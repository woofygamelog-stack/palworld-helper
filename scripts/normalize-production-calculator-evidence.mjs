import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const sourceDirectory=path.resolve(root,process.env.PAL_CALCULATOR_SOURCE??path.join("private","extracted","build-24467282-calculators-v2"));
const output=path.resolve(root,"private","verification","calculators","build-24467282","production-source-report.json");
const files={
  manifest:"calculator-manifest.json",
  tables:"calculator-tables.raw.json",
  blueprints:"calculator-runtime-blueprint-exports.raw.json",
  mappings:"calculator-mapping-definitions.raw.json",
};
const bytes=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>[key,await readFile(path.join(sourceDirectory,file))])));
const parse=key=>JSON.parse(bytes[key].toString("utf8"));
const manifest=parse("manifest"),tableDocument=parse("tables"),blueprintDocument=parse("blueprints"),mappingDocument=parse("mappings");
const tables=tableDocument.tables??{};
const structureSourceDirectory=path.resolve(root,"private","extracted","build-24467282-structures");
const structureManifest=JSON.parse(await readFile(path.join(structureSourceDirectory,"structure-manifest.json"),"utf8"));
const mapObjectMaster=JSON.parse(await readFile(path.join(structureSourceDirectory,"map-object-master.raw.json"),"utf8"));
const publicStructures=JSON.parse(await readFile(path.resolve(root,"public","data","structures.json"),"utf8"));
if(structureManifest.mode!=="structure"||structureManifest.mappingHash!==manifest.mappingHash||JSON.stringify(structureManifest.pakFiles)!==JSON.stringify(manifest.pakFiles)||String(publicStructures.meta?.gameBuild)!=="24467282")throw new Error("Production facility catalog inputs do not match the calculator build.");

const tablePaths={
  sickness:"Pal/Content/Pal/DataTable/BaseCamp/DT_BaseCampWorkerSickDataTable",
  lab:"Pal/Content/Pal/DataTable/Lab/DT_LabResearchDataTable",
  operating:"Pal/Content/Pal/DataTable/MapObject/DT_OperatingTablePassiveSkillDataTable",
  passive:"Pal/Content/Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main",
};
for(const [name,tablePath] of Object.entries(tablePaths))if(!tables[tablePath])throw new Error(`Missing production source table ${name}.`);
if(manifest.schema!==3||manifest.mode!=="calculator"||manifest.runtimeBlueprintRequestedCount!==17||manifest.runtimeBlueprintExtractedCount!==17||manifest.runtimeBlueprintMissingCount!==0||manifest.runtimeBlueprintFailureCount!==0||manifest.candidateTableFailureCount!==0)throw new Error("Production source manifest is incomplete.");

