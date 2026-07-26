import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source=path.resolve("public/assets/world-map.webp");
const target=path.resolve("public/assets/map-tiles");
const size=8192,tileSize=2048,columns=size/tileSize;
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
for(let y=0;y<columns;y++) for(let x=0;x<columns;x++) await sharp(source)
  .extract({left:x*tileSize,top:y*tileSize,width:tileSize,height:tileSize})
  .webp({quality:82,effort:5})
  .toFile(path.join(target,`${x}-${y}.webp`));
console.log(`Generated ${columns*columns} map tiles at ${tileSize}px.`);
