import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {collectionRoutes,entityRouteFamilies,supportedLocales} from "../src/route-manifest.ts";
import {mapExtraLabels} from "../src/map-extra-labels.ts";
import {mapLayerLabels} from "../src/map-labels.ts";
import {mapPointCategoryDefinitions,publicMapPointDetail} from "../src/map-point-categories.ts";
import {buildIndexableGroups,buildPrerenderEntries,productionOrigin} from "./seo-static.mjs";

const readJson=file=>readFile(file,"utf8").then(JSON.parse);
const [palData,itemData,skillData,mapData,mapPoints,npcData,dungeonData,technologyData,structureData,expeditionData,questData,healthData,elementData,condensingData,ivData]=await Promise.all([
  "pals","items","skills","map-markers","map-points","npcs","dungeons","technology","structures","expeditions","quests","health","elements","condensing","iv"
].map(name=>readJson(`public/data/${name}.json`)));

const seoData={palData,itemData,skillData,npcData,dungeonData,technologyData,healthData,elementData,structureData,expeditionData,questData};
const groups=buildIndexableGroups(seoData,productionOrigin),{selected,registry}=buildPrerenderEntries(seoData);
const familyByDataset=new Map(entityRouteFamilies.map(family=>[family.dataset,family]));
const itemIds=new Set(itemData.items.map(item=>item.id)),palIds=new Set(palData.pals.map(pal=>pal.id)),technologySlugs=new Set(technologyData.technologies.map(entry=>entry.slug)),questSlugs=new Set(questData.quests.map(entry=>entry.slug)),medicineSlugs=new Set(healthData.medicines.map(entry=>entry.slug)),elementSlugs=new Set(elementData.elements.map(entry=>entry.slug));
const itemById=new Map(itemData.items.map(item=>[item.id,item]));
const useful=value=>typeof value==="string"&&value.trim().length>0;
const localized=value=>value&&supportedLocales.every(locale=>useful(value[locale]));
const duplicateCount=(entities,key)=>entities.length-new Set(entities.map(key)).size;
const validSlug=value=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value||"");
const missing=(values,allowed)=>values.filter(value=>!allowed.has(value)).length;

