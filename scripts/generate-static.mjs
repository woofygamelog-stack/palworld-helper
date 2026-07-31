import {copyFile,mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {buildIndexableGroups,buildPrerenderEntries,productionOrigin,renderHtmlDocument,renderRouteModel,routeRenderingReport} from "./seo-static.mjs";

const origin=process.env.VITE_SITE_ORIGIN||productionOrigin;
if(origin!==productionOrigin)throw new Error(`Production origin must be ${productionOrigin}`);
const [palData,itemData,skillData,npcData,dungeonData,technologyData,healthData,elementData,structureData,expeditionData,questData,template]=await Promise.all(["pals","items","skills","npcs","dungeons","technology","health","elements","structures","expeditions","quests"].map(name=>readFile(`public/data/${name}.json`,"utf8").then(JSON.parse)).concat(readFile("dist/index.html","utf8")));
if(technologyData.meta.schema!==1||technologyData.meta.gameBuild!=="24467282"||technologyData.meta.verification!=="game-files"||technologyData.meta.technologyCount!==588||technologyData.technologies.length!==588)throw new Error("Technology dataset baseline mismatch");
if(structureData.meta.schema!==1||structureData.meta.gameBuild!=="24467282"||structureData.meta.verification!=="game-files"||structureData.meta.structureCount!==472||structureData.structures.length!==472)throw new Error("Structure dataset baseline mismatch");
if(expeditionData.meta.schema!==1||expeditionData.meta.gameBuild!=="24467282"||expeditionData.meta.verification!=="game-files"||expeditionData.meta.expeditionCount!==18||expeditionData.expeditions.length!==18||expeditionData.meta.rewardSlotCount!==169||expeditionData.meta.rewardRowCount!==279||expeditionData.meta.probabilitiesVerified!==false||expeditionData.meta.durationFormulaVerified!==false)throw new Error("Expedition dataset baseline mismatch");
if(healthData.meta.schema!==2||healthData.meta.gameBuild!=="24467282"||healthData.meta.verification!=="game-files"||healthData.meta.behaviorCount!==7||healthData.meta.conditionCount!==7||healthData.meta.medicineCount!==3||healthData.meta.sourceValuesVerified!==true||healthData.meta.runtimeApplicationVerified!==false)throw new Error("Health dataset baseline mismatch");
if(elementData.meta.schema!==2||elementData.meta.gameBuild!=="24467282"||elementData.meta.verification!=="game-ui-chart-and-game-files"||elementData.meta.elementCount!==9||elementData.meta.relationCount!==9||"chartImage" in elementData)throw new Error("Element dataset baseline mismatch");
if(questData.meta.schema!==1||questData.meta.gameBuild!=="24467282"||questData.meta.verification!=="game-files"||questData.meta.localeCount!==17||questData.meta.questCount!==82||questData.meta.mainCount!==32||questData.meta.sideCount!==50||questData.meta.objectiveStepCount!==74||questData.meta.rewardItemRelationCount!==63||questData.quests.length!==82)throw new Error("Quest dataset baseline mismatch");
const data={palData,itemData,skillData,npcData,dungeonData,technologyData,healthData,elementData,structureData,expeditionData,questData};
const groups=buildIndexableGroups(data,origin),{entries,selected,registry}=buildPrerenderEntries(data);
const assetMoves=[...palData.pals.map(entity=>({from:path.join("dist","assets","pals",`${entity.id}.png`),to:path.join("dist","assets","pals",`${registry.byId.pals.get(entity.id)}.png`)})),...itemData.items.map(entity=>({from:path.join("dist","assets","items",`${entity.id}.webp`),to:path.join("dist","assets","items",`${registry.byId.items.get(entity.id)}.webp`)}))];
for(let start=0;start<assetMoves.length;start+=64)await Promise.all(assetMoves.slice(start,start+64).map(({from,to})=>rename(from,to)));
const builtHealthPath=path.join("dist","data","health.json"),builtHealth=JSON.parse(await readFile(builtHealthPath,"utf8"));
for(const medicine of builtHealth.medicines){const match=medicine.image.match(/^\/assets\/items\/(.+)\.webp$/),slug=match&&registry.byId.items.get(decodeURIComponent(match[1]));if(!slug)throw new Error(`Health medicine image is missing a public slug: ${medicine.slug}`);medicine.image=`/assets/items/${slug}.webp`;for(const ingredient of medicine.recipe.ingredients)if(ingredient.image){const ingredientMatch=ingredient.image.match(/^\/assets\/items\/(.+)\.webp$/),ingredientSlug=ingredientMatch&&registry.byId.items.get(decodeURIComponent(ingredientMatch[1]));if(!ingredientSlug)throw new Error(`Health ingredient image is missing a public slug: ${ingredient.itemId}`);ingredient.image=`/assets/items/${ingredientSlug}.webp`}}
await writeFile(builtHealthPath,JSON.stringify(builtHealth));
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
    const model=renderRouteModel(entry,data,selected,registry),target=entry.route?path.join("dist",entry.locale,...entry.route.split("/").filter(Boolean))+".html":path.join("dist",`${entry.locale}.html`);
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
