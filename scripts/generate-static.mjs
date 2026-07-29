import {copyFile,readFile,writeFile} from "node:fs/promises";
import {collectionRoutes as routes,entityRouteFamilies,supportedLocales as locales} from "../src/route-manifest.ts";

const origin=process.env.VITE_SITE_ORIGIN||"https://palworld-helper.woofy.blog";
const [palData,itemData,skillData,npcData,dungeonData]=await Promise.all(["pals","items","skills","npcs","dungeons"].map(name=>readFile(`public/data/${name}.json`,"utf8").then(JSON.parse)));
const url=(locale,route)=>`${origin}/${locale}${route?`/${route}`:""}`;
const entityDatasets={pals:palData.pals,items:itemData.items,activeSkills:skillData.activeSkills,passiveSkills:skillData.passiveSkills,partnerSkills:skillData.partnerSkills,npcs:npcData.npcs,dungeons:dungeonData.dungeons};
const entityId=(entity)=>entity.slug??entity.id;
const entityRoutes=entityRouteFamilies.flatMap(family=>entityDatasets[family.dataset].map(entity=>`${family.prefix}/${encodeURIComponent(entityId(entity))}`)),indexableRoutes=[...routes,...entityRoutes],urls=locales.flatMap(locale=>indexableRoutes.map(route=>url(locale,route)));
await writeFile("dist/sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(value=>`<url><loc>${value}</loc></url>`).join("")}</urlset>`);
await writeFile("dist/prerender-report.json",JSON.stringify({schema:2,architecture:"shared-spa-document",indexableUrlCount:urls.length,physicalHtmlDocuments:1,routeFamilies:{static:routes.length*locales.length,...Object.fromEntries(entityRouteFamilies.map(family=>[family.dataset,entityDatasets[family.dataset].length*locales.length]))}},null,2));
await writeFile("dist/robots.txt",`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);await writeFile("dist/_headers",`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);await copyFile("public/site.webmanifest","dist/site.webmanifest");
console.log(`Generated ${urls.length} indexable URLs backed by one shared SPA document.`);
