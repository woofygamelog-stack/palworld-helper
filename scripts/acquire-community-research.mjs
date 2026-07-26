import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sources=[
  {id:"palworld-gg-map",url:"https://palworld.gg/ko/map",purpose:"map category and count discrepancy research"},
  {id:"paldb-map",url:"https://paldb.cc/ko/Map",purpose:"map layer and feature research"},
  {id:"paldb-partner",url:"https://paldb.cc/ko/Partner_Skill",purpose:"partner skill completeness comparison"},
];
const collected=[];
for(const source of sources){
  const response=await fetch(source.url,{headers:{"user-agent":"PalworldHelperResearch/1.0"}});
  if(!response.ok)throw new Error(`${source.id}: HTTP ${response.status}`);
  const html=await response.text();
  const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
  const counts=Object.fromEntries([...text.matchAll(/(고속 이동|세력 탑|알파 (?:팔|팰)|던전|파트너 스킬)\s*(\d{1,4})/g)].map(match=>[match[1],Number(match[2])]));
  collected.push({...source,retrievedAt:new Date().toISOString(),contentLength:html.length,counts,verification:"research-only; publish only after installed-game or official-source cross-check"});
}
const target=path.resolve("private/research");
await mkdir(target,{recursive:true});
await writeFile(path.join(target,"community-sources.json"),JSON.stringify({schema:1,sources:collected},null,2));
console.log(`Recorded ${collected.length} private research sources without publishing copied page content.`);
