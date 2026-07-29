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
const namesRaw=read(dungeonSource,"dungeon-names.raw.json"),spawnAreas=read(dungeonSource,"dungeon-spawn-areas.raw.json");
const enemyRows=Object.values(read(dungeonSource,"dungeon-enemy-spawns.raw.json")),dungeonItemRows=Object.values(read(dungeonSource,"dungeon-item-lottery.raw.json"));
const rewardRows=Object.values(read(dungeonSource,"dungeon-reward-lottery.raw.json")),fieldLottery=read(dungeonSource,"field-lottery-names.raw.json"),itemLotteryRows=Object.values(read(dungeonSource,"item-lottery.raw.json"));
const classDefaults=read(dungeonSource,"dungeon-class-defaults.raw.json"),wildRows=Object.values(read(mapSource,"pal-wild-spawners.raw.json"));
const palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8")),mapData=JSON.parse(fs.readFileSync(path.join(root,"public","data","map-markers.json"),"utf8"));
if(palData.meta.gameBuild!==gameBuild||itemData.meta.gameBuild!==gameBuild||mapData.meta.gameBuild!==gameBuild)throw new Error("Dungeon sources and public catalogs use different game builds.");
const palsByLower=new Map(palData.pals.map(pal=>[pal.id.toLowerCase(),pal])),itemsByLower=new Map(itemData.items.map(item=>[item.id.toLowerCase(),item]));
const enumValue=value=>String(value).split("::").at(-1);
const resolvePal=raw=>{if(typeof raw!=="string"||raw==="None")return null;return palsByLower.get(raw.replace(/^BOSS_/i,"").replace(/^GYM_/i,"").toLowerCase())?.id||null};
const resolveItem=raw=>{if(typeof raw!=="string"||raw==="None")return null;return itemsByLower.get(raw.toLowerCase())?.id||null};
const localizedNames=nameId=>Object.fromEntries(Object.entries(sourceLocaleToSiteLocale).map(([sourceLocale,siteLocale])=>{
  const value=namesRaw[sourceLocale]?.[nameId]?.trim();
  if(!value||/^(?:[a-z-]+[ _]Text|\?\?\?|This Dungeon is under investigation\.)$/i.test(value))throw new Error(`Unpublishable dungeon name ${nameId} for ${sourceLocale}`);
  return [siteLocale,value];
}));
const worldFor=(x,y)=>mapData.worlds.find(world=>x>=world.minX&&x<=world.maxX&&y>=world.minY&&y<=world.maxY)?.id;
const mapCoords=(x,y)=>({x:(y-158000)/459,y:(x+123888)/459});
const roomRole=value=>({Normal:"normal",Normal02:"normal",Normal03:"normal",Normal04:"normal",Boss:"boss",MidBoss:"midboss",Monster:"monster",FishPal:"aquatic"}[enumValue(value)]||null);
const roomRoleOrder={boss:0,midboss:1,normal:2,monster:3,aquatic:4};

const encounterGroupsForSpawners=spawners=>{
  const uniqueSpawners=[...new Map(spawners.filter(spawner=>spawner.roomRole).map(spawner=>[`${spawner.roomRole}|${spawner.name}`,spawner])).values()];
  const groups=[];
  for(const spawner of uniqueSpawners){
    for(const wild of wildRows.filter(row=>row.SpawnerName===spawner.name)){
      const members=[];
      for(let slot=1;slot<=3;slot++){
        const rawPalId=wild[`Pal_${slot}`],palId=resolvePal(rawPalId);if(!palId)continue;
        const levelMin=Number(wild[`LvMin_${slot}`]),levelMax=Number(wild[`LvMax_${slot}`]),quantityMin=Number(wild[`NumMin_${slot}`]),quantityMax=Number(wild[`NumMax_${slot}`]);
        if(!Number.isFinite(levelMin)||!Number.isFinite(levelMax)||levelMin<=0||levelMin>levelMax||!Number.isFinite(quantityMin)||!Number.isFinite(quantityMax)||quantityMin<=0||quantityMin>quantityMax)throw new Error(`Invalid dungeon encounter member ${palId}`);
        const primary=/^(?:BOSS|GYM)_/i.test(rawPalId),memberRole=primary?"primary":(["boss","midboss"].includes(spawner.roomRole)?"companion":"member");
        members.push({palId,memberRole,levelMin,levelMax,quantityMin,quantityMax});
      }
      if(members.length)groups.push({roomRole:spawner.roomRole,members});
    }
  }
  const signatures=new Set();
  const ordered=groups.filter(group=>{const signature=JSON.stringify(group);if(signatures.has(signature))return false;signatures.add(signature);return true}).sort((a,b)=>{
    const role=(roomRoleOrder[a.roomRole]??99)-(roomRoleOrder[b.roomRole]??99);if(role)return role;
    const aKey=a.members.map(member=>`${member.memberRole}|${member.palId}|${member.levelMin}|${member.quantityMin}`).join(";");
    const bKey=b.members.map(member=>`${member.memberRole}|${member.palId}|${member.levelMin}|${member.quantityMin}`).join(";");
    return aKey.localeCompare(bKey);
  });
  const counters=new Map();
  return ordered.map(group=>{const next=(counters.get(group.roomRole)||0)+1;counters.set(group.roomRole,next);return {id:`${group.roomRole}-${next}`,...group}});
};

