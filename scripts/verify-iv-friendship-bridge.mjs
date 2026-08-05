import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const evidenceRoot=path.join(root,"private","verification","calculators","build-24467282");
const sessionPaths=[1,2].map(index=>path.join(evidenceRoot,`initialized-pal-bridge-session-${index}.log`));
const friendshipRanks=Object.values(JSON.parse(await readFile(path.join(root,"private","extracted","build-24467282-calculators","friendship-ranks.raw.json"),"utf8"))).sort((left,right)=>left.FriendshipRank-right.FriendshipRank);
const expectedPoints=[-10000,-1000,-1,0,5999,6000,12999,13000,20999,21000,29999,30000,39999,40000,54999,55000,79999,80000,109999,110000,149999,150000,199999,200000];
const rankAt=point=>friendshipRanks.findLast(row=>row.RequiredPoint<=point)?.FriendshipRank;

const parseSession=(text,index)=>{
  if(text.includes("PAL_INITIALIZED_PARAMETER|error|"))throw new Error(`IV friendship bridge session ${index} contains an error marker.`);
  const markers=text.split(/\r?\n/).map(line=>line.slice(line.indexOf("PAL_INITIALIZED_PARAMETER|"))).filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|"));
  const profileLines=markers.filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|profile|"));
  const liveLines=markers.filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|friendship|"));
  const databaseLines=markers.filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|database-friendship|"));
  if(profileLines.length!==1||liveLines.length!==expectedPoints.length||databaseLines.length!==expectedPoints.length)throw new Error(`IV friendship bridge session ${index} has incomplete profile or boundary coverage.`);
  if(!markers.includes(`PAL_INITIALIZED_PARAMETER|database-bridge-complete|${expectedPoints.length}`)||!markers.includes("PAL_INITIALIZED_PARAMETER|complete"))throw new Error(`IV friendship bridge session ${index} did not complete.`);
  const profile=profileLines[0].split("|").slice(2);
  const palId=profile[0];
  if(!palId||palId==="unknown")throw new Error(`IV friendship bridge session ${index} has no Pal identifier.`);
  const liveByPoint=new Map(liveLines.map(line=>{
    const [requestedPoint,actualPoint,rank,hp,attack,defense]=line.split("|").slice(2).map(Number);
    return [requestedPoint,{actualPoint,rank,stats:[hp,attack,defense]}];
  }));
  const databaseByPoint=new Map(databaseLines.map(line=>{
    const [point,hp,attack,defense]=line.split("|").slice(2).map(Number);
    return [point,[hp,attack,defense]];
  }));
  if(liveByPoint.size!==expectedPoints.length||databaseByPoint.size!==expectedPoints.length)throw new Error(`IV friendship bridge session ${index} contains duplicate boundary rows.`);
  for(const point of expectedPoints){
    const live=liveByPoint.get(point),database=databaseByPoint.get(point);
    if(!live||!database||live.actualPoint!==point||live.rank!==rankAt(point))throw new Error(`IV friendship bridge session ${index} has invalid state at ${point}.`);
    if(live.stats.some((value,statIndex)=>!Number.isInteger(value)||value<0||value!==database[statIndex]))throw new Error(`IV friendship bridge session ${index} disagrees at ${point}.`);
  }
  const neutral=liveByPoint.get(0).stats;
  for(const point of [-10000,-1000,-1])if(liveByPoint.get(point).stats.some((value,statIndex)=>value!==neutral[statIndex]))throw new Error(`IV friendship bridge session ${index} changed a negative-rank stat.`);
  return {palId,sha256:createHash("sha256").update(markers.join("\n")).digest("hex"),cases:expectedPoints.length*3};
};

const texts=await Promise.all(sessionPaths.map(file=>readFile(file,"utf8")));
const sessions=texts.map((text,index)=>parseSession(text,index+1));
if(new Set(sessions.map(session=>session.palId)).size!==2)throw new Error("IV friendship bridge sessions must use two different Pals.");
const report={schema:1,status:"verified",gameBuild:"24467282",independentSessions:true,palIds:sessions.map(session=>session.palId),boundaryPoints:expectedPoints.length,statComparisons:sessions.reduce((sum,session)=>sum+session.cases,0),sessionPayloadSha256:sessions.map(session=>session.sha256),liveAndDatabaseRoutesMatch:true};
await mkdir(evidenceRoot,{recursive:true});
await writeFile(path.join(evidenceRoot,"iv-friendship-bridge-report.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(`Verified ${report.statComparisons} live-to-database IV friendship comparisons across two independent Pal sessions.`);
