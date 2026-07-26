import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),dist=path.join(root,"dist");
const locales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
const routes=["","map","pals","skills","calculators","calculators/breeding","calculators/crafting","database","server-tools/settings-generator"];
const [palData,itemData,index,sitemap,wrangler]=await Promise.all([
  readFile("public/data/pals.json","utf8").then(JSON.parse),
  readFile("public/data/items.json","utf8").then(JSON.parse),
  readFile(path.join(dist,"index.html"),"utf8"),
  readFile(path.join(dist,"sitemap.xml"),"utf8"),
  readFile("wrangler.jsonc","utf8").then(value=>JSON.parse(value.replace(/^\s*\/\/.*$/gm,"")))
]);
if(!index.includes('name="google-site-verification" content="vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ"'))throw new Error("SPA document is missing Search Console verification");
if(!index.includes('name="google-adsense-account" content="ca-pub-1986785092914105"'))throw new Error("SPA document is missing AdSense metadata");
if(/palworld-helper\.example|24181527|Data version|Game build/.test(index))throw new Error("SPA document exposes a placeholder domain or public build information");
if(wrangler.assets?.directory!=="./dist"||wrangler.assets?.not_found_handling!=="single-page-application")throw new Error("Cloudflare Assets must route deep links through the single SPA document");
const htmlFiles=[];
async function collectHtml(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const target=path.join(directory,entry.name);if(entry.isDirectory())await collectHtml(target);else if(entry.name.endsWith(".html"))htmlFiles.push(target)}}
await collectHtml(dist);
if(htmlFiles.length!==1||path.basename(htmlFiles[0])!=="index.html")throw new Error(`Expected one shared SPA HTML document, found ${htmlFiles.length}`);
if(/palworld-helper\.example/.test(sitemap))throw new Error("Placeholder domain must not appear in sitemap");
const expectedPerLocale=routes.length+palData.pals.length+itemData.items.length,expectedUrls=locales.length*expectedPerLocale;
if((sitemap.match(/<url>/g)||[]).length!==expectedUrls)throw new Error(`Sitemap must contain ${expectedUrls} collection and entity URLs`);
for(const locale of locales){
  if(!sitemap.includes(`<loc>https://palworld-helper.woofy.blog/${locale}/pals/${encodeURIComponent(palData.pals[0].id)}</loc>`))throw new Error(`${locale}: Pal detail URL missing from sitemap`);
  if(!sitemap.includes(`<loc>https://palworld-helper.woofy.blog/${locale}/items/${encodeURIComponent(itemData.items[0].id)}</loc>`))throw new Error(`${locale}: item detail URL missing from sitemap`);
}
if(/\/guides|\/privacy|\/calculators\/(capture|iv)/.test(sitemap))throw new Error("Placeholder routes must not appear in sitemap");
for(const asset of ["data/pals.json","data/items.json","data/skills.json","assets/world-map.webp","assets/elements/Fire.png","assets/passive-ranks/3.png","favicon.svg","site.webmanifest","sitemap.xml","robots.txt","ads.txt","_headers"])await access(path.join(dist,asset));
const adsTxt=await readFile(path.join(dist,"ads.txt"),"utf8");
if(adsTxt.trim()!=="google.com, pub-1986785092914105, DIRECT, f08c47fec0942fa0")throw new Error("ads.txt must contain the exact owner-authorized AdSense account entry");
console.log(`Validated one SPA HTML document and ${expectedUrls} localized collection/detail URLs.`);
