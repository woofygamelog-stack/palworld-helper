import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const evidenceRoot=path.join(root,"private","verification","calculators","build-24467282");
const sessionPaths=[1,2].map(index=>path.join(evidenceRoot,`iv-formula-session-${index}.log`));
const publicPals=JSON.parse(await readFile(path.join(root,"public","data","pals.json"),"utf8")).pals;
const rawParameters=JSON.parse(await readFile(path.join(root,"private","extracted","build-24467282-calculators","pal-parameters.raw.json"),"utf8"));
const expectedPoints=[0,6000,13000,21000,30000,40000,55000,80000,110000,150000,200000];
const expectedIds=publicPals.map(pal=>pal.id);
const expectedIdSet=new Set(expectedIds);
const f32=Math.fround;

if(publicPals.length!==299||expectedIdSet.size!==299)throw new Error("The current public Pal catalog must contain 299 unique IDs.");

const expectedNeutral=(pal,stat)=>{
  if(stat==="hp")return Math.floor(500+80*5+pal.hp*.5*80);
  if(stat==="attack")return Math.floor(100+pal.attack*.075*80);
  return Math.floor(50+pal.defense*.075*80);
};

const parseSeries=(value,label)=>{
  const series=value.split(",").map(Number);
  if(series.length!==expectedPoints.length||series.some(entry=>!Number.isSafeInteger(entry)||entry<0))throw new Error(`${label} is not a complete non-negative integer series.`);
  for(let index=1;index<series.length;index++)if(series[index]<series[index-1])throw new Error(`${label} decreases between friendship ranks ${index-1} and ${index}.`);
  if(series.at(-1)<=series[0])throw new Error(`${label} does not increase by friendship rank 10.`);
  return series;
};

