import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { messages } from "../src/i18n.ts";

const locales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
// Emit only routes with working, verified user-facing functionality.
const routes = ["","map","pals","calculators","calculators/breeding","calculators/crafting","database","server-tools/settings-generator"];
const origin = process.env.VITE_SITE_ORIGIN || "https://palworld-helper.example";
const source = await readFile("dist/index.html", "utf8");
const escapeHtml=value=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const routeMeta=(route,m)=>{
  if(route==="")return {title:m.hero,description:m.tagline};
  if(route==="map")return {title:m.mapTitle,description:m.mapBody};
  if(route==="pals")return {title:m.palDex,description:m.palDexBody};
  if(route==="calculators/breeding"||route==="calculators")return {title:m.breeding,description:m.breedingBody};
  if(route==="calculators/crafting")return {title:m.crafting,description:m.craftingBody};
  if(route==="database")return {title:m.itemDatabase,description:m.itemDatabaseBody};
  if(route==="server-tools/settings-generator")return {title:m.serverTitle,description:m.coming};
  return {title:m.calculators,description:m.coming};
};
for (const locale of locales) {
  for (const route of routes) {
    const destination = join("dist", locale, route, "index.html");
    await mkdir(dirname(destination), {recursive:true});
    const canonical = `${origin}/${locale}${route ? `/${route}` : ""}`;
    const alternates = locales.map(l=>`<link data-dynamic-meta="true" rel="alternate" hreflang="${l}" href="${origin}/${l}${route ? `/${route}` : ""}">`).join("");
    const m=messages(locale),meta=routeMeta(route,m),fullTitle=`${meta.title} · Palworld Helper`,safeTitle=escapeHtml(fullTitle),safeDescription=escapeHtml(meta.description);
    const html = source.replace('<html lang="en-US"', `<html lang="${locale}"`).replace(/<title>.*?<\/title>/,`<title>${safeTitle}</title><meta data-dynamic-meta="true" name="description" content="${safeDescription}"><meta data-dynamic-meta="true" property="og:title" content="${safeTitle}"><meta data-dynamic-meta="true" property="og:description" content="${safeDescription}"><meta data-dynamic-meta="true" property="og:url" content="${canonical}">`).replace('<div id="app"></div>',`<div id="app"><a class="skip-link" href="#main">${escapeHtml(m.skip)}</a><main id="main"><section class="page-hero"><h1>${escapeHtml(meta.title)}</h1><p>${safeDescription}</p></section></main></div>`).replace("</head>", `<link data-dynamic-meta="true" rel="canonical" href="${canonical}">${alternates}<link data-dynamic-meta="true" rel="alternate" hreflang="x-default" href="${origin}/en-US${route ? `/${route}` : ""}"></head>`);
    await writeFile(destination, html);
  }
}
await writeFile("dist/index.html", `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="google-site-verification" content="vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ"><meta name="google-adsense-account" content="ca-pub-1986785092914105"><meta http-equiv="refresh" content="0; url=/en-US"><link rel="canonical" href="${origin}/en-US"><title>Palworld Helper</title></head><body><a href="/en-US">Continue to Palworld Helper</a></body></html>`);
const urls = locales.flatMap(locale=>routes.map(route=>`${origin}/${locale}${route ? `/${route}` : ""}`));
await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join("")}</urlset>`);
await writeFile("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile("dist/_headers", `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
await copyFile("public/site.webmanifest", "dist/site.webmanifest");
console.log(`Generated ${urls.length} localized static routes.`);
