import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),build=process.env.PAL_GAME_BUILD||"24467282";
const sourceRoot=process.env.PAL_NPC_SOURCE||path.join(root,"private","extracted",`build-${build}-npcs`);
const actorRoot=process.env.PAL_ACTOR_SOURCE||path.join(root,"private","extracted",`build-${build}-map-actor-chunks-v2`);
const read=name=>JSON.parse(fs.readFileSync(path.join(sourceRoot,name),"utf8"));
if(!fs.existsSync(sourceRoot)||!fs.existsSync(actorRoot))throw new Error("Private NPC tables and cooked-world actor chunks are required.");
const npcManifest=read("npc-manifest.json");
if(npcManifest.schema!==1||npcManifest.mode!=="npc"||npcManifest.localeCount!==17||npcManifest.mappingHash!=="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851")throw new Error("NPC extraction manifest is incompatible with the accepted current build.");
const actorFiles=fs.readdirSync(actorRoot).filter(file=>file.endsWith(".raw.json")).sort();
if(actorFiles.length!==10)throw new Error(`Expected 10 complete actor chunks, found ${actorFiles.length}`);

const locales={"en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"};
const uniqueRows=read("unique-npcs.raw.json"),humanNames=read("human-names.raw.json"),uniqueNames=read("unique-npc-text.raw.json"),talkFlows=read("npc-talk-flow.raw.json"),shops=read("item-shop-create.raw.json"),shopSettings=read("item-shop-settings.raw.json"),palShops=read("pal-shop-create.raw.json"),achievements=read("achievement-reward-npcs.raw.json"),requests=read("item-request-npcs.raw.json"),palDisplays=read("pal-display-npcs.raw.json");
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8")),palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),mapData=JSON.parse(fs.readFileSync(path.join(root,"public","data","map-markers.json"),"utf8"));
const itemIds=new Set(itemData.items.map(item=>item.id)),itemById=new Map(itemData.items.map(item=>[item.id,item])),itemIdByFolded=new Map(itemData.items.map(item=>[item.id.toLowerCase(),item.id])),palIds=new Set(palData.pals.map(pal=>pal.id));

function localizedName(source,key){return Object.fromEntries(Object.entries(locales).map(([locale,rawLocale])=>{const value=source[rawLocale]?.[key];if(!value||/_Text$/.test(value))throw new Error(`${key} has no official ${locale} name`);return [locale,value]}))}
function hasLocalizedName(source,key){return key&&Object.values(locales).every(rawLocale=>source[rawLocale]?.[key]&&!/_Text$/.test(source[rawLocale][key]))}
function resolveNameKey(rowKey,row){return [row.NameTextID,rowKey,`NAME_${rowKey}`].find(key=>hasLocalizedName(uniqueNames,key))}
function rewardItems(value){return [...String(value||"").matchAll(/\(([A-Za-z0-9_]+)\s*,\s*([0-9]+)\)/g)].map(([,itemId,quantity])=>({itemId,quantity:Number(quantity)}))}
function verifyItems(entries,label){for(const entry of entries){if(!itemIds.has(entry.itemId)){const corrected=itemIdByFolded.get(entry.itemId.toLowerCase());if(!corrected)throw new Error(`${label} references unavailable item ${entry.itemId}`);entry.itemId=corrected}}return entries}
function worldId(location){const world=mapData.worlds.find(candidate=>location.X>=candidate.minX&&location.X<=candidate.maxX&&location.Y>=candidate.minY&&location.Y<=candidate.maxY);if(!world)throw new Error(`NPC encounter is outside the published worlds: ${JSON.stringify(location)}`);return world.id}
function slugify(value){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}

function inferredUniqueKey(type){
  const survey=type.match(/MonoNPCSpawner_Quest_(SurveyGirl\d+|SurveyMan\d+)_C$/);if(survey)return `U_${survey[1]}`;
  if(/MonoNPCSpawner_Quest_VolcanoPorter001_C$/.test(type))return "VolcanoPorter001";
  if(/MonoNPCSpawner_Quest_Police_LoneWolf3_C$/.test(type))return "Police_dependable_Lonewolf";
  if(/MonoNPCSpawner_StrongOldMan01_C$/.test(type))return "U_StrongOldMan01";
  return "";
}

