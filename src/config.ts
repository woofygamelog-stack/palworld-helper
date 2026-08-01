export const locales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en-US";
export const localeLabels: Record<Locale,string> = {
  "en-US":"English","zh-CN":"简体中文","zh-TW":"繁體中文","ja-JP":"日本語","fr-FR":"Français","it-IT":"Italiano","de-DE":"Deutsch","es-ES":"Español (España)","pt-BR":"Português (Brasil)","ru-RU":"Русский","ko-KR":"한국어","id-ID":"Bahasa Indonesia","es-419":"Español (Latinoamérica)","th-TH":"ไทย","tr-TR":"Türkçe","vi-VN":"Tiếng Việt","pl-PL":"Polski"
};
const env=import.meta.env||{};
export const site = {
  name:"Palworld Helper",
  origin:env.VITE_SITE_ORIGIN||"https://palworld-helper.woofy.blog",
  hubUrl:env.VITE_HUB_URL||"https://woofy.blog",
  contactUrl:env.VITE_SUPPORT_URL||"https://github.com/woofygamelog-stack/woofy-community/issues",
  gameVersion:"1.0.0",
  gameBuild:"24467282",
  analyticsId:env.VITE_GA_ID||"G-FF7N186M72",
  analyticsEnabled:env.VITE_ENABLE_ANALYTICS==="true",
  searchConsoleVerification:env.VITE_SEARCH_CONSOLE_VERIFICATION||"vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ",
  adsenseClient:env.VITE_ADSENSE_CLIENT||"ca-pub-1986785092914105",
  adsenseContentSlot:env.VITE_ADSENSE_CONTENT_SLOT||"",
  adsenseEnabled:env.VITE_ENABLE_ADSENSE==="true",
  googleCmp:env.VITE_GOOGLE_CMP||"disabled",
  releaseStage:env.VITE_RELEASE_STAGE||"prelaunch",
  consentTestMode:env.VITE_CONSENT_TEST_MODE==="true"
} as const;
const languageDefaults:Record<string,Locale>={en:"en-US",ja:"ja-JP",fr:"fr-FR",it:"it-IT",de:"de-DE",pt:"pt-BR",ru:"ru-RU",ko:"ko-KR",id:"id-ID",in:"id-ID",th:"th-TH",tr:"tr-TR",vi:"vi-VN",pl:"pl-PL"};
const latinAmericanSpanishRegions=new Set(["419","AR","BO","BR","BZ","CL","CO","CR","CU","DO","EC","GT","HN","MX","NI","PA","PE","PR","PY","SV","US","UY","VE"]);
export function browserLocale(languageTags:readonly string[]):Locale|undefined {
  for(const languageTag of languageTags){
    const normalized=languageTag.trim().replaceAll("_","-");
    if(!normalized)continue;
    const exact=locales.find(candidate=>candidate.toLowerCase()===normalized.toLowerCase());
    if(exact)return exact;
    const [language,...subtags]=normalized.split("-"),base=language.toLowerCase(),upperSubtags=subtags.map(value=>value.toUpperCase());
    if(base==="zh")return subtags.some(value=>value.toLowerCase()==="hant")||upperSubtags.some(value=>["TW","HK","MO"].includes(value))?"zh-TW":"zh-CN";
    if(base==="es")return upperSubtags.some(value=>latinAmericanSpanishRegions.has(value))?"es-419":"es-ES";
    const fallback=languageDefaults[base];if(fallback)return fallback;
  }
}
function storedLocale():Locale|undefined { try { const stored=typeof localStorage==="undefined"?null:localStorage.getItem("pw-locale");return stored&&locales.includes(stored as Locale)?stored as Locale:undefined } catch { return undefined } }
function browserLanguages():readonly string[] { if(typeof navigator==="undefined")return [];return navigator.languages?.length?navigator.languages:navigator.language?[navigator.language]:[] }
export function resolveLocale(pathname:string,languageTags:readonly string[]=browserLanguages()):Locale { const segment=pathname.split("/").filter(Boolean)[0]; if(locales.includes(segment as Locale))return segment as Locale; return storedLocale()||browserLocale(languageTags)||defaultLocale; }
export function localizePath(locale:Locale,route=""):string { return `/${locale}${route.startsWith("/")?route:`/${route}`}`.replace(/\/$/,"")||`/${locale}`; }
