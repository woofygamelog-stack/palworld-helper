import {createHash} from "node:crypto";
import {mkdir,readFile,rename,unlink,writeFile} from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const gameBuild=process.env.PAL_GAME_BUILD||"24467282";
const source=path.resolve(process.env.PAL_QUEST_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-quests`));
const baseSource=path.resolve(process.env.PAL_EXTRACTED_DATA||path.join(root,"private","extracted",`build-${gameBuild}`));
const structureSource=path.resolve(process.env.PAL_STRUCTURE_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-structures`));
const outputPath=path.join(root,"public","data","quests.json");
const provenancePath=path.join(root,"private","provenance","quests.json");
const expectedMappingHash="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851";
const rawFiles=["quests.raw.json","quest-class-defaults.raw.json","quest-block-class-defaults.raw.json","quest-manager-defaults.raw.json","ui-common.raw.json","npc-talk-text.raw.json","quest-manifest.json"];
const bytes=Object.fromEntries(await Promise.all(rawFiles.map(async file=>[file,await readFile(path.join(source,file))])));
const read=file=>JSON.parse(bytes[file].toString("utf8"));
const rows=read("quests.raw.json"),classDump=read("quest-class-defaults.raw.json"),blockDump=read("quest-block-class-defaults.raw.json"),managerDump=read("quest-manager-defaults.raw.json"),ui=read("ui-common.raw.json"),talk=read("npc-talk-text.raw.json"),manifest=read("quest-manifest.json");
const buildObjectNames=JSON.parse(await readFile(path.join(structureSource,"build-object-names.raw.json"),"utf8"));
const itemNames=JSON.parse(await readFile(path.join(baseSource,"item-names.raw.json"),"utf8"));
const itemData=JSON.parse(await readFile(path.join(root,"public","data","items.json"),"utf8"));
const palData=JSON.parse(await readFile(path.join(root,"public","data","pals.json"),"utf8"));

if(gameBuild!=="24467282"||itemData.meta.gameBuild!==gameBuild||palData.meta.gameBuild!==gameBuild)throw new Error("Quest, item, and Pal data must share the accepted current build.");
if(manifest.schema!==2||manifest.mode!=="quest"||manifest.mappingHash!==expectedMappingHash||manifest.localeCount!==17||manifest.questRowCount!==120||manifest.questLocationRowCount!==166||manifest.questClassCount!==119||manifest.questClassFailureCount!==0||manifest.questBlockClassCount!==216||manifest.questBlockClassFailureCount!==0||manifest.questManagerFailureCount!==0)throw new Error("Quest extraction baseline or mapping is incompatible.");
if(classDump.failedClassCount!==0||blockDump.failedClassCount!==0||managerDump.error||!managerDump.defaults)throw new Error("Quest class-default extraction is incomplete.");

