import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const input=path.resolve(root,process.argv[2]??"private/verification/calculators/build-24467282/runtime-evidence-expanded.log");
const output=path.resolve(root,process.argv[3]??"private/verification/calculators/build-24467282/runtime-report.json");
const bytes=await readFile(input);
const text=bytes.toString("utf8");
if(!text.includes("PAL_CALCULATOR_EVIDENCE|complete"))throw new Error("Calculator runtime evidence is incomplete.");
if(text.includes("PAL_CALCULATOR_EVIDENCE|error|")||text.includes("PAL_CALCULATOR_EVIDENCE|retry-error|"))throw new Error("Calculator runtime evidence contains an error.");

const constants=new Map();
const observations=new Map();
for(const line of text.split(/\r?\n/)){
  const marker=line.indexOf("PAL_CALCULATOR_EVIDENCE|");
  if(marker<0)continue;
  const fields=line.slice(marker).split("|");
  if(fields[1]==="constant"){
    if(fields[3]!=="true")throw new Error(`Runtime constant ${fields[2]} was not readable.`);
    constants.set(fields[2],Number(fields[4]));
  }
  if(fields[1]==="constructed-stat"){
    const key=fields.slice(2,7).join("|");
    if(observations.has(key))throw new Error(`Duplicate runtime observation ${key}.`);
    observations.set(key,fields.slice(7,11).map(Number));
  }
}

const expectedConstants={
  StatusCalculate_LevelMultiply_HP:0.5,
  StatusCalculate_ConstPlus_HP:500,
  StatusCalculate_LevelMultiply_Attack:0.075000002980232,
  StatusCalculate_ConstPlus_Attack:100,
  StatusCalculate_LevelMultiply_Defense:0.075000002980232,
  StatusCalculate_ConstPlus_Defense:50,
  StatusCalculate_TribeMultiply_CraftSpeed:0.69999998807907,
  StatusCalculate_GenkaiToppa_PerAdd:0.050000000745058,
  StatusCalculate_Talent_PerAdd:0.003000000026077,
  WorkAmountByManMonth:100,
  WorkAnimSpeedPower:0.5,
  AddWorkSpeedPerStatusPoint:50,
};
for(const [name,expected] of Object.entries(expectedConstants)){
  const actual=constants.get(name);
  if(actual===undefined||Math.abs(actual-expected)>1e-12)throw new Error(`Runtime constant mismatch for ${name}: ${actual} !== ${expected}.`);
}

const expectedObservations={
  "SheepBall|1|0|0|0":[523,100,53,63],
  "SheepBall|1|100|0|0":[535,102,55,63],
  "SheepBall|50|0|0|0":[523,397,349,63],
  "SheepBall|50|50|0|0":[529,441,394,63],
  "SheepBall|65|100|0|0":[535,605,557,63],
  "SheepBall|65|100|4|0":[648,732,675,91],
  "SheepBall|65|100|0|4":[599,677,623,70],
  "SheepBall|65|100|4|4":[725,819,756,101],
  "BlackMetalDragon|1|0|0|0":[534,103,56,63],
  "BlackMetalDragon|65|100|0|0":[551,883,836,63],
};
for(const [key,expected] of Object.entries(expectedObservations)){
  const actual=observations.get(key);
  if(!actual||actual.some((value,index)=>value!==expected[index]))throw new Error(`Runtime golden case mismatch for ${key}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}.`);
}
if(observations.size!==71)throw new Error(`Unexpected expanded runtime observation count ${observations.size}; expected 71.`);

const report={
  schema:1,
  status:"verified",
  inputSha256:createHash("sha256").update(bytes).digest("hex"),
  coverage:{species:4,levels:[1,2,10,50,65],talents:[0,1,50,99,100],condensingRanks:[0,1,2,3,4],soulRanks:[0,1,2,3,4],goldenCases:observations.size},
  constants:Object.fromEntries([...constants].filter(([name])=>name in expectedConstants).sort(([left],[right])=>left.localeCompare(right))),
  observations:Object.fromEntries([...observations].sort(([left],[right])=>left.localeCompare(right))),
};
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Verified ${observations.size} calculator runtime golden cases; report: ${path.relative(root,output)}`);
