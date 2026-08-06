import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),dataDirectory=path.join(root,"public","data");
const read=name=>JSON.parse(fs.readFileSync(path.join(dataDirectory,`${name}.json`),"utf8"));
const items=read("items"),technology=read("technology"),structures=read("structures"),npcs=read("npcs"),dungeons=read("dungeons"),expeditions=read("expeditions"),quests=read("quests");
const gameBuild=items.meta.gameBuild,locales=Object.keys(items.items[0]?.names||{}),inputs=[technology,structures,npcs,dungeons,expeditions,quests];
if(gameBuild!=="24467282"||inputs.some(data=>data.meta.gameBuild!==gameBuild)||items.meta.itemCount!==1891||npcs.meta.npcCount!==164||dungeons.meta.dungeonCount!==28||expeditions.meta.expeditionCount!==18||quests.meta.questCount!==82||locales.length!==17)throw new Error("Item relationship inputs do not match the accepted public-data baseline.");

const itemIds=new Set(items.items.map(item=>item.id)),technologySlugs=new Set(technology.technologies.map(entry=>entry.slug)),structureSlugs=new Set(structures.structures.map(entry=>entry.slug)),npcSlugs=new Set(npcs.npcs.map(entry=>entry.slug)),dungeonSlugs=new Set(dungeons.dungeons.map(entry=>entry.slug)),expeditionSlugs=new Set(expeditions.expeditions.map(entry=>entry.slug)),questSlugs=new Set(quests.quests.map(entry=>entry.slug));
const byItem=new Map(),relationKeys=new Set();
const itemRelations=itemId=>{
  if(!itemIds.has(itemId))throw new Error(`Item relationship references an unavailable item: ${itemId}`);
  if(!byItem.has(itemId))byItem.set(itemId,{craftedBy:[],ingredientOf:[],unlockedBy:[],constructionMaterialFor:[],producedBy:[],soldBy:[],requestedBy:[],rewardedByNpc:[],foundInDungeons:[],rewardedByExpeditions:[],rewardedByQuests:[]});
  return byItem.get(itemId);
};
const addUnique=(type,itemId,targetSlug,value)=>{
  const key=`${type}\u0000${itemId}\u0000${targetSlug}`;
  if(relationKeys.has(key))throw new Error(`Duplicate ${type} relationship for ${itemId} and ${targetSlug}`);
  relationKeys.add(key);value();
};
const grouped=(type,itemId,targetSlug,key,create)=>{
  const relations=itemRelations(itemId),list=relations[key];let entry=list.find(candidate=>candidate.slug===targetSlug);
  if(!entry){addUnique(type,itemId,targetSlug,()=>list.push(create()));entry=list.at(-1)}
  return entry;
};

const recipeIds=new Set();
for(const recipe of items.recipes){
  if(recipeIds.has(recipe.id))throw new Error(`Duplicate recipe relationship source: ${recipe.id}`);
  recipeIds.add(recipe.id);
  addUnique("crafted-by",recipe.productId,recipe.id,()=>itemRelations(recipe.productId).craftedBy.push(recipe.id));
  for(const ingredient of recipe.ingredients)addUnique("ingredient-of",ingredient.itemId,recipe.id,()=>itemRelations(ingredient.itemId).ingredientOf.push({recipeId:recipe.id,count:ingredient.count}));
}
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

