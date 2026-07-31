import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {analyzeGetWeakScaleAsset} from "./element-damage-evidence.mjs";

const root=process.cwd();
const invariant=(condition,message)=>{if(!condition)throw new Error(message)};
const sha256=value=>createHash("sha256").update(value).digest("hex");
const normalizedHash=value=>String(value??"").toLowerCase();
const sameTimestamp=(left,right)=>Number.isFinite(Date.parse(left))&&Math.abs(Date.parse(left)-Date.parse(right))<=2;
const installManifestPath=process.env.PAL_ELEMENT_INSTALL_MANIFEST;
invariant(installManifestPath,"PAL_ELEMENT_INSTALL_MANIFEST must point to the private detected-installation.json report");
const installation=JSON.parse(await readFile(path.resolve(installManifestPath),"utf8"));
invariant(installation.meta?.schema===1&&installation.meta?.status==="installed-build-complete","Detected installation report is not complete schema 1 evidence");
const gameBuild=String(process.env.PAL_GAME_BUILD||installation.meta.gameBuild);
invariant(gameBuild===String(installation.meta.gameBuild),"Requested game build does not match the detected installation");
const sourceRoot=path.resolve(process.env.PAL_ELEMENT_DAMAGE_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-element-damage`));
const reportPath=path.resolve(process.env.PAL_ELEMENT_SOURCE_REPORT||path.join(root,"private","verification","element-damage",`build-${gameBuild}`,"source-report.json"));
const readJson=async name=>JSON.parse(await readFile(path.join(sourceRoot,name),"utf8"));

const [manifest,settings,mappingOwners,mappingDefinitions,assetJson,chartBytes]=await Promise.all([
  readJson("element-manifest.json"),
  readJson("element-damage-settings.raw.json"),
  readJson("element-damage-mapping-owners.raw.json"),
  readJson("element-damage-mapping-definitions.raw.json"),
  readJson("BP_PalGameSetting.uassetapi.json"),
  readFile(path.join(sourceRoot,"element-matchup-chart.webp")),
]);
invariant(manifest.schema===2&&manifest.mode==="element","Element damage extraction manifest is not schema 2 element mode");
invariant(normalizedHash(manifest.mappingHash)===normalizedHash(installation.fingerprints?.mapping?.sha256),"Element extraction mapping does not match the detected installation mapping");
invariant(manifest.runtimeBlueprintCandidateCount>0&&manifest.runtimeBlueprintExtractedCount===manifest.runtimeBlueprintCandidateCount&&manifest.runtimeBlueprintFailureCount===0,"Runtime Blueprint candidate extraction is incomplete");
invariant(manifest.elementIconCount===9&&manifest.localeCount===17,"Element extraction coverage drifted");
const pak=manifest.pakFiles.find(value=>String(value.Name).toLowerCase()==="pal-windows.pak");
const installedPak=installation.fingerprints?.pak;
invariant(pak&&installedPak&&pak.Length===installedPak.length&&sameTimestamp(pak.LastWriteTimeUtc,installedPak.lastWriteTimeUtc),"Element extraction PAK fingerprint does not match the detected installation");
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
invariant([...expectedOwners].every(value=>actualOwners.has(value)),"Damage mapping ownership chain is missing a required field");
invariant(mappingDefinitions.requestedTypeCount===6&&mappingDefinitions.extractedTypeCount===6&&mappingDefinitions.missingTypeCount===0,"Damage mapping definitions are incomplete");
const functionAnalysis=analyzeGetWeakScaleAsset(assetJson);
const rawPackageRoot=path.join(sourceRoot,"raw-packages","Pal","Content","Pal","Blueprint","System");
const [uasset,uexp]=await Promise.all([readFile(path.join(rawPackageRoot,"BP_PalGameSetting.uasset")),readFile(path.join(rawPackageRoot,"BP_PalGameSetting.uexp"))]);
const weakCountLookup=Object.fromEntries(functionAnalysis.branches.map(value=>[String(value.weakCount),value.multiplier]));
const chartHash=sha256(chartBytes);
invariant(chartHash==="93bc7116e59463e93fa92968b825f566cbf9f0d55006e6906dc4dcb39658ca52","Official qualitative element chart changed and requires a reviewed relation refresh");
const report={
  meta:{schema:2,gameBuild,generatedAt:new Date().toISOString(),status:"source-lookup-verified-runtime-pending"},
  source:{
    mappingHash:normalizedHash(manifest.mappingHash),
    pakFingerprint:{name:pak.Name,length:pak.Length,lastWriteTimeUtc:new Date(pak.LastWriteTimeUtc).toISOString(),sampledSha256:installedPak.sampledSha256},
    packageHashes:{uasset:sha256(uasset),uexp:sha256(uexp)},
    qualitativeChartHash:chartHash,
    functionProfileId:functionAnalysis.profileId,
    functionName:functionAnalysis.functionName,
    functionRawHash:functionAnalysis.rawHash,
  },
  extraction:{runtimeBlueprintCandidateCount:manifest.runtimeBlueprintCandidateCount,runtimeBlueprintExtractedCount:manifest.runtimeBlueprintExtractedCount,runtimeBlueprintFailureCount:manifest.runtimeBlueprintFailureCount,elementIconCount:manifest.elementIconCount,localeCount:manifest.localeCount},
  findings:{singleMultipliers:{strong:weakCountLookup["1"],weak:weakCountLookup["-1"],neutral:weakCountLookup["0"]},weakCountLookup,defaultMultiplier:functionAnalysis.defaultBranch.multiplier,separateUnlinkedSetting:{name:"DamageElementMatchRate",value:settings.damageSettings.DamageElementMatchRate},defenderInputs:["DefenderElementType1","DefenderElementType2"]},
  verification:{installationComplete:true,buildMatchedExtraction:true,recognizedFunctionProfile:true,exactWeakCountLookup:true,weakCountAggregationRule:false,runtimeApplication:false,numericMultipliersReadyForPublic:false,dualElementRuleReadyForPublic:false},
  blockers:["The source proves the weakCount-to-multiplier lookup, but not how both defender elements are aggregated into weakCount.","Independent machine-generated runtime evidence has not passed for this build."],
};
await mkdir(path.dirname(reportPath),{recursive:true});
await writeFile(reportPath,JSON.stringify(report,null,2));
console.log(`Verified the build ${gameBuild} GetWeakScale source profile ${functionAnalysis.profileId} (${Object.entries(weakCountLookup).map(([key,value])=>`${key}:${value}`).join(", ")}); runtime publication gates remain closed.`);
