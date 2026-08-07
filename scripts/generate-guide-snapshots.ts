import {readFile,writeFile} from "node:fs/promises";
import {guideDefinitions,type GuideId,type GuideMetricKind,type GuideSnapshotData} from "../src/guide-content.ts";
import {serverSettingsInventory} from "../src/server-settings.ts";

const readJson=async(name:string)=>JSON.parse(await readFile(`public/data/${name}.json`,"utf8"));
const [pals,items,mapMarkers,mapPoints,skills,technology,structures,expeditions,quests,health,elements,iv]=await Promise.all(["pals","items","map-markers","map-points","skills","technology","structures","expeditions","quests","health","elements","iv"].map(readJson));
const gameBuild=pals.meta.gameBuild,versioned=[items,mapMarkers,skills,technology,structures,expeditions,quests,health,elements];
if(versioned.some(dataset=>dataset.meta.gameBuild!==gameBuild))throw new Error("Guide snapshot source build mismatch");
if(pals.meta.palCount!==299||pals.meta.breedingCount!==44851||items.meta.itemCount!==1891||items.meta.recipeCount!==1286||skills.meta.activeSkillCount!==317||skills.meta.passiveSkillCount!==115||technology.meta.technologyCount!==588||structures.meta.structureCount!==472||expeditions.meta.expeditionCount!==18||quests.meta.questCount!==82||health.meta.conditionCount!==7||elements.meta.elementCount!==9||iv.meta.palCount!==299||serverSettingsInventory.supported!==93)throw new Error("Guide snapshot source coverage drifted");
const mapPointCount=Object.values(mapPoints.counts as Record<string,number>).reduce((sum,count)=>sum+count,0);
if(mapPointCount!==10147||Object.keys(mapPoints.counts).length!==23)throw new Error("Guide snapshot map coverage drifted");
const metric=(route:string,kind:GuideMetricKind,count:number)=>({route,kind,count}),metrics:Record<GuideId,{route:string;kind:GuideMetricKind;count:number}[]>={
  "getting-started":[metric("map","locations",mapPointCount),metric("pals","pals",pals.meta.palCount),metric("database/technology","entries",technology.meta.technologyCount),metric("calculators/crafting","recipes",items.meta.recipeCount)],
  "returning-player":[metric("database/quests","entries",quests.meta.questCount),metric("database/technology","entries",technology.meta.technologyCount),metric("database/expeditions","entries",expeditions.meta.expeditionCount),metric("map","locations",mapPointCount)],
  breeding:[metric("pals","pals",pals.meta.palCount),metric("calculators/breeding","combinations",pals.meta.breedingCount),metric("skills/passive","skills",skills.meta.passiveSkillCount)],
  base:[metric("calculators/base","work-roles",pals.workSuitabilities.length),metric("pals","pals",pals.meta.palCount),metric("database/structures","entries",structures.meta.structureCount),metric("calculators/crafting","recipes",items.meta.recipeCount),metric("database","entries",items.meta.itemCount)],
  server:[metric("server-tools/settings-generator","settings",serverSettingsInventory.supported),metric("calculators/base","work-roles",pals.workSuitabilities.length),metric("database/structures","entries",structures.meta.structureCount),metric("calculators/crafting","recipes",items.meta.recipeCount)],
  combat:[metric("database/elements","entries",elements.meta.elementCount),metric("skills/active","skills",skills.meta.activeSkillCount),metric("calculators/iv","pals",iv.meta.palCount),metric("database/health","conditions",health.meta.conditionCount),metric("calculators/team-builder","pals",pals.meta.palCount)],
};
for(const guide of guideDefinitions)if(guide.stepKinds.length!==guide.related.length||!metrics[guide.id].length||metrics[guide.id].some(entry=>!guide.related.includes(entry.route as never)||!Number.isInteger(entry.count)||entry.count<=0))throw new Error(`Invalid Guide snapshot metrics: ${guide.id}`);
const output:GuideSnapshotData={meta:{schema:2,gameBuild,verification:"verified",localeCount:17,guideCount:guideDefinitions.length,metricCount:Object.values(metrics).reduce((sum,entries)=>sum+entries.length,0)},guides:Object.fromEntries(guideDefinitions.map(guide=>[guide.id,{reviewTrigger:guide.reviewTrigger,metrics:metrics[guide.id]}])) as GuideSnapshotData["guides"]};
await writeFile("public/data/guide-snapshots.json",JSON.stringify(output));
console.log(JSON.stringify(output.meta,null,2));
