import fs from "node:fs";

const data=JSON.parse(fs.readFileSync("public/data/dungeons.json","utf8"));
const pals=JSON.parse(fs.readFileSync("public/data/pals.json","utf8"));
const items=JSON.parse(fs.readFileSync("public/data/items.json","utf8"));
const maps=JSON.parse(fs.readFileSync("public/data/map-markers.json","utf8"));
const fail=message=>{throw new Error(`Dungeon validation failed: ${message}`)};
const expectedLocales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
if(data.meta.schema!==3||data.meta.gameBuild!=="24467282"||data.meta.verification!=="game-files")fail("metadata mismatch");
if(data.meta.localeCount!==expectedLocales.length||data.meta.dungeonCount!==28||data.meta.fixedCount!==18||data.meta.rotatingCount!==10||data.meta.entranceCount!==31||data.meta.rewardSourceCount!==79||data.meta.rewardItemCandidateCount!==819)fail("build-specific count drift");
if(data.meta.probabilitiesVerified!==false||data.meta.resourcesVerified!==false||data.meta.rewardSourcesVerified!==true||data.meta.rewardContentsVerified!==false)fail("Dungeon verification boundaries are inconsistent");
if(data.dungeons.length!==data.meta.dungeonCount)fail("dungeon count mismatch");
const palIds=new Set(pals.pals.map(pal=>pal.id)),itemIds=new Set(items.items.map(item=>item.id)),worlds=new Map(maps.worlds.map(world=>[world.id,world])),slugs=new Set(),entranceIds=new Set();
const roomRoles=new Set(["normal","boss","midboss","monster","aquatic"]),memberRoles=new Set(["primary","companion","member"]),rewardKinds=new Set(["pal-cage","pal","treasure-chest","salvage","pal-egg","lotus","cave-mushroom","mushroom","pickup","item-pool"]);
let fixedCount=0,rotatingCount=0,entranceCount=0,encounterGroupCount=0,itemCandidateCount=0,rewardSourceCount=0,rewardItemCandidateCount=0;
for(const dungeon of data.dungeons){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dungeon.slug)||slugs.has(dungeon.slug))fail(`invalid or duplicate slug ${dungeon.slug}`);slugs.add(dungeon.slug);
  if(dungeon.kind==="fixed")fixedCount++;else if(dungeon.kind==="rotating")rotatingCount++;else fail(`invalid kind ${dungeon.slug}`);
  if(dungeon.verification!=="game-files")fail(`unverified dungeon published ${dungeon.slug}`);
  if(JSON.stringify(Object.keys(dungeon.names).sort())!==JSON.stringify([...expectedLocales].sort()))fail(`locale coverage ${dungeon.slug}`);
  for(const value of Object.values(dungeon.names))if(!value.trim()||/^(?:[a-z-]+[ _]Text|\?\?\?|This Dungeon is under investigation\.)$/i.test(value))fail(`placeholder name ${dungeon.slug}`);
  if(dungeon.encounterLevel&&(!Number.isFinite(dungeon.encounterLevel.min)||!Number.isFinite(dungeon.encounterLevel.max)||dungeon.encounterLevel.min<=0||dungeon.encounterLevel.min>dungeon.encounterLevel.max))fail(`encounter level ${dungeon.slug}`);
  if(dungeon.probabilityStatus!==(dungeon.kind==="fixed"?"not-applicable":"unverified-multi-stage"))fail(`probability status ${dungeon.slug}`);
  const expectedEntranceStatus=dungeon.kind==="fixed"?"verified":dungeon.entrances.length?"partial":"unverified";
  if(dungeon.entranceStatus!==expectedEntranceStatus)fail(`entrance coverage ${dungeon.slug}`);
  if(dungeon.kind==="fixed"&&dungeon.entrances.length!==1)fail(`fixed entrance count ${dungeon.slug}`);
  entranceCount+=dungeon.entrances.length;
  for(const entrance of dungeon.entrances){const world=worlds.get(entrance.worldId);if(!world)fail(`unknown entrance world ${entrance.id}`);if(entranceIds.has(entrance.id))fail(`duplicate entrance ${entrance.id}`);entranceIds.add(entrance.id);if(!["fixed","rotation-candidate"].includes(entrance.type))fail(`entrance type ${entrance.id}`);if(!Number.isFinite(entrance.x)||!Number.isFinite(entrance.y)||!Number.isFinite(entrance.z)||entrance.x<world.minX||entrance.x>world.maxX||entrance.y<world.minY||entrance.y>world.maxY)fail(`entrance coordinates ${entrance.id}`);if(!Number.isFinite(entrance.map?.x)||!Number.isFinite(entrance.map?.y))fail(`display coordinates ${entrance.id}`);if(entrance.type==="fixed"&&entrance.cooldownMinutes!==60)fail(`fixed cooldown ${entrance.id}`);if(entrance.type==="rotation-candidate"&&entrance.cooldownMinutes!==null)fail(`rotation cooldown ${entrance.id}`)}
  const groupIds=new Set(),visiblePalIds=new Set();
  for(const group of dungeon.encounterGroups){
    encounterGroupCount++;
    if(!/^(?:normal|boss|midboss|monster|aquatic)-[1-9][0-9]*$/.test(group.id)||groupIds.has(group.id))fail(`invalid or duplicate encounter group ${dungeon.slug} ${group.id}`);groupIds.add(group.id);
    if(!roomRoles.has(group.roomRole)||!group.members.length)fail(`invalid encounter group ${dungeon.slug} ${group.id}`);
    const groupMembers=new Set();let primaryCount=0;
    for(const member of group.members){const key=`${member.memberRole}|${member.palId}`;if(groupMembers.has(key))fail(`duplicate group member ${dungeon.slug} ${group.id} ${key}`);groupMembers.add(key);if(!palIds.has(member.palId))fail(`unknown Pal ${dungeon.slug} ${member.palId}`);if(!memberRoles.has(member.memberRole))fail(`invalid member role ${dungeon.slug} ${group.id}`);if(member.memberRole==="primary")primaryCount++;if(member.levelMin<=0||member.levelMin>member.levelMax||member.quantityMin<=0||member.quantityMin>member.quantityMax)fail(`encounter range ${dungeon.slug} ${member.palId}`);visiblePalIds.add(member.palId)}
    if(["boss","midboss"].includes(group.roomRole)){if(primaryCount!==1||group.members.some(member=>member.memberRole==="member"))fail(`boss group composition ${dungeon.slug} ${group.id}`)}else if(primaryCount||group.members.some(member=>member.memberRole!=="member"))fail(`non-boss group composition ${dungeon.slug} ${group.id}`);
  }
  const poolIds=new Set(),visibleItemIds=new Set();
  for(const pool of dungeon.itemPools){
    if(!/^(?:normal|special)-[1-9][0-9]*$/.test(pool.id)||poolIds.has(pool.id))fail(`invalid or duplicate item pool ${dungeon.slug} ${pool.id}`);poolIds.add(pool.id);
    if(!["normal","special"].includes(pool.kind)||!pool.slots.length)fail(`invalid item pool ${dungeon.slug} ${pool.id}`);
    const slots=new Set();
    for(const slot of pool.slots){if(!Number.isInteger(slot.slot)||slot.slot<1||slot.slot>15||slots.has(slot.slot)||!slot.candidates.length)fail(`invalid item slot ${dungeon.slug} ${pool.id} ${slot.slot}`);slots.add(slot.slot);const candidates=new Set();for(const candidate of slot.candidates){itemCandidateCount++;const key=`${candidate.itemId}|${candidate.min}|${candidate.max}`;if(candidates.has(key))fail(`duplicate item candidate ${dungeon.slug} ${pool.id} ${slot.slot} ${key}`);candidates.add(key);if(!itemIds.has(candidate.itemId))fail(`unknown item ${dungeon.slug} ${candidate.itemId}`);if(candidate.min<=0||candidate.min>candidate.max)fail(`item quantity ${dungeon.slug} ${candidate.itemId}`);visibleItemIds.add(candidate.itemId)}}
  }
  if(!Array.isArray(dungeon.resources))fail(`resource array ${dungeon.slug}`);
  const rewardSourceIds=new Set(),visibleRewardItemIds=new Set();
  for(const source of dungeon.rewardSources){
    rewardSourceCount++;
    if(!rewardKinds.has(source.kind)||!new RegExp(`^${source.kind}-[1-9][0-9]*$`).test(source.id)||rewardSourceIds.has(source.id))fail(`reward source ${dungeon.slug} ${source.id}`);rewardSourceIds.add(source.id);
    if(!Number.isInteger(source.palCandidateCount)||source.palCandidateCount<0||(source.kind==="pal-egg"&&source.palCandidateCount===0))fail(`reward Pal candidate count ${dungeon.slug} ${source.id}`);
    const pickupIds=new Set();for(const pickup of source.pickups){if(!/^PickupItem_/.test(pickup.id)||pickupIds.has(pickup.id))fail(`reward pickup ${dungeon.slug} ${source.id} ${pickup.id}`);pickupIds.add(pickup.id);if(JSON.stringify(Object.keys(pickup.names).sort())!==JSON.stringify([...expectedLocales].sort())||Object.values(pickup.names).some(value=>!value.trim()))fail(`reward pickup locale coverage ${dungeon.slug} ${pickup.id}`)}
    for(const pool of source.itemPools){if(pool.kind!=="reward"||pool.id!=="reward-1"||!pool.slots.length)fail(`reward item pool ${dungeon.slug} ${source.id}`);const slots=new Set();for(const slot of pool.slots){if(!Number.isInteger(slot.slot)||slot.slot<1||slot.slot>15||slots.has(slot.slot)||!slot.candidates.length)fail(`reward item slot ${dungeon.slug} ${source.id} ${slot.slot}`);slots.add(slot.slot);const candidates=new Set();for(const candidate of slot.candidates){const key=`${candidate.itemId}|${candidate.min}|${candidate.max}`;if(candidates.has(key)||!itemIds.has(candidate.itemId)||candidate.min<=0||candidate.min>candidate.max)fail(`reward item candidate ${dungeon.slug} ${source.id} ${key}`);candidates.add(key);visibleRewardItemIds.add(candidate.itemId)}}}
  }
  rewardItemCandidateCount+=visibleRewardItemIds.size;
  if(dungeon.kind==="fixed"){
    if(dungeon.itemPools.length||dungeon.resources.length||dungeon.rewardSources.length||dungeon.coverage.resources!=="not-applicable"||dungeon.coverage.itemPools!=="not-applicable"||dungeon.coverage.rewardSources!=="not-applicable"||dungeon.coverage.rewardContents!=="not-applicable")fail(`fixed Dungeon exposes inapplicable loot sections ${dungeon.slug}`);
  }else{
    if(dungeon.resources.length||dungeon.coverage.resources!=="unverified")fail(`rotating Dungeon resource status ${dungeon.slug}`);
    if(dungeon.coverage.itemPools!=="verified"||dungeon.coverage.rewardSources!=="verified"||dungeon.coverage.rewardContents!=="partial"||!dungeon.itemPools.length||!dungeon.rewardSources.length)fail(`rotating Dungeon extracted coverage ${dungeon.slug}`);
  }
  if(dungeon.coverage.entrances!==dungeon.entranceStatus||dungeon.coverage.encounters!==(dungeon.encounterGroups.length?"verified":"verified-empty"))fail(`coverage summary ${dungeon.slug}`);
  if(dungeon.summary.palCount!==visiblePalIds.size||dungeon.summary.encounterGroupCount!==dungeon.encounterGroups.length||dungeon.summary.itemCandidateCount!==visibleItemIds.size||dungeon.summary.rewardSourceCount!==dungeon.rewardSources.length||dungeon.summary.rewardItemCandidateCount!==visibleRewardItemIds.size||dungeon.summary.entranceCount!==dungeon.entrances.length)fail(`summary mismatch ${dungeon.slug}`);
  for(const legacy of ["encounters","items","rewardKinds","rewardTypes","resourceStatus","rewardContentsStatus","level"])if(Object.hasOwn(dungeon,legacy))fail(`legacy flattened field ${legacy} remains on ${dungeon.slug}`);
  if(Object.hasOwn(dungeon.summary,"materialItemCount"))fail(`material items must not be presented as resources for ${dungeon.slug}`);
}
if(fixedCount!==data.meta.fixedCount||rotatingCount!==data.meta.rotatingCount||entranceCount!==data.meta.entranceCount||rewardSourceCount!==data.meta.rewardSourceCount||rewardItemCandidateCount!==data.meta.rewardItemCandidateCount)fail("aggregate mismatch");
if(encounterGroupCount!==366||itemCandidateCount!==536)fail(`relationship count drift ${encounterGroupCount}/${itemCandidateCount}`);
if(!data.dungeons.some(dungeon=>dungeon.slug==="hillside-cavern"&&dungeon.entrances.length===11&&dungeon.encounterLevel?.min===5&&dungeon.entranceStatus==="partial"))fail("Hillside Cavern golden record");
const frozen=data.dungeons.find(dungeon=>dungeon.slug==="sealed-realm-frozen-wings"),frozenGroup=frozen?.encounterGroups[0];
if(!frozen||frozen.encounterGroups.length!==1||frozenGroup?.members.length!==2||!frozenGroup.members.some(member=>member.palId==="CaptainPenguin"&&member.memberRole==="primary"&&member.levelMin===15&&member.quantityMin===1)||!frozenGroup.members.some(member=>member.palId==="Penguin"&&member.memberRole==="companion"&&member.levelMin===10&&member.levelMax===12&&member.quantityMin===3))fail("Sealed Realm boss-companion golden record");
console.log(`Validated ${data.meta.dungeonCount} dungeons, ${entranceCount} entrances, ${encounterGroupCount} encounter groups, ${itemCandidateCount} floor item candidates, ${rewardSourceCount} reward sources and ${rewardItemCandidateCount} unique per-dungeon reward item candidates without inferred resources.`);
