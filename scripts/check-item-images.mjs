import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root=process.cwd();
const data=JSON.parse(await readFile(path.join(root,"public","data","items.json"),"utf8"));
const manifest=JSON.parse(await readFile(path.join(root,"public","assets","image-manifest.json"),"utf8"));
const directory=path.join(root,"public","assets","items");
const expected=new Set(data.items.map(item=>`${item.id}.webp`));
const actual=(await readdir(directory)).filter(name=>name.endsWith(".webp"));
const missing=[...expected].filter(name=>!actual.includes(name));
const unexpected=actual.filter(name=>!expected.has(name));
if(missing.length||unexpected.length)throw new Error(`Item image set mismatch: missing=${missing.length}, unexpected=${unexpected.length}`);
if(manifest.gameBuild!==data.meta.gameBuild||manifest.itemCount!==data.items.length||manifest.expectedItemCount!==data.items.length||manifest.missingItemCount!==0||manifest.directItemCount+manifest.derivedOfficialItemCount!==data.items.length)throw new Error("Item image manifest is incomplete or belongs to another build");
for(const item of data.items){
  if(item.image!==true)throw new Error(`Item image flag is not verified: ${item.id}`);
  const file=path.join(directory,`${item.id}.webp`);
  await access(file);
  const metadata=await sharp(file).metadata();
  if(metadata.format!=="webp"||!metadata.width||!metadata.height||metadata.width<2||metadata.height<2)throw new Error(`Invalid item image: ${item.id}`);
  const stats=await sharp(file).ensureAlpha().stats();
  if(stats.channels[3].max===0)throw new Error(`Fully transparent item image: ${item.id}`);
}
console.log(`Verified ${data.items.length}/${data.items.length} item WebP images for build ${data.meta.gameBuild}.`);
