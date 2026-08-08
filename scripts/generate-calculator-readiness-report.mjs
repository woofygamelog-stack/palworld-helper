import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {assessCalculatorReadiness} from "./lib/calculator-readiness.mjs";

const root=process.cwd(),build="24467282",directory=path.resolve(root,"private","verification","calculators",`build-${build}`),readJson=async file=>JSON.parse(await readFile(path.join(directory,file),"utf8"));
const [productionSource,productionPlan,capturePlan,captureRuntime]=await Promise.all([readJson("production-source-report.json"),readJson("production-runtime-test-plan.json"),readJson("capture-evidence-plan.json"),readJson("capture-runtime-report.json")]);
const aggregateHash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const productionInput={schema:1,domain:"production",expectedGameBuild:build,source:{status:"ready",gameBuild:String(productionSource.gameBuild),definitionCount:Object.keys(productionSource.sourceIntegrity.semanticHashes).length,unknownDenominator:0,semanticHash:aggregateHash(productionSource.sourceIntegrity.semanticHashes)},runtime:{status:"planned",gameBuild:String(productionPlan.gameBuild),caseCount:productionPlan.totalCases,independentSessionTarget:productionPlan.independentSessionTarget,sessionPlans:productionPlan.sessionPlans},golden:{status:"missing",gameBuild:build},public:{status:"excluded",routeCount:0}};
const captureInput={schema:1,domain:"capture",expectedGameBuild:build,source:{status:"partial",gameBuild:String(capturePlan.gameBuild),definitionCount:0,unknownDenominator:capturePlan.unknownDenominator,semanticHash:capturePlan.contentHash},runtime:{status:"partial",gameBuild:String(captureRuntime.gameBuild),caseCount:captureRuntime.totalCases,independentSessionTarget:2,sessionPlans:[]},golden:{status:"partial",gameBuild:build},public:{status:"excluded",routeCount:0}};
const domains=[productionInput,captureInput].map(input=>({domain:input.domain,...assessCalculatorReadiness(input),inputSummary:{sourceDefinitions:input.source.definitionCount,unknownSourceDenominator:input.source.unknownDenominator,runtimeCases:input.runtime.caseCount,independentSessionTarget:input.runtime.independentSessionTarget,sessionVectorHashes:input.runtime.sessionPlans.map(plan=>plan.vectorHash)}}));
if(domains.find(row=>row.domain==="production")?.state!=="ready-for-runtime-session"||domains.find(row=>row.domain==="capture")?.state!=="blocked")throw new Error("Calculator readiness states do not match the Phase 7 gate.");
const report={schema:1,gameBuild:Number(build),status:"phase-7-automatic-evidence-complete",domains};
report.contentHash=aggregateHash(report);
const output=path.join(directory,"calculator-readiness-report.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Generated calculator readiness report: ${domains.map(row=>`${row.domain}=${row.state}`).join(", ")}.`);
