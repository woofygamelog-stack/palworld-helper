const statuses=new Set(["missing","partial","planned","verified","excluded","ready","contradictory"]);

export function assessCalculatorReadiness(input){
  const reasons=[];
  if(!input||input.schema!==1||!input.domain||!input.expectedGameBuild)throw new Error("Calculator readiness input is invalid.");
  for(const stage of ["source","runtime","golden","public"])if(!input[stage]||!statuses.has(input[stage].status))throw new Error(`Calculator readiness ${stage} stage is invalid.`);
  const buildMatched=[input.source,input.runtime,input.golden].every(stage=>stage.gameBuild===undefined||String(stage.gameBuild)===String(input.expectedGameBuild));
  if(!buildMatched)reasons.push("stale-build");
  const sourceReady=buildMatched&&input.source.status==="ready"&&Number.isInteger(input.source.definitionCount)&&input.source.definitionCount>0&&input.source.unknownDenominator===0&&typeof input.source.semanticHash==="string"&&input.source.semanticHash.length===64;
  if(!sourceReady)reasons.push(input.source.unknownDenominator>0?"unknown-source-denominator":"source-not-ready");
  const sessionPlans=input.runtime.sessionPlans;
  const planReady=input.runtime.status==="planned"&&Number.isInteger(input.runtime.caseCount)&&input.runtime.caseCount>0&&Array.isArray(sessionPlans)&&sessionPlans.length===input.runtime.independentSessionTarget&&input.runtime.independentSessionTarget===2&&new Set(sessionPlans.map(plan=>plan.vectorHash)).size===1&&sessionPlans.every(plan=>plan.completionMarker&&plan.errorMarker);
  if(input.runtime.status==="planned"&&!planReady)reasons.push("runtime-plan-incomplete");
  const runtimeReady=sourceReady&&input.runtime.status==="verified"&&input.runtime.independentSessions===true&&input.runtime.complete===true;
  const goldenReady=runtimeReady&&input.golden.status==="verified"&&input.golden.independentSessions===true&&input.golden.complete===true;
  const publicReady=goldenReady&&input.public.status==="ready"&&input.public.routeCount>0;
  if(input.public.status==="ready"&&!goldenReady)reasons.push("contradictory-public-readiness");
  if(input.runtime.status==="verified"&&!sourceReady)reasons.push("contradictory-runtime-readiness");
  if(input.golden.status==="verified"&&!runtimeReady)reasons.push("contradictory-golden-readiness");
  if([input.source,input.runtime,input.golden,input.public].some(stage=>stage.status==="contradictory"))reasons.push("contradictory-evidence");
  const readyForRuntimeSession=sourceReady&&planReady&&!runtimeReady&&!reasons.some(reason=>reason.startsWith("contradictory")||reason==="stale-build");
  const state=publicReady?"public-ready":readyForRuntimeSession?"ready-for-runtime-session":"blocked";
  return {state,stages:{"source-ready":sourceReady,"runtime-ready":runtimeReady,"golden-ready":goldenReady,"public-ready":publicReady},readyForRuntimeSession,reasons:[...new Set(reasons)]};
}
