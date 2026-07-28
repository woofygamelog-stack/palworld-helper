import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const source=process.env.PAL_EXTRACTED_DATA||path.join(root,"private","extracted","build-24181527");
const gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const files={items:"items.raw.json",recipes:"recipes.raw.json",names:"item-names.raw.json",descriptions:"item-descriptions.raw.json",map:"map-meta.raw.json",drops:"pal-drops.raw.json",dropsCommon:"pal-drops-common.raw.json",image:"world-map.webp"};
const bytes=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,name])=>[key,await readFile(path.join(source,name))])));
const rawItems=JSON.parse(bytes.items), rawRecipes=JSON.parse(bytes.recipes), rawNames=JSON.parse(bytes.names), rawDescriptions=JSON.parse(bytes.descriptions), map=JSON.parse(bytes.map),rawDrops=JSON.parse(bytes.drops),rawDropsCommon=JSON.parse(bytes.dropsCommon);
if(bytes.drops.toString("utf8")!==bytes.dropsCommon.toString("utf8"))throw new Error("Pal drop tables differ; source precedence must be reviewed");
const localeMap={de:"de-DE",en:"en-US","es-MX":"es-419",es:"es-ES",fr:"fr-FR",id:"id-ID",it:"it-IT",ko:"ko-KR",pl:"pl-PL","pt-BR":"pt-BR",ru:"ru-RU",th:"th-TH",tr:"tr-TR",vi:"vi-VN","zh-Hans":"zh-CN","zh-Hant":"zh-TW",ja:"ja-JP"};
const strip=value=>String(value).split("::").at(-1);
const legalEntries=Object.entries(rawItems).filter(([,item])=>item.bLegalInGame===true);
const canonical=new Map(legalEntries.map(([id])=>[id.toLocaleLowerCase("en-US"),id]));
if(canonical.size!==legalEntries.length) throw new Error("Case-insensitive duplicate legal item IDs found");
const resolveId=id=>canonical.get(String(id).toLocaleLowerCase("en-US"));

const localeLookups=Object.fromEntries(Object.entries(rawNames).map(([from,table])=>[from,new Map(Object.entries(table).map(([key,value])=>[key.toLocaleLowerCase("en-US"),value]))]));
const descriptionLookups=Object.fromEntries(Object.entries(rawDescriptions).map(([from,table])=>[from,new Map(Object.entries(table).map(([key,value])=>[key.toLocaleLowerCase("en-US"),value]))]));
const missingNames=[];
const items=legalEntries.map(([id,item])=>{
  const nameKey=item.OverrideName!=="None"?item.OverrideName:`ITEM_NAME_${id}`;
  const names=Object.fromEntries(Object.entries(localeMap).map(([from,to])=>{
    const value=localeLookups[from]?.get(nameKey.toLocaleLowerCase("en-US"));
    if(typeof value!=="string"||!value.trim()) missingNames.push(`${to}:${id}:${nameKey}`);
    return [to,value];
  }));
  const descriptionKey=(item.OverrideDescription&&item.OverrideDescription!=="None")?item.OverrideDescription:`ITEM_DESC_${id}`;
  const descriptions=Object.fromEntries(Object.entries(localeMap).map(([from,to])=>[to,descriptionLookups[from]?.get(descriptionKey.toLocaleLowerCase("en-US"))||""]));
  return {id,names,descriptions,type:strip(item.TypeA),subtype:strip(item.TypeB),rank:item.Rank,rarity:item.Rarity,maxStack:item.MaxStackCount,weight:item.Weight,price:item.Price,image:existsSync(path.join(root,"public","assets","items",`${id}.webp`))};
}).sort((a,b)=>a.id.localeCompare(b.id));
const itemsById=new Map(items.map(item=>[item.id,item]));
for(const item of items) for(const locale of Object.values(localeMap)) item.descriptions[locale]=String(item.descriptions[locale]||"")
  .replace(/<itemName id=\|([^|]+)\|\/>/g,(_match,id)=>itemsById.get(id)?.names[locale]||id)
  .replace(/<[^>]+>/g,"");
if(missingNames.length) throw new Error(`Missing official item names: ${missingNames.slice(0,20).join(", ")}`);