const definitions=[
  {domain:"pals",dataset:"pals",entities:palData.pals,source:palData.meta.palCount,names:e=>e.names,descriptions:e=>e.descriptions,localizedDescriptionTarget:296,images:e=>e.image===true,relationships:palData.pals.reduce((sum,e)=>sum+e.guaranteedPassiveIds.length,0),orphans:0,search:true,collection:"pals",exceptions:["3 Pals have no supplied localized description"]},
  {domain:"breeding-rows",entities:palData.pairs,source:palData.meta.breedingCount,localization:false,images:false,relationships:palData.pairs.length*3,orphans:palData.pairs.filter(row=>!row.slice(0,3).every(index=>Number.isInteger(index)&&index>=0&&index<palData.pals.length)).length,search:true},
  {domain:"items",dataset:"items",entities:itemData.items,source:itemData.meta.itemCount,names:e=>e.names,descriptions:e=>e.descriptions,images:e=>e.image===true,relationships:itemData.recipes.reduce((sum,e)=>sum+e.ingredients.length+1,0)+itemData.drops.length*2,orphans:missing(itemData.items.flatMap(e=>e.unlocksItemId?[e.unlocksItemId]:[]),itemIds),search:true,collection:"database"},
  {domain:"recipes",entities:itemData.recipes,source:itemData.meta.recipeCount,localization:false,images:false,relationships:itemData.recipes.reduce((sum,e)=>sum+e.ingredients.length+1,0),orphans:itemData.recipes.filter(recipe=>!itemIds.has(recipe.productId)||recipe.ingredients.some(ingredient=>!itemIds.has(ingredient.itemId))).length,search:true},
  {domain:"active-skills",dataset:"activeSkills",entities:skillData.activeSkills,source:skillData.meta.activeSkillCount,names:e=>e.names,descriptions:e=>e.descriptions,localizedDescriptionTarget:314,images:false,relationships:skillData.activeSkills.length,orphans:0,search:true,collection:"skills/active",exceptions:["3 active skills have no supplied localized description"]},
  {domain:"passive-skills",dataset:"passiveSkills",entities:skillData.passiveSkills,source:skillData.meta.passiveSkillCount,names:e=>e.names,descriptions:e=>e.descriptions,images:false,relationships:palData.pals.reduce((sum,e)=>sum+e.guaranteedPassiveIds.length,0),orphans:0,search:true,collection:"skills/passive"},
  {domain:"partner-skills",dataset:"partnerSkills",entities:skillData.partnerSkills,source:skillData.meta.partnerSkillCount,names:e=>e.names,localizedNameTarget:298,descriptions:e=>e.palDescriptions,localizedDescriptionTarget:296,images:false,relationships:skillData.partnerSkills.length,orphans:missing(skillData.partnerSkills.map(e=>e.palId),palIds),search:true,collection:"skills/partner",exceptions:["1 partner skill name and 3 descriptions are unavailable"]},
  {domain:"map-bosses",entities:mapData.bosses,source:mapData.meta.bossCount,localization:false,images:false,relationships:mapData.bosses.length,orphans:missing(mapData.bosses.map(e=>e.palId),palIds),search:true,collection:"map"},
  {domain:"map-habitats",entities:mapData.habitats,source:mapData.meta.habitatCount,localization:false,images:false,relationships:mapData.habitats.reduce((sum,e)=>sum+e.pals.length,0),orphans:missing(mapData.habitats.flatMap(e=>e.pals.map(pal=>pal.palId)),palIds),search:true,collection:"map"},
  {domain:"fast-travel",entities:mapData.fastTravel,source:mapData.meta.fastTravelCount,localization:false,images:false,relationships:0,orphans:0,search:true,collection:"map"},
  {domain:"map-points",entities:mapPoints.points,source:Object.values(mapPoints.counts).reduce((sum,count)=>sum+count,0),localization:false,images:e=>useful(e.icon),relationships:mapPoints.points.filter(e=>e.npcSlug||e.dungeonSlug).length,orphans:0,search:true,collection:"map"},
  {domain:"npcs",dataset:"npcs",entities:npcData.npcs,source:npcData.meta.sourceDefinitionCount,eligible:npcData.meta.npcCount,names:e=>e.names,descriptions:false,images:false,relationships:npcData.npcs.reduce((sum,e)=>sum+e.encounters.length,0),orphans:0,search:true,collection:"database/npcs",exceptions:[`${npcData.meta.excludedDefinitionCount} source definitions excluded by eligibility rules`,`${npcData.meta.publishedDefinitionCount-npcData.meta.npcCount} published definitions consolidated into player-facing NPC entities`]},
  {domain:"dungeons",dataset:"dungeons",entities:dungeonData.dungeons,source:dungeonData.meta.dungeonCount,names:e=>e.names,descriptions:false,images:false,relationships:dungeonData.dungeons.reduce((sum,e)=>sum+e.entrances.length+e.encounterGroups.reduce((groupSum,group)=>groupSum+group.members.length,0)+e.itemPools.reduce((poolSum,pool)=>poolSum+pool.slots.reduce((slotSum,slot)=>slotSum+slot.candidates.length,0),0),0),orphans:0,search:true,collection:"database/dungeons"},
  {domain:"technology",dataset:"technologies",entities:technologyData.technologies,source:technologyData.meta.technologyCount,names:e=>e.names,descriptions:e=>e.descriptions,images:e=>e.image===true,relationships:technologyData.technologies.reduce((sum,e)=>sum+e.unlocks.length+e.dependents.length+(e.prerequisite?1:0),0),orphans:technologyData.technologies.filter(e=>e.prerequisite&&!technologySlugs.has(e.prerequisite.slug)||e.dependents.some(relation=>!technologySlugs.has(relation.slug))).length,search:true,collection:"database/technology"},
  {domain:"structures",dataset:"structures",entities:structureData.structures,source:structureData.meta.structureCount,names:e=>e.names,descriptions:e=>e.descriptions,images:()=>true,relationships:structureData.structures.reduce((sum,e)=>sum+e.materials.length+e.technologies.length+(e.production?1:0),0),orphans:structureData.structures.filter(e=>e.materials.some(material=>!itemIds.has(material.itemId))||e.technologies.some(relation=>!technologySlugs.has(relation.slug))||e.production&&!itemIds.has(e.production.itemId)).length,search:true,collection:"database/structures"},
  {domain:"expeditions",dataset:"expeditions",entities:expeditionData.expeditions,source:expeditionData.meta.expeditionCount,names:e=>e.names,descriptions:false,images:e=>useful(e.image),relationships:expeditionData.expeditions.reduce((sum,e)=>sum+e.rewardSlots.reduce((slotSum,slot)=>slotSum+slot.candidates.length,0),0),orphans:expeditionData.expeditions.filter(e=>e.rewardSlots.some(slot=>slot.candidates.some(candidate=>!itemIds.has(candidate.itemId)))).length,search:true,collection:"database/expeditions"},
  {domain:"quests",dataset:"quests",entities:questData.quests,source:questData.meta.questCount,names:e=>e.names,descriptions:e=>e.descriptions,images:false,relationships:questData.quests.reduce((sum,e)=>sum+e.previousSlugs.length+e.nextSlugs.length+e.rewards.items.length,0),orphans:questData.quests.filter(e=>[...e.previousSlugs,...e.nextSlugs].some(slug=>!questSlugs.has(slug))||e.rewards.items.some(item=>!itemIds.has(item.itemId))).length,search:true,collection:"database/quests"},
  {domain:"health-conditions",dataset:"conditions",entities:healthData.conditions,source:healthData.meta.conditionCount,names:e=>e.names,descriptions:e=>e.descriptions,images:false,relationships:healthData.conditions.length,orphans:missing(healthData.conditions.map(e=>e.medicine),medicineSlugs),search:true,collection:"database/health"},
  {domain:"medicines",entities:healthData.medicines,source:healthData.meta.medicineCount,names:e=>e.names,descriptions:e=>e.descriptions,images:e=>useful(e.image),relationships:healthData.medicines.reduce((sum,e)=>sum+e.cures.length+e.recipe.ingredients.length,0),orphans:healthData.medicines.filter(e=>e.recipe.ingredients.some(ingredient=>!itemIds.has(ingredient.itemId))).length,search:true,collection:"database/health"},
  {domain:"elements",entities:elementData.elements,source:elementData.meta.elementCount,names:e=>e.names,descriptions:false,images:e=>useful(e.icon),relationships:elementData.relations.length,orphans:elementData.relations.filter(e=>!elementSlugs.has(e.attacker)||!elementSlugs.has(e.defender)).length,search:true,collection:"database/elements"},
  {domain:"condensing-stages",entities:condensingData.stages,source:condensingData.meta.stageCount,localization:false,images:false,relationships:condensingData.stages.length,orphans:condensingData.meta.gameBuild===palData.meta.gameBuild?0:1,search:true,collection:"calculators/condensing"},
  {domain:"iv-stat-profiles",entities:palData.pals,source:ivData.meta.palCount,localization:false,images:false,relationships:palData.pals.length*3,orphans:palData.pals.filter(pal=>!Number.isFinite(ivData.friendshipByBase.hp[String(pal.hp)])||!Number.isFinite(ivData.friendshipByBase.attack[String(pal.attack)])||!Number.isFinite(ivData.friendshipByBase.defense[String(pal.defense)])).length,search:true,collection:"calculators/iv",exceptions:["Exact output excludes passive, food, Alpha, Lucky, raid, and temporary modifiers"]},
];

