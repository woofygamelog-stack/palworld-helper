import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const source=path.resolve(process.env.PAL_EXPEDITION_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-expeditions`));
const outputFile=path.join(root,"public","data","expeditions.json");
const outputImageDirectory=path.join(root,"public","assets","expeditions");
const provenanceDirectory=path.join(root,"private","provenance");
const expectedMappingHash="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851";
const locales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
const localeMap={"en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"};

const read=name=>JSON.parse(fs.readFileSync(path.join(source,name),"utf8"));
const manifest=read("expedition-manifest.json");
const rawMissions=read("expeditions.raw.json");
const rawChallenges=read("expedition-challenges.raw.json");
const rawFieldLotteries=read("field-lottery-names.raw.json");
const rawItemLottery=read("item-lottery.raw.json");
const rawText=read("expedition-text.raw.json");
const rawImageSources=read("expedition-image-sources.raw.json");
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8"));
const elementData=JSON.parse(fs.readFileSync(path.join(root,"public","data","elements.json"),"utf8"));
const structureData=JSON.parse(fs.readFileSync(path.join(root,"public","data","structures.json"),"utf8"));
const technologyData=JSON.parse(fs.readFileSync(path.join(root,"public","data","technology.json"),"utf8"));

if(manifest.schema!==1||manifest.mode!=="expedition"||manifest.mappingHash!==expectedMappingHash||manifest.missionRowCount!==18||manifest.challengeRowCount!==18||manifest.stageImageCount!==9||manifest.localeCount!==17)throw new Error("Expedition extraction manifest mismatch");
if(itemData.meta.gameBuild!==gameBuild||elementData.meta.gameBuild!==gameBuild||structureData.meta.gameBuild!==gameBuild||technologyData.meta.gameBuild!==gameBuild)throw new Error("Expedition joins use mixed game builds");
if(!structureData.structures.some(entry=>entry.slug==="pal-expedition-station")||!technologyData.technologies.some(entry=>entry.slug==="pal-expedition-station"))throw new Error("Pal Expedition Station relation is missing");

const slugByRow={
  Dungeon_Grass:"verdant-hollow",
  Dungeon_Forest:"secret-realm-of-the-forest",
  Dungeon_Volcano:"blazing-cavern",
  Dungeon_Desert:"hidden-sanctum-of-the-desert",
  Dungeon_Snow:"astral-frost-cavern",
  Dungeon_Sakurajima:"celestial-sakura-cavern",
  Dungeon_DarkIsland:"dark-cave-of-feybreak",
  Dungeon_SkyIsland:"sunreach-isle",
  Dungeon_WorldTree:"world-tree-subterranean-city-ruins",
  Dungeon_GrassHard:"rayne-syndicate-smuggling-warehouse",
  Dungeon_ForestHard:"free-pal-alliance-illicit-trading-post",
  Dungeon_VolcanoHard:"eternal-pyre-forbidden-market",
  Dungeon_DesertHard:"pidf-illegal-factory",
  Dungeon_SnowHard:"pal-genetic-research-laboratory",
  Dungeon_SakurajimaHard:"moonflower-secret-hideout",
  Dungeon_DarkIslandHard:"ancient-feybreak-ruins",
  Dungeon_SkyIslandHard:"sunreach-dragon-husk",
  Dungeon_WorldTreeHard:"world-tree-forbidden-area"
};
const textureByEnum={Grass:{slug:"grass",image:"00"},Forest:{slug:"forest",image:"01"},Volcano:{slug:"volcano",image:"03"},Desert:{slug:"desert",image:"02"},Snow:{slug:"snow",image:"04"},Sakurajima:{slug:"sakurajima",image:"05"},DarkIsland:{slug:"dark-island",image:"06"},SkyIsland:{slug:"sky-island",image:"07"},WorldTree:{slug:"world-tree",image:"08"}};
const elementByEnum={Leaf:"grass",Fire:"fire",Earth:"ground",Ice:"ice",Water:"water",Dark:"dark",Dragon:"dragon",Normal:"neutral",None:null};
const difficultyByEnum={Easy:"easy",Normal:"normal",Hard:"hard",VeryHard:"very-hard"};
const bossRegionByEnum={GrassBoss:"grass",ForestBoss:"forest",ElectricBoss:"volcano",DesertBoss:"desert",SnowBoss:"snow",SakurajimaBoss:"sakurajima",VikingBoss:"dark-island",SorajimaBoss:"sky-island",WorldTreeBoss:"world-tree"};
const enumTail=value=>String(value).split("::").at(-1);
const itemsById=new Map(itemData.items.map(item=>[item.id,item]));
const validElementSlugs=new Set(elementData.elements.map(element=>element.slug));
const rewardsByField=new Map();
for(const row of Object.values(rawItemLottery)){
  if(!String(row.FieldName||"").startsWith("Expedition_"))continue;
  if(!itemsById.has(row.StaticItemId))throw new Error(`Unknown expedition reward item ${row.StaticItemId}`);
  if(!Number.isInteger(row.SlotNo)||row.SlotNo<1||!Number.isFinite(row.WeightInSlot)||row.WeightInSlot<=0||!Number.isInteger(row.MinNum)||!Number.isInteger(row.MaxNum)||row.MinNum<0||row.MaxNum<row.MinNum)throw new Error(`Invalid expedition reward row for ${row.FieldName}`);
  const entries=rewardsByField.get(row.FieldName)||[];
  entries.push({slot:row.SlotNo,itemId:row.StaticItemId,minCount:row.MinNum,maxCount:row.MaxNum,selectionWeight:row.WeightInSlot});
  rewardsByField.set(row.FieldName,entries);
}

const missionEntries=Object.entries(rawMissions);
if(missionEntries.length!==18||Object.keys(slugByRow).length!==18||missionEntries.some(([rowId])=>!slugByRow[rowId]))throw new Error("Expedition public slug mapping drifted");
const rowOrder=new Map(missionEntries.map(([rowId],index)=>[rowId,index]));
const localizedNames=textId=>Object.fromEntries(locales.map(locale=>{
  const sourceLocale=localeMap[locale],value=rawText[sourceLocale]?.[textId];
  if(typeof value!=="string"||!value.trim())throw new Error(`Missing ${locale} expedition name ${textId}`);
  return [locale,value.trim()];
}));
const condition=value=>{
  if(!value||value==="None")return null;
  const source=rawChallenges[value];
  if(!source)throw new Error(`Missing expedition condition ${value}`);
  const bossType=enumTail(source.DefeatBossType),regionSlug=bossRegionByEnum[bossType],difficulty=enumTail(source.DefeatBossDifficulty).toLowerCase();
  if(!regionSlug||!textureByEnum[Object.keys(textureByEnum).find(key=>textureByEnum[key].slug===regionSlug)])throw new Error(`Unknown expedition boss region ${bossType}`);
  if(!["normal","hard"].includes(difficulty)||!Number.isInteger(source.DefeatHardBossNum)||source.DefeatHardBossNum<0)throw new Error(`Invalid expedition condition ${value}`);
  return {kind:"boss",regionSlug,difficulty,hardBossCount:source.DefeatHardBossNum};
};

const expeditions=missionEntries.map(([rowId,row])=>{
  const textureType=enumTail(row.TextureType),texture=textureByEnum[textureType];
  const difficulty=difficultyByEnum[enumTail(row.Difficulty)],elementSlug=elementByEnum[enumTail(row.RequiredElementType)];
  if(!texture||!difficulty||elementSlug===undefined||elementSlug&&!validElementSlugs.has(elementSlug))throw new Error(`Unknown expedition enum in ${rowId}`);
  const rewardRows=rewardsByField.get(row.ItemFieldLotteryName)||[],field=rawFieldLotteries[row.ItemFieldLotteryName];
  if(!field||rewardRows.length===0)throw new Error(`Missing reward pool ${row.ItemFieldLotteryName}`);
  const slots=[...new Set(rewardRows.map(reward=>reward.slot))].sort((a,b)=>a-b).map(slot=>{
    const chance=field[`ItemSlot${slot}_ProbabilityPercent`];
    if(chance!==100)throw new Error(`Unexpected expedition slot chance ${row.ItemFieldLotteryName} slot ${slot}: ${chance}`);
    return {slot,candidates:rewardRows.filter(reward=>reward.slot===slot).sort((a,b)=>b.selectionWeight-a.selectionWeight||a.itemId.localeCompare(b.itemId))};
  });
  return {
    slug:slugByRow[rowId],
    names:localizedNames(row.TitleTextId),
    order:rowOrder.get(rowId),
    variant:rowId.endsWith("Hard")?"hard":"standard",
    difficulty,
    baseDurationSeconds:row.RequiredSeconds,
    recommendedStrength:row.RecommendedStrength,
    maxPalCount:row.MaxCharacterNum,
    requiredElementSlug:elementSlug,
    requiredElementCount:elementSlug?row.RequiredElementNum:null,
    image:`/assets/expeditions/${texture.slug}.webp`,
    imageRegionSlug:texture.slug,
    visibilityCondition:condition(row.ReleaseCondition),
    challengeCondition:condition(row.ChallengeCondition),
    rewardSlots:slots,
    summary:{rewardSlotCount:slots.length,rewardItemCandidateCount:rewardRows.length,uniqueRewardItemCount:new Set(rewardRows.map(reward=>reward.itemId)).size}
  };
});

const rewardRows=expeditions.flatMap(expedition=>expedition.rewardSlots.flatMap(slot=>slot.candidates));
const publicSlugs=new Set(expeditions.map(expedition=>expedition.slug));
if(publicSlugs.size!==18||expeditions.some(expedition=>Object.keys(expedition.names).length!==17||expedition.order<0||expedition.baseDurationSeconds<=0||expedition.recommendedStrength<=0||expedition.maxPalCount<=0||!expedition.challengeCondition))throw new Error("Normalized expedition baseline drifted");
if(rewardRows.length!==279||new Set(rewardRows.map(reward=>reward.itemId)).size!==75)throw new Error("Expedition reward baseline drifted");

fs.mkdirSync(outputImageDirectory,{recursive:true});
for(const [textureType,{slug,image}] of Object.entries(textureByEnum)){
  const sourceFile=path.join(source,"expedition-images",`stage-${image}.webp`),target=path.join(outputImageDirectory,`${slug}.webp`),sourceInfo=rawImageSources[image];
  if(!fs.existsSync(sourceFile)||!sourceInfo||sourceInfo.width!==1080||sourceInfo.height!==100||sourceInfo.provenance!=="direct")throw new Error(`Expedition image validation failed for ${textureType}`);
  fs.copyFileSync(sourceFile,target);
}

const generatedAt=manifest.extractedAt;
const payload={
  meta:{schema:1,gameBuild,generatedAt,verification:"game-files",localeCount:17,expeditionCount:18,standardCount:9,hardCount:9,rewardSlotCount:expeditions.reduce((sum,entry)=>sum+entry.rewardSlots.length,0),rewardRowCount:279,uniqueRewardItemCount:75,rewardContentsVerified:true,rewardQuantitiesVerified:true,probabilitiesVerified:false,durationFormulaVerified:false,imageProvenance:{direct:9,sharedAssignments:18,missing:0}},
  station:{structureSlug:"pal-expedition-station",technologySlug:"pal-expedition-station"},
  expeditions
};
fs.mkdirSync(path.dirname(outputFile),{recursive:true});
fs.writeFileSync(outputFile,JSON.stringify(payload));
fs.mkdirSync(provenanceDirectory,{recursive:true});
const rawFiles=["expeditions.raw.json","expedition-challenges.raw.json","field-lottery-names.raw.json","item-lottery.raw.json","expedition-text.raw.json","expedition-image-sources.raw.json","expedition-manifest.json"];
fs.writeFileSync(path.join(provenanceDirectory,"expeditions.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"Palworld character-team mission, challenge-condition, field-lottery, item-lottery, localized-text, and directly referenced UI texture data extracted read-only from installed game files",sourceDirectory:path.relative(root,source),mappingHash:manifest.mappingHash,hashes:Object.fromEntries(rawFiles.map(file=>[file,crypto.createHash("sha256").update(fs.readFileSync(path.join(source,file))).digest("hex")])),verification:{expeditionCount:18,standardCount:9,hardCount:9,rewardRowCount:279,uniqueRewardItemCount:75,localeCoverage:Object.fromEntries(locales.map(locale=>[locale,expeditions.filter(entry=>entry.names[locale]).length])),publicSlugsUnique:true,rewardReferencesValid:true,imageCoverage:{directAssets:9,sharedAssignments:18,missing:0}},publicationBoundary:{probabilitiesOmitted:"The field and item lottery rows are verified, but the complete runtime reward-rate and slot-selection calculation is not independently verified.",effectiveDurationOmitted:"The base duration is verified, but the team-strength curve and research modifiers are not independently verified.",bossNamesOmitted:"Challenge-condition boss enums are normalized to expedition regions; internal enum names are not published."}},null,2));
console.log(`Imported ${payload.meta.expeditionCount} expeditions, ${payload.meta.rewardSlotCount} reward slots, ${payload.meta.rewardRowCount} reward candidates, and ${payload.meta.uniqueRewardItemCount} unique reward items.`);
