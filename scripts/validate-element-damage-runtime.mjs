import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {mean} from "./element-damage-evidence.mjs";

const root=process.cwd();
const base=path.join(root,"private","verification","element-damage","build-24181527");
const sourceReport=JSON.parse(await readFile(process.env.PAL_ELEMENT_SOURCE_REPORT||path.join(base,"source-report.json"),"utf8"));
const testPlan=JSON.parse(await readFile(process.env.PAL_ELEMENT_TEST_PLAN||path.join(base,"test-plan.json"),"utf8"));
const evidencePath=process.env.PAL_ELEMENT_RUNTIME_EVIDENCE||path.join(base,"runtime-observations.json");
const outputPath=process.env.PAL_ELEMENT_RUNTIME_REPORT||path.join(base,"runtime-report.json");
const evidence=JSON.parse(await readFile(evidencePath,"utf8").catch(error=>{
  if(error.code==="ENOENT")throw new Error(`Runtime observations are not recorded. Copy ${path.join(base,"runtime-observations.template.json")} to ${evidencePath} and complete every generated case.`);
  throw error;
}));
const invariant=(condition,message)=>{if(!condition)throw new Error(message)};
invariant(evidence.schema===1&&evidence.gameBuild===sourceReport.meta.gameBuild&&testPlan.meta.gameBuild===sourceReport.meta.gameBuild,"Runtime evidence build or schema mismatch");
invariant(evidence.mappingHash===sourceReport.source.mappingHash,"Runtime evidence mapping hash mismatch");
invariant(evidence.pakFingerprint?.length===sourceReport.source.pakFingerprint.length&&evidence.pakFingerprint?.lastWriteTimeUtc===sourceReport.source.pakFingerprint.lastWriteTimeUtc,"Runtime evidence PAK fingerprint mismatch");
invariant(typeof evidence.worldDamageSettingsFingerprint==="string"&&evidence.worldDamageSettingsFingerprint.length>0,"Runtime evidence world damage-settings fingerprint is missing");
invariant(Array.isArray(evidence.observations),"Runtime observations are missing");
const planById=new Map(testPlan.requiredCases.map(value=>[value.id,value]));
invariant(evidence.observations.every(value=>planById.has(value.caseId)),"Runtime evidence contains a case that is not required by the pinned test plan");
const observationsByCase=new Map();
for(const observation of evidence.observations){
  const values=observationsByCase.get(observation.caseId)??[];
  values.push(observation);
  observationsByCase.set(observation.caseId,values);
}
const requiredInvariants=testPlan.measurementProtocol.requiredInvariants;
const results=[],missing=[];
for(const testCase of testPlan.requiredCases){
  const observations=observationsByCase.get(testCase.id)||[];
  const sessions=new Set(observations.map(value=>value.sessionId));
  if(sessions.size<testPlan.measurementProtocol.minimumSessionsPerCase){missing.push(testCase.id);continue}
  invariant(sessions.size===observations.length,`Each runtime observation must use a unique case/session pair: ${testCase.id}`);
  const sessionResults=[];
  for(const observation of observations){
    invariant(planById.has(observation.caseId),`Unknown runtime case: ${observation.caseId}`);
    invariant(typeof observation.sessionId==="string"&&observation.sessionId.length>0,`Runtime session ID is missing: ${observation.caseId}`);
    const setup=observation.setup;
    invariant(setup&&typeof setup.attackerPalId==="string"&&setup.attackerPalId.length>0,`Attacker identity is missing: ${observation.caseId}/${observation.sessionId}`);
    invariant(testCase.skillCandidates.some(value=>value.id===setup.skillId),`Unapproved attack skill: ${observation.caseId}/${observation.sessionId}`);
    invariant(Number.isInteger(setup.attackerLevel)&&setup.attackerLevel>0&&Number.isFinite(setup.attackerAttack)&&setup.attackerAttack>0,`Attacker level or attack stat is invalid: ${observation.caseId}/${observation.sessionId}`);
    invariant(setup.treatmentTargetId===testCase.target.id&&setup.controlTargetId===testCase.neutralControl.id,`Runtime target identity drifted: ${observation.caseId}/${observation.sessionId}`);
    invariant(Number.isInteger(setup.targetLevel)&&setup.targetLevel>0,`Target level is invalid: ${observation.caseId}/${observation.sessionId}`);
    invariant(Number.isFinite(setup.treatmentDefense)&&setup.treatmentDefense>0&&setup.controlDefense===setup.treatmentDefense,`Treatment and control defense must be the same positive value: ${observation.caseId}/${observation.sessionId}`);
    invariant(setup.worldDamageSettingsFingerprint===evidence.worldDamageSettingsFingerprint,`World damage settings drifted: ${observation.caseId}/${observation.sessionId}`);
    invariant(requiredInvariants.every(name=>observation.invariants?.[name]===true),`Runtime invariants failed: ${observation.caseId}/${observation.sessionId}`);
    invariant(observation.controlSamples?.length>=testPlan.measurementProtocol.minimumSamplesPerSession&&observation.treatmentSamples?.length>=testPlan.measurementProtocol.minimumSamplesPerSession,`Insufficient runtime samples: ${observation.caseId}/${observation.sessionId}`);
    const observedMultiplier=mean(observation.treatmentSamples)/mean(observation.controlSamples);
    const relativeError=Math.abs(observedMultiplier-testCase.sourceMultiplier)/testCase.sourceMultiplier;
    invariant(relativeError<=testPlan.measurementProtocol.maxRelativeMeanError,`Runtime multiplier mismatch for ${observation.caseId}/${observation.sessionId}: ${observedMultiplier}`);
    sessionResults.push({sessionId:observation.sessionId,observedMultiplier,relativeError,controlSamples:observation.controlSamples.length,treatmentSamples:observation.treatmentSamples.length});
  }
  results.push({caseId:testCase.id,expectedMultiplier:testCase.sourceMultiplier,sessions:sessionResults});
}
invariant(missing.length===0,`Runtime evidence is incomplete for ${missing.length} required cases: ${missing.slice(0,12).join(", ")}`);
const report={meta:{schema:1,gameBuild:sourceReport.meta.gameBuild,generatedAt:new Date().toISOString(),status:"runtime-verified"},coverage:{requiredCases:testPlan.requiredCases.length,verifiedCases:results.length,observationRecords:evidence.observations.length},results,verification:{exactWeakCountLookup:true,weakCountAggregationRule:true,runtimeApplication:true,numericMultipliersReadyForPublic:true,dualElementRuleReadyForPublic:true}};
await mkdir(path.dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify(report,null,2));
console.log(`Verified ${results.length} controlled element-damage cases across the required independent sessions.`);