let npcOfferSourceReferenceCount=0,npcRequestSourceReferenceCount=0,npcRewardSourceReferenceCount=0;
const addNpcOffer=(npc,merchant,offer,profile)=>{
  if(!itemIds.has(merchant.currencyItemId)||offer.price<0||offer.quantity<=0)throw new Error(`Invalid NPC offer relationship: ${npc.slug}`);
  const relation=grouped("sold-by",offer.itemId,npc.slug,"soldBy",()=>({slug:npc.slug,currencyItemId:merchant.currencyItemId,offers:[]}));
  if(relation.currencyItemId!==merchant.currencyItemId)throw new Error(`NPC offer currency drifted: ${npc.slug}`);
  relation.offers.push({price:offer.price,quantity:offer.quantity,purchaseLimit:offer.purchaseLimit,...(offer.stock===undefined?{}:{stock:offer.stock}),...(profile===null?{}:{profile})});npcOfferSourceReferenceCount++;
};
for(const npc of npcs.npcs){
  if(npc.merchant?.type==="items")for(const offer of npc.merchant.offers)addNpcOffer(npc,npc.merchant,offer,null);
  if(npc.merchant?.type==="item-profiles")npc.merchant.profiles.forEach((profile,index)=>profile.offers.forEach(offer=>addNpcOffer(npc,npc.merchant,offer,index+1)));
  for(const step of npc.events?.steps||[]){
    if(step.requestItemId){if(!(step.requestQuantity>0))throw new Error(`Invalid NPC request relationship: ${npc.slug}`);grouped("requested-by",step.requestItemId,npc.slug,"requestedBy",()=>({slug:npc.slug,quantities:[]})).quantities.push(step.requestQuantity);npcRequestSourceReferenceCount++}
    for(const reward of step.rewards){if(!(reward.quantity>0))throw new Error(`Invalid NPC reward relationship: ${npc.slug}`);grouped("rewarded-by-npc",reward.itemId,npc.slug,"rewardedByNpc",()=>({slug:npc.slug,quantities:[]})).quantities.push(reward.quantity);npcRewardSourceReferenceCount++}
  }
}

let dungeonItemSourceReferenceCount=0,dungeonFloorItemSourceReferenceCount=0,dungeonRewardItemSourceReferenceCount=0;
const addDungeonPool=(dungeon,pool,source)=>{for(const slot of pool.slots)for(const candidate of slot.candidates){const relation=grouped("found-in-dungeon",candidate.itemId,dungeon.slug,"foundInDungeons",()=>({slug:dungeon.slug,kinds:[],sources:[],sourceReferenceCount:0}));if(!relation.kinds.includes(pool.kind))relation.kinds.push(pool.kind);if(!relation.sources.includes(source))relation.sources.push(source);relation.sourceReferenceCount++;dungeonItemSourceReferenceCount++;if(source==="floor")dungeonFloorItemSourceReferenceCount++;else dungeonRewardItemSourceReferenceCount++}};
for(const dungeon of dungeons.dungeons){for(const pool of dungeon.itemPools)addDungeonPool(dungeon,pool,"floor");for(const rewardSource of dungeon.rewardSources)for(const pool of rewardSource.itemPools)addDungeonPool(dungeon,pool,"reward")}

let expeditionRewardSourceReferenceCount=0;
for(const expedition of expeditions.expeditions)for(const slot of expedition.rewardSlots)for(const candidate of slot.candidates){if(candidate.minCount<=0||candidate.maxCount<candidate.minCount)throw new Error(`Invalid Expedition reward relationship: ${expedition.slug}`);grouped("rewarded-by-expedition",candidate.itemId,expedition.slug,"rewardedByExpeditions",()=>({slug:expedition.slug,rewards:[]})).rewards.push({slot:slot.slot,minCount:candidate.minCount,maxCount:candidate.maxCount});expeditionRewardSourceReferenceCount++}
for(const quest of quests.quests)for(const reward of quest.rewards.items){if(reward.quantity<=0)throw new Error(`Invalid Quest reward relationship: ${quest.slug}`);addUnique("rewarded-by-quest",reward.itemId,quest.slug,()=>itemRelations(reward.itemId).rewardedByQuests.push({slug:quest.slug,quantity:reward.quantity}))}

