import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),build="24467282";
const sourceReport=JSON.parse(await readFile(path.resolve(root,"private","verification","calculators",`build-${build}`,"production-source-report.json"),"utf8"));
const itemData=JSON.parse(await readFile(path.resolve(root,"public","data","items.json"),"utf8"));
if(sourceReport.status!=="normalized-source-only"||sourceReport.publicationReady!==false||String(sourceReport.gameBuild)!==build||String(itemData.meta?.gameBuild)!==build)throw new Error("Production runtime plan inputs are not ready or build-matched.");

const observations=["baseCraftSpeed","buffedCraftSpeed","sicknessRate","workSuitabilityRank","workAmountDelta","elapsedTicks"];
const cases=[];
const add=(family,id,input)=>cases.push({caseId:`${family}:${id}`,family,input,requiredObservations:observations,expectedFinalValue:null});
add("baseline","default",{modifiers:[]});
for(const [suitability,values] of Object.entries(sourceReport.workSuitabilityCraftSpeeds))values.forEach((sourceValue,rank)=>add("suitability",`${suitability}:${rank}`,{suitability,rank,sourceValue}));
for(const passive of sourceReport.craftSpeedPassives)add("passive",passive.id,{passiveId:passive.id,effects:passive.effects});
for(const sickness of sourceReport.sicknessRows)add("sickness",sickness.id,{sicknessId:sickness.id,sourceWorkSpeed:sickness.workSpeed});
for(const research of sourceReport.labCraftSpeed)add("research",research.id,{researchId:research.id,suitability:research.suitability,sourceValue:research.value});
for(const [workHardType,sourceRate] of Object.entries(sourceReport.workHardRates))add("work-hard",workHardType,{workHardType,sourceRate});
for(const facility of sourceReport.facilityCatalogRelations)add("facility",facility.publicSlug,{facilitySlug:facility.publicSlug,facilityDefinition:facility.facilityName});
for(const inputValue of [0.5,1,2])add("world-setting",String(inputValue),{field:"WorkSpeedRate",inputValue});

const recipes=[...itemData.recipes].sort((left,right)=>left.workAmount-right.workAmount||left.id.localeCompare(right.id,"en"));
if(recipes.length!==1286||recipes.some(recipe=>!Number.isFinite(recipe.workAmount)||recipe.workAmount<=0))throw new Error("Production recipe runtime plan baseline drifted.");
for(const recipe of [recipes[0],recipes[Math.floor(recipes.length/2)],recipes.at(-1)])add("recipe",recipe.id,{recipeId:recipe.id,workAmount:recipe.workAmount,output:recipe.output});

const interactionFactors=["suitability","passive","sickness","facility","research","work-hard","world-setting"];
for(let left=0;left<interactionFactors.length;left++)for(let right=left+1;right<interactionFactors.length;right++)add("interaction",`${interactionFactors[left]}+${interactionFactors[right]}`,{factors:[interactionFactors[left],interactionFactors[right]],selection:"representative-nonzero"});
add("interaction","all-factors",{factors:interactionFactors,selection:"representative-nonzero"});

const familyCounts=Object.fromEntries([...Map.groupBy(cases,entry=>entry.family)].map(([family,entries])=>[family,entries.length]).sort(([left],[right])=>left.localeCompare(right,"en")));
const expectedFamilyCounts={baseline:1,facility:4,interaction:22,passive:64,recipe:3,research:53,sickness:9,suitability:121,"work-hard":4,"world-setting":3};
if(JSON.stringify(familyCounts)!==JSON.stringify(expectedFamilyCounts)||cases.length!==284||new Set(cases.map(entry=>entry.caseId)).size!==cases.length)throw new Error("Production runtime test-plan coverage drifted.");
const report={schema:1,gameBuild:Number(build),status:"planned",publicationReady:false,independentSessionTarget:2,completionMarker:"PAL_PRODUCTION_EVIDENCE|complete",errorMarker:"PAL_PRODUCTION_EVIDENCE|error",familyCounts,totalCases:cases.length,cases};
report.contentHash=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const output=path.resolve(root,"private","verification","calculators",`build-${build}`,"production-runtime-test-plan.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Generated ${cases.length} production runtime cases; report: ${path.relative(root,output)}`);
