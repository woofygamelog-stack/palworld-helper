const invariant=(condition,message)=>{if(!condition)throw new Error(message)};
const nearlyEqual=(actual,expected,tolerance=1e-6)=>Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance;

export function validateElementDamageRuntime({sourceReport,testPlan,evidenceText}){
  const gameBuild=String(sourceReport.meta.gameBuild);
  invariant(sourceReport.meta.schema===2&&testPlan.meta.schema===3&&String(testPlan.meta.gameBuild)===gameBuild,"Source report and runtime plan build or schema mismatch");
  invariant(testPlan.sourceExpectation?.aggregationRule?.sameElementResistance==="all-except-neutral"&&testPlan.sourceExpectation?.aggregationRule?.neutralAttackIsNeverWeak===true,"The runtime plan is missing a verified element-scoring exception");
  const records=evidenceText.split(/\r?\n/).map(value=>value.trim()).filter(Boolean).map((line,index)=>{try{return JSON.parse(line)}catch{throw new Error(`Runtime evidence line ${index+1} is not valid JSON`)}});
  invariant(records.length>0,"Runtime evidence is empty");
  const knownTypes=new Set(["session-start","lookup-observation","aggregation-observation","session-end"]);
  for(const record of records){
    invariant(record.schema===3&&String(record.gameBuild)===gameBuild&&record.planId===testPlan.meta.planId,`Runtime record build, schema, or plan mismatch (${record.type??"unknown"})`);
    invariant(knownTypes.has(record.type),`Runtime evidence contains an unknown record type: ${record.type??"missing"}`);
    invariant(typeof record.sessionId==="string"&&record.sessionId.length>0,"Runtime record session ID is missing");
  }
  const byType=type=>records.filter(value=>value.type===type);
  const starts=byType("session-start"),ends=byType("session-end"),sessions=new Map(starts.map(value=>[value.sessionId,value]));
  invariant(sessions.size===starts.length&&sessions.size>=testPlan.protocol.minimumIndependentSessions,"Independent runtime session coverage is incomplete or duplicated");
  invariant(ends.length===sessions.size&&new Set(ends.map(value=>value.sessionId)).size===sessions.size&&ends.every(value=>sessions.has(value.sessionId)&&value.completed===true&&value.lookupCount===testPlan.lookupCases.length&&value.aggregationCount===testPlan.aggregationCases.length),"Every runtime session must end successfully with exact coverage");
  invariant(records.every(value=>sessions.has(value.sessionId)),"Runtime evidence contains a record outside the declared sessions");
  for(const field of ["serverFingerprint","serverPakFingerprint","driverFingerprint","worldSettingsFingerprint"]){
    invariant(new Set(starts.map(value=>JSON.stringify(value[field]))).size===1,`${field} must remain identical across independent sessions`);
  }
  for(const start of starts){
    invariant(start.mappingHash===sourceReport.source.mappingHash,"Runtime mapping fingerprint mismatch");
    invariant(start.clientPakFingerprint?.length===sourceReport.source.pakFingerprint.length&&start.clientPakFingerprint?.sampledSha256===sourceReport.source.pakFingerprint.sampledSha256,"Client PAK fingerprint mismatch");
    invariant(typeof start.serverFingerprint==="string"&&start.serverFingerprint.length===64,"Runtime server fingerprint is missing");
    invariant(Number.isSafeInteger(start.serverPakFingerprint?.length)&&start.serverPakFingerprint.length>0&&typeof start.serverPakFingerprint?.sampledSha256==="string"&&start.serverPakFingerprint.sampledSha256.length===64,"Runtime server PAK fingerprint is missing");
    invariant(start.sourceFunctionRawHash===sourceReport.source.functionRawHash,"Runtime evidence does not reference the verified source GetWeakScale function");
    invariant(typeof start.driverFingerprint==="string"&&start.driverFingerprint.length===64,"Runtime driver fingerprint is missing");
    invariant(typeof start.worldSettingsFingerprint==="string"&&start.worldSettingsFingerprint.length===64,"Runtime world-settings fingerprint is missing");
  }
  const lookupById=new Map(testPlan.lookupCases.map(value=>[value.id,value]));
  const aggregationById=new Map(testPlan.aggregationCases.map(value=>[value.id,value]));
  for(const record of byType("lookup-observation")){
    const testCase=lookupById.get(record.caseId);invariant(testCase,`Unknown lookup case: ${record.caseId}`);
    invariant(record.weakCount===testCase.weakCount&&nearlyEqual(record.observedMultiplier,testCase.expectedMultiplier),`Lookup observation mismatch: ${record.caseId}/${record.sessionId}`);
  }
  for(const testCase of testPlan.lookupCases)for(const sessionId of sessions.keys())invariant(byType("lookup-observation").filter(value=>value.caseId===testCase.id&&value.sessionId===sessionId).length===1,`Lookup case must occur once per session: ${testCase.id}/${sessionId}`);
  for(const record of byType("aggregation-observation")){
    const testCase=aggregationById.get(record.caseId);invariant(testCase,`Unknown aggregation case: ${record.caseId}`);
    invariant(record.attacker===testCase.attacker&&JSON.stringify(record.defenders)===JSON.stringify(testCase.defenders),`Aggregation input drifted: ${record.caseId}/${record.sessionId}`);
    invariant(record.observedWeakCount===testCase.expectedWeakCount&&nearlyEqual(record.observedMultiplier,testCase.expectedMultiplier),`Damage-route aggregation mismatch: ${record.caseId}/${record.sessionId}`);
  }
  for(const testCase of testPlan.aggregationCases)for(const sessionId of sessions.keys())invariant(byType("aggregation-observation").filter(value=>value.caseId===testCase.id&&value.sessionId===sessionId).length===1,`Aggregation case must occur once per session: ${testCase.id}/${sessionId}`);
  invariant(byType("lookup-observation").length===testPlan.lookupCases.length*sessions.size,"Unexpected lookup observation count");
  invariant(byType("aggregation-observation").length===testPlan.aggregationCases.length*sessions.size,"Unexpected aggregation observation count");
  const lookup=Object.fromEntries(testPlan.lookupCases.map(value=>[String(value.weakCount),value.expectedMultiplier]));
  return {meta:{schema:3,gameBuild,generatedAt:new Date().toISOString(),status:"runtime-verified",planId:testPlan.meta.planId},coverage:{sessions:sessions.size,lookupCases:testPlan.lookupCases.length,aggregationCases:testPlan.aggregationCases.length,recordCount:records.length},rules:{numericMultipliers:{strong:lookup["1"],weak:lookup["-1"],neutral:lookup["0"]},dualElement:{operation:"sum-relation-scores",sameElementResistance:"all-except-neutral",neutralAttackIsNeverWeak:true,multipliersByWeakCount:lookup}},verification:{exactWeakCountLookup:true,weakCountAggregationRule:true,damageCalculationRoute:true,numericMultipliersReadyForPublic:true,dualElementRuleReadyForPublic:true}};
}
