import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),build="24181527";
const preferred=path.join(root,"private","extracted",`build-${build}-map-actor-chunks-v2`);
const chunks=fs.existsSync(preferred)?preferred:path.join(root,"private","extracted",`build-${build}-map-actor-chunks`);
if(!fs.existsSync(chunks))throw new Error("Private cooked-world actor chunks are required.");
const files=fs.readdirSync(chunks).filter(file=>file.endsWith(".raw.json")).sort();
if(files.length!==10)throw new Error(`Expected 10 complete actor chunks, found ${files.length}`);
const worlds=JSON.parse(fs.readFileSync(path.join(root,"public","data","map-markers.json"),"utf8")).worlds;
const icon={
  redBerry:"/assets/items/Berries.webp",mushroom:"/assets/items/Mushroom.webp",oil:"/assets/items/CrudeOil.webp",
  egg:"/assets/items/Egg.webp",skillFruit:"/assets/items/SkillCard_AirCanon.webp",ore:"/assets/items/CopperOre.webp",
  coal:"/assets/items/Coal.webp",sulfur:"/assets/items/Sulfur.webp",quartz:"/assets/items/Quartz.webp",
  treasure:"/assets/map-icons/treasure.webp",npc:"/assets/map-icons/npc.webp",merchant:"/assets/map-icons/merchant.webp",
  palMerchant:"/assets/map-icons/merchant.webp",fishing:"/assets/map-icons/fishing.webp",randomEvent:"/assets/map-icons/random-event.webp",
  dungeon:"/assets/map-icons/dungeon.webp",bounty:"/assets/map-icons/wanted.webp",collectibleShrine:"/assets/map-icons/pal-statue.webp",
  palStatue:"/assets/map-icons/pal-statue.webp"
};
const actorSubtype=type=>type.replace(/^BP_/i,"").replace(/_C$/i,"");
const keyOf=value=>value?.Key||"";
const title=value=>value.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\b\w/g,letter=>letter.toUpperCase());
const SURFACE_RESOURCE_MIN_Z=-20000;
const surfaceResourceCategories=new Set(["ore","coal","sulfur","quartz"]);
function publicSubtype(category,type){
  if(category==="egg"){const match=type.match(/palegg_(.+?)_grade_(\d+)/i);return match?`${title(match[1])} · Grade ${Number(match[2])}`:"Pal egg"}
  if(category==="skillFruit"){const match=type.match(/SkillFruits_(.+?)_C$/i);return match?title(match[1]):"Skill fruit tree"}
  if(category==="treasure"){const match=type.match(/Treasure_(.+?)_C$/i);return match?title(match[1]).replace(/\b0(\d)\b/g,"$1"):"Treasure chest"}
  return category;
}
function pointIcon(kind){if(kind.category!=="egg")return icon[kind.category];const match=kind.subtype.match(/^(.+?) · Grade (\d+)$/),region=match?.[1].toLowerCase()||"grass",grade=String(Math.min(5,Math.max(1,Number(match?.[2])||1))).padStart(2,"0"),element=region.includes("worldtree")?"WorldTree":region.includes("volcan")?"Fire":region.includes("glacier")?"Ice":region.includes("desert")?"Earth":region.includes("sky")?"Electricity":region.includes("tenraku")?"Dark":"Leaf";return `/assets/items/PalEgg_${element}_${grade}.webp`}
function classify(actor){
  const type=actor.actorType,z=Number(actor.location?.Z),human=keyOf(actor.properties?.HumanName),unique=keyOf(actor.properties?.UniqueName);
  const simple=[
    ["redBerry",/^BP_PalMapObjectSpawner_RedBerry_C$/i],["mushroom",/^BP_PalMapObjectSpawner_Mushroom_C$/i],
    ["oil",/^BP_LevelObject_OilField_C$/i],["egg",/^bp_palmapobjectspawner_palegg_.+_C$/i],
    ["skillFruit",/^BP_PalMapObjectSpawner_SkillFruits_.+_C$/i],["ore",/^BP_PalMapObjectSpawner_Rock(?:Copper|Iron)_C$/i],
    ["coal",/^BP_PalMapObjectSpawner_RockCoal_C$/i],["sulfur",/^BP_PalMapObjectSpawner_Sulfur_C$/i],
    ["quartz",/^BP_PalMapObjectSpawner_RockQuartz_C$/i],["treasure",/^BP_PalMapObjectSpawner_Treasure_.+_C$/i]
  ];
  const direct=simple.find(([,pattern])=>pattern.test(type));if(direct)return {category:direct[0],subtype:publicSubtype(direct[0],type)};
  if(/^BP_FishingSpot(?!PalSpawner).*_C$/i.test(type)&&!/_Dungeon_/i.test(type))return {category:"fishing",subtype:/Rare/i.test(type)?"rare":/River/i.test(type)?"river":"common"};
  if(/^BP_PalRandomIncidentSpawner/i.test(type))return {category:"randomEvent",subtype:"field-event"};
  if(/^BP_LevelObject_ItemPickupTower_C$/i.test(type))return {category:"collectibleShrine",subtype:"item-pickup-shrine"};
  if(/GoddessStatue/i.test(type))return {category:"palStatue",subtype:"goddess"};
  if(/IcePegasusStatue/i.test(type))return {category:"palStatue",subtype:"frostallion"};
  if(/Anubisstatue/i.test(type))return {category:"palStatue",subtype:"anubis"};
  if(/JetDragonStatue/i.test(type))return {category:"palStatue",subtype:"jetragon"};
  if(z>-20000&&/(?:DungeonFixedEntrance|DungeonPortalMarker|DungeonExit_grassLand)/i.test(type))return {category:"dungeon",subtype:"fixed-entrance"};
  if(z>-20000&&/MonoNPCSpawner/i.test(type)){
    if(actor.properties?.ParentComponent)return null;
    const npcSlug=/MedalTrader/.test(type)?"medal-merchant":/DarkTrader/.test(type)||/^DarkTrader\d*$/.test(unique)?"black-marketeer":unique==="BountyTrader"?"pidf-bounty-officer":unique==="ArenaShop"?"arena-merchant":unique==="U_Reward_Paldex"?"pal-ecological-researcher":unique==="U_Reward_PalCaptureCount"?"wise-hunter":unique==="U_Reward_BossDefeat"?"veteran-pal-hunter":unique==="U_Reward_Food"?"arrogant-gourmet":/^U_Reward_PalDisplay_[A-I]_01$/.test(unique)?"arrogant-pal-critic":undefined;
    if(/^SalesPerson/.test(human)||/MedalTrader|Male_Trader|DarkTrader/.test(type))return {category:"merchant",subtype:/MedalTrader/.test(type)?"medal":/DarkTrader/.test(type)?"black-market":"merchant",...(npcSlug?{npcSlug}:{})};
    if(/^PalDealer/.test(human))return {category:"palMerchant",subtype:"pal-merchant"};
    if(/MonoNPCSpawnerBossBase_BOSS_/.test(type))return {category:"bounty",subtype:"wanted"};
    return {category:"npc",subtype:/Quest/.test(type)?"quest":/Unique/.test(type)?"unique":"npc",...(npcSlug?{npcSlug}:{})};
  }
  return null;
}
const pointRows=[];let selected=0,parsed=0;
for(const file of files){const chunk=JSON.parse(fs.readFileSync(path.join(chunks,file),"utf8"));selected+=chunk.selectedPackageCount;parsed+=chunk.parsedPackageCount;if(chunk.failedPackageCount!==0)throw new Error(`${file} contains failed world cells`);for(const actor of chunk.actors){const kind=classify(actor),x=Number(actor.location?.X),y=Number(actor.location?.Y),z=Number(actor.location?.Z);if(!kind||!Number.isFinite(x)||!Number.isFinite(y)||(x===0&&y===0))continue;if(surfaceResourceCategories.has(kind.category)&&(!Number.isFinite(z)||z<=SURFACE_RESOURCE_MIN_Z))continue;const world=worlds.find(candidate=>x>=candidate.minX&&x<=candidate.maxX&&y>=candidate.minY&&y<=candidate.maxY);if(!world)continue;pointRows.push({worldId:world.id,...kind,icon:pointIcon(kind),x,y,...(Number.isFinite(z)?{z}: {})})}}
if(selected!==9977||parsed!==9977)throw new Error(`Incomplete cooked-world scan: selected ${selected}, parsed ${parsed}`);
pointRows.sort((a,b)=>a.worldId.localeCompare(b.worldId)||a.category.localeCompare(b.category)||a.x-b.x||a.y-b.y||a.subtype.localeCompare(b.subtype));
const points=pointRows.map((point,index)=>({id:`${point.category}-${index+1}`,...point}));
const counts=Object.fromEntries([...new Set(points.map(point=>point.category))].sort().map(category=>[category,points.filter(point=>point.category===category).length]));
fs.writeFileSync(path.join(root,"public","data","map-points.json"),JSON.stringify({counts,points}));
console.log(JSON.stringify({total:points.length,counts},null,2));
