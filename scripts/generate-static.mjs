import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {buildIndexableGroups,buildPrerenderEntries,productionOrigin,renderHtmlDocument,renderRouteModel,routeRenderingReport} from "./seo-static.mjs";

const origin=process.env.VITE_SITE_ORIGIN||productionOrigin;
if(origin!==productionOrigin)throw new Error(`Production origin must be ${productionOrigin}`);
const [palData,itemData,skillData,npcData,dungeonData,technologyData,healthData,elementData,structureData,template]=await Promise.all(["pals","items","skills","npcs","dungeons","technology","health","elements","structures"].map(name=>readFile(`public/data/${name}.json`,"utf8").then(JSON.parse)).concat(readFile("dist/index.html","utf8")));
if(technologyData.meta.schema!==1||technologyData.meta.gameBuild!=="24181527"||technologyData.meta.verification!=="game-files"||technologyData.meta.technologyCount!==588||technologyData.technologies.length!==588)throw new Error("Technology dataset baseline mismatch");
if(structureData.meta.schema!==1||structureData.meta.gameBuild!=="24181527"||structureData.meta.verification!=="game-files"||structureData.meta.structureCount!==472||structureData.structures.length!==472)throw new Error("Structure dataset baseline mismatch");
const data={palData,itemData,skillData,npcData,dungeonData,technologyData,healthData,elementData,structureData};
const groups=buildIndexableGroups(data,origin),{entries,selected}=buildPrerenderEntries(data);
const xml=value=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const sitemapDirectory=path.join("dist","sitemaps");
await mkdir(sitemapDirectory,{recursive:true});
for(const [name,urls] of Object.entries(groups)){
  if(urls.length>50_000)throw new Error(`${name} sitemap exceeds 50,000 URLs`);
  const content=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(value=>`<url><loc>${xml(value)}</loc></url>`).join("")}</urlset>`;
  if(Buffer.byteLength(content)>50*1024*1024)throw new Error(`${name} sitemap exceeds 50 MB`);
  await writeFile(path.join(sitemapDirectory,`${name}.xml`),content);
}
const sitemapIndex=`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(groups).map(name=>`<sitemap><loc>${origin}/sitemaps/${name}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
await writeFile("dist/sitemap.xml",sitemapIndex);

for(let start=0;start<entries.length;start+=64){
  await Promise.all(entries.slice(start,start+64).map(async entry=>{
    const model=renderRouteModel(entry,data,selected),target=entry.route?path.join("dist",entry.locale,...entry.route.split("/").filter(Boolean))+".html":path.join("dist",`${entry.locale}.html`);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,renderHtmlDocument(template,entry,model,origin));
  }));
}

const indexableUrlCount=Object.values(groups).reduce((sum,urls)=>sum+urls.length,0),physicalHtmlDocuments=entries.length+1,rendering=routeRenderingReport(data,selected);
await writeFile("dist/prerender-report.json",JSON.stringify({schema:3,architecture:"hybrid-prerender-plus-spa",indexableUrlCount,physicalHtmlDocuments,initialHtmlSeoCoverage:entries.length,sitemapFiles:Object.fromEntries(Object.entries(groups).map(([name,urls])=>[name,urls.length])),routeFamilies:rendering},null,2));
await writeFile("dist/robots.txt",`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile("dist/_headers",`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
await copyFile("public/site.webmanifest","dist/site.webmanifest");
console.log(`Generated ${indexableUrlCount} indexable URLs, ${entries.length} prerendered routes and ${Object.keys(groups).length} child sitemaps.`);
