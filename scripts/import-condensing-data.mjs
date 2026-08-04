import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),pals=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),gameBuild=String(process.env.PAL_GAME_BUILD||pals.meta.gameBuild),expectedMappingHash="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851";
if(gameBuild!==String(pals.meta.gameBuild))throw new Error("Condensing source and public Pal data must use the same build.");
const settingsRoot=path.resolve(process.env.PAL_CONDENSING_SETTINGS_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}-element-damage`)),itemRoot=path.resolve(process.env.PAL_CONDENSING_ITEM_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}`));
if(!path.basename(settingsRoot).includes(`build-${gameBuild}`)||!path.basename(itemRoot).includes(`build-${gameBuild}`))throw new Error("Condensing private inputs must be build-scoped.");
const readJson=file=>JSON.parse(fs.readFileSync(file,"utf8")),manifestPath=path.join(settingsRoot,"element-manifest.json"),exportsPath=path.join(settingsRoot,"element-runtime-blueprint-exports.raw.json"),itemsPath=path.join(itemRoot,"items.raw.json"),itemNamesPath=path.join(itemRoot,"item-names.raw.json"),uiPath=path.join(itemRoot,"ui-common.raw.json"),manifest=readJson(manifestPath),runtime=readJson(exportsPath),items=readJson(itemsPath),itemNames=readJson(itemNamesPath),ui=readJson(uiPath);
if(manifest.schema!==2||manifest.mode!=="element"||manifest.mappingHash!==expectedMappingHash||manifest.localeCount!==17||manifest.runtimeBlueprintFailureCount!==0)throw new Error("Condensing settings source failed the accepted build mapping or extraction gate.");
const packagePath="Pal/Content/Pal/Blueprint/System/BP_PalGameSetting.uasset",exports=runtime.packages?.[packagePath]?.exports,defaults=Array.isArray(exports)?exports.find(entry=>entry.exportName==="Default__BP_PalGameSetting_C")?.properties:null;
if(!defaults)throw new Error("Condensing game-setting defaults are unavailable.");
const maxInternalRank=defaults.CharacterMaxRank,entries=defaults.CharacterRankUpRequiredNumMap;
if(!Number.isInteger(maxInternalRank)||maxInternalRank<2||!Array.isArray(entries))throw new Error("Condensing rank settings are malformed.");
const requirements=new Map(entries.map(entry=>[Number(entry.Key),Number(entry.Value)])),expectedKeys=Array.from({length:maxInternalRank-1},(_,index)=>index+1);
if(requirements.size!==expectedKeys.length||expectedKeys.some(key=>!Number.isInteger(requirements.get(key))||requirements.get(key)<=0))throw new Error("Condensing stage requirements are incomplete.");
const localeKeys=Object.keys(itemNames),fruitIds=expectedKeys.map(key=>`Rankup_${key}`);
if(localeKeys.length!==17||Object.keys(ui).length!==17)throw new Error("Condensing localization evidence must cover all 17 locales.");
for(const [index,id] of fruitIds.entries()){
  const key=index+1,item=items[id];
  if(!item||item.TypeB!=="EPalItemTypeB::ConsumePalRankUp"||item.Rank!==key||item.bLegalInGame!==true)throw new Error(`Condensing rank item evidence is invalid: ${id}`);
  if(localeKeys.some(locale=>!itemNames[locale]?.[`ITEM_NAME_${id}`]))throw new Error(`Condensing rank item localization is incomplete: ${id}`);
}
if(Object.values(ui).some(catalog=>!catalog.RANKUP_TITLE||!catalog.RANKUP_COMPLETE))throw new Error("Condensing UI terminology is incomplete.");
let cumulative=0;
const stages=expectedKeys.map(toStars=>{const required=requirements.get(toStars);cumulative+=required;return {fromStars:toStars-1,toStars,required,cumulative}});
const output=JSON.stringify({meta:{schema:1,gameBuild,verification:"verified",maxStars:maxInternalRank-1,stageCount:stages.length},stages});
fs.writeFileSync(path.join(root,"public","data","condensing.json"),output);
const provenanceDirectory=path.join(root,"private","provenance");fs.mkdirSync(provenanceDirectory,{recursive:true});
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
fs.writeFileSync(path.join(provenanceDirectory,"condensing.json"),JSON.stringify({schema:1,gameBuild,sourceType:"build-matched game-setting defaults corroborated by legal rank items and official localized UI terminology",sourceDirectory:path.relative(root,settingsRoot),mappingHash:manifest.mappingHash,hashes:{manifest:hash(manifestPath),runtimeExports:hash(exportsPath),items:hash(itemsPath),itemNames:hash(itemNamesPath),uiCommon:hash(uiPath),output:crypto.createHash("sha256").update(output).digest("hex")},verification:{maxInternalRank,stageCount:stages.length,localeCount:localeKeys.length,rankItemCount:fruitIds.length,stageRequirements:stages.map(stage=>stage.required),cumulativeRequirements:stages.map(stage=>stage.cumulative)}},null,2));
console.log(`Imported ${stages.length} verified condensing stages for build ${gameBuild}.`);
