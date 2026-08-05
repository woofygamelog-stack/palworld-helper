import fs from "node:fs";
import {mapPointCategoryById,mapPointCategoryDefinitions} from "../src/map-point-categories.ts";

const data=JSON.parse(fs.readFileSync("public/data/map-markers.json","utf8"));
const pointData=JSON.parse(fs.readFileSync("public/data/map-points.json","utf8"));
const dungeonData=JSON.parse(fs.readFileSync("public/data/dungeons.json","utf8"));
const worldById=new Map(data.worlds.map(world=>[world.id,world]));
const surfaceResourceCounts={ore:1555,coal:497,sulfur:257,quartz:496};
const surfaceResourceAnchors={
  ore:{x:-459270.72,y:202074.19},
  coal:{x:-457591.2,y:-118155.234},
  sulfur:{x:-455647.25,y:-149972.66},
  quartz:{x:-571012.44,y:129335.625}
};
if(pointData.points.length!==Object.values(pointData.counts).reduce((sum,count)=>sum+count,0))throw new Error("Map point count mismatch");
const publishedCategories=Object.keys(pointData.counts).sort(),contractCategories=mapPointCategoryDefinitions.map(definition=>definition.id).sort();
if(JSON.stringify(publishedCategories)!==JSON.stringify(contractCategories))throw new Error(`Map category contract mismatch: published=${publishedCategories.join(",")} contract=${contractCategories.join(",")}`);
for(const definition of mapPointCategoryDefinitions){
  if(definition.iconPath&&!fs.existsSync(`public${definition.iconPath}`))throw new Error(`Missing contracted icon for ${definition.id}`);
  if(!definition.iconPath&&!definition.iconPrefix)throw new Error(`Missing icon contract for ${definition.id}`);
}
const pointIds=new Set();
for(const point of pointData.points){const world=worldById.get(point.worldId),definition=mapPointCategoryById.get(point.category);if(!world)throw new Error(`Unknown point world ${point.id}`);if(!definition)throw new Error(`Unknown point category ${point.id}`);if(point.x<world.minX||point.x>world.maxX||point.y<world.minY||point.y>world.maxY)throw new Error(`Out-of-bounds point ${point.id}`);if(pointIds.has(point.id))throw new Error(`Duplicate point ${point.id}`);if(!point.icon?.startsWith("/assets/")||!fs.existsSync(`public${point.icon}`))throw new Error(`Missing point icon ${point.id}`);if(definition.iconPath&&point.icon!==definition.iconPath)throw new Error(`Unexpected point icon ${point.id}`);if(definition.iconPrefix&&!point.icon.startsWith(definition.iconPrefix))throw new Error(`Unexpected point icon family ${point.id}`);if(typeof point.subtype!=="string"||!point.subtype.trim()||point.subtype.length>80)throw new Error(`Invalid public subtype ${point.id}`);if(/BP_|_C$|Spawner|LevelObject|(?:Ã.|Â.)|[�]/i.test(point.subtype))throw new Error(`Internal or malformed subtype leaked through ${point.id}`);if(point.category in surfaceResourceCounts&&(!Number.isFinite(point.z)||point.z<=-20000))throw new Error(`Underground resource leaked through ${point.id}`);pointIds.add(point.id)}
for(const definition of mapPointCategoryDefinitions){const normalizedCount=pointData.points.filter(point=>point.category===definition.id).length;if(normalizedCount!==pointData.counts[definition.id])throw new Error(`Category count mismatch for ${definition.id}: ${normalizedCount}/${pointData.counts[definition.id]}`)}
for(const [category,count] of Object.entries({redBerry:1939,mushroom:274,oil:185,egg:1816,skillFruit:47,...surfaceResourceCounts,npc:100,merchant:19,palMerchant:6,fishing:546,randomEvent:87,dungeon:31,bounty:33,collectibleShrine:104,palStatue:11,camp:55,note:49,supplyDrop:480,oilRig:1}))if(pointData.counts[category]!==count)throw new Error(`Unexpected ${category} count ${pointData.counts[category]}`);
const exactSubtypeCounts={"enemy-camp":55,"collectible-note":49,"possible-drop-zone":480,"oil-rig":1};
for(const [subtype,count] of Object.entries(exactSubtypeCounts))if(pointData.points.filter(point=>point.subtype===subtype).length!==count)throw new Error(`Unexpected ${subtype} count`);
const dungeonSlugs=new Set(dungeonData.dungeons.map(dungeon=>dungeon.slug)),dungeonPoints=pointData.points.filter(point=>point.category==="dungeon");
if(dungeonPoints.some(point=>!dungeonSlugs.has(point.dungeonSlug)||!["fixed-entrance","rotation-candidate"].includes(point.subtype)))throw new Error("Dungeon map relation is missing or invalid");
const entranceCoordinates=new Set(dungeonData.dungeons.flatMap(dungeon=>dungeon.entrances.map(entrance=>`${dungeon.slug}|${entrance.x}|${entrance.y}|${entrance.z}`)));
if(dungeonPoints.some(point=>!entranceCoordinates.has(`${point.dungeonSlug}|${point.x}|${point.y}|${point.z}`)))throw new Error("Dungeon map point does not match a normalized entrance");
for(const [category,count] of Object.entries(surfaceResourceCounts)){const resources=pointData.points.filter(point=>point.category===category);if(resources.length!==count)throw new Error(`Surface resource count mismatch for ${category}`);const anchor=surfaceResourceAnchors[category];if(!resources.some(point=>Math.abs(point.x-anchor.x)<0.01&&Math.abs(point.y-anchor.y)<0.01&&point.z>0))throw new Error(`Surface resource anchor missing for ${category}`)}
const fail=message=>{throw new Error(`Map validation failed: ${message}`)};
if(data.meta.gameBuild!=="24467282")fail("unexpected game build");
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
console.log(`Validated ${data.bosses.length} bosses, ${data.habitats.length} habitats, ${data.fastTravel?.length||0} fast-travel markers and ${pointData.points.length} points in ${mapPointCategoryDefinitions.length} categories across ${data.worlds.length} maps.`);