for(const relations of byItem.values()){
  relations.craftedBy.sort();relations.ingredientOf.sort((left,right)=>left.recipeId.localeCompare(right.recipeId));relations.unlockedBy.sort();relations.constructionMaterialFor.sort((left,right)=>left.slug.localeCompare(right.slug));relations.producedBy.sort();
  for(const key of ["soldBy","requestedBy","rewardedByNpc","foundInDungeons","rewardedByExpeditions","rewardedByQuests"])relations[key].sort((left,right)=>left.slug.localeCompare(right.slug));
  for(const relation of relations.soldBy)relation.offers.sort((left,right)=>(left.profile||0)-(right.profile||0)||left.price-right.price||left.quantity-right.quantity);
  for(const relation of [...relations.requestedBy,...relations.rewardedByNpc])relation.quantities.sort((left,right)=>left-right);
  for(const relation of relations.foundInDungeons){relation.kinds.sort();relation.sources.sort()}
  for(const relation of relations.rewardedByExpeditions)relation.rewards.sort((left,right)=>left.slot-right.slot||left.minCount-right.minCount||left.maxCount-right.maxCount);
}
const sum=key=>[...byItem.values()].reduce((total,relations)=>total+relations[key].length,0),recipeOutputRelationCount=sum("craftedBy"),recipeIngredientRelationCount=sum("ingredientOf"),technologyUnlockRelationCount=sum("unlockedBy"),structureMaterialRelationCount=sum("constructionMaterialFor"),structureProductionRelationCount=sum("producedBy"),npcSoldItemRelationCount=sum("soldBy"),npcRequestedItemRelationCount=sum("requestedBy"),npcRewardedItemRelationCount=sum("rewardedByNpc"),dungeonItemRelationCount=sum("foundInDungeons"),expeditionRewardRelationCount=sum("rewardedByExpeditions"),questRewardRelationCount=sum("rewardedByQuests");
const recipeProductCount=new Set(items.recipes.map(recipe=>recipe.productId)).size,recipeIngredientItemCount=new Set(items.recipes.flatMap(recipe=>recipe.ingredients.map(ingredient=>ingredient.itemId))).size;
if(items.meta.recipeCount!==1286||recipeIds.size!==1286||recipeOutputRelationCount!==1286||recipeIngredientRelationCount!==3676||recipeProductCount!==1271||recipeIngredientItemCount!==429||technology.meta.itemUnlockRelationCount!==383||technologyUnlockRelationCount!==382||duplicateTechnologyUnlockSourceCount!==1||structureMaterialRelationCount!==992||structureProductionRelationCount!==12||npcOfferSourceReferenceCount!==252||npcSoldItemRelationCount!==187||npcRequestSourceReferenceCount!==10||npcRequestedItemRelationCount!==10||npcRewardSourceReferenceCount!==173||npcRewardedItemRelationCount!==94||dungeonFloorItemSourceReferenceCount!==536||dungeonRewardItemSourceReferenceCount!==1126||dungeonItemSourceReferenceCount!==1662||dungeonItemRelationCount!==1072||expeditionRewardSourceReferenceCount!==279||expeditionRewardRelationCount!==209||questRewardRelationCount!==63||byItem.size!==1729)throw new Error("Item relationship coverage drifted from the accepted baseline.");
if([...byItem.keys()].some(itemId=>!itemIds.has(itemId)))throw new Error("Item relationship index contains an orphan item.");

