import fs from "node:fs";

const fail=message=>{throw new Error(`Expedition validation failed: ${message}`)};
const data=JSON.parse(fs.readFileSync("public/data/expeditions.json","utf8"));
const itemData=JSON.parse(fs.readFileSync("public/data/items.json","utf8"));
const elementData=JSON.parse(fs.readFileSync("public/data/elements.json","utf8"));
const structureData=JSON.parse(fs.readFileSync("public/data/structures.json","utf8"));
const technologyData=JSON.parse(fs.readFileSync("public/data/technology.json","utf8"));
const locales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
if(data.meta.schema!==1||data.meta.gameBuild!=="24181527"||data.meta.verification!=="game-files")fail("metadata baseline");
if(data.meta.localeCount!==17||data.meta.expeditionCount!==18||data.meta.standardCount!==9||data.meta.hardCount!==9)fail("entity counts");
if(data.meta.rewardRowCount!==279||data.meta.uniqueRewardItemCount!==75||data.meta.rewardContentsVerified!==true||data.meta.rewardQuantitiesVerified!==true||data.meta.probabilitiesVerified!==false||data.meta.durationFormulaVerified!==false)fail("verification boundary");
if(data.meta.imageProvenance.direct!==9||data.meta.imageProvenance.sharedAssignments!==18||data.meta.imageProvenance.missing!==0)fail("image coverage");
if(data.station.structureSlug!=="pal-expedition-station"||data.station.technologySlug!=="pal-expedition-station"||!structureData.structures.some(entry=>entry.slug===data.station.structureSlug)||!technologyData.technologies.some(entry=>entry.slug===data.station.technologySlug))fail("station relationships");
const itemIds=new Set(itemData.items.map(item=>item.id)),elementSlugs=new Set(elementData.elements.map(element=>element.slug)),slugs=new Set(),orders=new Set(),rewardItems=new Set();
let rewardRows=0,rewardSlots=0;
for(const expedition of data.expeditions){
  if(slugs.has(expedition.slug)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(expedition.slug)||expedition.slug.toLowerCase().includes("dungeon_"))fail(`public slug ${expedition.slug}`);slugs.add(expedition.slug);
  if(orders.has(expedition.order)||!Number.isInteger(expedition.order)||expedition.order<0)fail(`order ${expedition.slug}`);orders.add(expedition.order);
  if(Object.keys(expedition.names).length!==17||locales.some(locale=>typeof expedition.names[locale]!=="string"||!expedition.names[locale].trim()))fail(`locale coverage ${expedition.slug}`);
  if(!["standard","hard"].includes(expedition.variant)||!["easy","normal","hard","very-hard"].includes(expedition.difficulty)||expedition.baseDurationSeconds<=0||expedition.recommendedStrength<=0||expedition.maxPalCount<=0)fail(`core facts ${expedition.slug}`);
  if(expedition.requiredElementSlug!==null&&!elementSlugs.has(expedition.requiredElementSlug))fail(`element ${expedition.slug}`);
  if((expedition.requiredElementSlug===null&&expedition.requiredElementCount!==null)||(expedition.requiredElementSlug!==null&&(!Number.isInteger(expedition.requiredElementCount)||expedition.requiredElementCount<=0)))fail(`element count ${expedition.slug}`);
  if(typeof expedition.image!=="string"||!fs.existsSync(`public${expedition.image}`))fail(`image ${expedition.slug}`);
  for(const key of ["visibilityCondition","challengeCondition"]){const condition=expedition[key];if(condition===null){if(key==="challengeCondition")fail(`missing challenge condition ${expedition.slug}`);continue}if(condition.kind!=="boss"||!["normal","hard"].includes(condition.difficulty)||!Number.isInteger(condition.hardBossCount)||condition.hardBossCount<0)fail(`${key} ${expedition.slug}`)}
  const slotNumbers=new Set();for(const slot of expedition.rewardSlots){if(slotNumbers.has(slot.slot)||!Number.isInteger(slot.slot)||slot.slot<1||!slot.candidates.length)fail(`reward slot ${expedition.slug}`);slotNumbers.add(slot.slot);rewardSlots++;for(const candidate of slot.candidates){rewardRows++;rewardItems.add(candidate.itemId);if(!itemIds.has(candidate.itemId)||!Number.isInteger(candidate.minCount)||!Number.isInteger(candidate.maxCount)||candidate.minCount<0||candidate.maxCount<candidate.minCount||!Number.isFinite(candidate.selectionWeight)||candidate.selectionWeight<=0||"probability" in candidate)fail(`reward candidate ${expedition.slug}`)}}
  if(expedition.summary.rewardSlotCount!==slotNumbers.size||expedition.summary.rewardItemCandidateCount!==expedition.rewardSlots.reduce((sum,slot)=>sum+slot.candidates.length,0)||expedition.summary.uniqueRewardItemCount!==new Set(expedition.rewardSlots.flatMap(slot=>slot.candidates.map(candidate=>candidate.itemId))).size)fail(`summary ${expedition.slug}`);
}
if(slugs.size!==18||orders.size!==18||rewardRows!==279||rewardSlots!==data.meta.rewardSlotCount||rewardItems.size!==75)fail("aggregate counts");
const grass=data.expeditions.find(entry=>entry.slug==="verdant-hollow"),worldTreeHard=data.expeditions.find(entry=>entry.slug==="world-tree-forbidden-area");
if(!grass||grass.names["ko-KR"]!=="초원 동굴"||grass.baseDurationSeconds!==1800||grass.recommendedStrength!==25000||grass.requiredElementSlug!==null||grass.rewardSlots.find(slot=>slot.slot===1)?.candidates[0]?.itemId!=="AncientParts3"||grass.rewardSlots.find(slot=>slot.slot===1)?.candidates[0]?.minCount!==5||grass.rewardSlots.find(slot=>slot.slot===1)?.candidates[0]?.maxCount!==7)fail("Verdant Hollow golden record");
if(!worldTreeHard||worldTreeHard.difficulty!=="very-hard"||worldTreeHard.baseDurationSeconds!==7200||worldTreeHard.recommendedStrength!==2100000||worldTreeHard.rewardSlots.length!==8)fail("World Tree hard golden record");
console.log(`Validated ${data.meta.expeditionCount} expeditions, ${rewardSlots} reward slots, ${rewardRows} reward candidates, ${rewardItems.size} unique reward items, 17 locales, and 9 direct stage images without inferred probabilities.`);
