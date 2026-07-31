import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {calculateWeakCount,multiplierForWeakCount,qualitativeChartProfileForHash,qualitativeOutcome} from "./element-damage-evidence.mjs";

const root=process.cwd();
const invariant=(condition,message)=>{if(!condition)throw new Error(message)};
const sourceReportPath=process.env.PAL_ELEMENT_SOURCE_REPORT;
invariant(sourceReportPath,"PAL_ELEMENT_SOURCE_REPORT must point to a build-scoped source report");
const sourceReport=JSON.parse(await readFile(path.resolve(sourceReportPath),"utf8"));
invariant(sourceReport.meta?.schema===2&&sourceReport.meta?.status==="source-lookup-verified-runtime-pending","Source report is not runtime-pending schema 2 evidence");
invariant(sourceReport.verification?.exactWeakCountLookup===true&&sourceReport.verification?.runtimeApplication===false,"Source report is not in the expected fail-closed state");
const gameBuild=String(sourceReport.meta.gameBuild);
const base=path.join(root,"private","verification","element-damage",`build-${gameBuild}`);
const outputPath=path.resolve(process.env.PAL_ELEMENT_TEST_PLAN||path.join(base,"test-plan.json"));
const contractPath=path.resolve(process.env.PAL_ELEMENT_RUNTIME_CONTRACT||path.join(base,"runtime-evidence.contract.json"));
const chartProfile=qualitativeChartProfileForHash(sourceReport.source.qualitativeChartHash);
const relations=chartProfile.relations,lookup=sourceReport.findings.weakCountLookup,elements=chartProfile.elements;