const rows=definitions.map(definition=>{
  const entities=definition.entities||[],eligibleCount=definition.eligible??definition.source,family=definition.dataset?familyByDataset.get(definition.dataset):undefined;
  const publicSlugValue=entity=>registry.byId[definition.dataset]?.get(entity.id)||entity.slug||entity.id;
  return {
    domain:definition.domain,
    sourceCount:definition.source,
    eligibleCount,
    normalizedCount:entities.length,
    localizedNameCount:definition.localization===false||definition.names===false?null:entities.filter(entity=>localized(definition.names(entity))).length,
    localizedNameTarget:definition.localization===false||definition.names===false?null:definition.localizedNameTarget??eligibleCount,
    localizedDescriptionCount:definition.localization===false||definition.descriptions===false||!definition.descriptions?null:entities.filter(entity=>localized(definition.descriptions(entity))).length,
    localizedDescriptionTarget:definition.localization===false||definition.descriptions===false||!definition.descriptions?null:definition.localizedDescriptionTarget??eligibleCount,
    imageCount:definition.images===false?null:entities.filter(definition.images).length,
    imageTarget:definition.images===false?null:definition.imageTarget??eligibleCount,
    relationshipCount:definition.relationships,
    searchCovered:definition.search===true,
    collectionRoute:definition.collection||null,
    detailRouteFamily:family?.prefix||null,
    collectionIndexableUrls:definition.collection&&collectionRoutes.includes(definition.collection)?supportedLocales.length:0,
    detailIndexableUrls:family?groups[family.sitemap].length:0,
    detailPrerenderedUrls:family?selected[definition.dataset].length*supportedLocales.length:0,
    duplicateCount:duplicateCount(entities,entity=>entity.id||entity.slug||JSON.stringify(entity)),
    orphanCount:definition.orphans,
    invalidSlugCount:family?entities.filter(entity=>!validSlug(publicSlugValue(entity))).length:0,
    exceptions:definition.exceptions||[],
  };
});

