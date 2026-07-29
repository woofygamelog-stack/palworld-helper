import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),build="24181527";
const sourceRoot=path.join(root,"private","extracted",`build-${build}-npcs`);
const actorRoot=path.join(root,"private","extracted",`build-${build}-map-actor-chunks-v2`);
const read=name=>JSON.parse(fs.readFileSync(path.join(sourceRoot,name),"utf8"));
if(!fs.existsSync(sourceRoot)||!fs.existsSync(actorRoot))throw new Error("Private NPC tables and cooked-world actor chunks are required.");

const locales={
  "en-US":"en","zh-CN":"zh-Hans","zh-TW":"zh-Hant","ja-JP":"ja","fr-FR":"fr","it-IT":"it","de-DE":"de","es-ES":"es","pt-BR":"pt-BR","ru-RU":"ru","ko-KR":"ko","id-ID":"id","es-419":"es-MX","th-TH":"th","tr-TR":"tr","vi-VN":"vi","pl-PL":"pl"
};
const humanNames=read("human-names.raw.json"),uniqueNames=read("unique-npc-text.raw.json"),shops=read("item-shop-create.raw.json"),shopSettings=read("item-shop-settings.raw.json"),palShops=read("pal-shop-create.raw.json"),achievements=read("achievement-reward-npcs.raw.json"),requests=read("item-request-npcs.raw.json"),palDisplays=read("pal-display-npcs.raw.json");
const itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8")),palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),mapData=JSON.parse(fs.readFileSync(path.join(root,"public","data","map-markers.json"),"utf8"));
const itemIds=new Set(itemData.items.map(item=>item.id)),itemIdByFolded=new Map(itemData.items.map(item=>[item.id.toLowerCase(),item.id])),palIds=new Set(palData.pals.map(pal=>pal.id));

function localizedName(source,key){return Object.fromEntries(Object.entries(locales).map(([locale,rawLocale])=>{const value=source[rawLocale]?.[key];if(!value||/_Text$/.test(value))throw new Error(`${key} has no official ${locale} name`);return [locale,value]}))}
function rewardItems(value){return [...String(value||"").matchAll(/\(([A-Za-z0-9_]+)\s*,\s*([0-9]+)\)/g)].map(([,itemId,quantity])=>({itemId,quantity:Number(quantity)}))}
function verifyItems(entries,label){for(const entry of entries){if(!itemIds.has(entry.itemId)){const corrected=itemIdByFolded.get(entry.itemId.toLowerCase());if(!corrected)throw new Error(`${label} references unavailable item ${entry.itemId}`);entry.itemId=corrected}}return entries}
function worldId(location){const world=mapData.worlds.find(candidate=>location.X>=candidate.minX&&location.X<=candidate.maxX&&location.Y>=candidate.minY&&location.Y<=candidate.maxY);if(!world)throw new Error(`NPC encounter is outside the published worlds: ${JSON.stringify(location)}`);return world.id}

const actors=[];
for(const file of fs.readdirSync(actorRoot).filter(file=>file.endsWith(".raw.json")).sort()){
  const chunk=JSON.parse(fs.readFileSync(path.join(actorRoot,file),"utf8"));
  if(chunk.failedPackageCount!==0)throw new Error(`${file} contains failed world cells`);
  for(const actor of chunk.actors){
    const location=actor.location||{},x=Number(location.X),y=Number(location.Y),z=Number(location.Z);
    if(!/MonoNPCSpawner/i.test(actor.actorType)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||z<=-20000||actor.properties?.ParentComponent)continue;
    actors.push({actorType:actor.actorType,human:actor.properties?.HumanName?.Key||"",unique:actor.properties?.UniqueName?.Key||"",location:{x,y,z,worldId:worldId(location)}});
  }
}
const encounters=predicate=>actors.filter(predicate).map(actor=>actor.location).sort((a,b)=>a.worldId.localeCompare(b.worldId)||a.x-b.x||a.y-b.y);
const namedEncounter=(predicate,variantOf)=>actors.filter(predicate).map(actor=>({...actor.location,...(variantOf?{variant:variantOf(actor)}:{})})).sort((a,b)=>(a.variant||"").localeCompare(b.variant||"")||a.x-b.x||a.y-b.y);

function itemShop(slug,profile){
  const currencyItemId=shopSettings[profile]?.CurrencyItemID;
  if(!currencyItemId||!itemIds.has(currencyItemId))throw new Error(`${slug} has no verified currency`);
  const offers=(shops[profile]?.productDataArray||[]).map(row=>({itemId:row.StaticItemId,price:row.OverridePrice,quantity:row.ProductNum,purchaseLimit:row.ProductType.includes("OnlyPurchaseOne")?"once":null}));
  verifyItems(offers,slug);
  return {type:"items",currencyItemId,offers};
}
function achievementEvents(category){return Object.values(achievements).filter(row=>row.AchivementCategory.endsWith(`::${category}`)).sort((a,b)=>a.RequireCount-b.RequireCount).map(row=>({requireCount:row.RequireCount,rewards:verifyItems(rewardItems(row.RewardItemString),category),expBonusLevel:row.ExpBonusLevel}))}

