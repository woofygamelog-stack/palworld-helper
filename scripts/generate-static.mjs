import { readFile, writeFile, copyFile } from "node:fs/promises";

const locales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
const routes = ["","map","pals","skills","calculators","calculators/breeding","calculators/crafting","database","server-tools/settings-generator"];
const origin = process.env.VITE_SITE_ORIGIN || "https://palworld-helper.woofy.blog";
const [palData,itemData,skillData]=await Promise.all([readFile("public/data/pals.json","utf8").then(JSON.parse),readFile("public/data/items.json","utf8").then(JSON.parse),readFile("public/data/skills.json","utf8").then(JSON.parse)]);
const entityRoutes=[...palData.pals.map(pal=>`pals/${encodeURIComponent(pal.id)}`),...itemData.items.map(item=>`items/${encodeURIComponent(item.id)}`),...skillData.activeSkills.map(skill=>`skills/active/${encodeURIComponent(skill.id)}`),...skillData.passiveSkills.map(skill=>`skills/passive/${encodeURIComponent(skill.id)}`)];
const indexableRoutes=[...routes,...entityRoutes];
const urls = locales.flatMap(locale=>indexableRoutes.map(route=>`${origin}/${locale}${route ? `/${route}` : ""}`));
await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join("")}</urlset>`);
await writeFile("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile("dist/_headers", `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
await copyFile("public/site.webmanifest", "dist/site.webmanifest");
console.log(`Generated ${urls.length} indexable URLs from one SPA document.`);