let illegalProduct=0, illegalIngredient=0, unavailableUnlockItem=0;
const correctedCase=new Set();
const recipes=[];
for(const [id,row] of Object.entries(rawRecipes)){
  const productId=resolveId(row.Product_Id);
  if(!productId){illegalProduct++;continue}
  const ingredients=[]; let valid=true;
  for(let i=1;i<=5;i++){
    const rawId=row[`Material${i}_Id`], count=Number(row[`Material${i}_Count`]);
    if(!count) continue;
    const itemId=resolveId(rawId);
    if(!itemId){valid=false;break}
    if(itemId!==rawId) correctedCase.add(`${rawId}->${itemId}`);
    ingredients.push({itemId,count});
  }
  if(!valid){illegalIngredient++;continue}
  if(!(row.Product_Count>0)||!(row.WorkAmount>=0)||ingredients.some(x=>!(x.count>0))) throw new Error(`Invalid recipe numeric value: ${id}`);
  const unlockItemId=row.UnlockItemID&&row.UnlockItemID!=="None"?resolveId(row.UnlockItemID):undefined;
  if(row.UnlockItemID&&row.UnlockItemID!=="None"&&!unlockItemId)unavailableUnlockItem++;
  recipes.push({id,productId,output:row.Product_Count,workAmount:row.WorkAmount,ingredients,energyType:strip(row.EnergyType),energyAmount:row.EnergyAmount,...(unlockItemId?{unlockItemId}: {})});
}
recipes.sort((a,b)=>a.id.localeCompare(b.id));
if(new Set(recipes.map(r=>r.id)).size!==recipes.length) throw new Error("Duplicate recipe IDs found");
const itemIds=new Set(items.map(item=>item.id));
if(recipes.some(r=>!itemIds.has(r.productId)||r.ingredients.some(i=>!itemIds.has(i.itemId)))) throw new Error("Published recipe has a broken item reference");
const blueprintTargets=new Map();
for(const recipe of recipes){
  if(!recipe.unlockItemId)continue;
  const unlockItem=itemsById.get(recipe.unlockItemId);
  if(unlockItem?.type!=="Blueprint")continue;
  const previous=blueprintTargets.get(recipe.unlockItemId);
  if(previous&&previous!==recipe.productId)throw new Error(`Blueprint ${recipe.unlockItemId} unlocks multiple products: ${previous}, ${recipe.productId}`);
  blueprintTargets.set(recipe.unlockItemId,recipe.productId);
}
for(const [blueprintId,productId] of blueprintTargets)itemsById.get(blueprintId).unlocksItemId=productId;
if(!(map.minX<map.maxX&&map.minY<map.maxY&&map.width===8192&&map.height===8192)) throw new Error("Unexpected official map metadata");

const palData=JSON.parse(await readFile(path.join(root,"public","data","pals.json")));
if(palData.meta.gameBuild!==gameBuild)throw new Error("Pal and drop datasets use different game builds");
const palIds=new Set(palData.pals.map(pal=>pal.id)),drops=[],excludedDropCharacters=new Set(),excludedDropItems=new Set();
for(const [rowId,row] of Object.entries(rawDrops)){
  if(!palIds.has(row.CharacterID)){excludedDropCharacters.add(row.CharacterID);continue}
  if(!Number.isInteger(row.Level)||row.Level<0)throw new Error(`Invalid Pal drop level: ${rowId}`);
  for(let slot=1;slot<=10;slot++){
    const itemId=row[`ItemId${slot}`],rate=Number(row[`Rate${slot}`]),min=Number(row[`min${slot}`]),max=Number(row[`Max${slot}`]);
    if(!itemId||itemId==="None"||rate===0)continue;
    if(!itemIds.has(itemId)){excludedDropItems.add(itemId);continue}
    if(!(rate>0&&rate<=100&&Number.isInteger(min)&&Number.isInteger(max)&&min>=0&&max>=min))throw new Error(`Invalid Pal drop values: ${rowId}:${slot}`);
    drops.push({palId:row.CharacterID,itemId,level:row.Level,rate,min,max});
  }
}
drops.sort((a,b)=>a.palId.localeCompare(b.palId)||a.level-b.level||a.itemId.localeCompare(b.itemId));
if(new Set(drops.map(drop=>`${drop.palId}:${drop.level}:${drop.itemId}`)).size!==drops.length)throw new Error("Duplicate Pal drop relationship found");

const generatedAt=new Date().toISOString();
const publicMap={minX:map.minX,minY:map.minY,maxX:map.maxX,maxY:map.maxY,width:map.width,height:map.height};
const publicData={meta:{schema:2,gameBuild,generatedAt,itemCount:items.length,recipeCount:recipes.length,dropCount:drops.length,dropPalCount:new Set(drops.map(drop=>drop.palId)).size,localeCount:Object.keys(localeMap).length,excludedRecipes:{illegalProduct,illegalIngredient},excludedDrops:{characters:excludedDropCharacters.size,items:[...excludedDropItems].sort()},unavailableUnlockItem,blueprintTargetCount:blueprintTargets.size,caseCorrections:[...correctedCase].sort()},items,recipes,drops,map:publicMap};
await mkdir(path.join(root,"public","data"),{recursive:true});
await mkdir(path.join(root,"public","assets"),{recursive:true});
await writeFile(path.join(root,"public","data","items.json"),JSON.stringify(publicData));
await copyFile(path.join(source,files.image),path.join(root,"public","assets","world-map.webp"));
const sha256=value=>createHash("sha256").update(value).digest("hex");
await mkdir(path.join(root,"private","provenance"),{recursive:true});
await writeFile(path.join(root,"private","provenance","items.json"),JSON.stringify({schema:2,gameBuild,generatedAt,sourceType:"selected tables and texture extracted read-only from installed game files",sourceDirectory:path.relative(root,source),hashes:Object.fromEntries(Object.entries(bytes).map(([key,value])=>[key,sha256(value)])),verification:{rawItemRows:Object.keys(rawItems).length,publishedLegalItems:items.length,rawRecipeRows:Object.keys(rawRecipes).length,publishedRecipes:recipes.length,rawDropRows:Object.keys(rawDrops).length,publishedDrops:drops.length,publishedDropPals:new Set(drops.map(drop=>drop.palId)).size,excludedDrops:{characters:[...excludedDropCharacters].sort(),items:[...excludedDropItems].sort()},localeCounts:Object.fromEntries(Object.entries(rawNames).map(([key,value])=>[key,Object.keys(value).length])),excludedRecipes:{illegalProduct,illegalIngredient},caseCorrections:[...correctedCase].sort(),brokenPublishedReferences:0}},null,2));
console.log(`Published ${items.length} legal items, ${recipes.length} recipes, ${Object.keys(localeMap).length} locales, and verified ${map.width}x${map.height} map.`);
