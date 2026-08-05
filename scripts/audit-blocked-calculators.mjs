import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {collectionRoutes,shellNavigation} from "../src/route-manifest.ts";

const readJsonIfPresent=async file=>{try{return JSON.parse(await readFile(file,"utf8"))}catch(error){if(error?.code==="ENOENT")return null;throw error}};
const sourceManifest=await readJsonIfPresent("private/extracted/build-24467282-calculators/calculator-manifest.json");
const sourceTables=await readJsonIfPresent("private/extracted/build-24467282-calculators/calculator-tables.raw.json");
const ivReport=await readJsonIfPresent("private/verification/calculators/build-24467282/iv-runtime-report.json");
if(sourceManifest&&(sourceManifest.mode!=="calculator"||sourceManifest.runtimeBlueprintFailureCount!==0))throw new Error("Calculator source inventory is incomplete.");
if(ivReport&&(ivReport.status!=="verified"||!ivReport.equivalence.independentSessions))throw new Error("IV runtime evidence is incomplete.");
if(sourceTables&&!sourceTables.tables?.["Pal/Content/Pal/DataTable/Friendship/DT_FriendshipRankTable"])throw new Error("Friendship rank table is missing from calculator evidence.");
const candidates=[
  {domain:"capture",forbiddenRoutes:["calculators/capture","calculators/capture-probability"],acquired:["build-matched capture Blueprint control flow","capture-related Pal and item parameters","runtime function and parameter inventory","safe post-initialization observation hook for game-created Pal parameters"],missing:["a connected client or populated isolated world that creates live target and thrower handles","status, HP, level, passive, world-setting, rare-Pal, and sphere boundary cases","two independent complete golden-case sessions"]},
  {domain:"iv",forbiddenRoutes:["calculators/iv","calculators/iv-calculator"],acquired:ivReport?[`${ivReport.coverage.rawRuntimeCases} rank-0-friendship runtime cases per independent session`,"all current base-stat values across level, condensing, IV, and soul dimensions","complete friendship rank thresholds","safe post-initialization observation hook for game-created Pal parameters"]:[],missing:["a connected client or populated isolated world that produces positive and negative friendship-rank Pal parameters","friendship correction order and rounding","independent friendship golden cases"]},
  {domain:"production",forbiddenRoutes:["calculators/production","calculators/production-rate"],acquired:["recipe work amounts","work-speed and suitability runtime function inventory","base craft-speed, condensing, soul, and status-point constants","safe post-initialization observation hook for game-created Pal parameters"],missing:["a connected client or populated isolated world that creates worker and facility models","facility, suitability, passive, condition, research, and world-setting order","two independent complete golden-case sessions"]},
];
const navigationRoutes=shellNavigation.flatMap(item=>[item.path,...("children" in item?item.children.map(child=>child.path):[])]),publicRoutes=new Set([...collectionRoutes,...navigationRoutes]);
const rows=candidates.map(candidate=>{const exposed=candidate.forbiddenRoutes.filter(route=>publicRoutes.has(route));return {...candidate,status:"blocked",decision:"not-public",exposedRoutes:exposed}});
if(rows.some(row=>row.exposedRoutes.length))throw new Error(`Blocked calculator route is publicly exposed: ${rows.flatMap(row=>row.exposedRoutes).join(", ")}`);
const palData=JSON.parse(await readFile("public/data/pals.json","utf8"));
if(ivReport&&String(ivReport.gameBuild)!==String(palData.meta.gameBuild))throw new Error("Calculator evidence does not match the current public data build.");
const report={schema:2,gameBuild:palData.meta.gameBuild,decisionRule:"Publish exact calculator output only after every listed proof requirement and independent golden cases pass.",evidence:sourceManifest?{candidateAssets:sourceManifest.candidateAssetCount,candidateTables:sourceManifest.candidateTableCount,runtimeBlueprints:sourceManifest.runtimeBlueprintExtractedCount,ivIndependentSessions:ivReport?2:0}:{availability:"private evidence not present in this checkout"},rows};
const output=path.resolve("private","planning","blocked-calculators.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Validated ${rows.length} blocked calculator decisions with no public routes.`);
console.log(`Report: ${path.relative(process.cwd(),output)}`);
