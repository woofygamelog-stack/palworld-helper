import {mean} from "./element-damage-evidence.mjs";

const invariant=(condition,message)=>{if(!condition)throw new Error(message)};

export function validateElementDamageRuntime({sourceReport,testPlan,evidenceText}){
  const gameBuild=String(sourceReport.meta.gameBuild);
  invariant(sourceReport.meta.schema===2&&testPlan.meta.schema===2&&String(testPlan.meta.gameBuild)===gameBuild,"Source report and runtime plan build or schema mismatch");
  const records=evidenceText.split(/\r?\n/).map(value=>value.trim()).filter(Boolean).map((line,index)=>{try{return JSON.parse(line)}catch{throw new Error(`Runtime evidence line ${index+1} is not valid JSON`)}});
  invariant(records.length>0,"Runtime evidence is empty");
  for(const record of records){
    invariant(record.schema===2&&String(record.gameBuild)===gameBuild&&record.planId===testPlan.meta.planId,`Runtime record build, schema, or plan mismatch (${record.type??"unknown"})`);
    invariant(typeof record.sessionId==="string"&&record.sessionId.length>0,"Runtime record session ID is missing");
  }
  const starts=records.filter(value=>value.type==="session-start"),ends=records.filter(value=>value.type==="session-end");
  const sessions=new Map(starts.map(value=>[value.sessionId,value]));
  invariant(sessions.size===starts.length&&sessions.size>=testPlan.protocol.minimumIndependentSessions,"Independent runtime session coverage is incomplete or duplicated");
  invariant(ends.length===sessions.size&&new Set(ends.map(value=>value.sessionId)).size===sessions.size&&ends.every(value=>sessions.has(value.sessionId)&&value.completed===true),"Every runtime session must end successfully exactly once");
  invariant(records.every(value=>sessions.has(value.sessionId)),"Runtime evidence contains a record outside the declared sessions");
  invariant(new Set(starts.map(value=>value.serverFingerprint)).size===1&&new Set(starts.map(value=>value.driverFingerprint)).size===1&&new Set(starts.map(value=>value.worldSettingsFingerprint)).size===1,"Server, driver, and world-settings fingerprints must remain identical across independent sessions");
  for(const start of starts){
    invariant(start.mappingHash===sourceReport.source.mappingHash,"Runtime mapping fingerprint mismatch");
    invariant(start.pakFingerprint?.length===sourceReport.source.pakFingerprint.length&&start.pakFingerprint?.sampledSha256===sourceReport.source.pakFingerprint.sampledSha256,"Runtime PAK fingerprint mismatch");
    invariant(typeof start.serverFingerprint==="string"&&start.serverFingerprint.length>=16,"Runtime server fingerprint is missing");
    invariant(start.runtimeFunctionRawHash===sourceReport.source.functionRawHash,"Runtime server GetWeakScale profile does not match the extracted client source");
    invariant(typeof start.driverFingerprint==="string"&&start.driverFingerprint.length>=16,"Runtime driver fingerprint is missing");
    invariant(typeof start.worldSettingsFingerprint==="string"&&start.worldSettingsFingerprint.length>=16,"Runtime world-settings fingerprint is missing");
  }
  const lookupById=new Map(testPlan.lookupCases.map(value=>[value.id,value]));
  const aggregationById=new Map(testPlan.aggregationCases.map(value=>[value.id,value]));
  const applicationById=new Map(testPlan.applicationCases.map(value=>[value.id,value]));
  const byType=type=>records.filter(value=>value.type===type);
  const nearlyEqual=(actual,expected,tolerance=1e-6)=>Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance;
  for(const record of byType("lookup-observation")){
    const testCase=lookupById.get(record.caseId);invariant(testCase,`Unknown lookup case: ${record.caseId}`);
    invariant(record.weakCount===testCase.weakCount&&nearlyEqual(record.observedMultiplier,testCase.expectedMultiplier),`Lookup observation mismatch: ${record.caseId}/${record.sessionId}`);
  }
  for(const testCase of testPlan.lookupCases)for(const sessionId of sessions.keys())invariant(byType("lookup-observation").filter(value=>value.caseId===testCase.id&&value.sessionId===sessionId).length===1,`Lookup case must occur once per session: ${testCase.id}/${sessionId}`);
  for(const record of byType("aggregation-observation")){
    const testCase=aggregationById.get(record.caseId);invariant(testCase,`Unknown aggregation case: ${record.caseId}`);
    invariant(record.attacker===testCase.attacker&&JSON.stringify(record.defenders)===JSON.stringify(testCase.defenders),`Aggregation input drifted: ${record.caseId}/${record.sessionId}`);
    invariant(record.observedWeakCount===testCase.expectedWeakCount&&nearlyEqual(record.observedMultiplier,testCase.expectedMultiplier),`Aggregation result mismatch: ${record.caseId}/${record.sessionId}`);
  }
  for(const testCase of testPlan.aggregationCases)for(const sessionId of sessions.keys())invariant(byType("aggregation-observation").filter(value=>value.caseId===testCase.id&&value.sessionId===sessionId).length===1,`Aggregation case must occur once per session: ${testCase.id}/${sessionId}`);
  const contaminationFields=["critical","weakPoint","statusEffect","multiHit","passiveModifier","partnerModifier","worldSettingsDrift"];
  const applicationResults=[];
  for(const testCase of testPlan.applicationCases){
    const sessionResults=[];
    for(const sessionId of sessions.keys()){
      const samples=byType("damage-observation").filter(value=>value.caseId===testCase.id&&value.sessionId===sessionId);
      invariant(new Set(samples.map(value=>value.sampleId)).size===samples.length,`Damage sample IDs are duplicated: ${testCase.id}/${sessionId}`);
      invariant(samples.every(value=>value.arm==="control"||value.arm==="treatment"),`Damage sample arm is invalid: ${testCase.id}/${sessionId}`);
      const control=samples.filter(value=>value.arm==="control"),treatment=samples.filter(value=>value.arm==="treatment");
      invariant(control.length>=testPlan.protocol.minimumApplicationSamplesPerArmPerSession&&treatment.length>=testPlan.protocol.minimumApplicationSamplesPerArmPerSession,`Applied-damage samples are incomplete: ${testCase.id}/${sessionId}`);
      invariant(new Set(samples.map(value=>value.comparisonFingerprint)).size===1,"Treatment and control setup fingerprints differ");
      const deltas=samples.map(value=>{
        invariant(value.singleHit===true&&contaminationFields.every(name=>value.contamination?.[name]===false),`Contaminated applied-damage sample: ${testCase.id}/${sessionId}/${value.sampleId}`);
        const delta=value.hpBefore-value.hpAfter;
        invariant(delta>0&&nearlyEqual(delta,value.reportedAppliedDamage,testPlan.protocol.damageDeltaTolerance),`Applied damage does not match the target HP delta: ${testCase.id}/${sessionId}/${value.sampleId}`);
        return {arm:value.arm,delta};
      });
      const observedMultiplier=mean(deltas.filter(value=>value.arm==="treatment").map(value=>value.delta))/mean(deltas.filter(value=>value.arm==="control").map(value=>value.delta));
      const relativeError=Math.abs(observedMultiplier-testCase.expectedMultiplier)/testCase.expectedMultiplier;
      invariant(relativeError<=testPlan.protocol.maxRelativeMeanError,`Applied-damage multiplier mismatch: ${testCase.id}/${sessionId} observed ${observedMultiplier}`);
      sessionResults.push({sessionId,observedMultiplier,relativeError,controlSamples:control.length,treatmentSamples:treatment.length});
    }
    applicationResults.push({caseId:testCase.id,expectedMultiplier:testCase.expectedMultiplier,sessions:sessionResults});
  }
  const knownTypes=new Set(["session-start","lookup-observation","aggregation-observation","damage-observation","session-end"]);
  invariant(records.every(value=>knownTypes.has(value.type)),"Runtime evidence contains an unknown record type");
  invariant(byType("damage-observation").every(value=>applicationById.has(value.caseId)),"Runtime evidence contains an unknown application case");
  return {meta:{schema:2,gameBuild,generatedAt:new Date().toISOString(),status:"runtime-verified",planId:testPlan.meta.planId},coverage:{sessions:sessions.size,lookupCases:testPlan.lookupCases.length,aggregationCases:testPlan.aggregationCases.length,applicationCases:testPlan.applicationCases.length,recordCount:records.length},applicationResults,verification:{exactWeakCountLookup:true,weakCountAggregationRule:true,runtimeApplication:true,numericMultipliersReadyForPublic:true,dualElementRuleReadyForPublic:true}};
}
