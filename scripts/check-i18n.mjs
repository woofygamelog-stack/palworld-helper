import { readFile } from "node:fs/promises";
import { messageCatalogs, translationProvenance } from "../src/i18n.ts";
import { npcCopy } from "../src/npc-i18n.ts";
import { dungeonCopy, dungeonSearchCopy, dungeonTranslationProvenance } from "../src/dungeon-i18n.ts";
import { uiCopy } from "../src/ui-i18n.ts";
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
}
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
if(/\$\{esc\((?:encounter|step)\.variant\)/.test(main))throw new Error("NPC internal variant is rendered directly");
for(const text of [">Skill Fruit<",">Surgery cost<",">Breeding power<",">Size<","Server management","Import existing INI","Import and validate","INI output","Only settings documented by the official Palworld Server Guide"]){
  if(main.includes(text))throw new Error(`Hard-coded English UI copy remains in main.ts: ${text}`);
}
console.log(`Validated ${keys.length} shared, ${npcKeys.length} NPC, ${uiKeys.length} supplemental UI, and ${dungeonKeys.length} Dungeon message keys in ${Object.keys(messageCatalogs).length} complete catalogs; ${fallback.length} locales remain explicit fallback.`);