const parseSession=(text,index)=>{
  if(text.includes("PAL_INITIALIZED_PARAMETER|error|"))throw new Error(`IV friendship species session ${index} contains an error marker.`);
  const markers=text.split(/\r?\n/).map(line=>line.slice(line.indexOf("PAL_INITIALIZED_PARAMETER|"))).filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|"));
  const speciesLines=markers.filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|species|"));
  const gridLines=markers.filter(line=>line.startsWith("PAL_INITIALIZED_PARAMETER|grid|"));
  if(speciesLines.length!==299||gridLines.length!==10500||!markers.includes("PAL_INITIALIZED_PARAMETER|species-complete|299|11")||!markers.includes("PAL_INITIALIZED_PARAMETER|grid-complete|Alpaca|10500")||!markers.includes("PAL_INITIALIZED_PARAMETER|complete"))throw new Error(`IV formula session ${index} has incomplete coverage.`);
  const rows=new Map();
  for(const line of speciesLines){
    const [palId,hpText,attackText,defenseText]=line.split("|").slice(2);
    if(!expectedIdSet.has(palId)||rows.has(palId))throw new Error(`IV friendship species session ${index} contains an unknown or duplicate Pal ID: ${palId}.`);
    const pal=publicPals.find(candidate=>candidate.id===palId);
    const parameters=rawParameters[palId];
    if(!parameters||parameters.Hp!==pal.hp||parameters.ShotAttack!==pal.attack||parameters.Defense!==pal.defense)throw new Error(`IV friendship species session ${index} has a source-stat mismatch for ${palId}.`);
    for(const key of ["Friendship_HP","Friendship_ShotAttack","Friendship_Defense"])if(!Number.isFinite(parameters[key])||parameters[key]<=0)throw new Error(`IV friendship coefficient ${key} is unavailable for ${palId}.`);
    const hp=parseSeries(hpText,`${palId} HP`),attack=parseSeries(attackText,`${palId} attack`),defense=parseSeries(defenseText,`${palId} defense`);
    for(const [stat,series] of [["hp",hp],["attack",attack],["defense",defense]])if(series[0]!==expectedNeutral(pal,stat))throw new Error(`IV friendship species session ${index} has an invalid neutral ${stat} baseline for ${palId}: ${series[0]}.`);
    rows.set(palId,{hp,attack,defense});
  }
  if(expectedIds.some(id=>!rows.has(id)))throw new Error(`IV friendship species session ${index} is missing a current Pal ID.`);
  const speciesPayload=expectedIds.map(id=>{
    const row=rows.get(id);
    return `${id}|${row.hp.join(",")}|${row.attack.join(",")}|${row.defense.join(",")}`;
  }).join("\n");
  const alpaca=rawParameters.Alpaca;
  const stats=[
    {base:alpaca.Hp,friendship:alpaca.Friendship_HP,fixed:500,levelFixed:5,multiplier:f32(.5)},
    {base:alpaca.ShotAttack,friendship:alpaca.Friendship_ShotAttack,fixed:100,levelFixed:0,multiplier:f32(.075)},
    {base:alpaca.Defense,friendship:alpaca.Friendship_Defense,fixed:50,levelFixed:0,multiplier:f32(.075)}
  ];
  const calculate=(stat,level,talent,condensing,soul,friendshipRank)=>{
    const effectiveBase=f32(stat.base+f32(stat.friendship*Math.max(friendshipRank,0)));
    const talentMultiplier=f32(1+f32(talent*f32(.003)));
    const left=f32(effectiveBase*talentMultiplier),right=f32(stat.multiplier*level),fixed=f32(stat.fixed+stat.levelFixed*level);
    const base=Math.floor(f32(fixed+left*right));
    const condensed=Math.floor(f32(base*f32(1+f32(condensing*f32(.05)))));
    return Math.floor(f32(condensed*f32(1+f32(soul*f32(.03)))));
  };
  for(const line of gridLines){
    const values=line.split("|").slice(2).map(Number);
    if(values.length!==8||values.some(value=>!Number.isSafeInteger(value)))throw new Error(`IV formula session ${index} contains an invalid grid row.`);
    const [level,talent,condensing,soul,friendshipRank,...actual]=values;
    const expected=stats.map(stat=>calculate(stat,level,talent,condensing,soul,friendshipRank));
    if(actual.some((value,statIndex)=>value!==expected[statIndex]))throw new Error(`IV formula session ${index} disagrees at ${level}|${talent}|${condensing}|${soul}|${friendshipRank}: expected ${expected}, received ${actual}.`);
  }
  const gridPayload=gridLines.map(line=>line.slice("PAL_INITIALIZED_PARAMETER|grid|".length)).join("\n");
  const payload=`${speciesPayload}\n${gridPayload}`;
  return {payload,sha256:createHash("sha256").update(payload).digest("hex")};
};

const texts=await Promise.all(sessionPaths.map(file=>readFile(file,"utf8")));
const sessions=texts.map((text,index)=>parseSession(text,index+1));
if(sessions[0].payload!==sessions[1].payload)throw new Error("Independent IV friendship species sessions disagree.");
const report={
  schema:2,status:"verified",gameBuild:"24467282",independentSessions:true,
  palCount:expectedIds.length,friendshipRanks:expectedPoints.length,statCount:3,
  runtimeValues:(expectedIds.length*expectedPoints.length*3+10500*3)*sessions.length,
  interactionCasesPerSession:10500,formulaComparisonsPerSession:31500,
  sessionPayloadSha256:sessions.map(session=>session.sha256),
  allSpeciesNeutralBaselinesMatch:true,allSpeciesRankSeriesMonotonic:true,exactFloat32FormulaMatch:true,independentSessionPayloadsMatch:true,
  publicScope:"formula-verified-public-artifact-pending"
};
await mkdir(evidenceRoot,{recursive:true});
await writeFile(path.join(evidenceRoot,"iv-friendship-bridge-report.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(`Verified ${report.runtimeValues} IV friendship stat values across ${report.palCount} Pals and two independent sessions.`);
