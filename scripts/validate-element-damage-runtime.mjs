import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {validateElementDamageRuntime} from "./element-damage-runtime-validation.mjs";

const root=process.cwd();
const invariant=(condition,message)=>{if(!condition)throw new Error(message)};
const sourceReportPath=process.env.PAL_ELEMENT_SOURCE_REPORT;
const testPlanPath=process.env.PAL_ELEMENT_TEST_PLAN;
invariant(sourceReportPath&&testPlanPath,"PAL_ELEMENT_SOURCE_REPORT and PAL_ELEMENT_TEST_PLAN are required");
const [sourceReport,testPlan]=await Promise.all([readFile(path.resolve(sourceReportPath),"utf8").then(JSON.parse),readFile(path.resolve(testPlanPath),"utf8").then(JSON.parse)]);
const gameBuild=String(sourceReport.meta.gameBuild),base=path.join(root,"private","verification","element-damage",`build-${gameBuild}`);
const evidencePath=path.resolve(process.env.PAL_ELEMENT_RUNTIME_EVIDENCE||path.join(base,"runtime-evidence.jsonl"));
const outputPath=path.resolve(process.env.PAL_ELEMENT_RUNTIME_REPORT||path.join(base,"runtime-report.json"));
const evidenceText=await readFile(evidencePath,"utf8").catch(error=>{if(error.code==="ENOENT")throw new Error(`Machine runtime evidence is not available: ${evidencePath}`);throw error});
const report=validateElementDamageRuntime({sourceReport,testPlan,evidenceText});
await mkdir(path.dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify(report,null,2));
console.log(`Verified ${testPlan.lookupCases.length} lookup and ${testPlan.aggregationCases.length} live damage-route aggregation cases across ${report.coverage.sessions} independent sessions.`);
