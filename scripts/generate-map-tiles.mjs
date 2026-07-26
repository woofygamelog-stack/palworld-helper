import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const size=8192,tileSize=2048,columns=size/tileSize;
for(const map of [{source:"world-map.webp",target:"map-tiles"},{source:"tree-map.webp",target:"tree-map-tiles"}]){
  const source=path.resolve("public/assets",map.source),target=path.resolve("public/assets",map.target);
  await rm(target,{recursive:true,force:true});
  await mkdir(target,{recursive:true});
  for(let y=0;y<columns;y++) for(let x=0;x<columns;x++) await sharp(source)
    .extract({left:x*tileSize,top:y*tileSize,width:tileSize,height:tileSize})
    .webp({quality:82,effort:5})
    .toFile(path.join(target,`${x}-${y}.webp`));
}
console.log(`Generated ${columns*columns*2} map tiles at ${tileSize}px.`);