const defenderSets=[];
for(const element of elements)defenderSets.push([element]);
for(let left=0;left<elements.length;left++)for(let right=left+1;right<elements.length;right++)defenderSets.push([elements[left],elements[right]]);
const aggregationCases=[];
for(const attacker of elements)for(const defenders of defenderSets){
  const weakCount=calculateWeakCount(attacker,defenders,relations);
  aggregationCases.push({id:`aggregation-${attacker}-${defenders.join("-")}`,layer:"aggregation",attacker,defenders,outcomes:defenders.map(defender=>qualitativeOutcome(attacker,defender,relations)),expectedWeakCount:weakCount,expectedMultiplier:multiplierForWeakCount(weakCount,lookup)});
}
const lookupCases=Object.keys(lookup).map(Number).sort((a,b)=>a-b).map(weakCount=>({id:`lookup-${weakCount}`,layer:"lookup",weakCount,expectedMultiplier:multiplierForWeakCount(weakCount,lookup)}));
const neutralDefenderFor=attacker=>elements.find(defender=>qualitativeOutcome(attacker,defender,relations)==="neutral")??attacker;
const applicationKeys=new Set(),applicationCases=[];
const addApplicationCase=(attacker,defenders,kind)=>{
  const key=`${attacker}:${defenders.join("+")}`;
  if(applicationKeys.has(key))return;
  applicationKeys.add(key);
  const weakCount=calculateWeakCount(attacker,defenders,relations);
  applicationCases.push({id:`application-${attacker}-${defenders.join("-")}`,layer:"application",kind,attacker,defenders,controlDefenders:[neutralDefenderFor(attacker)],outcomes:defenders.map(defender=>qualitativeOutcome(attacker,defender,relations)),expectedWeakCount:weakCount,expectedMultiplier:multiplierForWeakCount(weakCount,lookup)});
};
for(const relation of relations){
  addApplicationCase(relation.attacker,[relation.defender],"single-strong");
  addApplicationCase(relation.defender,[relation.attacker],"single-weak");
}
for(const attacker of elements)addApplicationCase(attacker,[neutralDefenderFor(attacker)],"single-neutral");
for(const attacker of elements){
  const byPattern=new Map();
  for(const defenders of defenderSets.filter(value=>value.length===2)){
    const outcomes=defenders.map(defender=>qualitativeOutcome(attacker,defender,relations)).sort();
    const pattern=outcomes.join("+");
    if(!byPattern.has(pattern))byPattern.set(pattern,defenders);
  }
  for(const [pattern,defenders] of [...byPattern].sort(([left],[right])=>left.localeCompare(right)))addApplicationCase(attacker,defenders,`dual-${pattern}`);
}
const planIdentity={gameBuild,mappingHash:sourceReport.source.mappingHash,pak:sourceReport.source.pakFingerprint,functionRawHash:sourceReport.source.functionRawHash,chartHash:sourceReport.source.qualitativeChartHash,lookup};
const planId=createHash("sha256").update(JSON.stringify(planIdentity)).digest("hex");
const plan={
  meta:{schema:2,gameBuild,generatedAt:new Date().toISOString(),status:"machine-runtime-evidence-pending",planId},
  sourceExpectation:{functionProfileId:sourceReport.source.functionProfileId,qualitativeChartProfileId:chartProfile.profileId,weakCountLookup:lookup,aggregationHypothesis:"sum qualitative component scores (strong +1, neutral 0, weak -1)",aggregationVerified:false,runtimeVerified:false},
  coverage:{lookupCaseCount:lookupCases.length,aggregationCaseCount:aggregationCases.length,applicationCaseCount:applicationCases.length,attackerCount:elements.length,defenderSetCount:defenderSets.length,weakCounts:[...new Set(aggregationCases.map(value=>value.expectedWeakCount))].sort((a,b)=>a-b),applicationPatterns:[...new Set(applicationCases.map(value=>value.kind))].sort()},
  protocol:{minimumIndependentSessions:2,minimumApplicationSamplesPerArmPerSession:20,maxRelativeMeanError:.01,damageDeltaTolerance:1e-6,execution:"isolated official dedicated server with a disposable world and a verification-only driver",manualInputAllowed:false,requiredHooks:["GetWeakScale","CalcDamageCharacter","actual applied damage"],failClosedConditions:["build, mapping, PAK, plan, server, or world-settings fingerprint mismatch","missing or duplicate required cases","critical, weak-point, status, multi-hit, passive, partner, or world-setting contamination","damage popup without matching target HP delta","unrecognized function or chart profile"]},
  lookupCases,
  aggregationCases,
  applicationCases,
};
const contract={
  schema:2,
  gameBuild,
  planId,
  format:"UTF-8 JSON Lines; one object per line",
  recordTypes:{
    "session-start":{required:["schema","type","gameBuild","planId","sessionId","mappingHash","pakFingerprint","serverFingerprint","runtimeFunctionRawHash","driverFingerprint","worldSettingsFingerprint"]},
    "lookup-observation":{required:["schema","type","gameBuild","planId","sessionId","caseId","weakCount","observedMultiplier"]},
    "aggregation-observation":{required:["schema","type","gameBuild","planId","sessionId","caseId","attacker","defenders","observedWeakCount","observedMultiplier"]},
    "damage-observation":{required:["schema","type","gameBuild","planId","sessionId","caseId","sampleId","arm","comparisonFingerprint","hpBefore","hpAfter","reportedAppliedDamage","singleHit","contamination"]},
    "session-end":{required:["schema","type","gameBuild","planId","sessionId","completed"]},
  },
  contaminationFields:["critical","weakPoint","statusEffect","multiHit","passiveModifier","partnerModifier","worldSettingsDrift"],
  notes:["The verification driver writes this file. Human-entered samples are rejected by policy and are not part of this contract.","A runtime report may open publication gates only after every planned record passes in two independent fresh sessions."],
};
await mkdir(path.dirname(outputPath),{recursive:true});
await Promise.all([writeFile(outputPath,JSON.stringify(plan,null,2)),writeFile(contractPath,JSON.stringify(contract,null,2))]);
console.log(`Generated a machine-only runtime plan for build ${gameBuild}: ${lookupCases.length} lookup, ${aggregationCases.length} aggregation, and ${applicationCases.length} applied-damage cases.`);