const localeMap={de:"de-DE",en:"en-US","es-MX":"es-419",es:"es-ES",fr:"fr-FR",id:"id-ID",it:"it-IT",ko:"ko-KR",pl:"pl-PL","pt-BR":"pt-BR",ru:"ru-RU",th:"th-TH",tr:"tr-TR",vi:"vi-VN","zh-Hans":"zh-CN","zh-Hant":"zh-TW",ja:"ja-JP"};
const siteLocales=Object.values(localeMap);
const itemByFolded=new Map(itemData.items.map(item=>[item.id.toLocaleLowerCase("en-US"),item]));
const palByFolded=new Map(palData.pals.map(pal=>[pal.id.toLocaleLowerCase("en-US"),pal]));
const normalizeClassPath=value=>String(value||"").replace(/^\/Game\//,"Pal/Content/").toLocaleLowerCase("en-US");
const classesByPath=new Map(Object.entries(classDump.classes).map(([key,value])=>[key.toLocaleLowerCase("en-US"),value]));
const blocksByPath=new Map(Object.entries(blockDump.classes).map(([key,value])=>[key.toLocaleLowerCase("en-US"),value]));
const classForRow=row=>classesByPath.get(normalizeClassPath(row?.QuestData?.AssetPathName));

const localizedEntityName=(entity,locale)=>entity?.names?.[locale]||entity?.names?.["en-US"]||"";
const hasFinalConsonant=value=>{const character=[...value].at(-1)||"",code=character.charCodeAt(0);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28!==0};
const hasRieulFinal=value=>{const character=[...value].at(-1)||"",code=character.charCodeAt(0);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28===8};
const koreanParticles=value=>String(value)
  .replace(/([가-힣])은\(는\)/g,(match,last)=>hasFinalConsonant(last)?`${last}은`:`${last}는`)
  .replace(/([가-힣])이\(가\)/g,(match,last)=>hasFinalConsonant(last)?`${last}이`:`${last}가`)
  .replace(/([가-힣])을\(를\)/g,(match,last)=>hasFinalConsonant(last)?`${last}을`:`${last}를`)
  .replace(/([가-힣])과\(와\)/g,(match,last)=>hasFinalConsonant(last)?`${last}과`:`${last}와`)
  .replace(/([가-힣])아\(야\)/g,(match,last)=>hasFinalConsonant(last)?`${last}아`:`${last}야`)
  .replace(/([가-힣])으\(로\)/g,(match,last)=>hasFinalConsonant(last)&&!hasRieulFinal(last)?`${last}으로`:`${last}로`);
const resolveMarkup=(value,rawLocale,siteLocale)=>{
  const resolved=String(value||"").replace(/<(itemName|characterName|mapObjectName)\s+id=\|?([^|/>]+)\|?\s*\/>/g,(_match,kind,sourceId)=>{
    if(kind==="itemName"){
      const item=itemByFolded.get(sourceId.toLocaleLowerCase("en-US"));
      if(item)return localizedEntityName(item,siteLocale);
      const extractedName=itemNames[rawLocale]?.[`ITEM_NAME_${sourceId}`];
      if(!extractedName)throw new Error(`Unknown quest item-name reference: ${sourceId}`);
      return extractedName;
    }
    if(kind==="characterName"){
      const pal=palByFolded.get(sourceId.toLocaleLowerCase("en-US"));
      if(!pal)throw new Error(`Unknown quest character-name reference: ${sourceId}`);
      return localizedEntityName(pal,siteLocale);
    }
    const name=buildObjectNames[rawLocale]?.[`MAPOBJECT_NAME_${sourceId}`];
    if(!name)throw new Error(`Unknown quest map-object reference: ${sourceId} (${rawLocale})`);
    return name;
  }).replace(/\r\n/g,"\n").replace(/\|/g,"").replace(/[ \t]+\n/g,"\n").trim();
  const normalized=rawLocale==="ko"?koreanParticles(resolved):resolved;
  if(/<[^>]+>|\||^[a-z-]{2,7}[_ ]?text$/i.test(normalized))throw new Error(`Unresolved quest text for ${rawLocale}: ${normalized}`);
  return normalized;
};
const localizedText=reference=>Object.fromEntries(Object.entries(localeMap).map(([rawLocale,siteLocale])=>{
  const value=ui[rawLocale]?.[reference]??talk[rawLocale]?.[reference];
  if(typeof value!=="string"||!value.trim())throw new Error(`Missing quest localization ${reference} for ${rawLocale}`);
  return [siteLocale,resolveMarkup(value,rawLocale,siteLocale)];
}));

const forceTracking=[...managerDump.defaults.ForceTrackingQuestMap].sort((a,b)=>a.Value-b.Value).map(entry=>entry.Key);
const branchQuestId="Main_CollectKeySpheres";
const branchParentId="Main_TalkGrassBoss";
const branchIndex=forceTracking.indexOf(branchParentId);
if(branchIndex<0||forceTracking.includes(branchQuestId))throw new Error("Quest manager branch insertion assumptions drifted.");
forceTracking.splice(branchIndex+1,0,branchQuestId);
if(forceTracking.length!==32||new Set(forceTracking).size!==32)throw new Error(`Expected 32 active main quests, found ${forceTracking.length}`);

const sideIds=Object.entries(rows).filter(([,row])=>row.QuestType==="EPalQuestType::Sub").filter(([,row])=>{const value=classForRow(row);return value?.QuestTitleMsgId&&value?.QuestDescriptionMsgId}).map(([id])=>id);
if(sideIds.length!==50)throw new Error(`Expected 50 player-facing side quests, found ${sideIds.length}`);
const publishedIds=[...forceTracking,...sideIds];
const publishedIdSet=new Set(publishedIds);
if(publishedIds.some(id=>!rows[id]||!classForRow(rows[id])))throw new Error("Published quest selection contains an unresolved source row.");

let previousSlugs={};
if(fs.existsSync(provenancePath)){
  const previous=JSON.parse(await readFile(provenancePath,"utf8"));
  previousSlugs=previous.slugBySourceId||{};
}
const slugify=value=>String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"quest";
const slugBySourceId={};
const usedSlugs=new Set();
for(const sourceId of publishedIds){
  const questClass=classForRow(rows[sourceId]);
  const oldSlug=previousSlugs[sourceId];
  if(oldSlug&&!usedSlugs.has(oldSlug)){slugBySourceId[sourceId]=oldSlug;usedSlugs.add(oldSlug);continue}
  const base=slugify(localizedText(questClass.QuestTitleMsgId)["en-US"]);
  let slug=base,index=2;
  while(usedSlugs.has(slug))slug=`${base}-${index++}`;
  slugBySourceId[sourceId]=slug;
  usedSlugs.add(slug);
}
if(usedSlugs.size!==publishedIds.length)throw new Error("Quest public slugs are not unique.");

const previousById=new Map(publishedIds.map(id=>[id,[]]));
for(const sourceId of publishedIds){
  const nextIds=(classForRow(rows[sourceId]).AutoOrderQuests||[]).filter(id=>publishedIdSet.has(id));
  for(const nextId of nextIds)previousById.get(nextId).push(sourceId);
}

let objectiveQuestCount=0,objectiveStepCount=0,rewardQuestCount=0,rewardItemRelationCount=0,unavailableAdditionalRewardQuestCount=0;
const quests=publishedIds.map((sourceId,index)=>{
  const questClass=classForRow(rows[sourceId]);
  const kind=forceTracking.includes(sourceId)?"main":"side";
  const sourceOrder=kind==="main"?forceTracking.indexOf(sourceId):sideIds.indexOf(sourceId);
  const objectiveGroups=(questClass.QuestBlockGroupList||[]).map(group=>{
    const steps=(group.BlockList||[]).map(reference=>blocksByPath.get(normalizeClassPath(reference.AssetPathName))).filter(Boolean).filter(block=>block.bHideFromUI!==true).map(block=>block.ObjectiveText?.RowName||block.DescriptionText?.RowName).filter(Boolean).map(reference=>({texts:localizedText(reference)}));
    return {steps};
  }).filter(group=>group.steps.length);
  const stepCount=objectiveGroups.reduce((sum,group)=>sum+group.steps.length,0);
  if(stepCount)objectiveQuestCount++;
  objectiveStepCount+=stepCount;
  const reward=questClass.CommonRewardData||{};
  const rewardItems=(reward.Items||[]).map(entry=>{
    const sourceItemId=entry.Key?.Key,item=itemByFolded.get(String(sourceItemId||"").toLocaleLowerCase("en-US")),quantity=Number(entry.Value);
    if(!item||!Number.isInteger(quantity)||quantity<=0)throw new Error(`Invalid quest item reward for ${sourceId}: ${sourceItemId}`);
    return {itemId:item.id,names:item.names,quantity,image:item.image===true};
  });
  const experience=Number(reward.Exp||0);
  if(!Number.isInteger(experience)||experience<0)throw new Error(`Invalid quest experience reward for ${sourceId}`);
  const additionalRewardStatus=Array.isArray(reward.SkinNames)&&reward.SkinNames.length?"unavailable":undefined;
  if(experience||rewardItems.length||additionalRewardStatus)rewardQuestCount++;
  rewardItemRelationCount+=rewardItems.length;
  if(additionalRewardStatus)unavailableAdditionalRewardQuestCount++;
  const nextSlugs=(questClass.AutoOrderQuests||[]).filter(id=>publishedIdSet.has(id)).map(id=>slugBySourceId[id]);
  return {
    slug:slugBySourceId[sourceId],kind,order:sourceOrder,parallel:sourceId===branchQuestId,
    names:localizedText(questClass.QuestTitleMsgId),descriptions:localizedText(questClass.QuestDescriptionMsgId),
    objectiveGroups,
    rewards:{experience,items:rewardItems,...(additionalRewardStatus?{additionalRewardStatus}:{})},
    previousSlugs:previousById.get(sourceId).map(id=>slugBySourceId[id]),nextSlugs
  };
});

if(quests.length!==82||objectiveQuestCount!==21||objectiveStepCount!==74)throw new Error(`Quest publication baseline drifted: ${quests.length} quests, ${objectiveQuestCount} objective quests, ${objectiveStepCount} steps.`);
if(quests.some(quest=>Object.keys(quest.names).length!==siteLocales.length||Object.keys(quest.descriptions).length!==siteLocales.length||quest.objectiveGroups.some(group=>group.steps.some(step=>Object.keys(step.texts).length!==siteLocales.length))))throw new Error("Quest locale coverage is incomplete.");
if(quests.some(quest=>JSON.stringify(quest).includes("Main_")||JSON.stringify(quest).includes("Sub_")||JSON.stringify(quest).includes("BP_")))throw new Error("Public quest data leaks an internal quest identifier.");

const generatedAt=new Date().toISOString();
const publicData={meta:{schema:1,gameBuild,generatedAt,verification:"verified",localeCount:siteLocales.length,questCount:quests.length,mainCount:forceTracking.length,sideCount:sideIds.length,objectiveQuestCount,objectiveStepCount,rewardQuestCount,rewardItemRelationCount,unavailableAdditionalRewardQuestCount},quests};
const sha256=value=>createHash("sha256").update(value).digest("hex");
const provenance={schema:1,gameBuild,generatedAt,sourceDirectory:path.relative(root,source),baseSourceDirectory:path.relative(root,baseSource),structureSourceDirectory:path.relative(root,structureSource),slugBySourceId,hashes:Object.fromEntries(Object.entries(bytes).map(([file,value])=>[file,sha256(value)])),verification:{rawQuestRows:Object.keys(rows).length,publishedQuests:quests.length,mainQuests:forceTracking.length,sideQuests:sideIds.length,excludedSideDisplayRows:Object.values(rows).filter(row=>row.QuestType==="EPalQuestType::Sub").length-sideIds.length,objectiveQuestCount,objectiveStepCount,rewardQuestCount,rewardItemRelationCount,unavailableAdditionalRewardQuestCount,localeCount:siteLocales.length,brokenReferences:0}};

const writeJsonAtomic=async(target,value)=>{
  await mkdir(path.dirname(target),{recursive:true});
  const temporary=`${target}.${process.pid}.tmp`;
  try{await writeFile(temporary,JSON.stringify(value));await rename(temporary,target)}catch(error){await unlink(temporary).catch(()=>{});throw error}
};
await writeJsonAtomic(outputPath,publicData);
await writeJsonAtomic(provenancePath,provenance);
console.log(`Published ${quests.length} quests (${forceTracking.length} main, ${sideIds.length} side), ${objectiveStepCount} explicit objective steps, and ${rewardItemRelationCount} item reward relations.`);
