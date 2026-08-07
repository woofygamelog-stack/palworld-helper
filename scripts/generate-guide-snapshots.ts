import {readFile,writeFile} from "node:fs/promises";
import {guideDefinitions,type GuideId,type GuideSnapshotData} from "../src/guide-content.ts";
import {serverSettingsInventory} from "../src/server-settings.ts";

const readJson=async(name:string)=>JSON.parse(await readFile(`public/data/${name}.json`,"utf8"));
const [pals,items,mapMarkers,mapPoints,skills,technology,structures,expeditions,quests,health,elements,iv]=await Promise.all(["pals","items","map-markers","map-points","skills","technology","structures","expeditions","quests","health","elements","iv"].map(readJson));
const gameBuild=pals.meta.gameBuild,versioned=[items,mapMarkers,skills,technology,structures,expeditions,quests,health,elements];
if(versioned.some(dataset=>dataset.meta.gameBuild!==gameBuild))throw new Error("Guide snapshot source build mismatch");
if(pals.meta.palCount!==299||pals.meta.breedingCount!==44851||items.meta.itemCount!==1891||items.meta.recipeCount!==1286||skills.meta.activeSkillCount!==317||skills.meta.passiveSkillCount!==115||technology.meta.technologyCount!==588||structures.meta.structureCount!==472||expeditions.meta.expeditionCount!==18||quests.meta.questCount!==82||health.meta.conditionCount!==7||elements.meta.elementCount!==9||iv.meta.palCount!==299||serverSettingsInventory.supported!==93)throw new Error("Guide snapshot source coverage drifted");
const mapPointCount=Object.values(mapPoints.counts as Record<string,number>).reduce((sum,count)=>sum+count,0);
if(mapPointCount!==10147||Object.keys(mapPoints.counts).length!==23)throw new Error("Guide snapshot map coverage drifted");
const metric=(route:string,count:number)=>({route,count}),metrics:Record<GuideId,{route:string;count:number}[]>={
  "getting-started":[metric("map",mapPointCount),metric("pals",pals.meta.palCount),metric("database/technology",technology.meta.technologyCount),metric("calculators/crafting",items.meta.recipeCount)],
  "returning-player":[metric("database/quests",quests.meta.questCount),metric("database/technology",technology.meta.technologyCount),metric("database/expeditions",expeditions.meta.expeditionCount),metric("map",mapPointCount)],
  breeding:[metric("pals",pals.meta.palCount),metric("calculators/breeding",pals.meta.breedingCount),metric("skills/passive",skills.meta.passiveSkillCount)],
  base:[metric("calculators/base",pals.workSuitabilities.length),metric("pals",pals.meta.palCount),metric("database/structures",structures.meta.structureCount),metric("calculators/crafting",items.meta.recipeCount),metric("database",items.meta.itemCount)],
  server:[metric("server-tools/settings-generator",serverSettingsInventory.supported),metric("calculators/base",pals.workSuitabilities.length),metric("database/structures",structures.meta.structureCount),metric("calculators/crafting",items.meta.recipeCount)],
  combat:[metric("database/elements",elements.meta.elementCount),metric("skills/active",skills.meta.activeSkillCount),metric("calculators/iv",iv.meta.palCount),metric("database/health",health.meta.conditionCount),metric("calculators/team-builder",pals.meta.palCount)],
};
for(const guide of guideDefinitions)if(!metrics[guide.id].length||metrics[guide.id].some(entry=>!guide.related.includes(entry.route as never)||!Number.isInteger(entry.count)||entry.count<=0))throw new Error(`Invalid Guide snapshot metrics: ${guide.id}`);
const output:GuideSnapshotData={meta:{schema:1,gameBuild,verification:"verified",localeCount:17,guideCount:guideDefinitions.length,metricCount:Object.values(metrics).reduce((sum,entries)=>sum+entries.length,0)},guides:Object.fromEntries(guideDefinitions.map(guide=>[guide.id,{reviewTrigger:guide.reviewTrigger,metrics:metrics[guide.id]}])) as GuideSnapshotData["guides"]};
await writeFile("public/data/guide-snapshots.json",JSON.stringify(output));
console.log(JSON.stringify(output.meta,null,2));
