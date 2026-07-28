import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8"));
const gameBuild=process.env.PAL_GAME_BUILD||itemData.meta.gameBuild;
const ensure=dir=>fs.mkdirSync(dir,{recursive:true}),copy=(source,target)=>{if(!fs.existsSync(source))return false;fs.copyFileSync(source,target);return true};
const palSource=path.join(root,"private","palcalc-source","PalCalc.UI","Resources","Pals"),palTarget=path.join(root,"public","assets","pals");ensure(palTarget);
let palCount=0;
for(const pal of palData.pals){const source=path.join(palSource,`${pal.names["en-US"]}.png`);pal.image=copy(source,path.join(palTarget,`${pal.id}.png`));if(pal.image)palCount++}
const extractedSource=process.env.PAL_EXTRACTED_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}`);
const itemSource=path.join(extractedSource,"item-icons"),itemTarget=path.join(root,"public","assets","items");
const itemStage=fs.mkdtempSync(path.join(root,"private","item-icons-import-"));
let itemCount=0;
for(const item of itemData.items){const target=path.join(itemStage,`${item.id}.webp`);item.image=copy(path.join(itemSource,`${item.id}.webp`),target);if(item.image){const bytes=fs.readFileSync(target);if(bytes.length<16||bytes.subarray(0,4).toString("ascii")!=="RIFF"||bytes.subarray(8,12).toString("ascii")!=="WEBP")throw new Error(`Invalid WebP item icon: ${item.id}`);itemCount++}}
const missingItems=itemData.items.filter(item=>!item.image).map(item=>item.id);
if(missingItems.length)throw new Error(`Item icon coverage is incomplete: ${itemCount}/${itemData.items.length}; missing ${missingItems.slice(0,20).join(", ")}`);
const stagedNames=fs.readdirSync(itemStage).filter(name=>name.endsWith(".webp"));
if(stagedNames.length!==itemData.items.length)throw new Error(`Staged item icon count mismatch: ${stagedNames.length}/${itemData.items.length}`);
const backup=`${itemTarget}.previous`;
if(fs.existsSync(backup))fs.rmSync(backup,{recursive:true,force:true});
if(fs.existsSync(itemTarget))fs.renameSync(itemTarget,backup);
try{fs.renameSync(itemStage,itemTarget);fs.rmSync(backup,{recursive:true,force:true})}catch(error){if(fs.existsSync(itemTarget))fs.rmSync(itemTarget,{recursive:true,force:true});if(fs.existsSync(backup))fs.renameSync(backup,itemTarget);throw error}
fs.writeFileSync(path.join(root,"public","data","pals.json"),JSON.stringify(palData));
fs.writeFileSync(path.join(root,"public","data","items.json"),JSON.stringify(itemData));
fs.writeFileSync(path.join(root,"public","assets","image-manifest.json"),JSON.stringify({gameBuild,palCount,itemCount,expectedItemCount:itemData.items.length,missingItemCount:0}));
console.log(`Imported ${palCount} Pal portraits and ${itemCount} item icons.`);
