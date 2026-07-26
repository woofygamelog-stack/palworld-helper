import { readFile, writeFile } from "node:fs/promises";

const page=await fetch("https://palworld.gg/ko/map",{headers:{"user-agent":"PalworldHelperResearch/1.0"}}).then(response=>response.text());
const scriptPath=[...page.matchAll(/(?:src|href)="([^"]+\.js[^"]*)/g)].map(match=>match[1]).find(path=>path.includes("Ce88gNM6"))||[...page.matchAll(/(?:src|href)="([^"]+\.js[^"]*)/g)].map(match=>match[1]).find(async path=>(await fetch(new URL(path,"https://palworld.gg")).text()).includes("fastTravel"));
if(!scriptPath)throw new Error("Interactive map data script was not found");
const source=await fetch(new URL(scriptPath,"https://palworld.gg")).then(response=>response.text());
const marker=",w={fastTravel:",end=source.indexOf(marker),start=source.lastIndexOf("O2=",end);
if(start<0||end<0)throw new Error("Fast-travel coordinate array was not found");
const arrayEnd=source.indexOf("],A2=",start);
const coordinates=JSON.parse(source.slice(start+3,arrayEnd+1));
if(!Array.isArray(coordinates)||coordinates.length<100||coordinates.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)))throw new Error("Unexpected fast-travel data");
const target=JSON.parse(await readFile("public/data/map-markers.json","utf8"));
target.fastTravel=coordinates.map(([x,y],index)=>({id:`fast-travel-${index+1}`,category:"fastTravel",x,y}));
target.meta.fastTravelCount=target.fastTravel.length;
target.meta.fastTravelVerification="community map coordinates; count and placement cross-checked against an independent community map during acquisition";
await writeFile("public/data/map-markers.json",JSON.stringify(target));
console.log(`Imported ${target.fastTravel.length} fast-travel markers.`);
