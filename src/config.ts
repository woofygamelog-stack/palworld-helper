export const locales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en-US";
export const localeLabels: Record<Locale,string> = {
  "en-US":"English","zh-CN":"简体中文","zh-TW":"繁體中文","ja-JP":"日本語","fr-FR":"Français","it-IT":"Italiano","de-DE":"Deutsch","es-ES":"Español (España)","pt-BR":"Português (Brasil)","ru-RU":"Русский","ko-KR":"한국어","id-ID":"Bahasa Indonesia","es-419":"Español (Latinoamérica)","th-TH":"ไทย","tr-TR":"Türkçe","vi-VN":"Tiếng Việt","pl-PL":"Polski"
};
const env=import.meta.env||{};
export const site = { name:"Palworld Helper", origin:env.VITE_SITE_ORIGIN||"https://palworld-helper.example", gameVersion:"1.0.0", gameBuild:"24181527", supportUrl:env.VITE_SUPPORT_URL||"mailto:support@example.invalid",analyticsId:env.VITE_GA_ID||"G-FF7N186M72",searchConsoleVerification:env.VITE_SEARCH_CONSOLE_VERIFICATION||"vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ",adsenseClient:env.VITE_ADSENSE_CLIENT||"ca-pub-1986785092914105",adsenseContentSlot:env.VITE_ADSENSE_CONTENT_SLOT||"" } as const;
export function resolveLocale(pathname:string):Locale { const segment=pathname.split("/").filter(Boolean)[0]; if(locales.includes(segment as Locale))return segment as Locale; const stored=localStorage.getItem("pw-locale"); return stored&&locales.includes(stored as Locale)?stored as Locale:defaultLocale; }
export function localizePath(locale:Locale,route=""):string { return `/${locale}${route.startsWith("/")?route:`/${route}`}`.replace(/\/$/,"")||`/${locale}`; }
