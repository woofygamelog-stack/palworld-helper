import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const source=path.resolve(process.env.PAL_TECHNOLOGY_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-technology`));
const outputFile=path.join(root,"public","data","technology.json");
const outputImageDirectory=path.join(root,"public","assets","technology");
const provenanceDirectory=path.join(root,"private","provenance");
const localeMap={"en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"};
const expectedLocales=Object.keys(localeMap);
const rawFiles=["technology.raw.json","lab-research.raw.json","technology-names.raw.json","technology-descriptions.raw.json","item-descriptions.raw.json","lab-research-text.raw.json","build-object-names.raw.json","build-object-descriptions.raw.json","build-objects.raw.json","map-object-master.raw.json","ui-common.raw.json","technology-building-icon-sources.raw.json","technology-manifest.json"];
if(!fs.existsSync(source))throw new Error(`Technology extraction source is missing: ${source}`);
const bytes=Object.fromEntries(rawFiles.map(file=>[file,fs.readFileSync(path.join(source,file))]));
const read=file=>JSON.parse(bytes[file].toString("utf8"));

const rawTechnology=read("technology.raw.json");
const rawResearch=read("lab-research.raw.json");
const technologyNames=read("technology-names.raw.json");
const technologyDescriptions=read("technology-descriptions.raw.json");
const itemDescriptions=read("item-descriptions.raw.json");
const researchText=read("lab-research-text.raw.json");
const buildObjectNames=read("build-object-names.raw.json");
const buildObjectDescriptions=read("build-object-descriptions.raw.json");
const buildObjects=read("build-objects.raw.json");
const mapObjectMaster=read("map-object-master.raw.json");
const uiCommon=read("ui-common.raw.json");
const buildingIconManifest=read("technology-building-icon-sources.raw.json");
const extractionManifest=read("technology-manifest.json");
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8"));
const palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8"));

if(gameBuild!=="24181527"||itemData.meta.gameBuild!==gameBuild||palData.meta.gameBuild!==gameBuild)throw new Error("Technology, item, and Pal data builds must match the accepted build 24181527.");
if(extractionManifest.mappingHash!=="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851")throw new Error("Technology extraction mapping hash is not the accepted build-compatible USMAP.");
if(extractionManifest.technologyRowCount!==588||buildingIconManifest.expectedBuildingTechnologyCount!==217||buildingIconManifest.exportedCount!==217||buildingIconManifest.failedCount!==0)throw new Error("Technology extraction baseline drifted.");

const placeholder=value=>!String(value||"").trim()||/^[a-z-]{2,5}[_ ]text$/i.test(String(value).trim());
const foldedMap=values=>new Map(Object.entries(values).map(([key,value])=>[key.toLocaleLowerCase("en-US"),[key,value]]));
const localizedTables=sourceTables=>Object.fromEntries(Object.entries(localeMap).map(([locale,rawLocale])=>[locale,foldedMap(sourceTables[rawLocale]||{})]));
const technologyNameTables=localizedTables(technologyNames);
const technologyDescriptionTables=localizedTables(technologyDescriptions);
const itemDescriptionTables=localizedTables(itemDescriptions);
const researchTextTables=localizedTables(researchText);
const buildObjectNameTables=localizedTables(buildObjectNames);
const buildObjectDescriptionTables=localizedTables(buildObjectDescriptions);
const uiCommonTables=localizedTables(uiCommon);
const getLocalized=(tables,locale,key)=>tables[locale]?.get(String(key||"").toLocaleLowerCase("en-US"))?.[1]||"";

const itemsById=new Map(itemData.items.map(item=>[item.id,item]));
const itemsByFolded=new Map(itemData.items.map(item=>[item.id.toLocaleLowerCase("en-US"),item]));
const recipesByFolded=new Map(itemData.recipes.map(recipe=>[recipe.id.toLocaleLowerCase("en-US"),recipe]));
const palsByFolded=new Map(palData.pals.map(pal=>[pal.id.toLocaleLowerCase("en-US"),pal]));
const buildObjectsByFolded=foldedMap(buildObjects);
const mapObjectMasterByFolded=foldedMap(mapObjectMaster);
const researchByFolded=foldedMap(rawResearch);
const rawTechnologyByFolded=foldedMap(rawTechnology);

function resolveItem(value){
  const recipe=recipesByFolded.get(String(value).toLocaleLowerCase("en-US"));
  const productId=recipe?.productId||value;
  const item=itemsByFolded.get(String(productId).toLocaleLowerCase("en-US"));
  if(!item)throw new Error(`Technology references an unavailable legal item: ${value}`);
  return item;
}
function resolveBuildObject(value){
  const entry=buildObjectsByFolded.get(String(value).toLocaleLowerCase("en-US"));
  if(!entry)throw new Error(`Technology references an unavailable build object: ${value}`);
  return {id:entry[0],row:entry[1],master:mapObjectMasterByFolded.get(entry[0].toLocaleLowerCase("en-US"))?.[1]};
}
function buildObjectName(buildObject,locale){
  const override=buildObject.master?.OverrideNameMsgID;
  const keys=[override&&override!=="None"?override:"",`MAPOBJECT_NAME_${buildObject.id}`];
  return keys.map(key=>getLocalized(buildObjectNameTables,locale,key)).find(value=>!placeholder(value))||"";
}
function buildObjectDescription(buildObject,locale){
  const override=buildObject.row.OverrideDescMsgID;
  const keys=[override&&override!=="None"?override:"",`BUILDOBJECT_DESC_${buildObject.id}`];
  return keys.map(key=>getLocalized(buildObjectDescriptionTables,locale,key)).find(value=>!placeholder(value))||"";
}
function resolveInlineText(value,locale){
  let text=String(value||"");
  const replace=(pattern,resolver)=>{text=text.replace(pattern,(_match,id)=>resolver(id)||"")};
  replace(/<itemName\s+id=\|([^|]+)\|\s*\/>/gi,id=>itemsByFolded.get(id.toLocaleLowerCase("en-US"))?.names?.[locale]);
  replace(/<itemDescription\s+id=\|([^|]+)\|\s*\/>/gi,id=>itemsByFolded.get(id.toLocaleLowerCase("en-US"))?.descriptions?.[locale]);
  replace(/<mapObjectName\s+id=\|([^|]+)\|\s*\/>/gi,id=>{const entry=buildObjectsByFolded.get(id.toLocaleLowerCase("en-US"));return entry?buildObjectName({id:entry[0],row:entry[1],master:mapObjectMasterByFolded.get(entry[0].toLocaleLowerCase("en-US"))?.[1]},locale):""});
  replace(/<characterName\s+id=\|([^|]+)\|\s*\/>/gi,id=>palsByFolded.get(id.replace(/^BOSS_/i,"").toLocaleLowerCase("en-US"))?.names?.[locale]);
  replace(/<uiCommon\s+id=\|([^|]+)\|(?:\s+style=\|[^|]*\|)?\s*\/>/gi,id=>getLocalized(uiCommonTables,locale,id));
  text=text.replace(/<img\b[^>]*\/>/gi,"").replace(/<[^>]+>/g,"");
  return text.replace(/\|/g,"").replace(/\r\n/g,"\n").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function localizedEntityNames(entity){
  const names=Object.fromEntries(expectedLocales.map(locale=>[locale,entity.names[locale]]));
  if(Object.entries(names).some(([,value])=>placeholder(value)))throw new Error("An unlocked entity has incomplete official localization.");
  return names;
}
function localizedBuildNames(buildObject){
  const names=Object.fromEntries(expectedLocales.map(locale=>[locale,resolveInlineText(buildObjectName(buildObject,locale),locale)]));
  if(Object.entries(names).some(([,value])=>placeholder(value)))throw new Error(`Build object ${buildObject.id} has incomplete official localization.`);
  return names;
}
function slugify(value){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}

const derivedItemImageIds=new Set([
  "Accessory_AirDash1","Accessory_AirDash2","Accessory_AirDash3","Accessory_AquaResist_1","Accessory_AT_1","Accessory_CoolResist_1","Accessory_DarkResist_1","Accessory_defense_1","Accessory_DragonResist_1","Accessory_EarthResist_1","Accessory_FireResist_1","Accessory_HeatColdResist_1","Accessory_HeatResist_1","Accessory_HP_1","Accessory_IceResist_1","Accessory_JumpCount_Increase1","Accessory_JumpCount_Increase2","Accessory_LeafResist_1","Accessory_NormalResist_1","Accessory_ThunderResist_1","Accessory_WorkSpeed_1","Bow_Triple","HeadEquip001_purple","PalSphere","PalUpgradeStone","Shield_SF","SphereModule_Sniper","StirFriedVegetables",
  ...Array.from({length:5},(_,index)=>`AssaultRifle_Default${index+1}`),
  "Axe_Steal","Axe_Tier_00","Axe_Tier_01","Axe_Tier_02","Pickaxe_Steal","Pickaxe_Tier_00","Pickaxe_Tier_01","Pickaxe_Tier_02",
  ...Array.from({length:5},(_,index)=>index===0?"ClothArmor":`ClothArmor_${index+1}`),
  ...Array.from({length:5},(_,index)=>index===0?"FlameThrower":`FlameThrower_${index+1}`),
  ...Array.from({length:5},(_,index)=>`PalEgg_Normal_0${index+1}`),
  ...Array.from({length:5},(_,index)=>index===0?"PumpActionShotgun":`PumpActionShotgun_${index+1}`),
  "Spear","Spear_2","Spear_3",
  "WorkSuitability_AddTicket_Collection","WorkSuitability_AddTicket_Cool","WorkSuitability_AddTicket_Deforest","WorkSuitability_AddTicket_EmitFlame","WorkSuitability_AddTicket_GenerateElectricity","WorkSuitability_AddTicket_Handcraft","WorkSuitability_AddTicket_Mining","WorkSuitability_AddTicket_MonsterFarm","WorkSuitability_AddTicket_ProductMedicine","WorkSuitability_AddTicket_Seeding","WorkSuitability_AddTicket_Transport","WorkSuitability_AddTicket_Watering"
]);
if(derivedItemImageIds.size!==76)throw new Error("Accepted derived item-image provenance baseline drifted.");

const drafts=[];
for(const [order,[internalId,row]] of Object.entries(rawTechnology).entries()){
  const itemUnlocks=row.UnlockItemRecipes.map(resolveItem);
  const buildUnlocks=row.UnlockBuildObjects.map(resolveBuildObject);
  const unlocks=[
    ...itemUnlocks.map(item=>({kind:"item",names:localizedEntityNames(item)})),
    ...buildUnlocks.map(buildObject=>({kind:"building",names:localizedBuildNames(buildObject)}))
  ];
  if(!unlocks.length)throw new Error(`Technology ${internalId} has no verified unlock target.`);

  const names={};
  const descriptions={};
  for(const locale of expectedLocales){
    const template=getLocalized(technologyNameTables,locale,row.Name);
    let name=resolveInlineText(template,locale);
    if(placeholder(name))name=unlocks[0].names[locale];
    if(placeholder(name))throw new Error(`Technology ${internalId} has no official ${locale} display name.`);
    names[locale]=name;

    const technologyDescription=resolveInlineText(getLocalized(technologyDescriptionTables,locale,row.Description)||getLocalized(itemDescriptionTables,locale,row.Description),locale);
    const itemDescription=itemUnlocks.map(item=>resolveInlineText(item.descriptions[locale],locale)).find(value=>!placeholder(value));
    const buildingDescription=buildUnlocks.map(buildObject=>resolveInlineText(buildObjectDescription(buildObject,locale),locale)).find(value=>!placeholder(value));
    const description=[technologyDescription,itemDescription,buildingDescription].find(value=>!placeholder(value))||"";
    descriptions[locale]=description;
  }

  const category=itemUnlocks.length?"item":"building";
  const baseSlug=slugify(names["en-US"]);
  if(!baseSlug)throw new Error(`Technology ${internalId} has no safe public slug source.`);
  const labEntry=row.RequireResearchId!=="None"?researchByFolded.get(row.RequireResearchId.toLocaleLowerCase("en-US")):null;
  let labResearch;
  if(labEntry){
    const [researchId,researchRow]=labEntry;
    const researchNames=Object.fromEntries(expectedLocales.map(locale=>[locale,getLocalized(researchTextTables,locale,researchRow.TextId)]));
    if(Object.values(researchNames).some(placeholder))throw new Error(`Research ${researchId} has incomplete official localization.`);
    const materials=[];
    for(let index=1;index<=4;index++){
      const materialId=researchRow[`Material${index}_Id`],count=researchRow[`Material${index}_Count`];
      if(!materialId||materialId==="None"||!count)continue;
      const item=resolveItem(materialId);
      materials.push({names:localizedEntityNames(item),count});
    }
    const previous=researchRow.RequiredResearchId&&researchRow.RequiredResearchId!=="None"?researchByFolded.get(researchRow.RequiredResearchId.toLocaleLowerCase("en-US")):null;
    const previousNames=previous?Object.fromEntries(expectedLocales.map(locale=>[locale,getLocalized(researchTextTables,locale,previous[1].TextId)])):undefined;
    labResearch={names:researchNames,workAmount:researchRow.RequiredWorkAmount,materials,...(previousNames&&!Object.values(previousNames).some(placeholder)?{prerequisiteNames:previousNames}:{})};
  }else if(row.RequireResearchId!=="None")throw new Error(`Technology ${internalId} references unavailable research ${row.RequireResearchId}.`);

  drafts.push({internalId,row,baseSlug,names,descriptions,level:row.LevelCap,kind:row.IsBossTechnology?"ancient":"regular",pointCost:row.Cost,category,order,unlocks,towerBossRequired:row.RequireDefeatTowerBoss!=="EPalBossType::None",...(labResearch?{labResearch}:{})});
}

const slugGroups=new Map();
for(const draft of drafts){if(!slugGroups.has(draft.baseSlug))slugGroups.set(draft.baseSlug,[]);slugGroups.get(draft.baseSlug).push(draft)}
for(const [baseSlug,group] of slugGroups){
  if(group.length===1){group[0].slug=baseSlug;continue}
  for(const draft of group)draft.slug=`${baseSlug}-${draft.kind}-level-${draft.level}`;
  if(new Set(group.map(draft=>draft.slug)).size!==group.length)throw new Error(`Technology public slug collision requires an explicit mapping: ${baseSlug}`);
}
const draftsByInternalId=new Map(drafts.map(draft=>[draft.internalId.toLocaleLowerCase("en-US"),draft]));
for(const draft of drafts){
  if(draft.row.RequireTechnology!=="None"){
    const prerequisite=draftsByInternalId.get(draft.row.RequireTechnology.toLocaleLowerCase("en-US"));
    if(!prerequisite)throw new Error(`Technology ${draft.internalId} references unavailable prerequisite ${draft.row.RequireTechnology}.`);
    draft.prerequisite={slug:prerequisite.slug,names:prerequisite.names};
  }
  draft.dependents=drafts.filter(candidate=>candidate.row.RequireTechnology!=="None"&&candidate.row.RequireTechnology.toLocaleLowerCase("en-US")===draft.internalId.toLocaleLowerCase("en-US")).map(candidate=>({slug:candidate.slug,names:candidate.names}));
}

fs.mkdirSync(outputImageDirectory,{recursive:true});
const expectedImageFiles=new Set();
const imageProvenance={direct:0,"shared-official":0,"atlas-official":0,"derived-official":0,missing:0};
const provenanceBySlug={};
for(const draft of drafts){
  const fileName=`${draft.slug}.webp`;
  const target=path.join(outputImageDirectory,fileName);
  let sourceFile,provenance;
  if(draft.category==="building"){
    sourceFile=path.join(source,"technology-building-icons",`${draft.internalId}.webp`);
    provenance="direct";
  }else{
    const imageItem=resolveItem(draft.row.UnlockItemRecipes[0]);
    sourceFile=path.join(root,"public","assets","items",`${imageItem.id}.webp`);
    provenance=derivedItemImageIds.has(imageItem.id)?"derived-official":"shared-official";
  }
  if(!fs.existsSync(sourceFile)){imageProvenance.missing++;throw new Error(`Technology image source is missing for ${draft.internalId}`)}
  fs.copyFileSync(sourceFile,target);
  expectedImageFiles.add(fileName);
  imageProvenance[provenance]++;
  provenanceBySlug[draft.slug]={provenance};
  draft.image=true;
}
for(const file of fs.readdirSync(outputImageDirectory).filter(file=>file.endsWith(".webp")))if(!expectedImageFiles.has(file))fs.rmSync(path.join(outputImageDirectory,file));

const technologies=drafts.sort((left,right)=>left.level-right.level||left.order-right.order).map(({internalId,row,baseSlug,...technology})=>technology);
const technologyCount=technologies.length;
const regularCount=technologies.filter(technology=>technology.kind==="regular").length;
const ancientCount=technologies.filter(technology=>technology.kind==="ancient").length;
const prerequisiteCount=technologies.filter(technology=>technology.prerequisite).length;
const towerBossCount=technologies.filter(technology=>technology.towerBossRequired).length;
const researchCount=technologies.filter(technology=>technology.labResearch).length;
const levelMin=Math.min(...technologies.map(technology=>technology.level));
const levelMax=Math.max(...technologies.map(technology=>technology.level));
if(technologyCount!==588||regularCount!==537||ancientCount!==51||prerequisiteCount!==17||towerBossCount!==17||researchCount!==10||levelMin!==1||levelMax!==80)throw new Error("Normalized technology baseline drifted.");
if(new Set(technologies.map(technology=>technology.slug)).size!==technologyCount)throw new Error("Technology slugs are not unique.");
if(technologies.some(technology=>JSON.stringify(technology).includes("EPal")||JSON.stringify(technology).includes("NAME_RECIPE_")))throw new Error("Public technology data contains raw game identifiers.");

const generatedAt=new Date(extractionManifest.extractedAt).toISOString();
const output={meta:{schema:1,gameBuild,generatedAt,verification:"game-files",localeCount:expectedLocales.length,technologyCount,regularCount,ancientCount,prerequisiteCount,towerBossCount,researchCount,levelMin,levelMax,imageProvenance},technologies};
fs.writeFileSync(outputFile,JSON.stringify(output));
fs.mkdirSync(provenanceDirectory,{recursive:true});
fs.writeFileSync(path.join(provenanceDirectory,"technology.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"selected Palworld data tables, localized text, and directly referenced build-object textures extracted read-only from installed game files",sourceDirectory:path.relative(root,source),mappingHash:extractionManifest.mappingHash,hashes:Object.fromEntries(Object.entries(bytes).map(([file,value])=>[file,crypto.createHash("sha256").update(value).digest("hex")])),verification:{technologyCount,regularCount,ancientCount,prerequisiteCount,towerBossCount,researchCount,levelMin,levelMax,localeCounts:Object.fromEntries(expectedLocales.map(locale=>[locale,technologies.filter(technology=>technology.names[locale]).length])),imageProvenance,publicSlugsUnique:true,rawIdentifiersRemoved:true},images:provenanceBySlug},null,2));
console.log(JSON.stringify(output.meta,null,2));