const referencedTechnologySlugs=new Set([...byItem.values()].flatMap(relations=>relations.unlockedBy)),referencedStructureSlugs=new Set([...byItem.values()].flatMap(relations=>[...relations.constructionMaterialFor.map(relation=>relation.slug),...relations.producedBy])),referencedNpcSlugs=new Set([...byItem.values()].flatMap(relations=>[...relations.soldBy,...relations.requestedBy,...relations.rewardedByNpc].map(relation=>relation.slug))),referencedDungeonSlugs=new Set([...byItem.values()].flatMap(relations=>relations.foundInDungeons.map(relation=>relation.slug))),referencedExpeditionSlugs=new Set([...byItem.values()].flatMap(relations=>relations.rewardedByExpeditions.map(relation=>relation.slug))),referencedQuestSlugs=new Set([...byItem.values()].flatMap(relations=>relations.rewardedByQuests.map(relation=>relation.slug)));
const technologyCatalog=technology.technologies.filter(entry=>referencedTechnologySlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,level:entry.level,kind:entry.kind})),structureCatalog=structures.structures.filter(entry=>referencedStructureSlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,icon:entry.icon})),npcCatalog=npcs.npcs.filter(entry=>referencedNpcSlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,kind:entry.kind})),dungeonCatalog=dungeons.dungeons.filter(entry=>referencedDungeonSlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names})),expeditionCatalog=expeditions.expeditions.filter(entry=>referencedExpeditionSlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,image:entry.image})),questCatalog=quests.quests.filter(entry=>referencedQuestSlugs.has(entry.slug)).map(entry=>({slug:entry.slug,names:entry.names,kind:entry.kind}));
if(technologyCatalog.length!==referencedTechnologySlugs.size||structureCatalog.length!==referencedStructureSlugs.size||npcCatalog.length!==referencedNpcSlugs.size||dungeonCatalog.length!==referencedDungeonSlugs.size||expeditionCatalog.length!==referencedExpeditionSlugs.size||questCatalog.length!==referencedQuestSlugs.size||technologyCatalog.some(entry=>!technologySlugs.has(entry.slug))||structureCatalog.some(entry=>!structureSlugs.has(entry.slug))||npcCatalog.some(entry=>!npcSlugs.has(entry.slug))||dungeonCatalog.some(entry=>!dungeonSlugs.has(entry.slug))||expeditionCatalog.some(entry=>!expeditionSlugs.has(entry.slug))||questCatalog.some(entry=>!questSlugs.has(entry.slug)))throw new Error("Item relationship target catalogs are incomplete.");

const generatedAt=new Date(Math.max(...[items,...inputs].map(data=>Date.parse(data.meta.generatedAt||"1970-01-01T00:00:00.000Z")))).toISOString();
const output={
  meta:{schema:1,gameBuild,generatedAt,verification:"verified",localeCount:locales.length,itemCount:items.items.length,linkedItemCount:byItem.size,recipeCount:recipeIds.size,recipeProductCount,recipeIngredientItemCount,recipeOutputRelationCount,recipeIngredientRelationCount,technologyCount:technologyCatalog.length,structureCount:structureCatalog.length,technologyUnlockSourceReferenceCount:technology.meta.itemUnlockRelationCount,technologyUnlockRelationCount,duplicateTechnologyUnlockSourceCount,structureMaterialRelationCount,structureProductionRelationCount,npcCount:npcCatalog.length,npcOfferSourceReferenceCount,npcSoldItemRelationCount,npcRequestSourceReferenceCount,npcRequestedItemRelationCount,npcRewardSourceReferenceCount,npcRewardedItemRelationCount,dungeonCount:dungeonCatalog.length,dungeonFloorItemSourceReferenceCount,dungeonRewardItemSourceReferenceCount,dungeonItemSourceReferenceCount,dungeonItemRelationCount,expeditionCount:expeditionCatalog.length,expeditionRewardSourceReferenceCount,expeditionRewardRelationCount,questCount:questCatalog.length,questRewardRelationCount,structureAtlas:structures.meta.atlas},
  technologies:technologyCatalog,structures:structureCatalog,npcs:npcCatalog,dungeons:dungeonCatalog,expeditions:expeditionCatalog,quests:questCatalog,
  byItem:Object.fromEntries([...byItem.entries()].sort(([left],[right])=>left.localeCompare(right)))
};
fs.writeFileSync(path.join(dataDirectory,"item-relations.json"),JSON.stringify(output));
console.log(JSON.stringify(output.meta,null,2));
