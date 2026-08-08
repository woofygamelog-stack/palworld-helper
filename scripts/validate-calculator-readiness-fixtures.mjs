import assert from "node:assert/strict";
import {assessCalculatorReadiness} from "./lib/calculator-readiness.mjs";

const hash="a".repeat(64),base={schema:1,domain:"production",expectedGameBuild:"24467282",source:{status:"ready",gameBuild:"24467282",definitionCount:1,unknownDenominator:0,semanticHash:hash},runtime:{status:"planned",gameBuild:"24467282",caseCount:1,independentSessionTarget:2,sessionPlans:[1,2].map(session=>({session,vectorHash:hash,completionMarker:"complete",errorMarker:"error"}))},golden:{status:"missing",gameBuild:"24467282"},public:{status:"excluded",routeCount:0}};
assert.equal(assessCalculatorReadiness(base).state,"ready-for-runtime-session","a complete two-session plan must be ready for a runtime session");
assert.equal(assessCalculatorReadiness({...base,source:{...base.source,gameBuild:"old-build"}}).stages["public-ready"],false,"stale source evidence must fail closed");
assert.ok(assessCalculatorReadiness({...base,source:{...base.source,status:"partial",unknownDenominator:2}}).reasons.includes("unknown-source-denominator"),"partial source denominators must remain explicit blockers");
assert.ok(assessCalculatorReadiness({...base,runtime:{...base.runtime,sessionPlans:[base.runtime.sessionPlans[0],{...base.runtime.sessionPlans[1],vectorHash:"b".repeat(64)}]}}).reasons.includes("runtime-plan-incomplete"),"different session vectors must fail closed");
assert.ok(assessCalculatorReadiness({...base,public:{status:"ready",routeCount:1}}).reasons.includes("contradictory-public-readiness"),"public readiness must not bypass runtime and golden evidence");
assert.ok(assessCalculatorReadiness({...base,runtime:{...base.runtime,status:"verified",independentSessions:true,complete:true},source:{...base.source,status:"contradictory"}}).reasons.includes("contradictory-evidence"),"contradictory evidence must fail closed");
console.log("Validated stale, partial, contradictory, mismatched-session, and premature-public calculator readiness fixtures.");