const actors=[];
for(const file of actorFiles){
  const chunk=JSON.parse(fs.readFileSync(path.join(actorRoot,file),"utf8"));
  if(chunk.failedPackageCount!==0)throw new Error(`${file} contains failed world cells`);
  for(const actor of chunk.actors){
    const location=actor.location||{},x=Number(location.X),y=Number(location.Y),z=Number(location.Z);
    if(!/MonoNPCSpawner/i.test(actor.actorType)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||z<=-20000||actor.properties?.ParentComponent)continue;
    actors.push({actorType:actor.actorType,human:actor.properties?.HumanName?.Key||"",unique:actor.properties?.UniqueName?.Key||inferredUniqueKey(actor.actorType),level:Number(actor.properties?.Level)||null,location:{x,y,z,worldId:worldId(location)}});
  }
}
const sortEncounters=rows=>rows.sort((a,b)=>a.worldId.localeCompare(b.worldId)||a.x-b.x||a.y-b.y||a.z-b.z);
const encounterRows=predicate=>sortEncounters(actors.filter(predicate).map(actor=>actor.location));
const encounterRowsWithVariant=(predicate,variantOf)=>sortEncounters(actors.filter(predicate).map(actor=>({...actor.location,variant:variantOf(actor)})));
const levelRange=rows=>{const levels=rows.map(row=>Number(row.Level)).filter(Number.isFinite);return levels.length?{min:Math.min(...levels),max:Math.max(...levels)}:undefined};
const actorLevelRange=rows=>{const levels=rows.map(row=>row.level).filter(Number.isFinite);return levels.length?{min:Math.min(...levels),max:Math.max(...levels)}:undefined};

function itemOffers(profile){
  const rows=shops[profile]?.productDataArray||[];
  const offers=rows.map(row=>{const itemId=itemIds.has(row.StaticItemId)?row.StaticItemId:itemIdByFolded.get(String(row.StaticItemId).toLowerCase());if(!itemId)throw new Error(`${profile} references unavailable item ${row.StaticItemId}`);const price=row.OverridePrice>0?row.OverridePrice:itemById.get(itemId)?.price;return {itemId,price,quantity:row.ProductNum,purchaseLimit:row.ProductType.includes("OnlyPurchaseOne")?"once":null,...(row.Stock>0?{stock:row.Stock}:{})}});
  if(!offers.length||offers.some(offer=>!Number.isFinite(offer.price)||offer.price<=0))throw new Error(`${profile} has invalid offers`);
  return offers;
}
function itemShop(slug,profile){const currencyItemId=shopSettings[profile]?.CurrencyItemID||"Money";if(!itemIds.has(currencyItemId))throw new Error(`${slug} has no verified currency`);return {type:"items",currencyItemId,offers:itemOffers(profile)}}
function palProfiles(keys){return keys.map(key=>{const row=palShops[key];if(!row)throw new Error(`Missing Pal shop profile ${key}`);const profile={profile:String(keys.indexOf(key)+1),characterCount:row.CharacterNum,minLevel:row.MinCharacterLevel,maxLevel:row.MaxCharacterLevel,palIds:row.CharacterIDArray.map(entry=>entry.Key)};for(const palId of profile.palIds)if(!palIds.has(palId))throw new Error(`${key} references unavailable Pal ${palId}`);return profile})}
function achievementEvents(category){return Object.values(achievements).filter(row=>row.AchivementCategory.endsWith(`::${category}`)).sort((a,b)=>a.RequireCount-b.RequireCount).map(row=>({requireCount:row.RequireCount,rewards:verifyItems(rewardItems(row.RewardItemString),category),expBonusLevel:row.ExpBonusLevel}))}

