import {createHash} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const evidenceRoot=path.join(root,"private","verification","calculators","build-24467282");
const sessionPaths=[1,2].map(index=>path.join(evidenceRoot,`capture-grid-session-${index}.log`));
const hpRates=[1,0.75,0.5,0.25,0.1,0.01];
const sphereLevels=[0,1,7,20,38,50,100];
const sneakStates=[false,true];

const payload=text=>text.split(/\r?\n/).map(line=>line.slice(line.indexOf("PAL_CAPTURE_EVIDENCE|"))).filter(line=>line.startsWith("PAL_CAPTURE_EVIDENCE|"));
const texts=await Promise.all(sessionPaths.map(file=>readFile(file,"utf8")));
const sessions=texts.map((text,sessionIndex)=>{
  const lines=payload(text);
  if(!lines.includes("PAL_CAPTURE_EVIDENCE|coverage|84")||!lines.includes("PAL_CAPTURE_EVIDENCE|complete")||lines.some(line=>line.startsWith("PAL_CAPTURE_EVIDENCE|error|")))throw new Error(`Capture session ${sessionIndex+1} is incomplete.`);
  const rows=lines.filter(line=>line.startsWith("PAL_CAPTURE_EVIDENCE|case|")).map(line=>{
    const [targetId,targetLevelText,throwerId,throwerLevelText,hpText,sphereText,sneakText,statusText,rateText]=line.split("|").slice(2);
    const row={targetId,targetLevel:Number(targetLevelText),throwerId,throwerLevel:Number(throwerLevelText),hpRate:Number(hpText),sphereLevel:Number(sphereText),sneak:sneakText==="true",statusRate:Number(statusText),captureRate:Number(rateText)};
    if(!targetId||!Number.isInteger(row.targetLevel)||row.targetLevel<1||!Number.isInteger(row.throwerLevel)||row.throwerLevel<1||!["true","false"].includes(sneakText)||[row.hpRate,row.sphereLevel,row.statusRate,row.captureRate].some(value=>!Number.isFinite(value))||row.statusRate<0||row.statusRate>1||row.captureRate<0||row.captureRate>1)throw new Error(`Invalid capture row in session ${sessionIndex+1}.`);
    return row;
  });
  if(rows.length!==hpRates.length*sphereLevels.length*sneakStates.length)throw new Error(`Capture session ${sessionIndex+1} has ${rows.length} cases instead of 84.`);
  const identities=new Set(rows.map(row=>`${row.targetId}|${row.targetLevel}|${row.throwerId}|${row.throwerLevel}`));
  if(identities.size!==1)throw new Error(`Capture session ${sessionIndex+1} changed actors during its grid.`);
  const byKey=new Map(rows.map(row=>[`${row.hpRate}|${row.sphereLevel}|${row.sneak}`,row]));
  if(byKey.size!==rows.length)throw new Error(`Capture session ${sessionIndex+1} contains duplicate cases.`);
  for(const hpRate of hpRates)for(const sneak of sneakStates){
    let previous=-1;
    for(const sphereLevel of sphereLevels){
      const rate=byKey.get(`${hpRate}|${sphereLevel}|${sneak}`)?.captureRate;
      if(rate===undefined||rate<previous)throw new Error(`Capture rate decreased as sphere level rose in session ${sessionIndex+1}.`);
      previous=rate;
    }
  }
  for(const sphereLevel of sphereLevels)for(const sneak of sneakStates){
    let previous=-1;
    for(const hpRate of hpRates){
      const rate=byKey.get(`${hpRate}|${sphereLevel}|${sneak}`)?.captureRate;
      if(rate===undefined||rate<previous)throw new Error(`Capture rate decreased as target HP fell in session ${sessionIndex+1}.`);
      previous=rate;
    }
  }
  return {targetId:rows[0].targetId,targetLevel:rows[0].targetLevel,throwerId:rows[0].throwerId,throwerLevel:rows[0].throwerLevel,cases:rows.length,payloadSha256:createHash("sha256").update(lines.filter(line=>line.startsWith("PAL_CAPTURE_EVIDENCE|case|")).join("\n")).digest("hex")};
});
if(new Set(sessions.map(session=>`${session.targetId}|${session.targetLevel}`)).size!==sessions.length)throw new Error("Independent capture sessions must vary the target identity or level.");

const report={schema:1,status:"verified-partial",gameBuild:"24467282",independentSessions:true,totalCases:sessions.reduce((sum,session)=>sum+session.cases,0),axes:{hpRates,sphereLevels,sneakStates},sessions,verifiedBehavior:{sphereLevelNondecreasing:true,lowerHpNondecreasing:true,returnRange:[0,1]},remaining:["target level boundaries","capture passives and status effects","world capture-rate settings","rare-Pal behavior","public calculation artifact and localized route"]};
await writeFile(path.join(evidenceRoot,"capture-runtime-report.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(`Verified ${report.totalCases} capture runtime cases across two independent sessions.`);