const itemPoolsForAreas=areaIds=>{
  const poolDefinitions=new Map();
  for(const row of dungeonItemRows.filter(row=>areaIds.includes(row.SpawnAreaId))){
    const fieldName=row.ItemFieldLotteryName,sourceType=enumValue(row.Type),kind=sourceType==="Special"?"special":sourceType==="Normal"?"normal":null;
    if(!kind)throw new Error(`Unknown dungeon item source type ${sourceType}`);
    if(!fieldLottery[fieldName])throw new Error(`Unknown dungeon item lottery field ${fieldName}`);
    poolDefinitions.set(`${kind}|${fieldName}`,{kind,fieldName});
  }
  const pools=[];
  for(const definition of poolDefinitions.values()){
    const slots=new Map();
    for(const row of itemLotteryRows.filter(row=>row.FieldName===definition.fieldName)){
      const slot=Number(row.SlotNo),activation=Number(fieldLottery[definition.fieldName]?.[`ItemSlot${slot}_ProbabilityPercent`]??0);
      if(!Number.isInteger(slot)||slot<1||slot>15)throw new Error(`Invalid item slot ${definition.fieldName} ${row.SlotNo}`);
      if(activation<=0)continue;
      const itemId=resolveItem(row.StaticItemId);if(!itemId)throw new Error(`Unknown public dungeon item ${row.StaticItemId}`);
      const min=Number(row.MinNum),max=Number(row.MaxNum);
      if(!Number.isFinite(min)||!Number.isFinite(max)||min<=0||min>max)throw new Error(`Invalid dungeon item quantity ${itemId}`);
      const candidates=slots.get(slot)||[];candidates.push({itemId,min,max});slots.set(slot,candidates);
    }
    const publicSlots=[...slots.entries()].sort((a,b)=>a[0]-b[0]).map(([slot,candidates])=>{
      const unique=[...new Map(candidates.map(candidate=>[`${candidate.itemId}|${candidate.min}|${candidate.max}`,candidate])).values()];
      return {slot,candidates:unique.sort((a,b)=>a.itemId.localeCompare(b.itemId)||a.min-b.min||a.max-b.max)};
    });
    if(publicSlots.length)pools.push({kind:definition.kind,slots:publicSlots});
  }
  pools.sort((a,b)=>a.kind.localeCompare(b.kind)||JSON.stringify(a.slots).localeCompare(JSON.stringify(b.slots)));
  const counters=new Map();
  return pools.map(pool=>{const next=(counters.get(pool.kind)||0)+1;counters.set(pool.kind,next);return {id:`${pool.kind}-${next}`,...pool}});
};

const rewardTypesForAreas=areaIds=>{
  const types=new Set();
  for(const row of rewardRows.filter(row=>areaIds.includes(row.SpawnAreaId)&&Number(row.Weight)>0)){
    const content=enumValue(row.SpawnerContentType);
    if(content==="Cage")types.add("pal-cage");
    else if(content==="PalSpawner")types.add("pal");
    else if(content==="MapObjectSpawner")types.add("map-object");
    else throw new Error(`Unknown dungeon reward content type ${content}`);
  }
  return [...types].sort();
};

