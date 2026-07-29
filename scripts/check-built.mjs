import {access,readFile,readdir,stat} from "node:fs/promises";
import path from "node:path";
import {deploymentFileBudget,supportedLocales as locales} from "../src/route-manifest.ts";
import {buildIndexableGroups,buildPrerenderEntries,productionOrigin} from "./seo-static.mjs";

const root=process.cwd(),dist=path.join(root,"dist"),readJson=file=>readFile(file,"utf8").then(JSON.parse);
const [palData,itemData,skillData,npcData,dungeonData,technologyData,index,sitemapIndex,report,wrangler]=await Promise.all([
  readJson("public/data/pals.json"),readJson("public/data/items.json"),readJson("public/data/skills.json"),readJson("public/data/npcs.json"),readJson("public/data/dungeons.json"),readJson("public/data/technology.json"),
  readFile(path.join(dist,"index.html"),"utf8"),readFile(path.join(dist,"sitemap.xml"),"utf8"),readJson(path.join(dist,"prerender-report.json")),readJson("wrangler.jsonc")
]);
const data={palData,itemData,skillData,npcData,dungeonData,technologyData},groups=buildIndexableGroups(data,productionOrigin),{entries,selected}=buildPrerenderEntries(data);
const expectedUrls=Object.values(groups).reduce((sum,urls)=>sum+urls.length,0),expectedHtmlDocuments=entries.length+1;

for(const declaration of ['name="google-site-verification" content="vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ"','name="google-adsense-account" content="ca-pub-1986785092914105"'])if(!index.includes(declaration))throw new Error(`Root document is missing ${declaration}`);
if(/palworld-helper\.example|24181527|Data version|Game build/.test(index))throw new Error("Root document exposes a placeholder domain or public build information");
if(wrangler.name!=="palworld-helper"||wrangler.assets?.directory!=="./dist"||wrangler.assets?.not_found_handling!=="single-page-application"||wrangler.assets?.html_handling!=="drop-trailing-slash")throw new Error("Cloudflare Assets must preserve the configured no-slash hybrid SPA routing");
if(wrangler.workers_dev!==false||wrangler.preview_urls!==false||"main" in wrangler)throw new Error("Cloudflare public development hostnames must be disabled and no Worker runtime may be configured");

const allFiles=[],htmlFiles=[];
async function collect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const target=path.join(directory,entry.name);if(entry.isDirectory())await collect(target);else{allFiles.push(target);if(entry.name.endsWith(".html"))htmlFiles.push(target)}}}
await collect(dist);
const normalized=file=>path.relative(dist,file).replaceAll("\\","/"),htmlSet=new Set(htmlFiles.map(normalized));
const expectedHtmlSet=new Set(["index.html",...entries.map(entry=>entry.route?`${entry.locale}/${entry.route}.html`:`${entry.locale}.html`)]);
if(htmlSet.size!==expectedHtmlSet.size||[...expectedHtmlSet].some(file=>!htmlSet.has(file)))throw new Error(`Built HTML routes drifted: expected ${expectedHtmlSet.size}, found ${htmlSet.size}`);
if(allFiles.length>deploymentFileBudget.hardLimit-deploymentFileBudget.reservedHeadroom)throw new Error(`Deployment contains ${allFiles.length} files and violates the ${deploymentFileBudget.reservedHeadroom}-file growth reserve`);

