import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),build="24467282",directory=path.resolve(root,"private","verification","calculators",`build-${build}`);
const runtime=JSON.parse(await readFile(path.join(directory,"capture-runtime-report.json"),"utf8"));
if(runtime.schema!==1||runtime.status!=="verified-partial"||runtime.totalCases!==180||runtime.independentSessions!==true||String(runtime.gameBuild)!==build)throw new Error("Capture partial runtime evidence is incomplete or stale.");
const verifiedMatrix={caseCount:runtime.totalCases,gridCases:runtime.gridCases,levelCases:runtime.levelCases,axes:runtime.axes,sessionCount:runtime.sessions.length,sessionPayloadHashes:runtime.sessions.map(session=>session.payloadSha256)};
const blockers=[
  {family:"passive-order",unknownDenominator:true,requiredDefinition:"capture-affecting passive set and application order"},
  {family:"status-effect-order",unknownDenominator:true,requiredDefinition:"capture-affecting status set, stacking, and application order"},
  {family:"world-setting-placement",unknownDenominator:true,requiredDefinition:"world capture-rate setting placement and caps"},
  {family:"rare-pal-behavior",unknownDenominator:true,requiredDefinition:"rare-Pal branch and modifier behavior"},
  {family:"rounding-and-caps",unknownDenominator:true,requiredDefinition:"intermediate precision, rounding boundaries, and final caps"},
];
const report={schema:1,gameBuild:Number(build),status:"blocked-source-definitions",publicationReady:false,verifiedMatrix,blockers,unknownDenominator:blockers.length,independentSessionTarget:2,completionMarker:"PAL_CAPTURE_FULL_EVIDENCE|complete",errorMarker:"PAL_CAPTURE_FULL_EVIDENCE|error",sessionPlans:[]};
report.contentHash=createHash("sha256").update(JSON.stringify(report)).digest("hex");
const output=path.join(directory,"capture-evidence-plan.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Generated capture evidence gap plan with ${blockers.length} explicit source blockers; report: ${path.relative(root,output)}`);
