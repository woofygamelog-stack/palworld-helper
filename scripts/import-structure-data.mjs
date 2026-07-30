import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root=process.cwd();
const gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const source=path.resolve(process.env.PAL_STRUCTURE_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-structures`));
const outputFile=path.join(root,"public","data","structures.json");
const outputImageDirectory=path.join(root,"public","assets","structures");
const outputAtlas=path.join(outputImageDirectory,"structures-atlas.webp");
const provenanceDirectory=path.join(root,"private","provenance");
const localeMap={"en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"};
const expectedLocales=Object.keys(localeMap);
const rawFiles=["technology.raw.json","build-objects.raw.json","build-object-icons.raw.json","map-object-master.raw.json","map-object-products.raw.json","map-object-farm-crops.raw.json","map-object-assign.raw.json","build-object-names.raw.json","build-object-descriptions.raw.json","build-object-categories.raw.json","ui-common.raw.json","structure-icon-sources.raw.json","structure-manifest.json"];
if(!fs.existsSync(source))throw new Error(`Structure extraction source is missing: ${source}`);
const bytes=Object.fromEntries(rawFiles.map(file=>[file,fs.readFileSync(path.join(source,file))]));
const read=file=>JSON.parse(bytes[file].toString("utf8"));

const rawTechnology=read("technology.raw.json");
const buildObjects=read("build-objects.raw.json");
const mapObjectMaster=read("map-object-master.raw.json");
const productRows=read("map-object-products.raw.json");
const farmCropRows=read("map-object-farm-crops.raw.json");
const assignRows=read("map-object-assign.raw.json");
const buildObjectNames=read("build-object-names.raw.json");
const buildObjectDescriptions=read("build-object-descriptions.raw.json");
const categoryText=read("build-object-categories.raw.json");
const uiCommon=read("ui-common.raw.json");
const iconManifest=read("structure-icon-sources.raw.json");
const extractionManifest=read("structure-manifest.json");
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8"));
const palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8"));
const technologyData=JSON.parse(fs.readFileSync(path.join(root,"public","data","technology.json"),"utf8"));

if(gameBuild!=="24181527"||itemData.meta.gameBuild!==gameBuild||palData.meta.gameBuild!==gameBuild||technologyData.meta.gameBuild!==gameBuild)throw new Error("Structure, item, Pal, and Technology data builds must match the accepted build 24181527.");
if(extractionManifest.mappingHash!=="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851")throw new Error("Structure extraction mapping hash is not the accepted build-compatible USMAP.");
if(extractionManifest.technologyRowCount!==588||extractionManifest.buildObjectRowCount!==498||extractionManifest.linkedBuildObjectCount!==472||extractionManifest.structureIconCount!==472||extractionManifest.productRowCount!==16||extractionManifest.farmCropRowCount!==18||extractionManifest.assignRowCount!==271||extractionManifest.localeCount!==17)throw new Error("Structure extraction baseline drifted.");
if(iconManifest.expectedStructureCount!==472||iconManifest.exportedCount!==472||iconManifest.failedCount!==0||Object.keys(iconManifest.errors).length!==0)throw new Error("Structure icon extraction baseline drifted.");

const placeholder=value=>!String(value||"").trim()||String(value).trim()==="-"||/^[a-z-]{2,7}[_ ]?text$/i.test(String(value).trim());
const foldedMap=values=>new Map(Object.entries(values).map(([key,value])=>[key.toLocaleLowerCase("en-US"),[key,value]]));
const localizedTables=sourceTables=>Object.fromEntries(Object.entries(localeMap).map(([locale,rawLocale])=>[locale,foldedMap(sourceTables[rawLocale]||{})]));
const buildObjectNameTables=localizedTables(buildObjectNames);
const buildObjectDescriptionTables=localizedTables(buildObjectDescriptions);
const categoryTables=localizedTables(categoryText);
const uiCommonTables=localizedTables(uiCommon);
const getLocalized=(tables,locale,key)=>tables[locale]?.get(String(key||"").toLocaleLowerCase("en-US"))?.[1]||"";
const buildObjectsByFolded=foldedMap(buildObjects);
const mapObjectMasterByFolded=foldedMap(mapObjectMaster);
const itemsByFolded=new Map(itemData.items.map(item=>[item.id.toLocaleLowerCase("en-US"),item]));
const palsByFolded=new Map(palData.pals.map(pal=>[pal.id.toLocaleLowerCase("en-US"),pal]));
const technologiesByOrder=new Map(technologyData.technologies.map(technology=>[technology.order,technology]));

function resolveItem(value){
  const item=itemsByFolded.get(String(value||"").toLocaleLowerCase("en-US"));
  if(!item)throw new Error(`Structure references an unavailable legal item: ${value}`);
  return item;
}
function resolveBuildObject(value){
  const entry=buildObjectsByFolded.get(String(value).toLocaleLowerCase("en-US"));
  if(!entry)throw new Error(`Technology references an unavailable build object: ${value}`);
  const mapObjectId=entry[1].MapObjectId||entry[0];
  const master=mapObjectMasterByFolded.get(String(mapObjectId).toLocaleLowerCase("en-US"))?.[1];
  if(!master)throw new Error(`Build object ${value} has no map-object master row.`);
  return {internalId:entry[0],row:entry[1],master};
}
function buildObjectName(buildObject,locale){
  const override=buildObject.master.OverrideNameMsgID;
  const keys=[override&&override!=="None"?override:"",`MAPOBJECT_NAME_${buildObject.internalId}`];
  return keys.map(key=>getLocalized(buildObjectNameTables,locale,key)).find(value=>!placeholder(value))||"";
}
function buildObjectDescription(buildObject,locale){
  const override=buildObject.row.OverrideDescMsgID;
  const keys=[override&&override!=="None"?override:"",`BUILDOBJECT_DESC_${buildObject.internalId}`];
  return keys.map(key=>getLocalized(buildObjectDescriptionTables,locale,key)).find(value=>!placeholder(value))||"";
}
function resolveInlineText(value,locale){
  let text=String(value||"");
  const replace=(pattern,resolver)=>{text=text.replace(pattern,(_match,id)=>resolver(id)||"")};
  replace(/<itemName\s+id=\|([^|]+)\|\s*\/>/gi,id=>itemsByFolded.get(id.toLocaleLowerCase("en-US"))?.names?.[locale]);
  replace(/<mapObjectName\s+id=\|([^|]+)\|\s*\/>/gi,id=>{const entry=buildObjectsByFolded.get(id.toLocaleLowerCase("en-US"));if(!entry)return "";return buildObjectName(resolveBuildObject(entry[0]),locale)});
  replace(/<characterName\s+id=\|([^|]+)\|\s*\/>/gi,id=>palsByFolded.get(id.replace(/^BOSS_/i,"").toLocaleLowerCase("en-US"))?.names?.[locale]);
  replace(/<uiCommon\s+id=\|([^|]+)\|(?:\s+style=\|[^|]*\|)?\s*\/>/gi,id=>getLocalized(uiCommonTables,locale,id));
  text=text.replace(/<img\b[^>]*\/>/gi,"").replace(/<[^>]+>/g,"");
  return text.replace(/\|/g,"").replace(/\r\n/g,"\n").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function localizedValues(resolver,label){
  const values=Object.fromEntries(expectedLocales.map(locale=>[locale,resolveInlineText(resolver(locale),locale)]));
  if(Object.values(values).some(placeholder))throw new Error(`${label} has incomplete official localization.`);
  return values;
}
function enumValue(value){return String(value||"").split("::").at(-1)||""}
function slugify(value){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}

const categoryOrder=["Product","Pal","Infrastructure","Food","Storage","Foundation","Defense","Light","Furniture","Other"];
const categorySlugs={Product:"production",Pal:"pal",Infrastructure:"infrastructure",Food:"food",Storage:"storage",Foundation:"foundations",Defense:"defenses",Light:"lighting",Furniture:"furniture",Other:"other"};
const linkedBuildObjectIds=[...new Set(Object.values(rawTechnology).flatMap(row=>row.UnlockBuildObjects||[]).filter(value=>value&&value!=="None"))];
if(linkedBuildObjectIds.length!==472)throw new Error("Technology-linked structure count drifted.");

const drafts=linkedBuildObjectIds.map((internalId,sourceOrder)=>{
  const buildObject=resolveBuildObject(internalId);
  if(buildObject.master.bInDevelop)throw new Error(`Technology-linked build object ${internalId} is marked in-development.`);
  const names=localizedValues(locale=>buildObjectName(buildObject,locale),`Build object ${internalId} name`);
  const descriptions=localizedValues(locale=>buildObjectDescription(buildObject,locale),`Build object ${internalId} description`);
  const categoryId=enumValue(buildObject.row.TypeA);
  const categorySlug=categorySlugs[categoryId];
  if(!categorySlug)throw new Error(`Build object ${internalId} has an unsupported category ${categoryId}.`);
  const categoryNames=localizedValues(locale=>getLocalized(categoryTables,locale,`CATEGORY_TYPE_A_${categoryId}`),`Build category ${categoryId}`);
  const subcategoryId=enumValue(buildObject.row.TypeUIDisplay);
  const subcategoryNames=localizedValues(locale=>getLocalized(categoryTables,locale,`CATEGORY_TYPE_UI_${subcategoryId}`),`Build subcategory ${subcategoryId}`);
  const subcategorySlug=slugify(subcategoryNames["en-US"]);
  if(!subcategorySlug)throw new Error(`Build subcategory ${subcategoryId} has no safe public slug.`);
  const materials=[];
  for(let index=1;index<=4;index++){
    const materialId=buildObject.row[`Material${index}_Id`],count=buildObject.row[`Material${index}_Count`];
    if(!materialId||materialId==="None"||!count)continue;
    materials.push({itemId:resolveItem(materialId).id,count});
  }
  if(materials.length===0)throw new Error(`Build object ${internalId} has no verified construction materials.`);
  const energyType=enumValue(buildObject.row.RequiredEnergyType);
  const energy=energyType==="None"?undefined:{kind:energyType.toLocaleLowerCase("en-US"),consumption:Number(buildObject.row.ConsumeEnergySpeed)||0};
  const productEntry=Object.entries(productRows).find(([key])=>key.toLocaleLowerCase("en-US")===internalId.toLocaleLowerCase("en-US"));
  const production=productEntry?{itemId:resolveItem(productEntry[1].Product_Id).id,workAmount:productEntry[1].RequiredWorkAmount,autoWorkPerSecond:productEntry[1].AutoWorkAmountBySec}:undefined;
  const blueprintItem=buildObject.row.BlueprintItemID&&buildObject.row.BlueprintItemID!=="None"?resolveItem(buildObject.row.BlueprintItemID):undefined;
  const restrictions={
    baseOnly:Boolean(buildObject.row.bIsInstallOnlyOnBase),
    indoorOnly:Boolean(buildObject.row.bIsInstallOnlyInDoor),
    palboxAreaOnly:Boolean(buildObject.row.bIsInstallOnlyHubAround),
    maxPerBase:Number(buildObject.row.InstallMaxNumInBaseCamp)||0,
    raidAreaProhibited:Boolean(buildObject.row.bIsProhibitedInRaidBossArea),
    maxInRaidArea:Number(buildObject.row.MaxBuildCountInRaidBossArea)||0,
    paintable:Boolean(buildObject.row.bIsPaintable)
  };
  const stats={
    ...(Number(buildObject.master.Hp)>0?{hp:Number(buildObject.master.Hp)}:{}),
    ...(Number(buildObject.master.Defense)>=0?{defense:Number(buildObject.master.Defense)}:{}),
    ...(Number(buildObject.master.DeteriorationDamage)>0?{deteriorationDamage:Number(buildObject.master.DeteriorationDamage)}:{})
  };
  const order=Number(buildObject.row.SortId);
  const rank=Number(buildObject.row.Rank);
  const baseSlug=slugify(names["en-US"]);
  if(!baseSlug)throw new Error(`Build object ${internalId} has no safe public slug source.`);
  return {internalId:buildObject.internalId,sourceOrder,baseSlug,names,descriptions,category:{slug:categorySlug,names:categoryNames},subcategory:{slug:subcategorySlug,names:subcategoryNames},order,rank,workAmount:Number(buildObject.row.RequiredBuildWorkAmount),materials,...(energy?{energy}:{}),...(production?{production}:{}),...(blueprintItem?{blueprintItemId:blueprintItem.id}:{}),restrictions,stats,technologies:[]};
});

const slugGroups=new Map();
for(const draft of drafts){if(!slugGroups.has(draft.baseSlug))slugGroups.set(draft.baseSlug,[]);slugGroups.get(draft.baseSlug).push(draft)}
for(const [baseSlug,group] of slugGroups){
  group.sort((left,right)=>left.order-right.order||left.sourceOrder-right.sourceOrder);
  if(group.length===1){group[0].slug=baseSlug;continue}
  group.forEach((draft,index)=>{draft.slug=`${baseSlug}-${draft.category.slug}-${index+1}`});
  if(new Set(group.map(draft=>draft.slug)).size!==group.length)throw new Error(`Structure public slug collision could not be resolved: ${baseSlug}`);
}
const draftsByInternalId=new Map(drafts.map(draft=>[draft.internalId.toLocaleLowerCase("en-US"),draft]));
for(const [order,[internalTechnologyId,row]] of Object.entries(rawTechnology).entries()){
  const technology=technologiesByOrder.get(order);
  if(!technology)throw new Error(`Public Technology order ${order} is unavailable.`);
  for(const buildObjectId of row.UnlockBuildObjects||[]){
    if(!buildObjectId||buildObjectId==="None")continue;
    const draft=draftsByInternalId.get(buildObjectId.toLocaleLowerCase("en-US"));
    if(!draft)throw new Error(`Technology ${internalTechnologyId} references an unavailable normalized structure.`);
    draft.technologies.push({slug:technology.slug,names:technology.names,level:technology.level,kind:technology.kind,pointCost:technology.pointCost});
  }
}
if(drafts.some(draft=>draft.technologies.length===0))throw new Error("Every published structure must have a verified Technology unlock relation.");

drafts.sort((left,right)=>categoryOrder.indexOf(enumValue(buildObjects[left.internalId].TypeA))-categoryOrder.indexOf(enumValue(buildObjects[right.internalId].TypeA))||left.order-right.order||left.names["en-US"].localeCompare(right.names["en-US"],"en-US")||left.sourceOrder-right.sourceOrder);
const atlasCellSize=128,atlasColumns=24,atlasRows=Math.ceil(drafts.length/atlasColumns);
fs.mkdirSync(outputImageDirectory,{recursive:true});
const atlasInputs=[];
const imageSources={};
for(const [index,draft] of drafts.entries()){
  const sourceFile=path.join(source,"structure-icons",`${draft.internalId}.webp`);
  if(!fs.existsSync(sourceFile))throw new Error(`Structure icon source is missing for ${draft.internalId}.`);
  const metadata=await sharp(sourceFile).metadata();
  if(!metadata.width||!metadata.height)throw new Error(`Structure icon has invalid dimensions for ${draft.internalId}.`);
  const input=await sharp(sourceFile).resize(atlasCellSize,atlasCellSize,{fit:"contain"}).ensureAlpha().png().toBuffer();
  atlasInputs.push({input,left:index%atlasColumns*atlasCellSize,top:Math.floor(index/atlasColumns)*atlasCellSize});
  draft.icon={index};
  imageSources[draft.slug]={provenance:"direct",sourceWidth:metadata.width,sourceHeight:metadata.height,sourceHash:crypto.createHash("sha256").update(fs.readFileSync(sourceFile)).digest("hex")};
}
await sharp({create:{width:atlasColumns*atlasCellSize,height:atlasRows*atlasCellSize,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(atlasInputs).webp({quality:88,effort:5}).toFile(outputAtlas);

const structures=drafts.map(({internalId,sourceOrder,baseSlug,...structure})=>structure);
const structureCount=structures.length;
const categoryCounts=Object.fromEntries(categoryOrder.map(categoryId=>[categorySlugs[categoryId],structures.filter(structure=>structure.category.slug===categorySlugs[categoryId]).length]));
const productionCount=structures.filter(structure=>structure.production).length;
const energyCount=structures.filter(structure=>structure.energy).length;
const materialRelationCount=structures.reduce((sum,structure)=>sum+structure.materials.length,0);
const technologyRelationCount=structures.reduce((sum,structure)=>sum+structure.technologies.length,0);
if(structureCount!==472||productionCount!==12||energyCount!==41||new Set(structures.map(structure=>structure.slug)).size!==structureCount)throw new Error("Normalized structure baseline drifted.");
const publicText=JSON.stringify(structures);
if(/EPal|BUILDOBJECT|MAPOBJECT|OverrideDesc|RequiredEnergyType|Material[1-4]_Id|[A-Z][A-Za-z]+_[A-Za-z0-9_]+\.webp/.test(publicText)||/<[^>]+>|\|/.test(publicText))throw new Error("Public structure data contains raw game identifiers, source fields, or unresolved markup.");

const generatedAt=new Date(extractionManifest.extractedAt).toISOString();
const atlas={path:"/assets/structures/structures-atlas.webp",cellSize:atlasCellSize,columns:atlasColumns,rows:atlasRows};
const output={meta:{schema:1,gameBuild,generatedAt,verification:"game-files",localeCount:expectedLocales.length,structureCount,categoryCounts,productionCount,energyCount,materialRelationCount,technologyRelationCount,imageProvenance:{direct:structureCount,"atlas-official":structureCount,missing:0},atlas},structures};
fs.mkdirSync(path.dirname(outputFile),{recursive:true});
fs.writeFileSync(outputFile,JSON.stringify(output));
fs.mkdirSync(provenanceDirectory,{recursive:true});
fs.writeFileSync(path.join(provenanceDirectory,"structures.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"selected Palworld build-object, technology, production, localized-text, and directly referenced texture data extracted read-only from installed game files",sourceDirectory:path.relative(root,source),mappingHash:extractionManifest.mappingHash,hashes:Object.fromEntries(Object.entries(bytes).map(([file,value])=>[file,crypto.createHash("sha256").update(value).digest("hex")])),verification:{structureCount,categoryCounts,productionCount,energyCount,materialRelationCount,technologyRelationCount,localeCounts:Object.fromEntries(expectedLocales.map(locale=>[locale,structures.filter(structure=>structure.names[locale]&&structure.descriptions[locale]).length])),publicSlugsUnique:true,rawIdentifiersRemoved:true,imageCoverage:{expected:structureCount,exported:structureCount,missing:0}},publicationBoundary:{publishedProductRows:productionCount,unlinkedProductRows:Object.keys(productRows).length-productionCount,farmCropRowsOmitted:Object.keys(farmCropRows).length,assignRowsOmitted:Object.keys(assignRows).length,storageCapacityOmitted:"The extracted BuildCapacity field is zero for every build object, so its storage semantics are not verified.",farmCropRelationOmitted:"Farm-crop rows do not contain a direct build-object foreign key in this extraction.",assignRelationOmitted:"Assign rows do not contain a direct build-object foreign key in this extraction."},images:imageSources},null,2));
console.log(JSON.stringify(output.meta,null,2));
