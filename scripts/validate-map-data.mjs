import fs from "node:fs";

const data=JSON.parse(fs.readFileSync("public/data/map-markers.json","utf8"));
const pointData=JSON.parse(fs.readFileSync("public/data/map-points.json","utf8"));
const worldById=new Map(data.worlds.map(world=>[world.id,world]));
const surfaceResourceCounts={ore:1555,coal:497,sulfur:257,quartz:496};
const surfaceResourceAnchors={
  ore:{x:-459270.72,y:202074.19},
  coal:{x:-457591.2,y:-118155.234},
  sulfur:{x:-455647.25,y:-149972.66},
  quartz:{x:-571012.44,y:129335.625}
};
if(pointData.points.length!==Object.values(pointData.counts).reduce((sum,count)=>sum+count,0))throw new Error("Map point count mismatch");
const pointIds=new Set();
for(const point of pointData.points){const world=worldById.get(point.worldId);if(!world)throw new Error(`Unknown point world ${point.id}`);if(point.x<world.minX||point.x>world.maxX||point.y<world.minY||point.y>world.maxY)throw new Error(`Out-of-bounds point ${point.id}`);if(pointIds.has(point.id))throw new Error(`Duplicate point ${point.id}`);if(!point.icon?.startsWith("/assets/")||!fs.existsSync(`public${point.icon}`))throw new Error(`Missing point icon ${point.id}`);if(/BP_|_C$|Spawner|LevelObject/i.test(point.subtype))throw new Error(`Internal actor type leaked through ${point.id}`);if(point.category in surfaceResourceCounts&&(!Number.isFinite(point.z)||point.z<=-20000))throw new Error(`Underground resource leaked through ${point.id}`);pointIds.add(point.id)}
for(const [category,count] of Object.entries({redBerry:1939,mushroom:274,oil:185,egg:1816,skillFruit:47,...surfaceResourceCounts,merchant:16,palMerchant:6,fishing:546,randomEvent:87,dungeon:31,bounty:24,collectibleShrine:104,palStatue:11}))if(pointData.counts[category]!==count)throw new Error(`Unexpected ${category} count ${pointData.counts[category]}`);
for(const [category,count] of Object.entries(surfaceResourceCounts)){const resources=pointData.points.filter(point=>point.category===category);if(resources.length!==count)throw new Error(`Surface resource count mismatch for ${category}`);const anchor=surfaceResourceAnchors[category];if(!resources.some(point=>Math.abs(point.x-anchor.x)<0.01&&Math.abs(point.y-anchor.y)<0.01&&point.z>0))throw new Error(`Surface resource anchor missing for ${category}`)}
const fail=message=>{throw new Error(`Map validation failed: ${message}`)};
if(data.meta.gameBuild!=="24181527")fail("unexpected game build");
if(data.meta.bossCount!==data.bosses.length||data.meta.habitatCount!==data.habitats.length)fail("metadata count mismatch");
if(data.worlds.length!==2)fail("Palpagos and World Tree definitions are required");
const worlds=new Map(data.worlds.map(world=>[world.id,world]));
const ids=new Set();
for(const marker of [...data.bosses,...data.habitats,...(data.fastTravel||[])]){
  if(ids.has(marker.id))fail(`duplicate marker ID ${marker.id}`);
  ids.add(marker.id);
  const world=worlds.get(marker.worldId);
  if(!world)fail(`unknown world ${marker.worldId}`);
  if(!Number.isFinite(marker.x)||!Number.isFinite(marker.y))fail(`non-finite coordinate ${marker.id}`);
  if(marker.x<world.minX||marker.x>world.maxX||marker.y<world.minY||marker.y>world.maxY)fail(`out-of-bounds marker ${marker.id}`);
}
const palpagosBosses=data.bosses.filter(marker=>marker.worldId==="palpagos");
const treeBosses=data.bosses.filter(marker=>marker.worldId==="tree");
if(palpagosBosses.length!==83||treeBosses.length!==7)fail(`unexpected build-specific boss split ${palpagosBosses.length}/${treeBosses.length}`);
const chillet=data.bosses.find(marker=>marker.palId==="WeaselDragon");
if(!chillet)fail("Chillet coordinate anchor is missing");
const converted={x:(chillet.y-158000)/459,y:(chillet.x+123888)/459};
if(Math.abs(converted.x-172.37)>0.1||Math.abs(converted.y+417.64)>0.1)fail("game-map coordinate conversion drift");
const palpagos=worlds.get("palpagos");
const projected={left:(chillet.y-palpagos.minY)/(palpagos.maxY-palpagos.minY)*100,top:(palpagos.maxX-chillet.x)/(palpagos.maxX-palpagos.minX)*100};
if(Math.abs(projected.left-66.365)>0.01||Math.abs(projected.top-45.899)>0.01)fail("map-image projection drift");
const restored={x:palpagos.maxX-projected.top/100*(palpagos.maxX-palpagos.minX),y:palpagos.minY+projected.left/100*(palpagos.maxY-palpagos.minY)};
if(Math.abs(restored.x-chillet.x)>0.01||Math.abs(restored.y-chillet.y)>0.01)fail("map-image inverse projection drift");
const palIds=new Set(JSON.parse(fs.readFileSync("public/data/pals.json","utf8")).pals.map(pal=>pal.id));
if(data.bosses.some(marker=>!palIds.has(marker.palId)))fail("boss marker has an unknown Pal reference");
console.log(`Validated ${data.bosses.length} bosses, ${data.habitats.length} habitats and ${data.fastTravel?.length||0} fast-travel markers across ${data.worlds.length} maps.`);
