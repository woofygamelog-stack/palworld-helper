import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const source=process.env.PAL_EXTRACTED_DATA||path.join(root,"private","extracted","build-24181527");
const gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const files={items:"items.raw.json",recipes:"recipes.raw.json",names:"item-names.raw.json",map:"map-meta.raw.json",image:"world-map.webp"};
const bytes=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,name])=>[key,await readFile(path.join(source,name))])));
const rawItems=JSON.parse(bytes.items), rawRecipes=JSON.parse(bytes.recipes), rawNames=JSON.parse(bytes.names), map=JSON.parse(bytes.map);
const localeMap={de:"de-DE",en:"en-US","es-MX":"es-419",es:"es-ES",fr:"fr-FR",id:"id-ID",it:"it-IT",ko:"ko-KR",pl:"pl-PL","pt-BR":"pt-BR",ru:"ru-RU",th:"th-TH",tr:"tr-TR",vi:"vi-VN","zh-Hans":"zh-CN","zh-Hant":"zh-TW",ja:"ja-JP"};
const strip=value=>String(value).split("::").at(-1);
const legalEntries=Object.entries(rawItems).filter(([,item])=>item.bLegalInGame===true);
const canonical=new Map(legalEntries.map(([id])=>[id.toLocaleLowerCase("en-US"),id]));
if(canonical.size!==legalEntries.length) throw new Error("Case-insensitive duplicate legal item IDs found");
const resolveId=id=>canonical.get(String(id).toLocaleLowerCase("en-US"));

const localeLookups=Object.fromEntries(Object.entries(rawNames).map(([from,table])=>[from,new Map(Object.entries(table).map(([key,value])=>[key.toLocaleLowerCase("en-US"),value]))]));
const missingNames=[];
const items=legalEntries.map(([id,item])=>{
  const nameKey=item.OverrideName!=="None"?item.OverrideName:`ITEM_NAME_${id}`;
  const names=Object.fromEntries(Object.entries(localeMap).map(([from,to])=>{
    const value=localeLookups[from]?.get(nameKey.toLocaleLowerCase("en-US"));
    if(typeof value!=="string"||!value.trim()) missingNames.push(`${to}:${id}:${nameKey}`);
    return [to,value];
  }));
  return {id,names,type:strip(item.TypeA),subtype:strip(item.TypeB),rank:item.Rank,rarity:item.Rarity,maxStack:item.MaxStackCount,weight:item.Weight,price:item.Price};
}).sort((a,b)=>a.id.localeCompare(b.id));
if(missingNames.length) throw new Error(`Missing official item names: ${missingNames.slice(0,20).join(", ")}`);

let illegalProduct=0, illegalIngredient=0;
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
  recipes.push({id,productId,output:row.Product_Count,workAmount:row.WorkAmount,ingredients,energyType:strip(row.EnergyType),energyAmount:row.EnergyAmount});
}
recipes.sort((a,b)=>a.id.localeCompare(b.id));
if(new Set(recipes.map(r=>r.id)).size!==recipes.length) throw new Error("Duplicate recipe IDs found");
const itemIds=new Set(items.map(item=>item.id));
if(recipes.some(r=>!itemIds.has(r.productId)||r.ingredients.some(i=>!itemIds.has(i.itemId)))) throw new Error("Published recipe has a broken item reference");
if(!(map.minX<map.maxX&&map.minY<map.maxY&&map.width===8192&&map.height===8192)) throw new Error("Unexpected official map metadata");

const generatedAt=new Date().toISOString();
const publicData={meta:{schema:1,gameBuild,generatedAt,itemCount:items.length,recipeCount:recipes.length,localeCount:Object.keys(localeMap).length,excludedRecipes:{illegalProduct,illegalIngredient},caseCorrections:[...correctedCase].sort()},items,recipes,map};
await mkdir(path.join(root,"public","data"),{recursive:true});
await mkdir(path.join(root,"public","assets"),{recursive:true});
await writeFile(path.join(root,"public","data","items.json"),JSON.stringify(publicData));
await copyFile(path.join(source,files.image),path.join(root,"public","assets","world-map.webp"));
const sha256=value=>createHash("sha256").update(value).digest("hex");
await mkdir(path.join(root,"private","provenance"),{recursive:true});
await writeFile(path.join(root,"private","provenance","items.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"selected tables and texture extracted read-only from installed game files",sourceDirectory:path.relative(root,source),hashes:Object.fromEntries(Object.entries(bytes).map(([key,value])=>[key,sha256(value)])),verification:{rawItemRows:Object.keys(rawItems).length,publishedLegalItems:items.length,rawRecipeRows:Object.keys(rawRecipes).length,publishedRecipes:recipes.length,localeCounts:Object.fromEntries(Object.entries(rawNames).map(([key,value])=>[key,Object.keys(value).length])),excludedRecipes:{illegalProduct,illegalIngredient},caseCorrections:[...correctedCase].sort(),brokenPublishedReferences:0}},null,2));
console.log(`Published ${items.length} legal items, ${recipes.length} recipes, ${Object.keys(localeMap).length} locales, and verified ${map.width}x${map.height} map.`);
