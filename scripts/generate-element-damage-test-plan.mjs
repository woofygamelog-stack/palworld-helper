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
invariant(sourceReport.verification?.exactWeakCountLookup===true,"Source report does not contain the exact GetWeakScale lookup");
const gameBuild=String(sourceReport.meta.gameBuild);
const base=path.join(root,"private","verification","element-damage",`build-${gameBuild}`);
const outputPath=path.resolve(process.env.PAL_ELEMENT_TEST_PLAN||path.join(base,"test-plan.json"));
const contractPath=path.resolve(process.env.PAL_ELEMENT_RUNTIME_CONTRACT||path.join(base,"runtime-evidence.contract.json"));
const chartProfile=qualitativeChartProfileForHash(sourceReport.source.qualitativeChartHash);
const relations=chartProfile.relations,lookup=sourceReport.findings.weakCountLookup,elements=chartProfile.elements;
const runtimeElementEnum={1:"neutral",2:"fire",3:"water",4:"grass",5:"electric",6:"ice",7:"ground",8:"dark",9:"dragon"};
invariant(new Set(Object.values(runtimeElementEnum)).size===elements.length&&elements.every(element=>Object.values(runtimeElementEnum).includes(element)),"Runtime element enum is not a complete permutation of the chart elements");

const defenderSets=[];
for(const element of elements)defenderSets.push([element]);
for(let left=0;left<elements.length;left++)for(let right=left+1;right<elements.length;right++)defenderSets.push([elements[left],elements[right]]);
const aggregationCases=[];
for(const attacker of elements)for(const defenders of defenderSets){
  const weakCount=calculateWeakCount(attacker,defenders,relations);
  aggregationCases.push({id:`aggregation-${attacker}-${defenders.join("-")}`,layer:"damage-calculation-route",attacker,defenders,outcomes:defenders.map(defender=>qualitativeOutcome(attacker,defender,relations)),expectedWeakCount:weakCount,expectedMultiplier:multiplierForWeakCount(weakCount,lookup)});
}
const lookupCases=Object.keys(lookup).map(Number).sort((a,b)=>a-b).map(weakCount=>({id:`lookup-${weakCount}`,layer:"runtime-lookup",weakCount,expectedMultiplier:multiplierForWeakCount(weakCount,lookup)}));
const planIdentity={gameBuild,mappingHash:sourceReport.source.mappingHash,clientPak:sourceReport.source.pakFingerprint,functionRawHash:sourceReport.source.functionRawHash,chartHash:sourceReport.source.qualitativeChartHash,lookup,runtimeElementEnum,aggregationRule:"sum-component-scores-with-non-neutral-self-resistance-and-neutral-attack-immunity"};
const planId=createHash("sha256").update(JSON.stringify(planIdentity)).digest("hex");
const plan={
  meta:{schema:3,gameBuild,generatedAt:new Date().toISOString(),status:"machine-runtime-evidence-pending",planId},
  sourceExpectation:{functionProfileId:sourceReport.source.functionProfileId,qualitativeChartProfileId:chartProfile.profileId,weakCountLookup:lookup,runtimeElementEnum,aggregationRule:{operation:"sum-relation-scores",strongScore:1,neutralScore:0,weakScore:-1,sameElementResistance:"all-except-neutral",neutralAttackIsNeverWeak:true},aggregationVerified:false,damageCalculationRouteVerified:false},
  coverage:{lookupCaseCount:lookupCases.length,aggregationCaseCount:aggregationCases.length,attackerCount:elements.length,defenderSetCount:defenderSets.length,weakCounts:[...new Set(aggregationCases.map(value=>value.expectedWeakCount))].sort((a,b)=>a-b)},
  protocol:{minimumIndependentSessions:2,execution:"isolated official dedicated server with a disposable world and a verification-only UE4SS Lua driver",manualInputAllowed:false,requiredRuntimeRoute:["PalUtility.CalcDamageCharacter","BP_PalGameSetting.GetWeakScale"],failClosedConditions:["source build, mapping, client PAK, plan, server, driver, or world-settings fingerprint mismatch","missing or duplicate lookup or aggregation cases","CalcDamageCharacter not routing every planned case through GetWeakScale","observed weakCount or multiplier mismatch","unrecognized function or chart profile"]},
  lookupCases,
  aggregationCases,
};
const contract={
  schema:3,
  gameBuild,
  planId,
  format:"UTF-8 JSON Lines; one object per line",
  recordTypes:{
    "session-start":{required:["schema","type","gameBuild","planId","sessionId","mappingHash","clientPakFingerprint","serverFingerprint","serverPakFingerprint","sourceFunctionRawHash","driverFingerprint","worldSettingsFingerprint"]},
    "lookup-observation":{required:["schema","type","gameBuild","planId","sessionId","caseId","weakCount","observedMultiplier"]},
    "aggregation-observation":{required:["schema","type","gameBuild","planId","sessionId","caseId","attacker","defenders","observedWeakCount","observedMultiplier"]},
    "session-end":{required:["schema","type","gameBuild","planId","sessionId","completed","lookupCount","aggregationCount"]},
  },
  notes:["The verification driver writes this file; human-entered samples are not accepted.","Each aggregation observation is produced by the live CalcDamageCharacter path calling GetWeakScale.","A runtime report may open publication gates only after every planned record passes in two independent fresh server sessions."],
};
await mkdir(path.dirname(outputPath),{recursive:true});
await Promise.all([writeFile(outputPath,JSON.stringify(plan,null,2)),writeFile(contractPath,JSON.stringify(contract,null,2))]);
console.log(`Generated a machine-only runtime plan for build ${gameBuild}: ${lookupCases.length} lookup and ${aggregationCases.length} damage-route aggregation cases.`);
