import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const gameBuild=process.env.PAL_GAME_BUILD||"24467282";
const source=path.resolve(process.argv[2]||path.join(root,"private","extracted",`build-${gameBuild}-health`));
const expectedMappingHash="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851";
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public/data/items.json"),"utf8"));
const ui=JSON.parse(fs.readFileSync(path.join(source,"ui-common.raw.json"),"utf8"));
const itemDescriptions=JSON.parse(fs.readFileSync(path.join(source,"item-descriptions.raw.json"),"utf8"));
const workerEventRows=JSON.parse(fs.readFileSync(path.join(source,"health-worker-events.raw.json"),"utf8"));
const sicknessRows=JSON.parse(fs.readFileSync(path.join(source,"health-sickness.raw.json"),"utf8"));
const classDefaults=JSON.parse(fs.readFileSync(path.join(source,"health-worker-event-class-defaults.raw.json"),"utf8"));
const manifest=JSON.parse(fs.readFileSync(path.join(source,"health-manifest.json"),"utf8"));
const locales={"en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"};
const eventSpecs={
  DodgeWork:{slug:"slacking-off",category:"rest",comment:"COMMON_WORKER_PAL_COMMENT_DodgeWork"},
  DodgeWork_Short:{slug:"short-break",category:"rest",comment:"COMMON_WORKER_PAL_COMMENT_DodgeWork_Short"},
  DodgeWork_Sleep:{slug:"idling",category:"rest",comment:"COMMON_WORKER_PAL_COMMENT_DodgeWork_Sleep"},
  EatTooMuch:{slug:"overeating-event",category:"disruptive",comment:"COMMON_WORKER_PAL_COMMENT_EatTooMuch"},
  TurnFoodBox:{slug:"destroying-feed-box",category:"disruptive"},
  Trantrum:{slug:"rioting",category:"disruptive",comment:"COMMON_WORKER_PAL_COMMENT_Trantrum"},
  Sick:{slug:"sickness-event",category:"illness"},
};
const conditionSpecs=[
  ["sick","Cold","illness",1,"low-grade-medical-supplies"],
  ["sprain","Sprain","injury",1,"low-grade-medical-supplies"],
  ["overfull","Bulimia","eating",1,"low-grade-medical-supplies"],
  ["ulcer","GastricUlcer","illness",2,"medical-supplies"],
  ["fracture","Fracture","injury",2,"medical-supplies"],
  ["weakened","Weakness","illness",3,"high-grade-medical-supplies"],
  ["depressed","DepressionSprain","mental",3,"high-grade-medical-supplies"],
];
const medicineSpecs=[
  ["low-grade-medical-supplies","Herbs",1,["sick","sprain","overfull"]],
  ["medical-supplies","Medicines",2,["ulcer","fracture"]],
  ["high-grade-medical-supplies","LuxuryMedicines",3,["weakened","depressed"]],
];

if(String(itemData.meta.gameBuild)!==gameBuild||manifest.schema!==1||manifest.mode!=="health"||manifest.mappingHash!==expectedMappingHash)throw new Error("Health extraction does not match the verified build mapping");
if(manifest.localeCount!==17||manifest.workerEventRowCount!==11||manifest.sicknessRowCount!==9||manifest.workerEventClassCount!==11||manifest.workerEventClassFailureCount!==0)throw new Error("Health extraction counts drifted from the verified source");
if(Object.keys(workerEventRows).length!==11||Object.keys(sicknessRows).length!==9||classDefaults.requestedClassCount!==11||classDefaults.failedClassCount!==0)throw new Error("Health source tables are incomplete");

const localized=(key)=>Object.fromEntries(Object.entries(locales).map(([locale,sourceLocale])=>{
  const value=String(ui[sourceLocale]?.[key]||"").trim();
  if(!value)throw new Error(`Missing UI localization: ${key} ${sourceLocale}`);
  return [locale,value];
}));
const items=new Map(itemData.items.map(item=>[item.id,item]));
const recipes=new Map(itemData.recipes.map(recipe=>[recipe.productId,recipe]));
const resolveMarkup=(value,sourceLocale)=>{
  let result=String(value||"")
    .replace(/<img[^>]*\/?>/g,"")
    .replace(/<itemName id=\|([^|]+)\|[^>]*\/>/g,(_,id)=>items.get(id)?.names?.[Object.entries(locales).find(([,candidate])=>candidate===sourceLocale)?.[0]]||"")
    .replace(/<uiCommon id=\|([^|]+)\|[^>]*\/>/g,(_,key)=>ui[sourceLocale]?.[key]||"")
    .replace(/\r\n/g,"\n")
    .trim();
  if(!result||/<[^>]*>|\|/.test(result))throw new Error(`Unresolved localized markup for ${sourceLocale}: ${value}`);
  return result;
};

