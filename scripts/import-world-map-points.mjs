import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const chunks=path.join(root,"private","extracted","build-24181527-map-actor-chunks");
if(!fs.existsSync(chunks))throw new Error("Private cooked-world actor chunks are required.");
const worlds=JSON.parse(fs.readFileSync(path.join(root,"public","data","map-markers.json"),"utf8")).worlds;
const rules=[
  ["redBerry",/^BP_PalMapObjectSpawner_RedBerry_C$/i],
  ["mushroom",/^BP_PalMapObjectSpawner_Mushroom_C$/i],
  ["oil",/^BP_LevelObject_OilField_C$/i],
  ["egg",/^bp_palmapobjectspawner_palegg_.+_C$/i],
  ["skillFruit",/^BP_PalMapObjectSpawner_SkillFruits_.+_C$/i],
  ["ore",/^BP_PalMapObjectSpawner_Rock(?:Copper|Iron)_C$/i],
  ["coal",/^BP_PalMapObjectSpawner_RockCoal_C$/i],
  ["sulfur",/^BP_PalMapObjectSpawner_Sulfur_C$/i],
  ["quartz",/^BP_PalMapObjectSpawner_RockQuartz_C$/i],
  ["treasure",/^BP_PalMapObjectSpawner_Treasure_.+_C$/i]
];
const pointRows=[];
for(const file of fs.readdirSync(chunks).filter(file=>file.endsWith(".raw.json")).sort()){
  const chunk=JSON.parse(fs.readFileSync(path.join(chunks,file),"utf8"));
  if(chunk.failedPackageCount!==0)throw new Error(`${file} contains failed world cells`);
  for(const actor of chunk.actors){
    const match=rules.find(([,pattern])=>pattern.test(actor.actorType));
    const x=Number(actor.location?.X),y=Number(actor.location?.Y),z=Number(actor.location?.Z);
    if(!match||!Number.isFinite(x)||!Number.isFinite(y))continue;
    const world=worlds.find(candidate=>x>=candidate.minX&&x<=candidate.maxX&&y>=candidate.minY&&y<=candidate.maxY);
    if(!world)continue;
    pointRows.push({worldId:world.id,category:match[0],subtype:actor.actorType.replace(/^BP_PalMapObjectSpawner_?/i,"").replace(/_C$/i,""),x,y,...(Number.isFinite(z)?{z}: {})});
  }
}
pointRows.sort((a,b)=>a.worldId.localeCompare(b.worldId)||a.category.localeCompare(b.category)||a.x-b.x||a.y-b.y||a.subtype.localeCompare(b.subtype));
const points=pointRows.map((point,index)=>({id:`${point.category}-${index+1}`,...point}));
const counts=Object.fromEntries([...new Set(points.map(point=>point.category))].sort().map(category=>[category,points.filter(point=>point.category===category).length]));
fs.writeFileSync(path.join(root,"public","data","map-points.json"),JSON.stringify({counts,points}));
console.log(JSON.stringify({total:points.length,counts},null,2));
