import fs from "node:fs";

const data=JSON.parse(fs.readFileSync("public/data/map-markers.json","utf8"));
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
console.log(`Validated ${data.bosses.length} bosses, ${data.habitats.length} habitats and ${data.fastTravel?.length||0} fast-travel markers across ${data.worlds.length} maps.`);