const specialSlugs={MedalTrader:"medal-merchant",BountyTrader:"pidf-bounty-officer",ArenaShop:"arena-merchant",NAME_DarkTrader:"black-marketeer",NAME_Reward_Paldex:"pal-ecological-researcher",NAME_Reward_PalCaptureCount:"wise-hunter",NAME_Reward_BossDefeat:"veteran-pal-hunter",NAME_Reward_Food:"arrogant-gourmet",NAME_Reward_PalDisplay:"arrogant-pal-critic"};
const groupedRows=new Map();
const excludedRows=[];
for(const [rowKey,row] of Object.entries(uniqueRows)){
  const nameKey=resolveNameKey(rowKey,row);
  if(!nameKey||/^(Unique002|Unique003_Gift)$/.test(rowKey)){excludedRows.push(rowKey);continue}
  if(!groupedRows.has(nameKey))groupedRows.set(nameKey,[]);
  groupedRows.get(nameKey).push({rowKey,...row});
}

const usedSlugs=new Set();
function uniqueSlug(base,rows){let candidate=base;if(usedSlugs.has(candidate)){const genders=new Set(rows.map(row=>row.Gender?.split("::").pop()?.toLowerCase()).filter(Boolean));const suffix=genders.size===1?[...genders][0]:String(usedSlugs.size+1);candidate=`${base}-${suffix}`;let index=2;while(usedSlugs.has(candidate))candidate=`${base}-${suffix}-${index++}`}usedSlugs.add(candidate);return candidate}
function talkText(rows){return rows.flatMap(row=>[row.OneTalkDTName,row.TalkBPClass]).filter(value=>value&&value!=="None").map(value=>talkFlows[value]?.SoftTalkFlowAsset?.AssetPathName||value).join(" ")}
function rolesFor(nameKey,rows){
  const text=`${nameKey} ${rows.map(row=>row.rowKey).join(" ")} ${talkText(rows)}`;
  const roles=new Set();
  if(/DarkTrader|MedalTrader|BountyTrader|ArenaShop|ItemShop|Shabby_looking_merchant/i.test(text))roles.add("item-shop");
  if(/MerchantwithPAL/i.test(text))roles.add("pal-shop");
  if(/BountyNavigator/i.test(text))roles.add("bounty-intel");
  if(/Reward_PalDisplay|PalDisplay/i.test(text))roles.add("pal-request");
  if(/Reward_Food|FoodRequire/i.test(text))roles.add("item-request");
  if(/Reward_Paldex|Reward_PalCapture|Reward_BossDefeat|PalDexReach|PalCaptureReach|BossDefeatReach/i.test(text))roles.add("achievement-reward");
  if(/EmoteTester|Emote_location/i.test(text))roles.add("emote-reward");
  if(/Presenter|Gift|Present/i.test(text))roles.add("gift");
  if(/guide/i.test(text))roles.add("guide");
  if(/Quest|Farmer|Scholar|Breeder|Ranger|Nomad|Angler|Kigurumi|Survey|StrongOldMan|VolcanoPorter/i.test(text))roles.add("quest");
  if(/RandomBattle|BattlePalTamer|PvPVillage/i.test(text))roles.add("combat");
  if(talkText(rows))roles.add("dialogue");
  if(!roles.size)roles.add("character");
  return [...roles];
}
function kindFor(roles){return roles.some(role=>role==="item-shop"||role==="pal-shop")?"merchant":roles.some(role=>role==="item-request"||role==="pal-request")?"request":roles.some(role=>role==="achievement-reward"||role==="emote-reward"||role==="gift")?"reward":roles.includes("quest")?"quest":roles.includes("guide")||roles.includes("bounty-intel")?"guide":roles.includes("combat")?"combat":"character"}

