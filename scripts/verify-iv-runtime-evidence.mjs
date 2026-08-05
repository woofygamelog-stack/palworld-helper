import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const evidenceRoot=path.join(root,"private","verification","calculators","build-24467282");
const sessionPaths=[1,2].map(index=>path.join(evidenceRoot,`iv-rank-matrix-session-${index}.log`));
const soulPaths=["runtime-evidence-expanded.log","runtime-evidence-equivalence.log"].map(file=>path.join(evidenceRoot,file));
const palData=JSON.parse(await readFile(path.join(root,"public","data","pals.json"),"utf8"));
const friendshipRanks=JSON.parse(await readFile(path.join(root,"private","extracted","build-24467282-calculators","friendship-ranks.raw.json"),"utf8"));
const expectedBuild="24467282";
if(String(palData.meta.gameBuild)!==expectedBuild)throw new Error(`IV evidence build ${expectedBuild} does not match Pal data build ${palData.meta.gameBuild}.`);
const friendshipRows=Object.values(friendshipRanks).sort((left,right)=>left.FriendshipRank-right.FriendshipRank);
if(friendshipRows.length!==14||friendshipRows[0]?.FriendshipRank!==-3||friendshipRows.at(-1)?.FriendshipRank!==10||friendshipRows.some((row,index)=>index>0&&row.RequiredPoint<=friendshipRows[index-1].RequiredPoint))throw new Error("Friendship rank source table is incomplete or non-monotonic.");

const markerPayload=text=>text.split(/\r?\n/).map(line=>line.slice(line.indexOf("PAL_IV_MATRIX|"))).filter(line=>line.startsWith("PAL_IV_MATRIX|row|")||line.startsWith("PAL_IV_MATRIX|complete|")).join("\n");
const sessionTexts=await Promise.all(sessionPaths.map(file=>readFile(file,"utf8")));
const payloads=sessionTexts.map(markerPayload);
const payloadHashes=payloads.map(value=>createHash("sha256").update(value).digest("hex"));
if(payloadHashes[0]!==payloadHashes[1])throw new Error("Independent IV matrix sessions do not match byte-for-byte.");

const completion="PAL_IV_MATRIX|complete|27|80|5|101";
const rows=new Map();
for(const line of payloads[0].split("\n")){
  if(line===completion)continue;
  const [marker,kind,id,levelText,rankText,hpText,attackText,defenseText]=line.split("|");
  if(marker!=="PAL_IV_MATRIX"||kind!=="row")throw new Error(`Unexpected IV evidence line: ${line.slice(0,120)}`);
  const level=Number(levelText),rank=Number(rankText),key=`${id}|${level}|${rank}`;
  if(rows.has(key))throw new Error(`Duplicate IV evidence row ${key}.`);
  const values=[hpText,attackText,defenseText].map(text=>text.split(",").map(Number));
  if(values.some(list=>list.length!==101||list.some(value=>!Number.isInteger(value)||value<0)))throw new Error(`Invalid IV values for ${key}.`);
  if(values.some(list=>list.some((value,index)=>index>0&&value<list[index-1])))throw new Error(`Non-monotonic IV values for ${key}.`);
  rows.set(key,values);
}
if(rows.size!==27*80*5)throw new Error(`Expected 10800 IV rows, received ${rows.size}.`);

const palById=new Map(palData.pals.map(pal=>[pal.id,pal]));
const representatives=[...new Set([...rows.keys()].map(key=>key.split("|")[0]))].sort();
if(representatives.length!==27)throw new Error(`Expected 27 representative Pals, received ${representatives.length}.`);
const dimensions=[{name:"hp",field:"hp",index:0},{name:"attack",field:"attack",index:1},{name:"defense",field:"defense",index:2}];
const dimensionTables={};
const dimensionCoverage={};

const encodeRows=matrix=>{
  const bytes=Buffer.alloc(80*5*102);
  let offset=0;
  for(let level=1;level<=80;level++)for(let rank=0;rank<=4;rank++){
    const values=matrix.get(`${level}|${rank}`);
    if(!values)throw new Error(`Missing encoded IV row ${level}|${rank}.`);
    bytes.writeUInt16LE(values[0],offset);offset+=2;
    for(let talent=1;talent<=100;talent++){
      const delta=values[talent]-values[talent-1];
      if(delta<0||delta>255)throw new Error(`IV delta ${delta} cannot be encoded for ${level}|${rank}|${talent}.`);
      bytes.writeUInt8(delta,offset++);
    }
  }
  return bytes.toString("base64");
};

