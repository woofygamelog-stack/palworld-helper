import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),dataDirectory=path.join(root,"public","data");
const read=name=>JSON.parse(fs.readFileSync(path.join(dataDirectory,`${name}.json`),"utf8"));
const items=read("items"),technology=read("technology"),structures=read("structures");
const gameBuild=items.meta.gameBuild,locales=Object.keys(items.items[0]?.names||{});
if(gameBuild!=="24467282"||technology.meta.gameBuild!==gameBuild||structures.meta.gameBuild!==gameBuild||items.meta.itemCount!==1891||locales.length!==17)throw new Error("Item relationship inputs do not match the accepted public-data baseline.");

const itemIds=new Set(items.items.map(item=>item.id)),technologySlugs=new Set(technology.technologies.map(entry=>entry.slug)),structureSlugs=new Set(structures.structures.map(entry=>entry.slug));
const byItem=new Map(),relationKeys=new Set();
const itemRelations=itemId=>{
  if(!itemIds.has(itemId))throw new Error(`Item relationship references an unavailable item: ${itemId}`);
  if(!byItem.has(itemId))byItem.set(itemId,{unlockedBy:[],constructionMaterialFor:[],producedBy:[]});
  return byItem.get(itemId);
};
const addUnique=(type,itemId,targetSlug,value)=>{
  const key=`${type}\u0000${itemId}\u0000${targetSlug}`;
  if(relationKeys.has(key))throw new Error(`Duplicate ${type} relationship for ${itemId} and ${targetSlug}`);
  relationKeys.add(key);value();
};

let duplicateTechnologyUnlockSourceCount=0;
for(const entry of technology.technologies)for(const unlock of entry.unlocks){
  if(unlock.kind!=="item")continue;
  const key=`unlocked-by\u0000${unlock.targetId}\u0000${entry.slug}`;
  if(relationKeys.has(key)){duplicateTechnologyUnlockSourceCount++;continue}
  addUnique("unlocked-by",unlock.targetId,entry.slug,()=>itemRelations(unlock.targetId).unlockedBy.push(entry.slug));
}
for(const structure of structures.structures){
  for(const material of structure.materials)addUnique("construction-material-for",material.itemId,structure.slug,()=>itemRelations(material.itemId).constructionMaterialFor.push({slug:structure.slug,count:material.count}));
  if(structure.production)addUnique("produced-by",structure.production.itemId,structure.slug,()=>itemRelations(structure.production.itemId).producedBy.push(structure.slug));
  if(structure.blueprintItemId)throw new Error("Structure blueprint relationships require an explicit public contract before publication.");
}

for(const relations of byItem.values()){
  relations.unlockedBy.sort();
  relations.constructionMaterialFor.sort((left,right)=>left.slug.localeCompare(right.slug));
  relations.producedBy.sort();
}
const technologyUnlockRelationCount=[...byItem.values()].reduce((sum,relations)=>sum+relations.unlockedBy.length,0),structureMaterialRelationCount=[...byItem.values()].reduce((sum,relations)=>sum+relations.constructionMaterialFor.length,0),structureProductionRelationCount=[...byItem.values()].reduce((sum,relations)=>sum+relations.producedBy.length,0);
if(technology.meta.itemUnlockRelationCount!==383||technologyUnlockRelationCount!==382||duplicateTechnologyUnlockSourceCount!==1||structureMaterialRelationCount!==992||structureProductionRelationCount!==12||byItem.size!==417)throw new Error("Item relationship coverage drifted from the accepted baseline.");
if([...byItem.keys()].some(itemId=>!itemIds.has(itemId)))throw new Error("Item relationship index contains an orphan item.");

const referencedTechnologySlugs=new Set([...byItem.values()].flatMap(relations=>relations.unlockedBy)),referencedStructureSlugs=new Set([...byItem.values()].flatMap(relations=>[...relations.constructionMaterialFor.map(relation=>relation.slug),...relations.producedBy]));
const technologyCatalog=technology.technologies.filter(entry=>referencedTechnologySlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,level:entry.level,kind:entry.kind}));
const structureCatalog=structures.structures.filter(entry=>referencedStructureSlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,icon:entry.icon}));
if(technologyCatalog.length!==referencedTechnologySlugs.size||structureCatalog.length!==referencedStructureSlugs.size||technologyCatalog.some(entry=>!technologySlugs.has(entry.slug))||structureCatalog.some(entry=>!structureSlugs.has(entry.slug)))throw new Error("Item relationship target catalogs are incomplete.");

const generatedAt=new Date(Math.max(...[items,technology,structures].map(data=>Date.parse(data.meta.generatedAt||"1970-01-01T00:00:00.000Z")))).toISOString();
const output={
  meta:{schema:1,gameBuild,generatedAt,verification:"verified",localeCount:locales.length,itemCount:items.items.length,linkedItemCount:byItem.size,technologyCount:technologyCatalog.length,structureCount:structureCatalog.length,technologyUnlockSourceReferenceCount:technology.meta.itemUnlockRelationCount,technologyUnlockRelationCount,duplicateTechnologyUnlockSourceCount,structureMaterialRelationCount,structureProductionRelationCount,structureAtlas:structures.meta.atlas},
  technologies:technologyCatalog,
  structures:structureCatalog,
  byItem:Object.fromEntries([...byItem.entries()].sort(([left],[right])=>left.localeCompare(right)))
};
fs.writeFileSync(path.join(dataDirectory,"item-relations.json"),JSON.stringify(output));
console.log(JSON.stringify(output.meta,null,2));
