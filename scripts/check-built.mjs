import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),dist=path.join(root,"dist");
const locales=["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"];
const routes=["","map","pals","skills","calculators","calculators/breeding","calculators/crafting","database","server-tools/settings-generator"];
let checked=0;
for(const locale of locales)for(const route of routes){
  const file=path.join(dist,locale,route,"index.html"),html=await readFile(file,"utf8"),where=`${locale}/${route||"home"}`;
  if(!html.includes(`<html lang="${locale}"`))throw new Error(`${where}: incorrect html lang`);
  if((html.match(/<h1[ >]/g)||[]).length!==1)throw new Error(`${where}: expected exactly one static h1`);
  if(!/<title>[^<]+ · Palworld Helper<\/title>/.test(html))throw new Error(`${where}: localized title missing`);
  if(!/<meta data-dynamic-meta="true" name="description" content="[^"]+">/.test(html))throw new Error(`${where}: localized description missing`);
  if(!html.includes('name="google-site-verification" content="vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ"'))throw new Error(`${where}: Search Console verification missing`);
  if(!html.includes('name="google-adsense-account" content="ca-pub-1986785092914105"'))throw new Error(`${where}: AdSense account metadata missing`);
  if((html.match(/hreflang=/g)||[]).length!==locales.length+1)throw new Error(`${where}: hreflang count mismatch`);
  if(!html.includes(`hreflang="x-default" href="https://palworld-helper.woofy.blog/en-US${route?`/${route}`:""}"`))throw new Error(`${where}: x-default mismatch`);
  if(/palworld-helper\.example|24181527|Data version|Game build/.test(html))throw new Error(`${where}: placeholder domain or public version information found`);
  if(/Loading…|\bundefined\b|\[object Object\]/.test(html))throw new Error(`${where}: unresolved UI value found`);
  checked++;
}
const index=await readFile(path.join(dist,"index.html"),"utf8");
if(!index.includes('url=/en-US'))throw new Error("Root redirect must target en-US");
if(!index.includes('name="google-site-verification" content="vcYPQJf0I03LumjZIODPdq47ZnYMCRvD2ABcBFyBImQ"'))throw new Error("Root Search Console verification missing");
const sitemap=await readFile(path.join(dist,"sitemap.xml"),"utf8");
if(/palworld-helper\.example/.test(sitemap))throw new Error("Placeholder domain must not appear in sitemap");
if((sitemap.match(/<url>/g)||[]).length!==locales.length*routes.length)throw new Error("Sitemap URL count must match implemented localized routes");
if(/\/guides|\/privacy|\/calculators\/(capture|iv)/.test(sitemap))throw new Error("Placeholder routes must not appear in the sitemap");
for(const asset of ["data/pals.json","data/items.json","data/skills.json","assets/world-map.webp","assets/elements/Fire.png","assets/passive-ranks/3.png","favicon.svg","site.webmanifest","sitemap.xml","robots.txt","ads.txt","_headers"])await access(path.join(dist,asset));
const adsTxt=await readFile(path.join(dist,"ads.txt"),"utf8");
if(adsTxt.trim()!=="google.com, pub-1986785092914105, DIRECT, f08c47fec0942fa0")throw new Error("ads.txt must contain the exact owner-authorized AdSense account entry");
console.log(`Validated ${checked} localized HTML pages, root redirect, SEO metadata and required static assets.`);