const npcs=[];
for(const [nameKey,rows] of [...groupedRows].sort((a,b)=>uniqueNames.en[a[0]].localeCompare(uniqueNames.en[b[0]])||a[0].localeCompare(b[0]))){
  const names=localizedName(uniqueNames,nameKey),base=specialSlugs[nameKey]||slugify(names["en-US"]),slug=uniqueSlug(base,rows),rowKeys=new Set(rows.map(row=>row.rowKey)),matchedActors=actors.filter(actor=>rowKeys.has(actor.unique)),roles=rolesFor(nameKey,rows),npc={slug,names,kind:kindFor(roles),roles,encounters:sortEncounters(matchedActors.map(actor=>actor.location)),level:levelRange(rows),fixedLocation:matchedActors.length>0};
  if(slug==="medal-merchant"){npc.encounters=encounterRows(actor=>/MonoNPCSpawner_MedalTrader/.test(actor.actorType));npc.fixedLocation=true;npc.merchant=itemShop(slug,"Medal_Shop_1")}
  else if(slug==="pidf-bounty-officer")npc.merchant=itemShop(slug,"Bounty_Shop_1");
  else if(slug==="arena-merchant")npc.merchant=itemShop(slug,"Arena_Shop_1");
  else if(slug==="black-marketeer"){npc.encounters=encounterRows(actor=>!/BossBase/.test(actor.actorType)&&(/DarkTrader/.test(actor.actorType)||/^DarkTrader\d*$/.test(actor.unique)));npc.fixedLocation=npc.encounters.length>0;npc.merchant={type:"pals",profiles:palProfiles(["Dark_01","Dark_02","Dark_03","Dark_04"])}}
  else if(names["en-US"]==="Traveling Merchant")npc.merchant={type:"item-profiles",currencyItemId:"Money",profiles:Object.keys(shops).filter(key=>/^Caravan_Shop_\d+$/.test(key)).sort((a,b)=>Number(a.match(/\d+$/)[0])-Number(b.match(/\d+$/)[0])).map((profile,index)=>({profile:String(index+1),offers:itemOffers(profile)}))};
  if(slug==="pal-ecological-researcher")npc.events={type:"achievement",category:"paldex",steps:achievementEvents("PalDex")};
  else if(slug==="wise-hunter")npc.events={type:"achievement",category:"capture",steps:achievementEvents("PalCapture")};
  else if(slug==="veteran-pal-hunter")npc.events={type:"achievement",category:"boss",steps:achievementEvents("BossDefeat")};
  else if(slug==="arrogant-gourmet")npc.events={type:"item-request",steps:Object.values(requests).filter(row=>row.RequestCategory.endsWith("::Food_A")).map(row=>({requestItemId:row.RequestItem,requestQuantity:row.RequestNum,rewards:verifyItems(rewardItems(row.RewardItemString),"food request"),expBonusLevel:row.ExpBonusLevel}))};
  else if(slug==="arrogant-pal-critic"){
    npc.encounters=encounterRowsWithVariant(actor=>/^U_Reward_PalDisplay_[A-I]_01$/.test(actor.unique),actor=>actor.unique.match(/PalDisplay_([A-I])_01/)?.[1]);npc.fixedLocation=npc.encounters.length>0;
    const steps=Object.values(palDisplays).map(row=>({variant:row.RequestCategory.match(/Area_([A-I])1/)?.[1],requestPalId:row.RequestPalID,rewards:verifyItems(rewardItems(row.RewardItems),"pal display"),expBonusLevel:row.ExpBonusLevel})).sort((a,b)=>a.variant.localeCompare(b.variant));
    for(const step of steps)if(!step.variant||!palIds.has(step.requestPalId))throw new Error(`Pal display references unavailable Pal ${step.requestPalId}`);npc.events={type:"pal-request",steps};
  }
  npcs.push(npc);
}

function addNamedNpc({slug,nameSource,nameKey,kind,roles,matchedActors,merchant}){if(usedSlugs.has(slug))throw new Error(`Duplicate NPC slug ${slug}`);usedSlugs.add(slug);const npc={slug,names:localizedName(nameSource,nameKey),kind,roles,encounters:sortEncounters(matchedActors.map(actor=>actor.location)),level:actorLevelRange(matchedActors),fixedLocation:matchedActors.length>0,...(merchant?{merchant}:{})};npcs.push(npc)}