const sitemapNames=Object.keys(groups),sitemapLocs=[...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
if(!sitemapIndex.includes("<sitemapindex")||sitemapIndex.includes("<url>"))throw new Error("The root sitemap must be a sitemap index");
if(sitemapLocs.length!==sitemapNames.length||sitemapNames.some(name=>!sitemapLocs.includes(`${productionOrigin}/sitemaps/${name}.xml`)))throw new Error("Sitemap index does not exactly reference every route-family sitemap");
for(const [name,expected] of Object.entries(groups)){
  const target=path.join(dist,"sitemaps",`${name}.xml`),xml=await readFile(target,"utf8"),actual=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]),size=(await stat(target)).size;
  if(!xml.includes("<urlset")||actual.length!==expected.length||actual.length>50_000||size>50*1024*1024)throw new Error(`${name} sitemap violates count or size limits`);
  const actualSet=new Set(actual);if(actualSet.size!==expected.length||expected.some(url=>!actualSet.has(url)))throw new Error(`${name} sitemap URLs drifted from the typed route manifest`);
  if(/\/guides|\/privacy|\/calculators\/(capture|iv)|palworld-helper\.example/.test(xml))throw new Error(`${name} sitemap contains an unimplemented route or placeholder origin`);
}
if(report.schema!==3||report.architecture!=="hybrid-prerender-plus-spa"||report.indexableUrlCount!==expectedUrls||report.physicalHtmlDocuments!==expectedHtmlDocuments||report.initialHtmlSeoCoverage!==entries.length)throw new Error("Hybrid rendering report does not match the typed route manifest");
for(const [name,urls] of Object.entries(groups))if(report.sitemapFiles?.[name]!==urls.length)throw new Error(`${name} report count does not match its sitemap`);
if(report.routeFamilies?.entities?.find(family=>family.dataset==="items")?.prerenderedUrls!==selected.items.length*locales.length)throw new Error("Priority item prerender count is not deterministic");
if(report.routeFamilies?.entities?.find(family=>family.dataset==="technologies")?.prerenderedUrls!==20*locales.length)throw new Error("Priority technology prerender count is not deterministic");