const failures=[];
for(const row of rows){
  if(row.normalizedCount!==row.eligibleCount)failures.push(`${row.domain}: normalized ${row.normalizedCount}/${row.eligibleCount}`);
  if(row.localizedNameCount!==null&&row.localizedNameCount!==row.localizedNameTarget)failures.push(`${row.domain}: localized names ${row.localizedNameCount}/${row.localizedNameTarget}`);
  if(row.localizedDescriptionCount!==null&&row.localizedDescriptionCount!==row.localizedDescriptionTarget)failures.push(`${row.domain}: localized descriptions ${row.localizedDescriptionCount}/${row.localizedDescriptionTarget}`);
  if(row.imageCount!==null&&row.imageCount!==row.imageTarget)failures.push(`${row.domain}: images ${row.imageCount}/${row.imageTarget}`);
  if(row.duplicateCount||row.orphanCount||row.invalidSlugCount)failures.push(`${row.domain}: duplicate=${row.duplicateCount}, orphan=${row.orphanCount}, invalidSlug=${row.invalidSlugCount}`);
}

const mapCategoryCoverage=mapPointCategoryDefinitions.map(definition=>{
  const entities=mapPoints.points.filter(point=>point.category===definition.id),labelValues=supportedLocales.map(locale=>definition.labelSource==="item"?itemById.get(definition.labelKey)?.names?.[locale]:definition.labelSource==="extra"?mapExtraLabels[locale]?.[definition.labelKey]:mapLayerLabels[locale]?.[definition.labelKey]),detailKind=definition.detailKind;
  return {
    category:definition.id,
    group:definition.group,
    sourceCount:mapPoints.counts[definition.id]??0,
    normalizedCount:entities.length,
    localizedLabelCount:labelValues.filter(useful).length,
    localizedLabelTarget:supportedLocales.length,
    iconCount:entities.filter(entity=>useful(entity.icon)).length,
    iconTarget:entities.length,
    relationshipCount:entities.filter(entity=>entity.npcSlug||entity.dungeonSlug).length,
    publicDetailCount:entities.filter(entity=>publicMapPointDetail(detailKind,entity.subtype,"Grade")).length,
    publicDetailTarget:detailKind?entities.length:0,
    worldCounts:Object.fromEntries(mapData.worlds.map(world=>[world.id,entities.filter(entity=>entity.worldId===world.id).length])),
    labelSource:definition.labelSource,
    itemId:definition.labelSource==="item"?definition.labelKey:null,
  };
});
for(const row of mapCategoryCoverage){
  if(row.normalizedCount!==row.sourceCount)failures.push(`map/${row.category}: normalized ${row.normalizedCount}/${row.sourceCount}`);
  if(row.localizedLabelCount!==row.localizedLabelTarget)failures.push(`map/${row.category}: localized labels ${row.localizedLabelCount}/${row.localizedLabelTarget}`);
  if(row.iconCount!==row.iconTarget)failures.push(`map/${row.category}: icons ${row.iconCount}/${row.iconTarget}`);
  if(row.publicDetailCount!==row.publicDetailTarget)failures.push(`map/${row.category}: public details ${row.publicDetailCount}/${row.publicDetailTarget}`);
}
const mapResourceItemMappings=mapCategoryCoverage.filter(row=>row.labelSource==="item").map(row=>({category:row.category,itemId:row.itemId,resolved:itemIds.has(row.itemId),localizedLabelCount:row.localizedLabelCount,localizedLabelTarget:row.localizedLabelTarget}));
for(const mapping of mapResourceItemMappings)if(!mapping.resolved)failures.push(`map/${mapping.category}: unresolved item label ${mapping.itemId}`);
const mapWorldCoverage=mapData.worlds.map(world=>({worldId:world.id,categoryCount:mapCategoryCoverage.filter(row=>row.worldCounts[world.id]>0).length,pointCount:mapCategoryCoverage.reduce((sum,row)=>sum+row.worldCounts[world.id],0)}));

const report={schema:2,gameBuild:palData.meta.gameBuild,localeCount:supportedLocales.length,domainCount:rows.length,indexableUrlCount:Object.values(groups).reduce((sum,urls)=>sum+urls.length,0),mapCategoryCount:mapCategoryCoverage.length,mapPointCount:mapCategoryCoverage.reduce((sum,row)=>sum+row.normalizedCount,0),mapWorldCoverage,mapCategoryCoverage,mapResourceItemMappings,rows};
report.contentHash=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const output=path.resolve("private","planning","domain-coverage.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log(`Coverage report: ${rows.length} domains, ${report.indexableUrlCount} indexable URLs, hash ${report.contentHash}.`);
console.log(`Report: ${path.relative(process.cwd(),output)}`);
if(failures.length)throw new Error(`Coverage validation failed:\n${failures.join("\n")}`);