const salesProfiles=[
  ["Village_Shop_1",actor=>actor.human==="SalesPerson"],
  ["Desert_Shop_1",actor=>actor.human==="SalesPerson_Desert"],
  ["Desert_Shop_2",actor=>actor.human==="SalesPerson_Desert2"],
  ["Volcano_Shop_1",actor=>actor.human==="SalesPerson_Volcano"],
  ["Volcano_Shop_2",actor=>actor.human==="SalesPerson_Volcano2"]
];
const salesActors=actors.filter(actor=>/^SalesPerson/.test(actor.human));
addNamedNpc({slug:"wandering-merchant",nameSource:humanNames,nameKey:"NAME_SELESPERSON",kind:"merchant",roles:["item-shop"],matchedActors:salesActors,merchant:{type:"item-profiles",currencyItemId:"Money",profiles:salesProfiles.map(([profile,predicate],index)=>({profile:String(index+1),offers:itemOffers(profile),encounters:sortEncounters(salesActors.filter(predicate).map(actor=>actor.location))}))}});
const palMerchantActors=actors.filter(actor=>/^PalDealer/.test(actor.human));
addNamedNpc({slug:"pal-merchant",nameSource:humanNames,nameKey:"NAME_PAL_DEALER",kind:"merchant",roles:["pal-shop"],matchedActors:palMerchantActors,merchant:{type:"pals",profiles:palProfiles(["Test_00","Desert_00","Volcano_00"])}});

const bossActors=actors.filter(actor=>/MonoNPCSpawnerBossBase_/.test(actor.actorType));
const bossTypes=[...new Set(bossActors.map(actor=>actor.actorType.match(/MonoNPCSpawnerBossBase_(.+)_C$/)?.[1]).filter(Boolean))].sort();
for(const bossType of bossTypes){const candidates=[`NAME_${bossType}`,`NAME_BOSS_${bossType}`,bossType==="BOSS_Believer_Fat_GatlingGun"?"NAME_BOSS_Believer_Fat_GiantClub":""],nameKey=candidates.find(key=>hasLocalizedName(humanNames,key));if(!nameKey)throw new Error(`Boss NPC ${bossType} has no official localized name`);const names=localizedName(humanNames,nameKey),matchedActors=bossActors.filter(actor=>actor.actorType.includes(`_${bossType}_C`));let slug=slugify(names["en-US"]),index=2;while(usedSlugs.has(slug))slug=`${slugify(names["en-US"])}-wanted-${index++}`;addNamedNpc({slug,nameSource:humanNames,nameKey,kind:"combat",roles:["combat"],matchedActors})}

npcs.sort((a,b)=>a.names["en-US"].localeCompare(b.names["en-US"])||a.slug.localeCompare(b.slug));
const merchantCount=npcs.filter(npc=>npc.kind==="merchant").length,encounterCount=npcs.reduce((sum,npc)=>sum+npc.encounters.length,0),fixedNpcCount=npcs.filter(npc=>npc.fixedLocation).length;
if(groupedRows.size!==134||excludedRows.length!==26||bossTypes.length!==28)throw new Error(`NPC source baseline drifted: groups=${groupedRows.size}, excluded=${excludedRows.length}, bosses=${bossTypes.length}`);
const output={meta:{schema:2,gameBuild:build,generatedAt:new Date().toISOString(),localeCount:Object.keys(locales).length,sourceDefinitionCount:Object.keys(uniqueRows).length,publishedDefinitionCount:Object.keys(uniqueRows).length-excludedRows.length,excludedDefinitionCount:excludedRows.length,npcCount:npcs.length,merchantCount,combatCount:npcs.filter(npc=>npc.kind==="combat").length,fixedNpcCount,encounterCount,verification:"game-files"},npcs};
fs.writeFileSync(path.join(root,"public","data","npcs.json"),JSON.stringify(output));
console.log(JSON.stringify(output.meta,null,2));
