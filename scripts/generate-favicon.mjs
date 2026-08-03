import {writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=path.join(root,"public","favicon.svg");
const destination=path.join(root,"public","favicon.ico");
const sizes=[16,32,48,64];
const images=await Promise.all(sizes.map(size=>sharp(source).resize(size,size).png().toBuffer()));
const directory=Buffer.alloc(6+images.length*16);

directory.writeUInt16LE(0,0);
directory.writeUInt16LE(1,2);
directory.writeUInt16LE(images.length,4);

let offset=directory.length;
for(const [index,image] of images.entries()){
  const entry=6+index*16,size=sizes[index];
  directory.writeUInt8(size===256?0:size,entry);
  directory.writeUInt8(size===256?0:size,entry+1);
  directory.writeUInt8(0,entry+2);
  directory.writeUInt8(0,entry+3);
  directory.writeUInt16LE(1,entry+4);
  directory.writeUInt16LE(32,entry+6);
  directory.writeUInt32LE(image.length,entry+8);
  directory.writeUInt32LE(offset,entry+12);
  offset+=image.length;
}

await writeFile(destination,Buffer.concat([directory,...images]));
console.log(`Generated ${path.relative(root,destination)} with ${sizes.join(", ")}px variants.`);
