import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
const source=path.resolve(process.argv[2]||path.join(root,"private/extracted/build-24181527-technology"));
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public/data/items.json"),"utf8"));
const ui=JSON.parse(fs.readFileSync(path.join(source,"ui-common.raw.json"),"utf8"));
const itemDescriptions=JSON.parse(fs.readFileSync(path.join(source,"item-descriptions.raw.json"),"utf8"));
const manifest=JSON.parse(fs.readFileSync(path.join(source,"technology-manifest.json"),"utf8"));
const locales={"en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"};
const conditionSpecs=[
  ["sick","Cold","illness","low-grade-medical-supplies"],
  ["sprain","Sprain","injury","low-grade-medical-supplies"],
  ["overfull","Bulimia","eating","low-grade-medical-supplies"],
  ["ulcer","GastricUlcer","illness","medical-supplies"],
  ["fracture","Fracture","injury","medical-supplies"],
  ["weakened","Weakness","illness","high-grade-medical-supplies"],
  ["depressed","DepressionSprain","mental","high-grade-medical-supplies"],
];
const medicineSpecs=[
  ["low-grade-medical-supplies","Herbs",["sick","sprain","overfull"]],
  ["medical-supplies","Medicines",["ulcer","fracture"]],
  ["high-grade-medical-supplies","LuxuryMedicines",["weakened","depressed"]],
];
const localized=(key)=>Object.fromEntries(Object.entries(locales).map(([locale,sourceLocale])=>[locale,ui[sourceLocale]?.[key]||ui.en?.[key]||""]));
const items=new Map(itemData.items.map(item=>[item.id,item]));
const recipes=new Map(itemData.recipes.map(recipe=>[recipe.productId,recipe]));
const clean=(value,sourceLocale)=>String(value||"").replace(/<img[^>]*\/?>/g,"").replace(/<uiCommon id=\|([^|]+)\|[^>]*\/>/g,(_,key)=>ui[sourceLocale]?.[key]||ui.en?.[key]||"").replace(/<[^>]+>/g,"").replace(/\|/g,"").trim();
const conditions=conditionSpecs.map(([slug,key,category,medicine])=>({slug,category,medicine,names:localized(`COMMON_CONDITION_NAME_${key}`),descriptions:localized(`COMMON_CONDITION_DESC_${key}`),effects:{status:"qualitative-official-text",numericModifiers:null},verification:"game-files-localization"}));
const medicines=medicineSpecs.map(([slug,id,cures])=>{const item=items.get(id),recipe=recipes.get(id);if(!item||!recipe)throw new Error(`Missing medicine or recipe: ${id}`);return {slug,names:item.names,descriptions:Object.fromEntries(Object.entries(locales).map(([locale,sourceLocale])=>[locale,clean(itemDescriptions[sourceLocale]?.[`ITEM_DESC_${id}`],sourceLocale)||item.descriptions[locale]])),image:`/assets/items/${id}.webp`,cures,healthRestoration:0,recipe:{output:recipe.output,workAmount:recipe.workAmount,ingredients:recipe.ingredients.map(ingredient=>{const related=items.get(ingredient.itemId);if(!related)throw new Error(`Missing ingredient: ${ingredient.itemId}`);return {names:related.names,count:ingredient.count};})},verification:"game-files-item-description-and-recipe"};});
const data={meta:{schema:1,gameBuild:String(itemData.meta.gameBuild),localeCount:Object.keys(locales).length,conditionCount:conditions.length,medicineCount:medicines.length,verification:"game-files",numericEffectsVerified:false},san:{names:localized("COMMON_STATUS_SANITY_TITLE"),descriptions:localized("COMMON_STATUS_SANITY_DESC"),numericThresholds:null,verification:"game-files-localization"},conditions,medicines};
for(const condition of conditions)for(const locale of Object.keys(locales))if(!condition.names[locale]||!condition.descriptions[locale])throw new Error(`Missing ${condition.slug} ${locale}`);
const output=JSON.stringify(data);fs.writeFileSync(path.join(root,"public/data/health.json"),output);
const provenanceDirectory=path.join(root,"private/provenance");fs.mkdirSync(provenanceDirectory,{recursive:true});
fs.writeFileSync(path.join(provenanceDirectory,"health.json"),JSON.stringify({schema:1,gameBuild:data.meta.gameBuild,sourceDirectory:path.relative(root,source),mappingHash:manifest.mappingHash,outputSha256:crypto.createHash("sha256").update(output).digest("hex"),verification:{conditionCount:conditions.length,medicineCount:medicines.length,localeCount:Object.keys(locales).length,numericEffectsVerified:false,conditionText:"direct-localization",treatmentRelations:"official-item-description",recipes:"direct-data-table"}},null,2));
console.log(`Wrote ${conditions.length} conditions and ${medicines.length} medicines.`);
