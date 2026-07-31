import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {analyzeGetWeakScaleAsset,sourceProfile} from "./element-damage-evidence.mjs";

const root=process.cwd();
const sourceRoot=process.env.PAL_ELEMENT_DAMAGE_SOURCE||path.join(root,"private","extracted","build-24181527-element-damage");
const reportPath=process.env.PAL_ELEMENT_SOURCE_REPORT||path.join(root,"private","verification","element-damage","build-24181527","source-report.json");
const readJson=async name=>JSON.parse(await readFile(path.join(sourceRoot,name),"utf8"));
const sha256=value=>createHash("sha256").update(value).digest("hex");
const invariant=(condition,message)=>{if(!condition)throw new Error(message)};

const [manifest,settings,mappingOwners,mappingDefinitions,assetJson]=await Promise.all([
  readJson("element-manifest.json"),
  readJson("element-damage-settings.raw.json"),
  readJson("element-damage-mapping-owners.raw.json"),
  readJson("element-damage-mapping-definitions.raw.json"),
  readJson("BP_PalGameSetting.uassetapi.json"),
]);
invariant(manifest.schema===2&&manifest.mode==="element","Element damage extraction manifest is not schema 2 element mode");
invariant(manifest.mappingHash===sourceProfile.mappingHash,"Element damage extraction mapping hash drifted");
invariant(manifest.runtimeBlueprintCandidateCount===13&&manifest.runtimeBlueprintExtractedCount===13&&manifest.runtimeBlueprintFailureCount===0,"Runtime Blueprint candidate extraction is incomplete");
invariant(manifest.elementIconCount===9&&manifest.localeCount===17,"Element extraction coverage drifted");
const pak=manifest.pakFiles.find(value=>value.Name==="Pal-Windows.pak");
invariant(pak?.Length===40526106335&&pak.LastWriteTimeUtc==="2026-07-15T13:16:03.9195742Z","Installed PAK fingerprint drifted from build 24181527");
invariant(settings.schema===1&&settings.sourceClass==="Default__BP_PalGameSetting_C","Pal game-setting source drifted");
invariant(settings.damageSettings.DamageElementMatchRate===1.2,"DamageElementMatchRate source value drifted");
invariant(settings.combinationFunction.name==="GetWeakScale","Element scale function name drifted");
invariant(settings.combinationFunction.fields.some(value=>value.values?.Name==="weakCount"&&value.values.PropertyFlags?.includes("Parm")),"GetWeakScale weakCount parameter was not extracted");
invariant(settings.combinationFunction.fields.some(value=>value.values?.Name==="ReturnValue"&&value.values.PropertyFlags?.includes("ReturnParm")),"GetWeakScale return value was not extracted");
const expectedOwners=new Set([
  "PalGameSetting:DamageElementMatchRate",
  "PalSkillDamageReactionComponent:WeakElementRate",
  "PalSkillDamageReactionComponent:NonWeakElementRate",
  "PalDamageInfo:AttackElementType",
  "PalDamageResult:AttackElementType",
  "PalCalcCharacterDamageInfo:DefenderElementType1",
  "PalCalcCharacterDamageInfo:DefenderElementType2",
]);
const actualOwners=new Set(mappingOwners.matches.map(value=>`${value.owner}:${value.field}`));
invariant(mappingOwners.matchCount===expectedOwners.size&&[...expectedOwners].every(value=>actualOwners.has(value)),"Damage mapping ownership chain drifted");
invariant(mappingDefinitions.requestedTypeCount===6&&mappingDefinitions.extractedTypeCount===6&&mappingDefinitions.missingTypeCount===0,"Damage mapping definitions are incomplete");
const functionAnalysis=analyzeGetWeakScaleAsset(assetJson);
const rawPackageRoot=path.join(sourceRoot,"raw-packages","Pal","Content","Pal","Blueprint","System");
const [uasset,uexp]=await Promise.all([readFile(path.join(rawPackageRoot,"BP_PalGameSetting.uasset")),readFile(path.join(rawPackageRoot,"BP_PalGameSetting.uexp"))]);
invariant(sha256(uasset).toUpperCase()==="7C868C5B5E507ADA81977016E951D359260D4445ADF83FF9CC59075BC3AA638A","BP_PalGameSetting.uasset hash drifted");
invariant(sha256(uexp).toUpperCase()==="A7D8F8752E64AAE4623EECEA9ADCB7F110AC619023DCDC074071B3AC7D6904BA","BP_PalGameSetting.uexp hash drifted");
const weakCountLookup=Object.fromEntries(functionAnalysis.branches.map(value=>[String(value.weakCount),value.multiplier]));
const report={
  meta:{schema:1,gameBuild:sourceProfile.gameBuild,generatedAt:new Date().toISOString(),status:"source-lookup-verified-runtime-pending"},
  source:{mappingHash:manifest.mappingHash,pakFingerprint:{name:pak.Name,length:pak.Length,lastWriteTimeUtc:pak.LastWriteTimeUtc},packageHashes:{uasset:sha256(uasset),uexp:sha256(uexp)},functionName:functionAnalysis.functionName,functionRawHash:functionAnalysis.rawHash},
  findings:{singleMultipliers:{strong:weakCountLookup["1"],weak:weakCountLookup["-1"],neutral:weakCountLookup["0"]},weakCountLookup,defaultMultiplier:functionAnalysis.defaultBranch.multiplier,separateUnlinkedSetting:{name:"DamageElementMatchRate",value:settings.damageSettings.DamageElementMatchRate},defenderInputs:["DefenderElementType1","DefenderElementType2"]},
  verification:{exactWeakCountLookup:true,weakCountAggregationRule:false,runtimeApplication:false,numericMultipliersReadyForPublic:false,dualElementRuleReadyForPublic:false},
  blockers:["The source proves the weakCount-to-multiplier lookup, but not how both defender elements are aggregated into weakCount.","Independent controlled runtime cases have not been recorded for this build."],
};
await mkdir(path.dirname(reportPath),{recursive:true});
await writeFile(reportPath,JSON.stringify(report,null,2));
console.log(`Verified the build ${sourceProfile.gameBuild} GetWeakScale source lookup (${Object.entries(weakCountLookup).map(([key,value])=>`${key}:${value}`).join(", ")}); runtime publication gates remain closed.`);
