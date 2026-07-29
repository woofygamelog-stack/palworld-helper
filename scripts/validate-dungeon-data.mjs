import fs from "node:fs";

const data=JSON.parse(fs.readFileSync("public/data/dungeons.json","utf8"));
const pals=JSON.parse(fs.readFileSync("public/data/pals.json","utf8"));
const items=JSON.parse(fs.readFileSync("public/data/items.json","utf8"));
const maps=JSON.parse(fs.readFileSync("public/data/map-markers.json","utf8"));
const fail=message=>{throw new Error(`Dungeon validation failed: ${message}`)};
const expectedLocales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
if(data.meta.schema!==1||data.meta.gameBuild!=="24181527"||data.meta.verification!=="game-files")fail("metadata mismatch");
if(data.meta.localeCount!==expectedLocales.length||data.meta.dungeonCount!==28||data.meta.fixedCount!==18||data.meta.rotatingCount!==10||data.meta.entranceCount!==31)fail("build-specific count drift");
if(data.meta.probabilitiesVerified!==false)fail("unverified lottery weights must not become probabilities");
if(data.dungeons.length!==data.meta.dungeonCount)fail("dungeon count mismatch");
const palIds=new Set(pals.pals.map(pal=>pal.id)),itemIds=new Set(items.items.map(item=>item.id)),worlds=new Map(maps.worlds.map(world=>[world.id,world])),slugs=new Set(),entranceIds=new Set();
const rewardKinds=new Set(["pal-cage","pal","treasure-chest","pal-egg","lotus","skill-fruit","cave-mushroom","mushroom","elixir","salvage"]);
let fixedCount=0,rotatingCount=0,entranceCount=0;
for(const dungeon of data.dungeons){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dungeon.slug)||slugs.has(dungeon.slug))fail(`invalid or duplicate slug ${dungeon.slug}`);slugs.add(dungeon.slug);
  if(dungeon.kind==="fixed")fixedCount++;else if(dungeon.kind==="rotating")rotatingCount++;else fail(`invalid kind ${dungeon.slug}`);
  if(dungeon.verification!=="game-files")fail(`unverified dungeon published ${dungeon.slug}`);
  if(JSON.stringify(Object.keys(dungeon.names).sort())!==JSON.stringify([...expectedLocales].sort()))fail(`locale coverage ${dungeon.slug}`);
  for(const value of Object.values(dungeon.names))if(!value.trim()||/^(?:[a-z-]+[ _]Text|\?\?\?|This Dungeon is under investigation\.)$/i.test(value))fail(`placeholder name ${dungeon.slug}`);
  if(dungeon.level&&(!Number.isFinite(dungeon.level.min)||!Number.isFinite(dungeon.level.max)||dungeon.level.min<=0||dungeon.level.min>dungeon.level.max))fail(`level range ${dungeon.slug}`);
  if(dungeon.kind==="fixed"&&dungeon.entrances.length!==1)fail(`fixed entrance count ${dungeon.slug}`);
  entranceCount+=dungeon.entrances.length;
  for(const entrance of dungeon.entrances){const world=worlds.get(entrance.worldId);if(!world)fail(`unknown entrance world ${entrance.id}`);if(entranceIds.has(entrance.id))fail(`duplicate entrance ${entrance.id}`);entranceIds.add(entrance.id);if(!["fixed","rotation-candidate"].includes(entrance.type))fail(`entrance type ${entrance.id}`);if(!Number.isFinite(entrance.x)||!Number.isFinite(entrance.y)||!Number.isFinite(entrance.z)||entrance.x<world.minX||entrance.x>world.maxX||entrance.y<world.minY||entrance.y>world.maxY)fail(`entrance coordinates ${entrance.id}`);if(!Number.isFinite(entrance.map?.x)||!Number.isFinite(entrance.map?.y))fail(`display coordinates ${entrance.id}`);if(entrance.type==="fixed"&&entrance.cooldownMinutes!==60)fail(`fixed cooldown ${entrance.id}`);if(entrance.type==="rotation-candidate"&&entrance.cooldownMinutes!==null)fail(`rotation cooldown ${entrance.id}`)}
  const encounterKeys=new Set();for(const encounter of dungeon.encounters){const key=`${encounter.role}|${encounter.palId}`;if(encounterKeys.has(key))fail(`duplicate encounter ${dungeon.slug} ${key}`);encounterKeys.add(key);if(!palIds.has(encounter.palId))fail(`unknown Pal ${dungeon.slug} ${encounter.palId}`);if(!["normal","boss","midboss","monster","aquatic"].includes(encounter.role))fail(`encounter role ${dungeon.slug}`);if(encounter.levelMin<=0||encounter.levelMin>encounter.levelMax||encounter.quantityMin<=0||encounter.quantityMin>encounter.quantityMax)fail(`encounter range ${dungeon.slug} ${encounter.palId}`)}
  const itemKeys=new Set();for(const item of dungeon.items){const key=`${item.source}|${item.itemId}`;if(itemKeys.has(key))fail(`duplicate item ${dungeon.slug} ${key}`);itemKeys.add(key);if(!itemIds.has(item.itemId))fail(`unknown item ${dungeon.slug} ${item.itemId}`);if(!["floor","special"].includes(item.source)||item.min<=0||item.min>item.max)fail(`item range ${dungeon.slug} ${item.itemId}`)}
  for(const kind of dungeon.rewardKinds)if(!rewardKinds.has(kind))fail(`reward kind ${dungeon.slug} ${kind}`);
  if(dungeon.summary.palCount!==new Set(dungeon.encounters.map(row=>row.palId)).size||dungeon.summary.itemCount!==new Set(dungeon.items.map(row=>row.itemId)).size||dungeon.summary.entranceCount!==dungeon.entrances.length)fail(`summary mismatch ${dungeon.slug}`);
}
if(fixedCount!==data.meta.fixedCount||rotatingCount!==data.meta.rotatingCount||entranceCount!==data.meta.entranceCount)fail("aggregate mismatch");
if(!data.dungeons.some(dungeon=>dungeon.slug==="hillside-cavern"&&dungeon.entrances.length===11&&dungeon.level?.min===5))fail("Hillside Cavern golden record");
if(!data.dungeons.some(dungeon=>dungeon.slug==="sealed-realm-ardent"&&dungeon.encounters.some(encounter=>encounter.palId==="FlameBuffalo"&&encounter.levelMin===15)))fail("Sealed Realm golden record");
console.log(`Validated ${data.meta.dungeonCount} dungeons, ${entranceCount} entrances, ${data.dungeons.reduce((sum,row)=>sum+row.encounters.length,0)} encounter relations and ${data.dungeons.reduce((sum,row)=>sum+row.items.length,0)} item relations.`);
