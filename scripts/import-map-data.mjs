import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),build="24181527",refreshed=path.join(root,"private","extracted",`build-${build}-map-refresh`),source=fs.existsSync(refreshed)?refreshed:path.join(root,"private","extracted",`build-${build}`);
const read=name=>JSON.parse(fs.readFileSync(path.join(source,name),"utf8"));
const pals=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")).pals;
const known=new Set(pals.map(p=>p.id));
const cleanPal=value=>{if(typeof value!=="string"||value==="None")return null;let id=value.replace(/^BOSS_/i,"").replace(/^GYM_/i,"");return known.has(id)?id:null};
const palSlots=row=>Array.from({length:5},(_,index)=>index+1).map(index=>({palId:cleanPal(row[`Pal_${index}`]),levelMin:Number(row[`LvMin_${index}`])||0,levelMax:Number(row[`LvMax_${index}`])||0})).filter(slot=>slot.palId);
const worldsRaw=fs.existsSync(path.join(source,"map-worlds-meta.raw.json"))?read("map-worlds-meta.raw.json"):{MainMap:read("map-meta.raw.json")};
const worlds=Object.entries(worldsRaw).map(([sourceId,bounds])=>({id:sourceId==="Tree"?"tree":"palpagos",sourceId,...bounds}));
const worldFor=(x,y)=>worlds.find(world=>x>=world.minX&&x<=world.maxX&&y>=world.minY&&y<=world.maxY)?.id;
const bossRows=read("boss-spawns.raw.json");
const bosses=Object.entries(bossRows).map(([id,row])=>{const x=Number(row.Location?.X),y=Number(row.Location?.Y);return {id:`boss-${id}`,worldId:worldFor(x,y),category:"boss",palId:cleanPal(row.CharacterID),x,y,levelMin:Number(row.Level)||0,levelMax:Number(row.Level)||0,radius:0}}).filter(row=>row.worldId&&row.palId&&Number.isFinite(row.x)&&Number.isFinite(row.y));
const placements=read("pal-spawner-placement.raw.json"),wild=read("pal-wild-spawners.raw.json"),wildEntries=Object.entries(wild);
const habitats=[];
for(const [id,row] of Object.entries(placements)){
  if(row.WorldName!=="PL_MainWorld5"||row.PlacementType!=="EPalSpawnerPlacementType::Field")continue;
  const variants=wildEntries.filter(([key])=>key===row.SpawnerName||key.startsWith(`${row.SpawnerName}_`));
  const byPal=new Map();
  for(const [,variant] of variants)for(const slot of palSlots(variant)){const current=byPal.get(slot.palId)||{levelMin:slot.levelMin,levelMax:slot.levelMax};current.levelMin=Math.min(current.levelMin,slot.levelMin);current.levelMax=Math.max(current.levelMax,slot.levelMax);byPal.set(slot.palId,current)}
  if(!byPal.size)continue;
  habitats.push({id:`habitat-${id}`,worldId:"palpagos",category:"habitat",x:Number(row.Location?.X),y:Number(row.Location?.Y),radius:Number(row.StaticRadius)||15000,pals:[...byPal].map(([palId,levels])=>({palId,...levels}))});
}
const existingPath=path.join(root,"public","data","map-markers.json"),existing=fs.existsSync(existingPath)?JSON.parse(fs.readFileSync(existingPath,"utf8")):{};
const fastTravel=(existing.fastTravel||[]).map(marker=>({...marker,worldId:marker.worldId||"palpagos"}));
const payload={meta:{gameBuild:build,generatedAt:new Date().toISOString(),verification:"game-file-derived bosses, habitats, world bounds and textures; fast travel pending local placement verification",bossCount:bosses.length,habitatCount:habitats.length,fastTravelCount:fastTravel.length},worlds,bosses,habitats,fastTravel};
fs.writeFileSync(path.join(root,"public","data","map-markers.json"),JSON.stringify(payload));
console.log(`Imported ${bosses.length} bosses, ${habitats.length} habitat regions and ${worlds.length} world maps.`);