const enumTail=value=>String(value).split("::").at(-1);
const finite=(value,label)=>{if(typeof value!=="number"||!Number.isFinite(value))throw new Error(`${label} must be finite.`);return value};
const sortedEntries=record=>Object.entries(record).sort(([left],[right])=>left.localeCompare(right,"en"));
const assertCount=(actual,expected,label)=>{if(actual!==expected)throw new Error(`${label} baseline drifted: ${actual} !== ${expected}.`)};
const hash=value=>createHash("sha256").update(typeof value==="string"||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest("hex");

const sicknessRows=sortedEntries(tables[tablePaths.sickness]).map(([id,row])=>({id,type:enumTail(row.SickType),workSpeed:finite(row.WorkSpeed,`${id}.WorkSpeed`)}));
assertCount(sicknessRows.length,9,"Worker sickness row count");

const passiveRows=sortedEntries(tables[tablePaths.passive]);
assertCount(passiveRows.length,1905,"Passive skill row count");
const craftSpeedPassives=passiveRows.flatMap(([id,row])=>{
  const effects=[];
  for(let slot=1;slot<=4;slot++)if(row[`EffectType${slot}`]==="EPalPassiveSkillEffectType::CraftSpeed")effects.push({slot,value:finite(row[`EffectValue${slot}`],`${id}.EffectValue${slot}`),target:enumTail(row[`TargetType${slot}`])});
  return effects.length?[{id,rank:finite(row.Rank,`${id}.Rank`),category:enumTail(row.Category),invoke:{always:Boolean(row.InvokeAlways),worker:Boolean(row.InvokeWorker),baseCamp:Boolean(row.InvokeInBaseCamp)},effects}]:[];
});
assertCount(craftSpeedPassives.length,64,"Craft-speed passive row count");
const craftSpeedPassiveIds=new Set(craftSpeedPassives.map(row=>row.id));

const operatingRows=sortedEntries(tables[tablePaths.operating]);
assertCount(operatingRows.length,54,"Operating-table passive row count");
const operatingCraftSpeed=operatingRows.filter(([,row])=>craftSpeedPassiveIds.has(row.PassiveSkill)).map(([id,row])=>({id,passiveSkill:row.PassiveSkill,requiredItem:row.RequireItemId,price:finite(row.Price,`${id}.Price`)}));
assertCount(operatingCraftSpeed.length,8,"Operating-table craft-speed row count");

const labRows=sortedEntries(tables[tablePaths.lab]);
assertCount(labRows.length,168,"Lab research row count");
const labCraftSpeed=labRows.filter(([,row])=>row.EffectType==="EPalPassiveSkillEffectType::CraftSpeed").map(([id,row])=>({id,suitability:enumTail(row.EffectOptionWorkSuitability),value:finite(row.EffectValue,`${id}.EffectValue`),requiredResearch:row.RequiredResearchId,essential:Boolean(row.bIsEssential)}));
assertCount(labCraftSpeed.length,53,"Lab craft-speed row count");
const labIds=new Set(labRows.map(([id])=>id));
if(labCraftSpeed.some(row=>row.requiredResearch!=="None"&&!labIds.has(row.requiredResearch)))throw new Error("Lab craft-speed research contains an orphan prerequisite.");
const labBySuitability=Object.fromEntries([...Map.groupBy(labCraftSpeed,row=>row.suitability)].sort(([left],[right])=>left.localeCompare(right,"en")).map(([suitability,rows])=>[suitability,{rows:rows.length,total:rows.reduce((sum,row)=>sum+row.value,0)}]));
assertCount(Object.keys(labBySuitability).length,9,"Lab craft-speed suitability count");

const gameSettingPath="Pal/Content/Pal/Blueprint/System/BP_PalGameSetting.uasset";
const gameSettingPackage=blueprintDocument.packages?.[gameSettingPath];
const gameSetting=gameSettingPackage?.exports?.find(entry=>entry.exportName==="Default__BP_PalGameSetting_C")?.properties;
if(!gameSetting)throw new Error("BP_PalGameSetting defaults are missing.");
const constants={
  craftSpeedTribeMultiplier:finite(gameSetting.StatusCalculate_TribeMultiply_CraftSpeed,"StatusCalculate_TribeMultiply_CraftSpeed"),
  workAmountByManMonth:finite(gameSetting.WorkAmountByManMonth,"WorkAmountByManMonth"),
  workAnimationSpeedPower:finite(gameSetting.WorkAnimSpeedPower,"WorkAnimSpeedPower"),
  workSpeedPerStatusPoint:finite(gameSetting.AddWorkSpeedPerStatusPoint,"AddWorkSpeedPerStatusPoint"),
  workSuitabilityMaxRank:finite(gameSetting.WorkSuitabilityMaxRank,"WorkSuitabilityMaxRank"),
};
if(constants.craftSpeedTribeMultiplier!==0.7||constants.workAmountByManMonth!==100||constants.workAnimationSpeedPower!==0.5||constants.workSpeedPerStatusPoint!==50||constants.workSuitabilityMaxRank!==10)throw new Error("Production calculator constant baseline drifted.");

const workHardRates=Object.fromEntries((gameSetting.BaseCampPassiveEffectWorkHardInfoMap??[]).map(entry=>[enumTail(entry.Key),finite(entry.Value?.WorkSpeedRate,`${entry.Key}.WorkSpeedRate`)]).sort(([left],[right])=>left.localeCompare(right,"en")));
if(JSON.stringify(workHardRates)!==JSON.stringify({Easy:0.7,Hard:1.25,Normal:1,VeryHard:1.5}))throw new Error("Work-hard rate baseline drifted.");
const workSuitabilityCraftSpeeds=Object.fromEntries((gameSetting.WorkSuitabilityDefineDataMap??[]).map(entry=>{
  const values=entry.Value?.CraftSpeeds;
  if(!Array.isArray(values)||values.length!==constants.workSuitabilityMaxRank+1||values.some(value=>typeof value!=="number"||!Number.isFinite(value)))throw new Error(`${entry.Key} craft-speed ranks are incomplete.`);
  return [enumTail(entry.Key),values];
}).sort(([left],[right])=>left.localeCompare(right,"en")));
assertCount(Object.keys(workSuitabilityCraftSpeeds).length,11,"Work-suitability craft-speed family count");

const facilityNames=["BP_BuildObject_BaseCampWorkHard.uasset","BP_BuildObject_BaseCampWorkHard_02.uasset","BP_BuildObject_BaseCampWorkHard_03.uasset","BP_BuildObject_WorkSpeedIncrease1.uasset"];
const facilityDefinitions=facilityNames.map(name=>{
  const match=Object.entries(blueprintDocument.packages??{}).find(([packagePath])=>packagePath.endsWith(`/${name}`));
  if(!match)throw new Error(`Production facility definition is missing: ${name}`);
  const packageData=match[1],classDefault=packageData.exports?.find(entry=>entry.exportName.startsWith("Default__"));
  if(!classDefault?.properties?.ConcreteModelClass?.ObjectName)throw new Error(`Production facility model is missing: ${name}`);
  const components=(packageData.exports??[]).filter(entry=>/ParameterComponent$/.test(entry.exportType)).map(entry=>({type:entry.exportType,properties:entry.properties})).sort((left,right)=>left.type.localeCompare(right.type,"en"));
  if(!components.length)throw new Error(`Production facility parameter is missing: ${name}`);
  return {name,concreteModelClass:classDefault.properties.ConcreteModelClass.ObjectName,components};
});
assertCount(facilityDefinitions.length,4,"Production facility definition count");
const allWorkSpeedFacility=facilityDefinitions.find(entry=>entry.name==="BP_BuildObject_WorkSpeedIncrease1.uasset")?.components.find(component=>component.type==="PalMapObjectBaseCampPassiveEffectAllWorkSpeedParameterComponent");
if(allWorkSpeedFacility?.properties?.WorkSpeedAdditionalRate!==10)throw new Error("All-work-speed facility baseline drifted.");
const expectedFacilityCatalogRelations=[{internalId:"BaseCampWorkHard",facilityName:"BP_BuildObject_BaseCampWorkHard.uasset",publicSlug:"monitoring-stand",publicName:"Monitoring Stand"},{internalId:"BaseCampWorkHard02",facilityName:"BP_BuildObject_BaseCampWorkHard_02.uasset",publicSlug:"high-quality-monitoring-stand",publicName:"High Quality Monitoring Stand"},{internalId:"BaseCampWorkHard03",facilityName:"BP_BuildObject_BaseCampWorkHard_03.uasset",publicSlug:"ancient-monitoring-stand",publicName:"Ancient Monitoring Stand"},{internalId:"WorkSpeedIncrease1",facilityName:"BP_BuildObject_WorkSpeedIncrease1.uasset",publicSlug:"beta-wave-generator",publicName:"Beta Wave Generator"}];
const facilityCatalogRelations=expectedFacilityCatalogRelations.map(relation=>{
  const master=mapObjectMaster[relation.internalId],publicEntry=publicStructures.structures?.find(entry=>entry.slug===relation.publicSlug);
  if(`${master?.BlueprintClassName}.uasset`!==relation.facilityName||publicEntry?.names?.["en-US"]!==relation.publicName)throw new Error(`Production facility catalog relation drifted: ${relation.publicSlug}`);
  return relation;
});
assertCount(facilityCatalogRelations.length,4,"Production facility catalog relation count");

const requiredTypeProperties={PalBaseCampPassiveEffectWorkHardInfo:["WorkSpeedRate"],PalBaseCampPassiveEffect_AllWorkSpeed:["WorkSpeedAdditionalRate"],PalBaseCampPassiveEffect_WorkSuitability:["WorkSpeedAdditionalRateMap"],PalCharacterParameterDatabaseRow:["CraftSpeed","Friendship_CraftSpeed"],PalIndividualCharacterSaveParameter:["CraftSpeed","CraftSpeedRates","CraftSpeeds","Rank_CraftSpeed","WorkerSick"],PalLabResearchMasterData:["EffectOptionWorkSuitability","EffectType","EffectValue"],PalMapObjectBaseCampPassiveEffectAllWorkSpeedParameterComponent:["WorkSpeedAdditionalRate"],PalMapObjectConvertItemModel:["WorkSpeedAdditionalRate"],PalMapObjectItemConverterParameterComponent:["AutoWorkAmountBySec","WorkSpeedAdditionalRate"],PalOptionWorldSettings:["WorkSpeedRate"],PalWorkProgress:["AutoWorkSelfAmountBySec","CurrentWorkAmount","RequiredWorkAmount"],PalWorkSuitabilityDefineData:["CraftSpeeds"]};
const typeContracts=Object.entries(requiredTypeProperties).sort(([left],[right])=>left.localeCompare(right,"en")).map(([name,requiredProperties])=>{
  const type=mappingDocument.types?.find(candidate=>candidate.name===name),properties=new Set(type?.properties?.map(property=>property.Name));
  if(!type||requiredProperties.some(property=>!properties.has(property)))throw new Error(`Production type contract is incomplete: ${name}`);
  return {name,superType:type.superType,requiredProperties};
});
assertCount(typeContracts.length,12,"Production type contract count");
const semanticHashes={sicknessRows:hash(sicknessRows),labBySuitability:hash(labBySuitability),labCraftSpeed:hash(labCraftSpeed),craftSpeedPassives:hash(craftSpeedPassives),operatingCraftSpeed:hash(operatingCraftSpeed),workSuitabilityCraftSpeeds:hash(workSuitabilityCraftSpeeds),facilityDefinitions:hash(facilityDefinitions),facilityCatalogRelations:hash(facilityCatalogRelations),typeContracts:hash(typeContracts)};
const expectedSemanticHashes={sicknessRows:"528ce2a1e0e67b9440edd15487e2a3862c08c44b35bbdb9fd2bd26e6002c16d1",labBySuitability:"c54580584fc6f751e9fe01379b0fe06a316d84b30dd1901a358cea7dacc3ad81",labCraftSpeed:"e15a523f769c69281861e49fe87c9ed694622131ebe65c2c2c32ead4ccff64a0",craftSpeedPassives:"465ba6467f7ea2b394d7d5be27af7385938c83ba2ad35b32fb10f06058659a9e",operatingCraftSpeed:"eeeb12ecb5e927c4719fe3bbd81293a248e5806cc060426bce66b2e902bc34fd",workSuitabilityCraftSpeeds:"faaf85b444cb8aa9be431b7ec9031e4b2123bca81dcaaee1b8b3cd39746e9bb4",facilityDefinitions:"d638c5fc248f1a262d2aa536f701a820f477682b7464b68ed932f196170abbf2",facilityCatalogRelations:"b41c08c8df2ebd7cb0c773eea56e7a042463277f50be3c171ee337f1a2737b6a",typeContracts:"11ffa744c981a100417f5cc8b593c7006efb90907b319cf490e7508226e5e409"};
if(Object.entries(expectedSemanticHashes).some(([key,value])=>semanticHashes[key]!==value))throw new Error("Production source semantics drifted; review the build before updating baselines.");

const report={
  schema:1,
  gameBuild:24467282,
  status:"normalized-source-only",
  publicationReady:false,
  sourceIntegrity:{manifestSchema:manifest.schema,hashes:Object.fromEntries(Object.entries(bytes).map(([key,value])=>[key,hash(value)])),semanticHashes},
  coverage:{sicknessRows:sicknessRows.length,labRows:labRows.length,labCraftSpeedRows:labCraftSpeed.length,passiveRows:passiveRows.length,craftSpeedPassiveRows:craftSpeedPassives.length,operatingRows:operatingRows.length,operatingCraftSpeedRows:operatingCraftSpeed.length,workSuitabilityFamilies:Object.keys(workSuitabilityCraftSpeeds).length,facilityDefinitions:facilityDefinitions.length,facilityCatalogRelations:facilityCatalogRelations.length,typeContracts:typeContracts.length,worldWorkSpeedField:true},
  constants,workHardRates,workSuitabilityCraftSpeeds,facilityDefinitions,facilityCatalogRelations,typeContracts,sicknessRows,labBySuitability,labCraftSpeed,craftSpeedPassives,operatingCraftSpeed,
  unresolved:["application order","rounding boundaries","facility contribution","world-setting placement","complete controlled golden cases in two independent sessions"],
};
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Normalized production source evidence; report: ${path.relative(root,output)}`);
