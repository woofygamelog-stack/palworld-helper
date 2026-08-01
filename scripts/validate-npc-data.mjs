import fs from "node:fs";

const npcData=JSON.parse(fs.readFileSync("public/data/npcs.json","utf8"));
const itemData=JSON.parse(fs.readFileSync("public/data/items.json","utf8"));
const palData=JSON.parse(fs.readFileSync("public/data/pals.json","utf8"));
const mapPoints=JSON.parse(fs.readFileSync("public/data/map-points.json","utf8")).points;
const locales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
const itemIds=new Set(itemData.items.map(item=>item.id)),palIds=new Set(palData.pals.map(pal=>pal.id)),slugs=new Set();
if(npcData.meta.schema!==2||npcData.meta.sourceDefinitionCount!==216||npcData.meta.publishedDefinitionCount!==190||npcData.meta.excludedDefinitionCount!==26||npcData.meta.npcCount!==164||npcData.meta.merchantCount!==7||npcData.meta.combatCount!==41||npcData.meta.fixedNpcCount!==101||npcData.meta.encounterCount!==155||npcData.meta.localeCount!==locales.length||npcData.meta.verification!=="verified")throw new Error("NPC metadata baseline mismatch");
for(const npc of npcData.npcs){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(npc.slug)||slugs.has(npc.slug))throw new Error(`Invalid or duplicate NPC slug ${npc.slug}`);slugs.add(npc.slug);
  if(JSON.stringify(Object.keys(npc.names).sort())!==JSON.stringify([...locales].sort())||Object.values(npc.names).some(name=>!name.trim()))throw new Error(`${npc.slug} has incomplete official names`);
  if(npc.fixedLocation!==(npc.encounters.length>0)||npc.encounters.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z)))throw new Error(`${npc.slug} has invalid encounters`);
  if(!["merchant","reward","request","quest","guide","combat","character"].includes(npc.kind)||!npc.roles.length)throw new Error(`${npc.slug} has invalid role metadata`);
  if(npc.level&&(npc.level.min<=0||npc.level.min>npc.level.max))throw new Error(`${npc.slug} has invalid level range`);
  if(npc.merchant?.type==="items"){if(!itemIds.has(npc.merchant.currencyItemId)||!npc.merchant.offers.length)throw new Error(`${npc.slug} has invalid item shop metadata`);for(const offer of npc.merchant.offers)if(!itemIds.has(offer.itemId)||offer.price<=0||offer.quantity<=0)throw new Error(`${npc.slug} has invalid item offer`)}
  if(npc.merchant?.type==="item-profiles"){if(!itemIds.has(npc.merchant.currencyItemId)||!npc.merchant.profiles.length)throw new Error(`${npc.slug} has invalid item shop profiles`);for(const profile of npc.merchant.profiles){if(!profile.offers.length)throw new Error(`${npc.slug} has an empty item shop profile`);for(const offer of profile.offers)if(!itemIds.has(offer.itemId)||offer.price<=0||offer.quantity<=0)throw new Error(`${npc.slug} has invalid item profile offer`)}}
  if(npc.merchant?.type==="pals")for(const profile of npc.merchant.profiles){if(profile.characterCount<=0||profile.minLevel>profile.maxLevel)throw new Error(`${npc.slug} has invalid Pal stock rule`);for(const palId of profile.palIds)if(!palIds.has(palId))throw new Error(`${npc.slug} references unavailable Pal ${palId}`)}
  for(const step of npc.events?.steps||[]){for(const reward of step.rewards)if(!itemIds.has(reward.itemId)||reward.quantity<=0)throw new Error(`${npc.slug} has invalid reward`);if(step.requestItemId&&!itemIds.has(step.requestItemId))throw new Error(`${npc.slug} requests unavailable item`);if(step.requestPalId&&!palIds.has(step.requestPalId))throw new Error(`${npc.slug} requests unavailable Pal`)}
}
const expectedOffers={"medal-merchant":37,"pidf-bounty-officer":18,"arena-merchant":56};
for(const [slug,count] of Object.entries(expectedOffers))if(npcData.npcs.find(npc=>npc.slug===slug)?.merchant?.offers.length!==count)throw new Error(`${slug} offer count drifted`);
if(npcData.npcs.find(npc=>npc.slug==="black-marketeer")?.merchant?.profiles.length!==4)throw new Error("Black Marketeer stock profiles drifted");
if(npcData.npcs.find(npc=>npc.slug==="wandering-merchant")?.merchant?.profiles.length!==5)throw new Error("Wandering Merchant stock profiles drifted");
if(npcData.npcs.find(npc=>npc.slug==="pal-merchant")?.merchant?.profiles.length!==3)throw new Error("Pal Merchant stock profiles drifted");
const mapNpcPoints=mapPoints.filter(point=>point.npcSlug);
if(mapNpcPoints.length!==155)throw new Error(`Expected 155 linked NPC map points, found ${mapNpcPoints.length}`);
for(const npc of npcData.npcs){const points=mapNpcPoints.filter(point=>point.npcSlug===npc.slug);if(points.length!==npc.encounters.length)throw new Error(`${npc.slug} map encounter count mismatch`);for(const encounter of npc.encounters)if(!points.some(point=>point.worldId===encounter.worldId&&point.x===encounter.x&&point.y===encounter.y))throw new Error(`${npc.slug} encounter is not linked on the map`)}
if(/U_Reward_|NameTextID|TalkBPClass|OneTalkDTName|BP_MonoNPCSpawner|CharacterID/.test(JSON.stringify(npcData)))throw new Error("Public NPC data exposes private engine identifiers");
console.log(`Validated ${npcData.npcs.length} NPCs, ${npcData.meta.encounterCount} encounters and ${mapNpcPoints.length} linked map points.`);
