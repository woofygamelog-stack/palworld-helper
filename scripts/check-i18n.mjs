import { readFile } from "node:fs/promises";
import { messageCatalogs, translationProvenance } from "../src/i18n.ts";
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
console.log(`Validated ${keys.length} message keys in ${Object.keys(messageCatalogs).length} complete catalogs; ${fallback.length} locales remain explicit fallback.`);