const activeSourceEvents=Object.entries(workerEventRows).filter(([,row])=>row.Invalid===false);
if(activeSourceEvents.length!==7||activeSourceEvents.some(([id])=>!eventSpecs[id])||Object.keys(eventSpecs).some(id=>!activeSourceEvents.some(([sourceId])=>sourceId===id)))throw new Error("Active worker-event set drifted from the verified source");
const behaviors=activeSourceEvents.map(([id,row],order)=>{
  if(!Number.isInteger(row.TriggerSanity)||row.TriggerSanity<0||row.TriggerSanity>100)throw new Error(`Invalid SAN source value: ${id}`);
  const spec=eventSpecs[id],names=localized(`BASECAMP_EVENT_TYPE_${id}`);
  return {slug:spec.slug,sourceId:id,category:spec.category,order,names,descriptions:spec.comment?localized(spec.comment):names,sanValue:row.TriggerSanity,sourceValueVerified:true,triggerSelectionVerified:false,verification:"game-files-data-table-and-localization"};
});

const conditions=conditionSpecs.map(([slug,key,category,rank,medicine])=>{
  const row=sicknessRows[key];
  if(!row||row.EffectiveItemRank!==rank)throw new Error(`Sickness treatment rank drifted: ${key}`);
  for(const field of ["WorkSpeed","MoveSpeed","SatietyDecrease","RecoveryProbabilityPercentageInPalBox"])if(typeof row[field]!=="number")throw new Error(`Sickness source value missing: ${key}.${field}`);
  return {slug,sourceId:key,category,medicine,effectiveItemRank:rank,names:localized(`COMMON_CONDITION_NAME_${key}`),descriptions:localized(`COMMON_CONDITION_DESC_${key}`),effects:{workSpeed:row.WorkSpeed,moveSpeed:row.MoveSpeed,satietyDecrease:row.SatietyDecrease,palBoxRecovery:row.RecoveryProbabilityPercentageInPalBox,sourceValuesVerified:true,runtimeApplicationVerified:false},verification:"game-files-data-table-and-localization"};
});
if(sicknessRows.NoneSick?.EffectiveItemRank!==0||sicknessRows.DisturbingElement?.EffectiveItemRank!==4)throw new Error("Special sickness rows drifted from the verified source");

const medicines=medicineSpecs.map(([slug,id,rank,cures])=>{
  const item=items.get(id),recipe=recipes.get(id);
  if(!item||!recipe)throw new Error(`Missing medicine or recipe: ${id}`);
  if(!conditions.filter(condition=>condition.effectiveItemRank===rank).every(condition=>cures.includes(condition.slug)))throw new Error(`Medicine cure relation drifted: ${id}`);
  const descriptions=Object.fromEntries(Object.entries(locales).map(([locale,sourceLocale])=>[locale,resolveMarkup(itemDescriptions[sourceLocale]?.[`ITEM_DESC_${id}`],sourceLocale)]));
  return {slug,itemId:id,effectiveItemRank:rank,names:item.names,descriptions,image:`/assets/items/${id}.webp`,cures,healthRestoration:0,recipe:{output:recipe.output,workAmount:recipe.workAmount,ingredients:recipe.ingredients.map(ingredient=>{const related=items.get(ingredient.itemId);if(!related)throw new Error(`Missing ingredient: ${ingredient.itemId}`);return {itemId:ingredient.itemId,names:related.names,image:related.image?`/assets/items/${ingredient.itemId}.webp`:null,count:ingredient.count};})},verification:"game-files-item-description-and-recipe"};
});

const data={meta:{schema:2,gameBuild:String(itemData.meta.gameBuild),localeCount:Object.keys(locales).length,behaviorCount:behaviors.length,conditionCount:conditions.length,medicineCount:medicines.length,excludedSpecialConditionCount:1,verification:"game-files",sourceValuesVerified:true,runtimeApplicationVerified:false},san:{names:localized("COMMON_STATUS_SANITY_TITLE"),descriptions:localized("COMMON_STATUS_SANITY_DESC"),behaviors,sourceValuesVerified:true,triggerSelectionVerified:false,verification:"game-files-data-table-and-localization"},conditions,medicines};
for(const condition of conditions)for(const locale of Object.keys(locales))if(!condition.names[locale]||!condition.descriptions[locale])throw new Error(`Missing ${condition.slug} ${locale}`);
const output=JSON.stringify(data);fs.writeFileSync(path.join(root,"public/data/health.json"),output);
const provenanceDirectory=path.join(root,"private/provenance");fs.mkdirSync(provenanceDirectory,{recursive:true});
fs.writeFileSync(path.join(provenanceDirectory,"health.json"),JSON.stringify({schema:2,gameBuild:data.meta.gameBuild,sourceDirectory:path.relative(root,source),mappingHash:manifest.mappingHash,sourceManifestSha256:crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),outputSha256:crypto.createHash("sha256").update(output).digest("hex"),verification:{workerEventRows:11,activeWorkerEvents:behaviors.length,sicknessRows:9,publishedConditions:conditions.length,excludedSpecialConditions:1,medicines:medicines.length,localeCount:Object.keys(locales).length,sourceValuesVerified:true,runtimeApplicationVerified:false,conditionText:"direct-localization",treatmentRelations:"effective-item-rank-and-official-item-description",recipes:"direct-data-table"}},null,2));
console.log(`Wrote ${behaviors.length} SAN behaviors, ${conditions.length} conditions and ${medicines.length} medicines.`);