const displayEncounters=namedEncounter(actor=>/^U_Reward_PalDisplay_[A-I]_01$/.test(actor.unique),actor=>actor.unique.match(/PalDisplay_([A-I])_01/)?.[1]);
const displaySteps=Object.values(palDisplays).map(row=>({variant:row.RequestCategory.match(/Area_([A-I])1/)?.[1],requestPalId:row.RequestPalID,rewards:verifyItems(rewardItems(row.RewardItems),"pal display"),expBonusLevel:row.ExpBonusLevel})).sort((a,b)=>a.variant.localeCompare(b.variant));
for(const step of displaySteps)if(!step.variant||!palIds.has(step.requestPalId))throw new Error(`Pal display references unavailable Pal ${step.requestPalId}`);

const darkProfiles=Object.entries(palShops).filter(([key])=>key.startsWith("Dark_")).sort(([a],[b])=>a.localeCompare(b)).map(([profile,row])=>({profile:profile.replace("Dark_",""),characterCount:row.CharacterNum,minLevel:row.MinCharacterLevel,maxLevel:row.MaxCharacterLevel,palIds:row.CharacterIDArray.map(entry=>entry.Key)}));
for(const profile of darkProfiles)for(const palId of profile.palIds)if(!palIds.has(palId))throw new Error(`Black market profile references unavailable Pal ${palId}`);

const npcs=[
  {slug:"medal-merchant",names:localizedName(uniqueNames,"MedalTrader"),kind:"merchant",roles:["item-shop"],encounters:encounters(actor=>/MonoNPCSpawner_MedalTrader/.test(actor.actorType)),merchant:itemShop("medal-merchant","Medal_Shop_1")},
  {slug:"pidf-bounty-officer",names:localizedName(uniqueNames,"BountyTrader"),kind:"merchant",roles:["item-shop","bounty-exchange"],encounters:encounters(actor=>actor.unique==="BountyTrader"),merchant:itemShop("pidf-bounty-officer","Bounty_Shop_1")},
  {slug:"arena-merchant",names:localizedName(uniqueNames,"ArenaShop"),kind:"merchant",roles:["item-shop","arena-exchange"],encounters:encounters(actor=>actor.unique==="ArenaShop"),merchant:itemShop("arena-merchant","Arena_Shop_1")},
  {slug:"black-marketeer",names:localizedName(humanNames,"NAME_DarkTrader"),kind:"merchant",roles:["pal-shop"],encounters:encounters(actor=>/DarkTrader/.test(actor.actorType)||/^DarkTrader\d*$/.test(actor.unique)),merchant:{type:"pals",profiles:darkProfiles}},
  {slug:"pal-ecological-researcher",names:localizedName(uniqueNames,"NAME_Reward_Paldex"),kind:"reward",roles:["achievement-reward"],encounters:encounters(actor=>actor.unique==="U_Reward_Paldex"),events:{type:"achievement",category:"paldex",steps:achievementEvents("PalDex")}},
  {slug:"wise-hunter",names:localizedName(uniqueNames,"NAME_Reward_PalCaptureCount"),kind:"reward",roles:["achievement-reward"],encounters:encounters(actor=>actor.unique==="U_Reward_PalCaptureCount"),events:{type:"achievement",category:"capture",steps:achievementEvents("PalCapture")}},
  {slug:"veteran-pal-hunter",names:localizedName(uniqueNames,"NAME_Reward_BossDefeat"),kind:"reward",roles:["achievement-reward"],encounters:encounters(actor=>actor.unique==="U_Reward_BossDefeat"),events:{type:"achievement",category:"boss",steps:achievementEvents("BossDefeat")}},
  {slug:"arrogant-gourmet",names:localizedName(uniqueNames,"NAME_Reward_Food"),kind:"request",roles:["item-request"],encounters:encounters(actor=>actor.unique==="U_Reward_Food"),events:{type:"item-request",steps:Object.values(requests).filter(row=>row.RequestCategory.endsWith("::Food_A")).map(row=>({requestItemId:row.RequestItem,requestQuantity:row.RequestNum,rewards:verifyItems(rewardItems(row.RewardItemString),"food request"),expBonusLevel:row.ExpBonusLevel}))}},
  {slug:"arrogant-pal-critic",names:localizedName(uniqueNames,"NAME_Reward_PalDisplay"),kind:"request",roles:["pal-request"],encounters:displayEncounters,events:{type:"pal-request",steps:displaySteps}}
];
for(const npc of npcs){if(!npc.encounters.length)throw new Error(`${npc.slug} has no verified encounter`);if(new Set(Object.values(npc.names)).size===0)throw new Error(`${npc.slug} has no names`)}
if(npcs.length!==9||npcs.filter(npc=>npc.kind==="merchant").length!==4||displayEncounters.length!==9)throw new Error("NPC catalog baseline drifted");

const output={meta:{schema:1,gameBuild:build,generatedAt:new Date().toISOString(),localeCount:Object.keys(locales).length,npcCount:npcs.length,merchantCount:npcs.filter(npc=>npc.kind==="merchant").length,encounterCount:npcs.reduce((sum,npc)=>sum+npc.encounters.length,0),verification:"game-files"},npcs};
fs.writeFileSync(path.join(root,"public","data","npcs.json"),JSON.stringify(output));
console.log(JSON.stringify(output.meta,null,2));