for(const dimension of dimensions){
  const byBase=new Map();
  for(const id of representatives){
    const pal=palById.get(id);
    if(!pal)throw new Error(`IV representative ${id} is missing from current Pal data.`);
    const base=String(pal[dimension.field]);
    const matrix=new Map();
    for(let level=1;level<=80;level++)for(let rank=0;rank<=4;rank++)matrix.set(`${level}|${rank}`,rows.get(`${id}|${level}|${rank}`)[dimension.index]);
    if(byBase.has(base)){
      const accepted=byBase.get(base);
      for(const [key,values] of matrix)if(values.some((value,index)=>value!==accepted.get(key)[index]))throw new Error(`${dimension.name} base ${base} differs between representative species at ${key}.`);
    }else byBase.set(base,matrix);
  }
  const expectedBases=[...new Set(palData.pals.map(pal=>String(pal[dimension.field])))].sort((a,b)=>Number(a)-Number(b));
  const actualBases=[...byBase.keys()].sort((a,b)=>Number(a)-Number(b));
  if(JSON.stringify(expectedBases)!==JSON.stringify(actualBases))throw new Error(`${dimension.name} base coverage mismatch: expected ${expectedBases}, received ${actualBases}.`);
  dimensionTables[dimension.name]=Object.fromEntries(actualBases.map(base=>[base,encodeRows(byBase.get(base))]));
  dimensionCoverage[dimension.name]={baseValues:actualBases.map(Number),baseValueCount:actualBases.length,rows:actualBases.length*80*5,forwardCases:actualBases.length*80*5*101};
}

const parseSoulCases=text=>{
  const result=new Map();
  for(const line of text.split(/\r?\n/)){
    const marker=line.indexOf("PAL_CALCULATOR_EVIDENCE|constructed-stat|");
    if(marker<0)continue;
    const fields=line.slice(marker).split("|");
    const [id,level,talent,rank,soul]=fields.slice(2,7);
    if(id!=="SheepBall"||level!=="65"||talent!=="100")continue;
    result.set(`${rank}|${soul}`,fields.slice(7,10).map(Number));
  }
  return result;
};
const soulTexts=await Promise.all(soulPaths.map(file=>readFile(file,"utf8")));
const soulSessions=soulTexts.map(parseSoulCases);
for(const key of ["0|0","0|1","0|2","0|3","0|4","4|0","4|4"]){
  const first=soulSessions[0].get(key),second=soulSessions[1].get(key);
  if(!first||!second||first.some((value,index)=>value!==second[index]))throw new Error(`Independent soul evidence mismatch for ${key}.`);
}
for(const rank of [0,4]){
  const base=soulSessions[0].get(`${rank}|0`);
  for(const soul of rank===0?[1,2,3,4]:[4]){
    const actual=soulSessions[0].get(`${rank}|${soul}`);
    const expected=base.map(value=>Math.floor(value*(1+soul*0.03)));
    if(actual.some((value,index)=>value!==expected[index]))throw new Error(`Soul application order mismatch for rank ${rank}, soul ${soul}.`);
  }
}

const normalizedOutput={
  meta:{schema:1,verification:"verified",scope:"friendship-rank-0",palCount:palData.meta.palCount,levelRange:[1,80],condensingRankRange:[0,4],ivRange:[0,100],soulRankRange:[0,4],friendshipRankRange:[0,0]},
  encoding:{kind:"row-u16le-first-u8-deltas-base64",levelCount:80,rankCount:5,talentCount:101,rowBytes:102,order:"level-major, condensing-rank-minor"},
  tables:dimensionTables
};
const normalizedPath=path.join(evidenceRoot,"iv-runtime-table.json");
await mkdir(evidenceRoot,{recursive:true});
await writeFile(normalizedPath,`${JSON.stringify(normalizedOutput)}\n`);

const report={
  schema:1,status:"verified",gameBuild:expectedBuild,
  sessionPayloadSha256:payloadHashes,
  sessionFileSha256:sessionTexts.map(value=>createHash("sha256").update(value).digest("hex")),
  coverage:{representativePals:representatives.length,levels:80,condensingRanks:5,ivValues:101,rawRuntimeCases:27*80*5*101,dimensions:dimensionCoverage},
  equivalence:{sameBaseCrossSpecies:true,independentSessions:true,soulApplication:"floor after condensing result",soulGoldenCases:7},
  friendship:{sourceRanks:friendshipRows.map(row=>({rank:row.FriendshipRank,requiredPoint:row.RequiredPoint})),sourceTableComplete:true,runtimeCasesVerified:false,publicScope:"rank-0-only"},
  normalizedOutput:{path:path.relative(root,normalizedPath).replaceAll("\\","/"),sha256:createHash("sha256").update(`${JSON.stringify(normalizedOutput)}\n`).digest("hex"),publicationReady:false}
};
await writeFile(path.join(evidenceRoot,"iv-runtime-report.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(`Verified ${report.coverage.rawRuntimeCases.toLocaleString("en-US")} IV runtime cases across two independent sessions.`);
console.log(`Generated private normalized evidence with ${Object.values(dimensionCoverage).reduce((sum,value)=>sum+value.forwardCases,0).toLocaleString("en-US")} unique forward cases.`);
