import { readFile } from "node:fs/promises";
import { messageCatalogs, translationProvenance } from "../src/i18n.ts";
import { npcCopy } from "../src/npc-i18n.ts";
import { dungeonCopy, dungeonSearchCopy, dungeonTranslationProvenance } from "../src/dungeon-i18n.ts";
import { itemFilterAllLabels, itemFilterAllLabelsProvenance, uiCopy } from "../src/ui-i18n.ts";
import { partnerLabel, passiveUiLabels, skillLabels, skillTranslationProvenance } from "../src/skill-i18n.ts";
import { technologyCopy, technologyCopyProvenance } from "../src/technology-i18n.ts";
import { healthCopy, healthCopyProvenance } from "../src/health-i18n.ts";
import { elementCopy, elementCopyProvenance } from "../src/element-i18n.ts";
import { elementMatchupCopy, elementMatchupCopyProvenance } from "../src/element-matchup-i18n.ts";
import { structureCopy, structureCopyProvenance } from "../src/structure-i18n.ts";
import { expeditionCopy, expeditionCopyProvenance } from "../src/expedition-i18n.ts";
import { questCopy, questCopyProvenance } from "../src/quest-i18n.ts";
import { plannerCopy, plannerCopyProvenance } from "../src/planner-i18n.ts";
import { basePresetCopy, basePresetCopyProvenance } from "../src/base-preset-i18n.ts";
import { basePresets } from "../src/base-presets.ts";
import { mapSeoCopy, mapSeoTranslationProvenance } from "./seo-static.mjs";
import { shellCopy, shellCopyProvenance } from "../src/shell-i18n.ts";
const config = await readFile("src/config.ts", "utf8");
const i18n = await readFile("src/i18n.ts", "utf8");
const expected = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
for (const locale of expected) {
  if (!config.includes(`"${locale}"`)) throw new Error(`Locale missing from config: ${locale}`);
  if (!i18n.includes(`"${locale}"`)) throw new Error(`Translation provenance missing: ${locale}`);
}
if (!config.includes('defaultLocale: Locale = "en-US"')) throw new Error("en-US must remain the default locale");
const english=messageCatalogs["en-US"];
if(!english) throw new Error("English catalog missing");
const keys=Object.keys(english).sort();
for(const [locale,catalog] of Object.entries(messageCatalogs)){
  const localeKeys=Object.keys(catalog).sort();
  if(JSON.stringify(localeKeys)!==JSON.stringify(keys)) throw new Error(`${locale} catalog key mismatch`);
  for(const key of keys){
    if(typeof catalog[key]!=="string"||!catalog[key].trim()) throw new Error(`${locale}.${key} is empty`);
    const sourceTokens=[...english[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    const targetTokens=[...catalog[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    if(JSON.stringify(sourceTokens)!==JSON.stringify(targetTokens)) throw new Error(`${locale}.${key} placeholder mismatch`);
  }
  if(translationProvenance[locale]==="fallback") throw new Error(`${locale} has a catalog but fallback provenance`);
  if(locale!=="en-US"&&keys.filter(key=>catalog[key]!==english[key]).length<Math.floor(keys.length*.8)) throw new Error(`${locale} appears to be an accidental English fallback`);
}
if(JSON.stringify(messageCatalogs["zh-CN"])===JSON.stringify(messageCatalogs["zh-TW"])) throw new Error("Simplified and Traditional Chinese catalogs must be independently localized");
const fallback=expected.filter(locale=>translationProvenance[locale]==="fallback");
if(Object.keys(messageCatalogs).length!==expected.length) throw new Error(`Expected ${expected.length} complete catalogs, found ${Object.keys(messageCatalogs).length}`);
if(fallback.length) throw new Error(`Release-blocking fallback locales: ${fallback.join(", ")}`);
const npcEnglish=npcCopy["en-US"],npcKeys=Object.keys(npcEnglish).sort();
for(const locale of expected){
  const catalog=npcCopy[locale];
  if(!catalog)throw new Error(`NPC catalog missing: ${locale}`);
  if(JSON.stringify(Object.keys(catalog).sort())!==JSON.stringify(npcKeys))throw new Error(`${locale} NPC catalog key mismatch`);
  for(const key of npcKeys){
    if(typeof catalog[key]!=="string"||!catalog[key].trim())throw new Error(`${locale} NPC catalog ${key} is empty`);
    const sourceTokens=[...npcEnglish[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    const targetTokens=[...catalog[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    if(JSON.stringify(sourceTokens)!==JSON.stringify(targetTokens))throw new Error(`${locale} NPC catalog ${key} placeholder mismatch`);
  }
  if(locale!=="en-US"&&npcKeys.filter(key=>catalog[key]!==npcEnglish[key]).length<Math.floor(npcKeys.length*.8))throw new Error(`${locale} NPC catalog appears to be an accidental English fallback`);
}
const uiEnglish=uiCopy["en-US"],uiKeys=Object.keys(uiEnglish).sort();
for(const locale of expected){
  const catalog=uiCopy[locale];
  if(!catalog)throw new Error(`UI catalog missing: ${locale}`);
  if(JSON.stringify(Object.keys(catalog).sort())!==JSON.stringify(uiKeys))throw new Error(`${locale} UI catalog key mismatch`);
  for(const key of uiKeys){
    if(typeof catalog[key]!=="string"||!catalog[key].trim())throw new Error(`${locale} UI catalog ${key} is empty`);
    const sourceTokens=[...uiEnglish[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    const targetTokens=[...catalog[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    if(JSON.stringify(sourceTokens)!==JSON.stringify(targetTokens))throw new Error(`${locale} UI catalog ${key} placeholder mismatch`);
  }
  if(locale!=="en-US"&&uiKeys.filter(key=>catalog[key]!==uiEnglish[key]).length<Math.floor(uiKeys.length*.8))throw new Error(`${locale} UI catalog appears to be an accidental English fallback`);
  if(typeof itemFilterAllLabels[locale]!=="string"||!itemFilterAllLabels[locale].trim())throw new Error(`${locale} item filter all label is missing`);
}
if(itemFilterAllLabelsProvenance!=="gpt")throw new Error("Item filter all-label provenance is incomplete");
const dungeonEnglish=dungeonCopy["en-US"],dungeonKeys=Object.keys(dungeonEnglish).sort();
for(const locale of expected){
  const catalog=dungeonCopy[locale];
  if(!catalog)throw new Error(`Dungeon catalog missing: ${locale}`);
  if(typeof dungeonSearchCopy[locale]!=="string"||!dungeonSearchCopy[locale].trim())throw new Error(`${locale} Dungeon search copy is empty`);
  if(JSON.stringify(Object.keys(catalog).sort())!==JSON.stringify(dungeonKeys))throw new Error(`${locale} Dungeon catalog key mismatch`);
  for(const key of dungeonKeys){
    if(typeof catalog[key]!=="string"||!catalog[key].trim())throw new Error(`${locale} Dungeon catalog ${key} is empty`);
    const sourceTokens=[...dungeonEnglish[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    const targetTokens=[...catalog[key].matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
    if(JSON.stringify(sourceTokens)!==JSON.stringify(targetTokens))throw new Error(`${locale} Dungeon catalog ${key} placeholder mismatch`);
  }
  if(!dungeonTranslationProvenance[locale])throw new Error(`${locale} Dungeon translation provenance missing`);
  if(locale!=="en-US"&&dungeonKeys.filter(key=>catalog[key]!==dungeonEnglish[key]).length<Math.floor(dungeonKeys.length*.8))throw new Error(`${locale} Dungeon catalog appears to be an accidental English fallback`);
}
const main=await readFile("src/main.ts","utf8");
const skillEnglish=skillLabels["en-US"],skillKeys=Object.keys(skillEnglish).sort(),passiveEnglish=passiveUiLabels["en-US"],passiveKeys=Object.keys(passiveEnglish).sort();
for(const locale of expected){
  if(JSON.stringify(Object.keys(skillLabels[locale]||{}).sort())!==JSON.stringify(skillKeys))throw new Error(`${locale} skill catalog key mismatch`);
  if(JSON.stringify(Object.keys(passiveUiLabels[locale]||{}).sort())!==JSON.stringify(passiveKeys))throw new Error(`${locale} passive skill catalog key mismatch`);
  if(!partnerLabel[locale]?.trim()||!skillTranslationProvenance[locale])throw new Error(`${locale} skill label or provenance is missing`);
  if(Object.values(skillLabels[locale]).some(value=>!value.trim())||Object.values(passiveUiLabels[locale]).some(value=>!value.trim()))throw new Error(`${locale} skill catalog contains an empty value`);
  if(!mapSeoCopy[locale]?.title?.trim()||!mapSeoCopy[locale]?.body?.trim()||mapSeoTranslationProvenance[locale]!=="gpt")throw new Error(`${locale} map SEO copy or provenance is incomplete`);
}
const technologyEnglish=technologyCopy["en-US"],technologyKeys=Object.keys(technologyEnglish).sort();
for(const locale of expected){
  const catalog=technologyCopy[locale],provenance=technologyCopyProvenance[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(technologyKeys))throw new Error(`${locale} technology catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} technology catalog contains an empty value`);
  if(!provenance||provenance.title!=="official"||provenance.regular!=="official"||provenance.ancient!=="official"||provenance.regularPoints!=="official"||provenance.ancientPoints!=="official"||provenance.remaining!=="gpt")throw new Error(`${locale} technology translation provenance is incomplete`);
  if(locale!=="en-US"&&technologyKeys.filter(key=>catalog[key]!==technologyEnglish[key]).length<Math.floor(technologyKeys.length*.8))throw new Error(`${locale} technology catalog appears to be an accidental English fallback`);
}
const healthKeys=Object.keys(healthCopy["en-US"]).sort();
for(const locale of expected){
  const catalog=healthCopy[locale],provenance=healthCopyProvenance[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(healthKeys))throw new Error(`${locale} health catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} health catalog contains an empty value`);
  if(!provenance||provenance.title!=="gpt"||provenance.remaining!=="gpt")throw new Error(`${locale} health translation provenance is incomplete`);
}
const elementEnglish=elementCopy["en-US"],elementKeys=Object.keys(elementEnglish).sort();
for(const locale of expected){
  const catalog=elementCopy[locale],provenance=elementCopyProvenance[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(elementKeys))throw new Error(`${locale} element catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} element catalog contains an empty value`);
  if(!provenance||provenance.title!=="gpt"||provenance.remaining!=="gpt")throw new Error(`${locale} element translation provenance is incomplete`);
  if(locale!=="en-US"&&elementKeys.filter(key=>catalog[key]!==elementEnglish[key]).length<Math.floor(elementKeys.length*.8))throw new Error(`${locale} element catalog appears to be an accidental English fallback`);
}
const elementMatchupEnglish=elementMatchupCopy["en-US"],elementMatchupKeys=Object.keys(elementMatchupEnglish).sort();
for(const locale of expected){
  const catalog=elementMatchupCopy[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(elementMatchupKeys))throw new Error(`${locale} element matchup catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} element matchup catalog contains an empty value`);
  if(elementMatchupCopyProvenance[locale]!=="gpt")throw new Error(`${locale} element matchup translation provenance is incomplete`);
  if(locale!=="en-US"&&elementMatchupKeys.filter(key=>catalog[key]!==elementMatchupEnglish[key]).length<Math.floor(elementMatchupKeys.length*.8))throw new Error(`${locale} element matchup catalog appears to be an accidental English fallback`);
}
const structureEnglish=structureCopy["en-US"],structureKeys=Object.keys(structureEnglish).sort();
for(const locale of expected){
  const catalog=structureCopy[locale],provenance=structureCopyProvenance[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(structureKeys))throw new Error(`${locale} structure catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} structure catalog contains an empty value`);
  if(!provenance||provenance.remaining!=="gpt")throw new Error(`${locale} structure translation provenance is incomplete`);
  if(locale!=="en-US"&&structureKeys.filter(key=>catalog[key]!==structureEnglish[key]).length<Math.floor(structureKeys.length*.8))throw new Error(`${locale} structure catalog appears to be an accidental English fallback`);
}
const expeditionEnglish=expeditionCopy["en-US"],expeditionKeys=Object.keys(expeditionEnglish).sort();
for(const locale of expected){
  const catalog=expeditionCopy[locale],provenance=expeditionCopyProvenance[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(expeditionKeys))throw new Error(`${locale} expedition catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} expedition catalog contains an empty value`);
  if(!provenance||provenance.remaining!=="gpt")throw new Error(`${locale} expedition translation provenance is incomplete`);
  if(locale!=="en-US"&&expeditionKeys.filter(key=>catalog[key]!==expeditionEnglish[key]).length<Math.floor(expeditionKeys.length*.8))throw new Error(`${locale} expedition catalog appears to be an accidental English fallback`);
}
const questEnglish=questCopy["en-US"],questKeys=Object.keys(questEnglish).sort();
for(const locale of expected){
  const catalog=questCopy[locale],provenance=questCopyProvenance[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(questKeys))throw new Error(`${locale} quest catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} quest catalog contains an empty value`);
  if(!provenance)throw new Error(`${locale} quest translation provenance is incomplete`);
  if(locale!=="en-US"&&questKeys.filter(key=>catalog[key]!==questEnglish[key]).length<Math.floor(questKeys.length*.8))throw new Error(`${locale} quest catalog appears to be an accidental English fallback`);
}
const plannerEnglish=plannerCopy["en-US"],plannerKeys=Object.keys(plannerEnglish).sort();
for(const locale of expected){
  const catalog=plannerCopy[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(plannerKeys))throw new Error(`${locale} planner catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} planner catalog contains an empty value`);
  if(locale!=="en-US"&&plannerKeys.filter(key=>catalog[key]!==plannerEnglish[key]).length<Math.floor(plannerKeys.length*.8))throw new Error(`${locale} planner catalog appears to be an accidental English fallback`);
}
if(plannerCopyProvenance!=="gpt")throw new Error("Planner translation provenance is incomplete");
const basePresetIds=basePresets.map(preset=>preset.id).sort(),basePresetGroupKeys=Object.keys(basePresetCopy["en-US"].groups).sort(),basePresetEnglish=[basePresetCopy["en-US"].custom,basePresetCopy["en-US"].selectedRoles,basePresetCopy["en-US"].noRoles,...Object.values(basePresetCopy["en-US"].groups),...Object.values(basePresetCopy["en-US"].presets)];
for(const locale of expected){
  const catalog=basePresetCopy[locale];
  if(!catalog)throw new Error(`Base preset catalog missing: ${locale}`);
  if(JSON.stringify(Object.keys(catalog.groups).sort())!==JSON.stringify(basePresetGroupKeys))throw new Error(`${locale} base preset group key mismatch`);
  if(JSON.stringify(Object.keys(catalog.presets).sort())!==JSON.stringify(basePresetIds))throw new Error(`${locale} base preset key mismatch`);
  const values=[catalog.custom,catalog.selectedRoles,catalog.noRoles,...Object.values(catalog.groups),...Object.values(catalog.presets)];
  if(values.some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} base preset catalog contains an empty value`);
  if(locale!=="en-US"&&values.filter((value,index)=>value!==basePresetEnglish[index]).length<Math.floor(values.length*.8))throw new Error(`${locale} base preset catalog appears to be an accidental English fallback`);
}
if(basePresetCopyProvenance!=="gpt")throw new Error("Base preset translation provenance is incomplete");
const shellKeys=Object.keys(shellCopy["en-US"]).sort();
for(const locale of expected){
  const catalog=shellCopy[locale];
  if(JSON.stringify(Object.keys(catalog||{}).sort())!==JSON.stringify(shellKeys))throw new Error(`${locale} shell catalog key mismatch`);
  if(Object.values(catalog).some(value=>typeof value!=="string"||!value.trim()))throw new Error(`${locale} shell catalog contains an empty value`);
}
if(shellCopyProvenance!=="gpt")throw new Error("Shell translation provenance is incomplete");
if(/\$\{esc\((?:encounter|step)\.variant\)/.test(main))throw new Error("NPC internal variant is rendered directly");
for(const text of [">Skill Fruit<",">Surgery cost<",">Breeding power<",">Size<","Server management","Import existing INI","Import and validate","INI output","Only settings documented by the official Palworld Server Guide"]){
  if(main.includes(text))throw new Error(`Hard-coded English UI copy remains in main.ts: ${text}`);
}
console.log(`Validated ${keys.length} shared, ${npcKeys.length} NPC, ${uiKeys.length} supplemental UI, ${skillKeys.length} skill, ${dungeonKeys.length} Dungeon, ${technologyKeys.length} technology, ${healthKeys.length} health, ${elementKeys.length} element, ${elementMatchupKeys.length} element matchup, ${structureKeys.length} structure, ${expeditionKeys.length} expedition, ${questKeys.length} quest, ${plannerKeys.length} planner, ${shellKeys.length} shell, and ${basePresetIds.length} base preset message keys in ${Object.keys(messageCatalogs).length} complete catalogs; ${fallback.length} locales remain explicit fallback.`);