const representativeEntries=[
  entries.find(entry=>entry.locale==="en-US"&&entry.kind==="collection"&&entry.route===""),
  entries.find(entry=>entry.locale==="ko-KR"&&entry.kind==="collection"&&entry.route==="database/dungeons"),
  entries.find(entry=>entry.locale==="en-US"&&entry.dataset==="pals"),entries.find(entry=>entry.locale==="en-US"&&entry.dataset==="items"),
  entries.find(entry=>entry.locale==="en-US"&&entry.dataset==="activeSkills"),entries.find(entry=>entry.locale==="en-US"&&entry.dataset==="passiveSkills"),entries.find(entry=>entry.locale==="en-US"&&entry.dataset==="partnerSkills"),
  entries.find(entry=>entry.locale==="en-US"&&entry.dataset==="npcs"),entries.find(entry=>entry.locale==="ko-KR"&&entry.dataset==="dungeons")
  ,entries.find(entry=>entry.locale==="en-US"&&entry.kind==="collection"&&entry.route==="database/technology"),entries.find(entry=>entry.locale==="ko-KR"&&entry.dataset==="technologies")
];
if(representativeEntries.some(entry=>!entry))throw new Error("Representative prerender routes are missing");
const representativeTitles=new Set();
for(const entry of representativeEntries){
  const file=entry.route?path.join(dist,entry.locale,...entry.route.split("/").filter(Boolean))+".html":path.join(dist,`${entry.locale}.html`),html=await readFile(file,"utf8"),canonical=`${productionOrigin}/${entry.locale}${entry.route?`/${entry.route}`:""}`,title=html.match(/<title>([^<]+)<\/title>/)?.[1];
  if(!title||!html.includes(`<html lang="${entry.locale}"`)||!html.includes(`rel="canonical" href="${canonical}"`)||!html.includes(`hreflang="x-default" href="${productionOrigin}/en-US${entry.route?`/${entry.route}`:""}`))throw new Error(`${normalized(file)} has incomplete localized canonical metadata`);
  for(const locale of locales)if(!html.includes(`hreflang="${locale}" href="${productionOrigin}/${locale}${entry.route?`/${entry.route}`:""}`))throw new Error(`${normalized(file)} is missing the ${locale} alternate`);
  for(const required of ['name="description"','property="og:title"','property="og:description"','property="og:url"','property="og:image"','name="twitter:card"','name="twitter:title"','name="twitter:description"','name="twitter:image"','data-prerender-content'])if(!html.includes(required))throw new Error(`${normalized(file)} is missing ${required}`);
  if((html.match(/<h1(?:\s[^>]*)?>/g)||[]).length!==1||html.length<2_000)throw new Error(`${normalized(file)} does not contain substantial initial HTML with exactly one h1`);
  if(/palworld-helper\.example|24181527|Data version|Game build|[A-Z]:\\|file:\/\//.test(html))throw new Error(`${normalized(file)} exposes private, placeholder, or build-version text`);
  if(entry.dataset&&["npcs","dungeons","technologies"].includes(entry.dataset)){if(!html.includes('"@type":"BreadcrumbList"')||!html.includes('"@type":"WebPage"'))throw new Error(`${normalized(file)} needs safe detail structured data`)}
  else if(entry.dataset&&html.includes("data-route-structured-data"))throw new Error(`${normalized(file)} must not add unsupported structured data to raw-ID detail routes`);
  representativeTitles.add(`${entry.locale}:${title}`);
}
if(representativeTitles.size!==representativeEntries.length)throw new Error("Representative prerender pages must have unique localized titles");

for(const asset of ["data/pals.json","data/items.json","data/skills.json","data/npcs.json","data/dungeons.json","data/technology.json","assets/image-manifest.json","assets/world-map.webp","assets/elements/Fire.png","assets/passive-ranks/3.png","assets/map-icons/dungeon.webp","assets/technology/primitive-workbench.webp","favicon.svg","favicon-32.png","apple-touch-icon.png","icon-192.png","icon-512.png","og-image.png","site.webmanifest","sitemap.xml","prerender-report.json","robots.txt","ads.txt","_headers"])await access(path.join(dist,asset));
for(let y=0;y<4;y++)for(let x=0;x<4;x++)await access(path.join(dist,"assets","map-tiles",`${x}-${y}.webp`));
const robots=await readFile(path.join(dist,"robots.txt"),"utf8");if(!robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`))throw new Error("robots.txt must reference the production sitemap index");
if(allFiles.some(file=>normalized(file)==="_worker.js"||normalized(file).endsWith("/_worker.js")))throw new Error("Static output must not contain a Worker entrypoint");
try{const redirects=await readFile(path.join(dist,"_redirects"),"utf8");if(/^\/\*\s+\/index\.html\s+200\s*$/m.test(redirects))throw new Error("SPA asset fallback must not be combined with a catch-all redirect")}catch(error){if(error.code!=="ENOENT")throw error}

const builtItems=await readJson(path.join(dist,"data","items.json")),builtDungeons=await readJson(path.join(dist,"data","dungeons.json")),builtTechnology=await readJson(path.join(dist,"data","technology.json"));
if(builtTechnology.meta.schema!==1||builtTechnology.meta.gameBuild!==palData.meta.gameBuild||builtTechnology.meta.verification!=="game-files"||builtTechnology.meta.localeCount!==locales.length||builtTechnology.meta.technologyCount!==588||builtTechnology.meta.regularCount!==537||builtTechnology.meta.ancientCount!==51||builtTechnology.meta.prerequisiteCount!==17||builtTechnology.meta.towerBossCount!==17||builtTechnology.meta.researchCount!==10||builtTechnology.meta.levelMin!==1||builtTechnology.meta.levelMax!==80||builtTechnology.meta.imageProvenance.missing!==0)throw new Error("Built technology baseline or verification metadata drifted");
const technologySlugs=new Set(builtTechnology.technologies.map(technology=>technology.slug)),builtTechnologyText=JSON.stringify(builtTechnology);
if(technologySlugs.size!==588||builtTechnology.technologies.some(technology=>technology.image!==true||Object.keys(technology.names).length!==locales.length||Object.keys(technology.descriptions).length!==locales.length||Object.values(technology.descriptions).some(value=>!String(value).trim()||/<[^>]+>|\|/.test(value))||technology.prerequisite&&!technologySlugs.has(technology.prerequisite.slug)||technology.dependents.some(relation=>!technologySlugs.has(relation.slug))))throw new Error("Built technology entities failed localization, relation, description, or image validation");
if(/EPal|NAME_RECIPE_|[A-Z]:\\|file:\/\//.test(builtTechnologyText))throw new Error("Built technology data exposes raw identifiers or local provenance");
const builtTechnologyImages=(await readdir(path.join(dist,"assets","technology"))).filter(name=>name.endsWith(".webp"));
if(builtTechnologyImages.length!==588)throw new Error(`Built technology image file mismatch: ${builtTechnologyImages.length}/588`);
for(const technology of builtTechnology.technologies)await access(path.join(dist,"assets","technology",`${technology.slug}.webp`));
if(builtDungeons.meta.schema!==3||builtDungeons.meta.probabilitiesVerified!==false||builtDungeons.meta.resourcesVerified!==false||builtDungeons.meta.rewardSourcesVerified!==true||builtDungeons.meta.rewardContentsVerified!==false)throw new Error("Built dungeon verification boundaries do not match schema 3");
const builtDungeonText=JSON.stringify(builtDungeons);
if(/"(?:items|rewardKinds|rewardTypes|resourceStatus|rewardContentsStatus|materialItemCount|LotteryValue|FieldLotteryName|classPath)"\s*:/.test(builtDungeonText))throw new Error("Built dungeon data contains a legacy, private-source, or inferred field");
if(builtDungeons.meta.rewardSourceCount!==builtDungeons.dungeons.reduce((sum,dungeon)=>sum+dungeon.rewardSources.length,0)||builtDungeons.meta.rewardItemCandidateCount!==builtDungeons.dungeons.reduce((sum,dungeon)=>sum+dungeon.summary.rewardItemCandidateCount,0))throw new Error("Built dungeon reward summaries drifted from the entity data");
if(builtDungeons.dungeons.some(dungeon=>dungeon.kind==="fixed"&&(dungeon.probabilityStatus!=="not-applicable"||dungeon.itemPools.length||dungeon.resources.length||dungeon.rewardSources.length||dungeon.coverage.resources!=="not-applicable"||dungeon.coverage.itemPools!=="not-applicable"||dungeon.coverage.rewardSources!=="not-applicable"||dungeon.coverage.rewardContents!=="not-applicable")))throw new Error("Built fixed dungeon data exposes inapplicable loot or probability information");
if(builtDungeons.dungeons.some(dungeon=>dungeon.kind==="rotating"&&(dungeon.resources.length||dungeon.coverage.resources!=="unverified"||dungeon.coverage.itemPools!=="verified"||dungeon.coverage.rewardSources!=="verified"||dungeon.coverage.rewardContents!=="partial"||!dungeon.itemPools.length||!dungeon.rewardSources.length)))throw new Error("Built rotating dungeon coverage states do not match the verified extraction boundary");
for(const dungeon of builtDungeons.dungeons)for(const source of dungeon.rewardSources){if(!source.id||!source.kind||!Array.isArray(source.pickups)||!Array.isArray(source.itemPools))throw new Error(`${dungeon.slug} has an invalid reward source`);for(const pickup of source.pickups)if(Object.keys(pickup.names).length!==locales.length)throw new Error(`${dungeon.slug} reward pickup ${pickup.id} lacks locale coverage`)}
const builtImageManifest=await readJson(path.join(dist,"assets","image-manifest.json")),imagedItems=builtItems.items.filter(item=>item.image===true),missingItemImages=builtItems.items.length-imagedItems.length;
if(builtImageManifest.gameBuild!==builtItems.meta.gameBuild||builtImageManifest.itemCount!==imagedItems.length||builtImageManifest.expectedItemCount!==builtItems.items.length||builtImageManifest.missingItemCount!==0||builtImageManifest.directItemCount+builtImageManifest.derivedOfficialItemCount!==builtItems.items.length||missingItemImages)throw new Error(`Built item image coverage is incomplete: ${imagedItems.length}/${builtItems.items.length}`);
const builtItemImages=(await readdir(path.join(dist,"assets","items"))).filter(name=>name.endsWith(".webp"));if(builtItemImages.length!==imagedItems.length)throw new Error(`Built item image file mismatch: files=${builtItemImages.length}, flags=${imagedItems.length}`);
for(const item of imagedItems)await access(path.join(dist,"assets","items",`${item.id}.webp`));
for(const work of palData.workSuitabilities)await access(path.join(dist,work.icon.replace(/^\//,"")));
if(palData.meta.palPortraitCount!==palData.pals.length||palData.pals.some(pal=>pal.image!==true))throw new Error("Every published Pal must retain its portrait manifest state");
for(const pal of palData.pals)await access(path.join(dist,"assets","pals",`${pal.id}.png`));
for(const pal of palData.pals)for(const description of Object.values(pal.descriptions))if(/<[^>]+>|Error_Code:|\||（か）|？（を）|後（と）/.test(description))throw new Error(`${pal.id} exposes unresolved game-runtime description markup`);
const adsTxt=await readFile(path.join(dist,"ads.txt"),"utf8");if(adsTxt.trim()!=="google.com, pub-1986785092914105, DIRECT, f08c47fec0942fa0")throw new Error("ads.txt must contain the exact authorized account entry");
console.log(`Validated ${expectedUrls} indexable URLs, ${expectedHtmlDocuments} HTML documents, ${entries.length} initial-HTML routes, ${sitemapNames.length} child sitemaps, and ${allFiles.length} deployed files.`);
