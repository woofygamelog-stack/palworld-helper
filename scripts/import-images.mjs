import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),palData=JSON.parse(fs.readFileSync(path.join(root,"public","data","pals.json"),"utf8")),itemData=JSON.parse(fs.readFileSync(path.join(root,"public","data","items.json"),"utf8"));
const gameBuild=process.env.PAL_GAME_BUILD||itemData.meta.gameBuild;
const ensure=dir=>fs.mkdirSync(dir,{recursive:true}),copy=(source,target)=>{if(!fs.existsSync(source))return false;fs.copyFileSync(source,target);return true};
const palSource=path.join(root,"private","palcalc-source","PalCalc.UI","Resources","Pals"),palTarget=path.join(root,"public","assets","pals");ensure(palTarget);
let palCount=0;
for(const pal of palData.pals){const source=path.join(palSource,`${pal.names["en-US"]}.png`);pal.image=copy(source,path.join(palTarget,`${pal.id}.png`));if(pal.image)palCount++}
const extractedSource=process.env.PAL_EXTRACTED_SOURCE||path.join(root,"private","extracted",`build-${gameBuild}`);
const itemSource=path.join(extractedSource,"item-icons"),itemTarget=path.join(root,"public","assets","items");ensure(itemTarget);
let itemCount=0;
for(const item of itemData.items){item.image=copy(path.join(itemSource,`${item.id}.webp`),path.join(itemTarget,`${item.id}.webp`));if(item.image)itemCount++}
const missingItems=itemData.items.filter(item=>!item.image).map(item=>item.id);
if(missingItems.length)throw new Error(`Item icon coverage is incomplete: ${itemCount}/${itemData.items.length}; missing ${missingItems.slice(0,20).join(", ")}`);
fs.writeFileSync(path.join(root,"public","data","pals.json"),JSON.stringify(palData));
fs.writeFileSync(path.join(root,"public","data","items.json"),JSON.stringify(itemData));
fs.writeFileSync(path.join(root,"public","assets","image-manifest.json"),JSON.stringify({gameBuild,palCount,itemCount,expectedItemCount:itemData.items.length,missingItemCount:0}));
console.log(`Imported ${palCount} Pal portraits and ${itemCount} item icons.`);
