import {createHash} from "node:crypto";

const sourceProfile={
  gameBuild:"24181527",
  mappingHash:"C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851",
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
};

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
  const exported=asset.Exports.find(value=>value.ObjectName===sourceProfile.functionName);
  invariant(exported?.Data,`${sourceProfile.functionName} raw export was not found`);
  const raw=Buffer.from(exported.Data,"base64");
  invariant(raw.length===sourceProfile.functionRawLength,`Unexpected ${sourceProfile.functionName} raw length: ${raw.length}`);
  const rawHash=sha256(raw);
  invariant(rawHash===sourceProfile.functionRawHash,`${sourceProfile.functionName} raw hash drifted: ${rawHash}`);
  const literals=extractNumericLiterals(raw);
  for(const expected of sourceProfile.comparisons){
    invariant(raw[expected.callOffset]===0x68,`CallMath opcode missing at ${expected.callOffset}`);
    const importIndex=raw.readInt32LE(expected.callOffset+1);
    invariant(importIndex<0&&asset.Imports[-importIndex-1]?.ObjectName===expected.comparison,`Comparison call drifted for weakCount ${expected.weakCount}`);
    invariant(raw[expected.intOffset]===0x1d&&raw.readInt32LE(expected.intOffset+1)===expected.weakCount,`Integer branch drifted for weakCount ${expected.weakCount}`);
  }
  for(const expected of [...sourceProfile.branches,sourceProfile.defaultBranch]){
    invariant(raw[expected.floatOffset]===0x1e,`Float branch opcode missing at ${expected.floatOffset}`);
    invariant(nearlyEqual(raw.readFloatLE(expected.floatOffset+1),expected.multiplier),`Float branch drifted at ${expected.floatOffset}`);
  }
  return {
    functionName:sourceProfile.functionName,
    rawHash,
    rawLength:raw.length,
    comparisons:sourceProfile.comparisons,
    branches:sourceProfile.branches,
    defaultBranch:sourceProfile.defaultBranch,
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

export function mean(values){
  invariant(Array.isArray(values)&&values.length>0&&values.every(value=>Number.isFinite(value)&&value>0),"Damage samples must be positive finite numbers");
  return values.reduce((total,value)=>total+value,0)/values.length;
}

export {sourceProfile};