const actorFiles=fs.readdirSync(actorSource).filter(file=>file.endsWith(".raw.json")).sort();
if(actorFiles.length!==10)throw new Error(`Expected 10 complete actor chunks, found ${actorFiles.length}`);
const dungeonActors=[];let selectedPackages=0,parsedPackages=0;
for(const file of actorFiles){const chunk=read(actorSource,file);selectedPackages+=chunk.selectedPackageCount;parsedPackages+=chunk.parsedPackageCount;if(chunk.failedPackageCount)throw new Error(`${file} contains failed packages`);for(const actor of chunk.actors){const z=Number(actor.location?.Z);if(z>-20000&&/(DungeonFixedEntrance|DungeonPortalMarker|DungeonExit_grassLand)/i.test(actor.actorType))dungeonActors.push(actor)}}
if(selectedPackages!==9977||parsedPackages!==9977||dungeonActors.length!==31)throw new Error(`Dungeon entrance scan drifted: ${dungeonActors.length} entrances from ${parsedPackages}/${selectedPackages} packages.`);
const portalDefaultsByType={BP_DungeonPortalMarker_Grass1_C:(classDefaults["portal-grass-1"]?.SpawnAreaIds||[]).map(value=>value.Key).filter(Boolean)};
const fixedDefaultNameByType={
  BP_DungeonFixedEntrance_grass_1_C:classDefaults["fixed-grass-1"]?.DungeonNameRowHandle?.RowName,
  BP_DungeonFixedEntrance_grass_5_C:classDefaults["fixed-grass-5"]?.DungeonNameRowHandle?.RowName,
  BP_DungeonFixedEntrance_grass_6_C:classDefaults["fixed-grass-6"]?.DungeonNameRowHandle?.RowName,
  BP_DungeonFixedEntrance_grass_7_C:classDefaults["fixed-grass-7"]?.DungeonNameRowHandle?.RowName
};
const entranceRows=[];
for(const actor of dungeonActors){
  const rotating=/DungeonPortalMarker/i.test(actor.actorType),instanceAreas=actor.properties?.SpawnAreaIds?.map(value=>value.Key).filter(Boolean)||[];
  const areaIds=rotating?(instanceAreas.length?instanceAreas:portalDefaultsByType[actor.actorType]):[];
  if(rotating&&!areaIds?.length)throw new Error(`Dungeon portal type ${actor.actorType} has no verified spawn-area default.`);
  const areaNames=rotating?[...new Set(areaIds.map(areaId=>spawnAreas[areaId]?.DungeonNameTextId).filter(Boolean))]:[];
  if(rotating&&areaNames.length!==1)throw new Error(`Dungeon portal ${actor.actorType} resolves to ${areaNames.length} public dungeon names.`);
  const nameId=rotating?areaNames[0]:actor.properties?.DungeonNameRowHandle?.RowName||fixedDefaultNameByType[actor.actorType];
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
  const spawners=definition.kind==="rotating"?enemyRows.filter(row=>areaIds.includes(row.SpawnAreaId)).map(row=>({name:row.SpawnerName,roomRole:roomRole(row.RankType)})):entrances.flatMap(entrance=>{const match=entrance.enemySpawnerPath?.match(/BP_PalSpawner_Sheets_(.+?)\.[^./]+$/);return match?[{name:match[1],roomRole:"boss"}]:[]});
  const encounterGroups=encounterGroupsForSpawners(spawners),itemPools=definition.kind==="rotating"?itemPoolsForAreas(areaIds):[],rewardTypes=definition.kind==="rotating"?rewardTypesForAreas(areaIds):[];
  const members=encounterGroups.flatMap(group=>group.members),levelsFound=members.flatMap(member=>[member.levelMin,member.levelMax]);
  const itemIds=new Set(itemPools.flatMap(pool=>pool.slots.flatMap(slot=>slot.candidates.map(candidate=>candidate.itemId))));
  const entranceStatus=definition.kind==="fixed"?"verified":entrances.length?"partial":"unverified";
  dungeons.push({
    slug:definition.slug,
    names:localizedNames(nameId),
    kind:definition.kind,
    verification:"game-files",
    probabilityStatus:definition.kind==="fixed"?"not-applicable":"unverified-multi-stage",
    entranceStatus,
    encounterLevel:levelsFound.length?{min:Math.min(...levelsFound),max:Math.max(...levelsFound)}:null,
    entrances:entrances.map(({slug:_slug,enemySpawnerPath,...entry})=>entry),
    encounterGroups,
    itemPools,
    rewardTypes,
    rewardContentsStatus:definition.kind==="rotating"&&rewardTypes.length?"unverified":"not-applicable",
    resourceStatus:definition.kind==="rotating"?"unverified":"not-applicable",
    summary:{palCount:new Set(members.map(member=>member.palId)).size,encounterGroupCount:encounterGroups.length,itemCandidateCount:itemIds.size,entranceCount:entrances.length}
  });
}
dungeons.sort((a,b)=>(a.encounterLevel?.min??Number.MAX_SAFE_INTEGER)-(b.encounterLevel?.min??Number.MAX_SAFE_INTEGER)||a.names["en-US"].localeCompare(b.names["en-US"])||a.slug.localeCompare(b.slug));
const slugs=new Set();for(const dungeon of dungeons){if(slugs.has(dungeon.slug))throw new Error(`Duplicate dungeon slug ${dungeon.slug}`);slugs.add(dungeon.slug);if(Object.keys(dungeon.names).length!==17)throw new Error(`Dungeon locale coverage failed for ${dungeon.slug}`)}
const payload={meta:{schema:2,gameBuild,localeCount:17,dungeonCount:dungeons.length,fixedCount:dungeons.filter(row=>row.kind==="fixed").length,rotatingCount:dungeons.filter(row=>row.kind==="rotating").length,entranceCount:dungeons.reduce((sum,row)=>sum+row.entrances.length,0),verification:"game-files",probabilitiesVerified:false,resourcesVerified:false,rewardContentsVerified:false},dungeons};
fs.writeFileSync(outputPath,JSON.stringify(payload));
console.log(`Imported ${payload.meta.dungeonCount} dungeons (${payload.meta.fixedCount} fixed, ${payload.meta.rotatingCount} rotating), ${payload.meta.entranceCount} linked entrances, ${dungeons.reduce((sum,row)=>sum+row.encounterGroups.length,0)} encounter groups and ${dungeons.reduce((sum,row)=>sum+row.itemPools.reduce((count,pool)=>count+pool.slots.reduce((slotCount,slot)=>slotCount+slot.candidates.length,0),0),0)} item candidates.`);
