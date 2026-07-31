import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {calculateWeakCount,multiplierForWeakCount,qualitativeOutcome} from "./element-damage-evidence.mjs";

const root=process.cwd();
const reportPath=process.env.PAL_ELEMENT_SOURCE_REPORT||path.join(root,"private","verification","element-damage","build-24181527","source-report.json");
const outputPath=process.env.PAL_ELEMENT_TEST_PLAN||path.join(root,"private","verification","element-damage","build-24181527","test-plan.json");
const templatePath=process.env.PAL_ELEMENT_RUNTIME_TEMPLATE||path.join(root,"private","verification","element-damage","build-24181527","runtime-observations.template.json");
const [sourceReport,elementData,palData,skillData]=await Promise.all([
  readFile(reportPath,"utf8").then(JSON.parse),
  readFile(path.join(root,"public","data","elements.json"),"utf8").then(JSON.parse),
  readFile(path.join(root,"public","data","pals.json"),"utf8").then(JSON.parse),
  readFile(path.join(root,"public","data","skills.json"),"utf8").then(JSON.parse),
]);
if(sourceReport.meta.gameBuild!==elementData.meta.gameBuild||palData.meta.gameBuild!==elementData.meta.gameBuild||skillData.meta.gameBuild!==elementData.meta.gameBuild)throw new Error("Element test-plan inputs are mixed across builds");
if(!sourceReport.verification.exactWeakCountLookup||sourceReport.verification.runtimeApplication)throw new Error("Source report is not in the expected runtime-pending state");
const relations=elementData.relations,lookup=sourceReport.findings.weakCountLookup;
const palOrder=(a,b)=>a.dex-b.dex||Number(a.variant)-Number(b.variant)||a.id.localeCompare(b.id);
const singlePals=palData.pals.filter(value=>value.elementSlugs.length===1).sort(palOrder);
const dualPals=palData.pals.filter(value=>value.elementSlugs.length===2).sort(palOrder);
const palRef=value=>value?{id:value.id,dex:value.dex,name:value.names["en-US"],elements:value.elementSlugs,baseDefense:value.defense}:null;
const neutralControl=(attacker,target)=>singlePals.find(value=>qualitativeOutcome(attacker,value.elementSlugs[0],relations)==="neutral"&&value.defense===target?.defense)||null;
const pairedTargetFor=(attacker,elements)=>{
  const targets=palData.pals.filter(value=>value.elementSlugs.length===elements.length&&elements.every(element=>value.elementSlugs.includes(element))).sort(palOrder);
  for(const target of targets){
    const control=neutralControl(attacker,target);
    if(control)return {target,control};
  }
  return {target:targets[0]??null,control:null};
};
const skillCandidates=Object.fromEntries(elementData.elements.map(element=>{
  const sourceId=skillData.elements.find(value=>value.names["en-US"]===element.names["en-US"])?.id;
  const candidates=skillData.activeSkills.filter(value=>value.elementId===sourceId&&value.hasSkillFruit&&value.power>0).sort((a,b)=>a.power-b.power||a.cooldown-b.cooldown||a.id.localeCompare(b.id)).slice(0,5);
  return [element.slug,candidates.map(value=>({id:value.id,name:value.names["en-US"],power:value.power,cooldown:value.cooldown,requiresSingleHitManualReview:true}))];
}));
const singleCases=[];
for(const relation of relations){
  for(const [kind,attacker,defender] of [["strong",relation.attacker,relation.defender],["weak",relation.defender,relation.attacker]]){
    const pair=pairedTargetFor(attacker,[defender]),weakCount=calculateWeakCount(attacker,[defender],relations);
    singleCases.push({id:`single-${kind}-${attacker}-${defender}`,kind,attacker,defenders:[defender],outcomes:[qualitativeOutcome(attacker,defender,relations)],weakCount,sourceMultiplier:multiplierForWeakCount(weakCount,lookup),target:palRef(pair.target),neutralControl:palRef(pair.control),skillCandidates:skillCandidates[attacker]});
  }
}
for(const attacker of elementData.elements.map(value=>value.slug)){
  const defender=elementData.elements.map(value=>value.slug).find(value=>qualitativeOutcome(attacker,value,relations)==="neutral"&&value!==attacker)||attacker;
  const pair=pairedTargetFor(attacker,[defender]);
  singleCases.push({id:`single-neutral-${attacker}-${defender}`,kind:"neutral",attacker,defenders:[defender],outcomes:["neutral"],weakCount:0,sourceMultiplier:1,target:palRef(pair.target),neutralControl:palRef(pair.target),skillCandidates:skillCandidates[attacker]});
}
const dualCandidates=[];
for(const attacker of elementData.elements.map(value=>value.slug))for(const pal of dualPals){
  const outcomes=pal.elementSlugs.map(defender=>qualitativeOutcome(attacker,defender,relations));
  const weakCount=calculateWeakCount(attacker,pal.elementSlugs,relations);
  dualCandidates.push({attacker,pal,outcomes,weakCount,pattern:[...outcomes].sort().join("+")});
}
const groupedDualCandidates=new Map();
for(const candidate of dualCandidates){
  const key=`${candidate.attacker}:${candidate.pattern}`;
  const values=groupedDualCandidates.get(key)??[];
  values.push(candidate);
  groupedDualCandidates.set(key,values);
}
const dualCases=[],excludedCases=[];
for(const candidates of groupedDualCandidates.values()){
  const candidate=candidates.find(value=>neutralControl(value.attacker,value.pal));
  if(!candidate){
    const unavailable=candidates[0];
    excludedCases.push({id:`dual-${unavailable.attacker}-${unavailable.pattern.replaceAll("+","-")}`,attacker:unavailable.attacker,pattern:unavailable.pattern,candidateTargets:candidates.map(value=>palRef(value.pal)),reason:"No single-element neutral-control Pal has matching base defense; changing both defense and attack would confound the ratio."});
    continue;
  }
  dualCases.push({id:`dual-${candidate.attacker}-${candidate.pattern.replaceAll("+","-")}`,kind:"dual",attacker:candidate.attacker,defenders:candidate.pal.elementSlugs,outcomes:candidate.outcomes,pattern:candidate.pattern,weakCount:candidate.weakCount,sourceMultiplier:multiplierForWeakCount(candidate.weakCount,lookup),target:palRef(candidate.pal),neutralControl:palRef(neutralControl(candidate.attacker,candidate.pal)),skillCandidates:skillCandidates[candidate.attacker]});
}
const reachableWeakCounts=[...new Set(dualCandidates.map(value=>value.weakCount))].sort((a,b)=>a-b);
const requiredCases=[...singleCases,...dualCases];
if(requiredCases.some(value=>!value.target||!value.neutralControl||value.skillCandidates.length===0))throw new Error("A required runtime case is missing a target, matched neutral control, or usable skill candidate");
const requiredInvariants=["sameAttacker","sameSkill","sameAttackerLevel","sameTargetLevel","sameTargetDefense","singleHitOnly","noCritical","noWeakPoint","noStatusEffects","noPassiveOrPartnerModifiers","sameWorldDamageSettings","hpDeltaMeasured"];
const plan={
  meta:{schema:1,gameBuild:elementData.meta.gameBuild,generatedAt:new Date().toISOString(),status:"runtime-observations-pending",caseCount:requiredCases.length},
  sourceExpectation:{weakCountLookup:lookup,aggregationHypothesis:"sum qualitative component scores (strong +1, neutral 0, weak -1)",aggregationVerified:false,runtimeVerified:false},
  coverage:{singleCaseCount:singleCases.length,dualCaseCount:dualCases.length,excludedCaseCount:excludedCases.length,reachableDualWeakCounts:reachableWeakCounts,sourceOnlyWeakCounts:Object.keys(lookup).map(Number).filter(value=>!reachableWeakCounts.includes(value)),dualPatterns:[...new Set(dualCases.map(value=>value.pattern))].sort()},
  measurementProtocol:{minimumSessionsPerCase:2,minimumSamplesPerSession:20,maxRelativeMeanError:.01,requiredInvariants,notes:["Record target HP deltas, not only popup text.","Pair every treatment sample with the listed same-defense neutral control while keeping the attacker and skill unchanged.","Reject multi-hit, damage-over-time, critical, weak-point, status, passive, partner-skill, and world-setting contamination.","Use only the exact build and PAK fingerprint recorded in the source report."]},
  requiredCases,
  excludedCases,
};
const template={
  schema:1,
  gameBuild:sourceReport.meta.gameBuild,
  mappingHash:sourceReport.source.mappingHash,
  pakFingerprint:sourceReport.source.pakFingerprint,
  worldDamageSettingsFingerprint:"<recorded-settings-fingerprint>",
  observations:[{
    caseId:"<requiredCases[].id>",
    sessionId:"<independent-session-id>",
    setup:{attackerPalId:"<immutable-pal-id>",skillId:"<one listed skillCandidates[].id>",attackerLevel:0,attackerAttack:0,treatmentTargetId:"<required case target.id>",controlTargetId:"<required case neutralControl.id>",targetLevel:0,treatmentDefense:0,controlDefense:0,worldDamageSettingsFingerprint:"<same as top-level>"},
    invariants:Object.fromEntries(requiredInvariants.map(value=>[value,false])),
    controlSamples:[],
    treatmentSamples:[],
  }],
};
await mkdir(path.dirname(outputPath),{recursive:true});
await Promise.all([writeFile(outputPath,JSON.stringify(plan,null,2)),writeFile(templatePath,JSON.stringify(template,null,2))]);
console.log(`Generated ${singleCases.length} single-element and ${dualCases.length} feasible dual-element controlled runtime cases (${excludedCases.length} confounded case excluded); reachable dual weakCount values: ${reachableWeakCounts.join(", ")}.`);
