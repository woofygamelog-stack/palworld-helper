import fs from "node:fs";
import path from "node:path";
import { dungeonPublicDefinitions, sourceLocaleToSiteLocale } from "./dungeon-public-config.mjs";

const root=process.cwd(),gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const dungeonSource=process.env.PAL_DUNGEON_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-dungeons`);
const mapSource=process.env.PAL_MAP_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-map-refresh`);
const actorSource=process.env.PAL_ACTOR_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-map-actor-chunks-v2`);
const outputPath=path.join(root,"public","data","dungeons.json");
const read=(directory,name)=>JSON.parse(fs.readFileSync(path.join(directory,name),"utf8"));
const requiredDungeonFiles=["dungeon-manifest.json","dungeon-class-defaults.raw.json","dungeon-levels.raw.json","dungeon-spawn-areas.raw.json","dungeon-enemy-spawns.raw.json","dungeon-item-lottery.raw.json","dungeon-reward-lottery.raw.json","dungeon-names.raw.json","field-lottery-names.raw.json","item-lottery.raw.json"];
for(const file of requiredDungeonFiles)if(!fs.existsSync(path.join(dungeonSource,file)))throw new Error(`Missing private dungeon extraction: ${file}`);

const manifest=read(dungeonSource,"dungeon-manifest.json");
if(manifest.mode!=="dungeon"||manifest.localeCount!==17)throw new Error("Dungeon extraction manifest is incompatible.");
if(manifest.mappingHash!=="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851")throw new Error("Dungeon extraction mapping hash is not approved for this build.");
const namesRaw=read(dungeonSource,"dungeon-names.raw.json"),spawnAreas=read(dungeonSource,"dungeon-spawn-areas.raw.json"),levels=read(dungeonSource,"dungeon-levels.raw.json");
const enemyRows=Object.values(read(dungeonSource,"dungeon-enemy-spawns.raw.json")),dungeonItemRows=Object.values(read(dungeonSource,"dungeon-item-lottery.raw.json"));
const rewardRows=Object.values(read(dungeonSource,"dungeon-reward-lottery.raw.json")),fieldLottery=read(dungeonSource,"field-lottery-names.raw.json"),itemLotteryRows=Object.values(read(dungeonSource,"item-lottery.raw.json"));
const classDefaults=read(dungeonSource,"dungeon-class-defaults.raw.json"),wildRows=Object.values(read(mapSource,"pal-wild-spawners.raw.json"));
const palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8")),mapData=JSON.parse(fs.readFileSync(path.join(root,"public","data","map-markers.json"),"utf8"));
if(palData.meta.gameBuild!==gameBuild||itemData.meta.gameBuild!==gameBuild||mapData.meta.gameBuild!==gameBuild)throw new Error("Dungeon sources and public catalogs use different game builds.");
const palsByLower=new Map(palData.pals.map(pal=>[pal.id.toLowerCase(),pal])),itemsByLower=new Map(itemData.items.map(item=>[item.id.toLowerCase(),item]));
const resolvePal=raw=>{if(typeof raw!=="string"||raw==="None")return null;return palsByLower.get(raw.replace(/^BOSS_/i,"").replace(/^GYM_/i,"").toLowerCase())?.id||null};
const resolveItem=raw=>{if(typeof raw!=="string"||raw==="None")return null;return itemsByLower.get(raw.toLowerCase())?.id||null};
const localizedNames=nameId=>Object.fromEntries(Object.entries(sourceLocaleToSiteLocale).map(([sourceLocale,siteLocale])=>{
  const value=namesRaw[sourceLocale]?.[nameId]?.trim();
  if(!value||/^(?:[a-z-]+[ _]Text|\?\?\?|This Dungeon is under investigation\.)$/i.test(value))throw new Error(`Unpublishable dungeon name ${nameId} for ${sourceLocale}`);
  return [siteLocale,value];
}));
const worldFor=(x,y)=>mapData.worlds.find(world=>x>=world.minX&&x<=world.maxX&&y>=world.minY&&y<=world.maxY)?.id;
const mapCoords=(x,y)=>({x:(y-158000)/459,y:(x+123888)/459});
const rankRole=value=>({Normal:"normal",Normal02:"normal",Normal03:"normal",Normal04:"normal",Boss:"boss",MidBoss:"midboss",Monster:"monster",FishPal:"aquatic"}[String(value).split("::").at(-1)]||null);
const mergeEncounter=(map,palId,role,row)=>{
  const key=`${role}|${palId}`,current=map.get(key)||{palId,role,levelMin:Number.POSITIVE_INFINITY,levelMax:0,quantityMin:Number.POSITIVE_INFINITY,quantityMax:0};
  current.levelMin=Math.min(current.levelMin,Number(row.levelMin));current.levelMax=Math.max(current.levelMax,Number(row.levelMax));
  current.quantityMin=Math.min(current.quantityMin,Number(row.quantityMin));current.quantityMax=Math.max(current.quantityMax,Number(row.quantityMax));map.set(key,current);
};
const encountersForSpawners=(spawners)=>{
  const encounters=new Map();
  for(const spawner of spawners){
    const role=spawner.role;if(!role)continue;
    for(const wild of wildRows.filter(row=>row.SpawnerName===spawner.name))for(let slot=1;slot<=3;slot++){
      const palId=resolvePal(wild[`Pal_${slot}`]);if(!palId)continue;
      mergeEncounter(encounters,palId,role,{levelMin:wild[`LvMin_${slot}`],levelMax:wild[`LvMax_${slot}`],quantityMin:wild[`NumMin_${slot}`],quantityMax:wild[`NumMax_${slot}`]});
    }
  }
  return [...encounters.values()].map(row=>({...row,levelMin:Number.isFinite(row.levelMin)?row.levelMin:0,quantityMin:Number.isFinite(row.quantityMin)?row.quantityMin:0})).sort((a,b)=>a.role.localeCompare(b.role)||a.levelMin-b.levelMin||a.palId.localeCompare(b.palId));
};
const itemsForAreas=areaIds=>{
  const fieldKinds=new Map();
  for(const row of dungeonItemRows.filter(row=>areaIds.includes(row.SpawnAreaId))){
    if(!fieldLottery[row.ItemFieldLotteryName])throw new Error(`Unknown dungeon item lottery field ${row.ItemFieldLotteryName}`);
    const kind=String(row.Type).split("::").at(-1)==="Special"?"special":"floor";
    fieldKinds.set(row.ItemFieldLotteryName,kind);
  }
  const results=new Map();
  for(const row of itemLotteryRows.filter(row=>fieldKinds.has(row.FieldName))){
    const itemId=resolveItem(row.StaticItemId);if(!itemId)continue;
    const source=fieldKinds.get(row.FieldName),key=`${source}|${itemId}`,current=results.get(key)||{itemId,source,min:Number.POSITIVE_INFINITY,max:0};
    current.min=Math.min(current.min,Number(row.MinNum)||0);current.max=Math.max(current.max,Number(row.MaxNum)||0);results.set(key,current);
  }
  return [...results.values()].map(row=>({...row,min:Number.isFinite(row.min)?row.min:0})).sort((a,b)=>a.source.localeCompare(b.source)||a.itemId.localeCompare(b.itemId));
};
const rewardKindsForAreas=areaIds=>{
  const kinds=new Set();
  for(const row of rewardRows.filter(row=>areaIds.includes(row.SpawnAreaId)&&Number(row.Weight)>0)){
    const content=String(row.SpawnerContentType).split("::").at(-1),value=String(row.LotteryValueBlueprintClassName||row.LotteryValue||"");
    if(content==="Cage")kinds.add("pal-cage");else if(content==="PalSpawner")kinds.add("pal");else if(/Treasure_/i.test(value))kinds.add("treasure-chest");else if(/palegg/i.test(value))kinds.add("pal-egg");else if(/Lotus/i.test(value))kinds.add("lotus");else if(/SkillFruits/i.test(value))kinds.add("skill-fruit");else if(/CaveMushroom/i.test(value))kinds.add("cave-mushroom");else if(/Mushroom/i.test(value))kinds.add("mushroom");else if(/Elixir/i.test(value))kinds.add("elixir");else if(/Junk/i.test(value))kinds.add("salvage");
  }
  return [...kinds].sort();
};
const actorFiles=fs.readdirSync(actorSource).filter(file=>file.endsWith(".raw.json")).sort();
if(actorFiles.length!==10)throw new Error(`Expected 10 complete actor chunks, found ${actorFiles.length}`);
const dungeonActors=[];let selectedPackages=0,parsedPackages=0;
for(const file of actorFiles){const chunk=read(actorSource,file);selectedPackages+=chunk.selectedPackageCount;parsedPackages+=chunk.parsedPackageCount;if(chunk.failedPackageCount)throw new Error(`${file} contains failed packages`);for(const actor of chunk.actors){const z=Number(actor.location?.Z);if(z>-20000&&/(DungeonFixedEntrance|DungeonPortalMarker|DungeonExit_grassLand)/i.test(actor.actorType))dungeonActors.push(actor)}}
if(selectedPackages!==9977||parsedPackages!==9977||dungeonActors.length!==31)throw new Error(`Dungeon entrance scan drifted: ${dungeonActors.length} entrances from ${parsedPackages}/${selectedPackages} packages.`);
const defaultPortalAreas=(classDefaults["portal-grass-1"]?.SpawnAreaIds||[]).map(value=>value.Key).filter(Boolean);
const fixedDefaultNameByType={
  BP_DungeonFixedEntrance_grass_1_C:classDefaults["fixed-grass-1"]?.DungeonNameRowHandle?.RowName,
  BP_DungeonFixedEntrance_grass_5_C:classDefaults["fixed-grass-5"]?.DungeonNameRowHandle?.RowName,
  BP_DungeonFixedEntrance_grass_6_C:classDefaults["fixed-grass-6"]?.DungeonNameRowHandle?.RowName,
  BP_DungeonFixedEntrance_grass_7_C:classDefaults["fixed-grass-7"]?.DungeonNameRowHandle?.RowName
};
const entranceRows=[];
for(const actor of dungeonActors){
  const rotating=/DungeonPortalMarker/i.test(actor.actorType),areaIds=rotating?(actor.properties?.SpawnAreaIds?.map(value=>value.Key).filter(Boolean)||defaultPortalAreas):[];
  const nameId=rotating?spawnAreas[areaIds[0]]?.DungeonNameTextId:actor.properties?.DungeonNameRowHandle?.RowName||fixedDefaultNameByType[actor.actorType];
  const definition=dungeonPublicDefinitions[nameId];if(!definition)continue;
  const x=Number(actor.location.X),y=Number(actor.location.Y),z=Number(actor.location.Z),worldId=worldFor(x,y);if(!worldId)throw new Error(`Dungeon entrance ${definition.slug} is outside every world.`);
  entranceRows.push({slug:definition.slug,worldId,type:rotating?"rotation-candidate":"fixed",x,y,z,map:mapCoords(x,y),enemySpawnerPath:actor.properties?.EnemySpawnerSoftClass?.AssetPathName||null,cooldownMinutes:rotating?null:Number(actor.properties?.RespawnCoolTimeMinutesAfterBossDefeated)||null});
}
entranceRows.sort((a,b)=>a.slug.localeCompare(b.slug)||a.x-b.x||a.y-b.y);
const entrancesBySlug=new Map();for(const entrance of entranceRows){const rows=entrancesBySlug.get(entrance.slug)||[];rows.push({...entrance,id:`${entrance.slug}-${rows.length+1}`});entrancesBySlug.set(entrance.slug,rows)}
const areasByNameId=new Map();for(const [areaId,row] of Object.entries(spawnAreas)){const list=areasByNameId.get(row.DungeonNameTextId)||[];list.push(areaId);areasByNameId.set(row.DungeonNameTextId,list)}
const dungeons=[];
for(const [nameId,definition] of Object.entries(dungeonPublicDefinitions)){
  const areaIds=areasByNameId.get(nameId)||[],entrances=entrancesBySlug.get(definition.slug)||[];
  if(definition.kind==="fixed"&&!entrances.length)continue;
  const spawners=definition.kind==="rotating"?enemyRows.filter(row=>areaIds.includes(row.SpawnAreaId)).map(row=>({name:row.SpawnerName,role:rankRole(row.RankType)})):entrances.flatMap(entrance=>{const match=entrance.enemySpawnerPath?.match(/BP_PalSpawner_Sheets_(.+?)\.[^./]+$/);return match?[{name:match[1],role:"boss"}]:[]});
  const encounters=encountersForSpawners(spawners),items=definition.kind==="rotating"?itemsForAreas(areaIds):[],rewardKinds=definition.kind==="rotating"?rewardKindsForAreas(areaIds):[];
  const levelsFound=encounters.flatMap(row=>[row.levelMin,row.levelMax]).filter(value=>Number.isFinite(value)&&value>0),materialItemCount=items.filter(row=>itemsByLower.get(row.itemId.toLowerCase())?.type==="Material").length;
  dungeons.push({slug:definition.slug,names:localizedNames(nameId),kind:definition.kind,verification:"game-files",level:levelsFound.length?{min:Math.min(...levelsFound),max:Math.max(...levelsFound)}:null,entrances:entrances.map(({slug:_slug,enemySpawnerPath,...entry})=>entry),encounters,items,rewardKinds,summary:{palCount:new Set(encounters.map(row=>row.palId)).size,itemCount:new Set(items.map(row=>row.itemId)).size,materialItemCount,entranceCount:entrances.length}});
}
dungeons.sort((a,b)=>(a.level?.min??Number.MAX_SAFE_INTEGER)-(b.level?.min??Number.MAX_SAFE_INTEGER)||a.names["en-US"].localeCompare(b.names["en-US"])||a.slug.localeCompare(b.slug));
const slugs=new Set();for(const dungeon of dungeons){if(slugs.has(dungeon.slug))throw new Error(`Duplicate dungeon slug ${dungeon.slug}`);slugs.add(dungeon.slug);if(Object.keys(dungeon.names).length!==17)throw new Error(`Dungeon locale coverage failed for ${dungeon.slug}`)}
const payload={meta:{schema:1,gameBuild,localeCount:17,dungeonCount:dungeons.length,fixedCount:dungeons.filter(row=>row.kind==="fixed").length,rotatingCount:dungeons.filter(row=>row.kind==="rotating").length,entranceCount:dungeons.reduce((sum,row)=>sum+row.entrances.length,0),verification:"game-files",probabilitiesVerified:false},dungeons};
fs.writeFileSync(outputPath,JSON.stringify(payload));
console.log(`Imported ${payload.meta.dungeonCount} dungeons (${payload.meta.fixedCount} fixed, ${payload.meta.rotatingCount} rotating), ${payload.meta.entranceCount} linked entrances, ${dungeons.reduce((sum,row)=>sum+row.encounters.length,0)} encounter records and ${dungeons.reduce((sum,row)=>sum+row.items.length,0)} item records.`);
