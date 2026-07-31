import {createHash} from "node:crypto";

const acceptedFunctionProfiles=[{
  profileId:"get-weak-scale-e8bd2cb8",
  functionName:"GetWeakScale",
  functionRawHash:"e8bd2cb86426c838299e3c1eac3604cf384b1c1eb589aedb7053e7f6755e64d4",
  functionRawLength:909,
  comparisons:[
    {weakCount:0,callOffset:297,intOffset:319,comparison:"NotEqual_IntInt"},
    {weakCount:1,callOffset:365,intOffset:387,comparison:"NotEqual_IntInt"},
    {weakCount:2,callOffset:433,intOffset:455,comparison:"NotEqual_IntInt"},
    {weakCount:-1,callOffset:501,intOffset:523,comparison:"EqualEqual_IntInt"},
    {weakCount:-2,callOffset:745,intOffset:767,comparison:"EqualEqual_IntInt"},
  ],
  branches:[
    {weakCount:-2,floatOffset:829,multiplier:.43},
    {weakCount:-1,floatOffset:585,multiplier:.66},
    {weakCount:0,floatOffset:629,multiplier:1},
    {weakCount:1,floatOffset:673,multiplier:1.5},
    {weakCount:2,floatOffset:717,multiplier:2.25},
  ],
  defaultBranch:{floatOffset:873,multiplier:.66},
}];

const sourceProfile=acceptedFunctionProfiles[0];

const qualitativeChartProfiles=[{
  profileId:"element-chart-93bc7116",
  hash:"93bc7116e59463e93fa92968b825f566cbf9f0d55006e6906dc4dcb39658ca52",
  elements:["neutral","fire","water","electric","grass","dark","dragon","ground","ice"],
  relations:[
    {attacker:"electric",defender:"water"},
    {attacker:"water",defender:"fire"},
    {attacker:"fire",defender:"grass"},
    {attacker:"fire",defender:"ice"},
    {attacker:"grass",defender:"ground"},
    {attacker:"ground",defender:"electric"},
    {attacker:"ice",defender:"dragon"},
    {attacker:"dragon",defender:"dark"},
    {attacker:"dark",defender:"neutral"},
  ],
}];

function invariant(condition,message){if(!condition)throw new Error(message)}
function nearlyEqual(actual,expected,tolerance=1e-6){return Math.abs(actual-expected)<=tolerance}
function sha256(value){return createHash("sha256").update(value).digest("hex")}

export function extractNumericLiterals(buffer){
  const integers=[],floats=[];
  for(let offset=0;offset<buffer.length-4;offset++){
    if(buffer[offset]===0x1d)integers.push({offset,value:buffer.readInt32LE(offset+1)});
    if(buffer[offset]===0x1e)floats.push({offset,value:buffer.readFloatLE(offset+1)});
  }
  return {integers,floats};
}

export function analyzeGetWeakScaleAsset(asset){
  invariant(Array.isArray(asset?.Exports)&&Array.isArray(asset?.Imports),"UAssetAPI JSON is missing exports or imports");
  const exported=asset.Exports.find(value=>value.ObjectName==="GetWeakScale");
  invariant(exported?.Data,"GetWeakScale raw export was not found");
  const raw=Buffer.from(exported.Data,"base64");
  const rawHash=sha256(raw);
  const profile=acceptedFunctionProfiles.find(value=>value.functionRawLength===raw.length&&value.functionRawHash===rawHash);
  invariant(profile,`GetWeakScale bytecode is not a recognized source profile (length ${raw.length}, sha256 ${rawHash})`);
  const literals=extractNumericLiterals(raw);
  for(const expected of profile.comparisons){
    invariant(raw[expected.callOffset]===0x68,`CallMath opcode missing at ${expected.callOffset}`);
    const importIndex=raw.readInt32LE(expected.callOffset+1);
    invariant(importIndex<0&&asset.Imports[-importIndex-1]?.ObjectName===expected.comparison,`Comparison call drifted for weakCount ${expected.weakCount}`);
    invariant(raw[expected.intOffset]===0x1d&&raw.readInt32LE(expected.intOffset+1)===expected.weakCount,`Integer branch drifted for weakCount ${expected.weakCount}`);
  }
  for(const expected of [...profile.branches,profile.defaultBranch]){
    invariant(raw[expected.floatOffset]===0x1e,`Float branch opcode missing at ${expected.floatOffset}`);
    invariant(nearlyEqual(raw.readFloatLE(expected.floatOffset+1),expected.multiplier),`Float branch drifted at ${expected.floatOffset}`);
  }
  return {
    profileId:profile.profileId,
    functionName:profile.functionName,
    rawHash,
    rawLength:raw.length,
    comparisons:profile.comparisons,
    branches:profile.branches,
    defaultBranch:profile.defaultBranch,
    literalInventory:literals,
  };
}

export function qualitativeOutcome(attacker,defender,relations){
  if(relations.some(value=>value.attacker===attacker&&value.defender===defender))return "strong";
  if(relations.some(value=>value.attacker===defender&&value.defender===attacker))return "weak";
  return "neutral";
}

export function relationScore(outcome){return outcome==="strong"?1:outcome==="weak"?-1:0}

export function calculateWeakCount(attacker,defenders,relations){
  invariant(defenders.length>=1&&defenders.length<=2,"One or two defending elements are required");
  invariant(new Set(defenders).size===defenders.length,"Defending elements must be unique");
  return defenders.reduce((total,defender)=>total+relationScore(qualitativeOutcome(attacker,defender,relations)),0);
}

export function multiplierForWeakCount(weakCount,lookup){
  const value=lookup[String(weakCount)];
  invariant(Number.isFinite(value),`No verified multiplier exists for weakCount ${weakCount}`);
  return value;
}

export function qualitativeChartProfileForHash(hash){
  const profile=qualitativeChartProfiles.find(value=>value.hash===String(hash).toLowerCase());
  invariant(profile,`Qualitative element chart is not a recognized reviewed profile: ${hash}`);
  return profile;
}

export function mean(values){
  invariant(Array.isArray(values)&&values.length>0&&values.every(value=>Number.isFinite(value)&&value>0),"Damage samples must be positive finite numbers");
  return values.reduce((total,value)=>total+value,0)/values.length;
}

export {acceptedFunctionProfiles,qualitativeChartProfiles,sourceProfile};
