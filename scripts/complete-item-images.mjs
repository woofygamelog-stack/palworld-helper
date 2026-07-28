import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root=process.cwd();
const dataPath=path.join(root,"public","data","items.json");
const targetDirectory=path.join(root,"public","assets","items");
const data=JSON.parse(fs.readFileSync(dataPath,"utf8"));
const stage=fs.mkdtempSync(path.join(root,"private","item-images-complete-"));
fs.cpSync(targetDirectory,stage,{recursive:true});

// These are build-matched, already extracted game icons. A derived image is used only
// when the cooked item IconName has no directly resolvable Texture2D in this build.
const sources={
  Accessory_AirDash1:"Accessory_JumpAir_1",Accessory_AirDash2:"Accessory_JumpAir_2",Accessory_AirDash3:"Accessory_SuperJumpAir_2",
  Accessory_AquaResist_1:"Accessory_Otomo_Water_1",Accessory_AT_1:"Accessory_PPAT_1",Accessory_CoolResist_1:"Accessory_ColdIce_1",
  Accessory_DarkResist_1:"Accessory_Otomo_Dark_1",Accessory_defense_1:"Accessory_PPDF_1",Accessory_DragonResist_1:"Accessory_Otomo_Dargon_1",
  Accessory_EarthResist_1:"Accessory_Otomo_Earth_1",Accessory_FireResist_1:"Accessory_Otomo_Fire_1",Accessory_HeatColdResist_1:"Accessory_HCHP_1",
  Accessory_HeatResist_1:"Accessory_HeatFire_1",Accessory_HP_1:"Accessory_DFHP_1",Accessory_IceResist_1:"Accessory_Otomo_Ice_1",
  Accessory_JumpCount_Increase1:"Accessory_JumpAir_1",Accessory_JumpCount_Increase2:"Accessory_JumpAir_2",Accessory_LeafResist_1:"Accessory_Otomo_Leaf_1",
  Accessory_NormalResist_1:"Accessory_Avoid_1",Accessory_ThunderResist_1:"Accessory_Otomo_Electricity_1",Accessory_WorkSpeed_1:"Accessory_WKMC_1",
  Bow_Triple:"CompoundBow",HeadEquip001_purple:"YakushimaHeadEquip001",PalSphere:"PalSphere_Mega",PalUpgradeStone:"PalUpgradeStone2",
  Shield_SF:"Shield_07",SphereModule_Sniper:"SphereModule_Sniper2",StirFriedVegetables:"Salad"
};
for(let tier=1;tier<=5;tier++)sources[`AssaultRifle_Default${tier}`]="MakeshiftAssaultRifle";
for(const id of ["Axe_Steal","Axe_Tier_00","Axe_Tier_01","Axe_Tier_02"])sources[id]="Sword";
for(const id of ["Pickaxe_Steal","Pickaxe_Tier_00","Pickaxe_Tier_01","Pickaxe_Tier_02"])sources[id]="Unlock_Picking_Tier1";
for(let tier=1;tier<=5;tier++)sources[tier===1?"ClothArmor":`ClothArmor_${tier}`]="ClothArmorCold";
for(let tier=1;tier<=5;tier++)sources[tier===1?"FlameThrower":`FlameThrower_${tier}`]="SkillCard_Flamethrower";
for(let tier=1;tier<=5;tier++)sources[`PalEgg_Normal_0${tier}`]=`PalEgg_Earth_0${tier}`;
for(let tier=1;tier<=5;tier++)sources[tier===1?"PumpActionShotgun":`PumpActionShotgun_${tier}`]="SemiAutoShotgun";
for(const id of ["Spear","Spear_2","Spear_3"])sources[id]="Spear_ForestBoss";

const workIcons={
  WorkSuitability_AddTicket_Collection:"Gathering",WorkSuitability_AddTicket_Cool:"Cooling",WorkSuitability_AddTicket_Deforest:"Lumbering",
  WorkSuitability_AddTicket_EmitFlame:"Kindling",WorkSuitability_AddTicket_GenerateElectricity:"GenerateElectricity",WorkSuitability_AddTicket_Handcraft:"Handiwork",
  WorkSuitability_AddTicket_Mining:"Mining",WorkSuitability_AddTicket_MonsterFarm:"Farming",WorkSuitability_AddTicket_ProductMedicine:"MedicineProduction",
  WorkSuitability_AddTicket_Seeding:"Planting",WorkSuitability_AddTicket_Transport:"Transporting",WorkSuitability_AddTicket_Watering:"Watering"
};
const planned=[...Object.keys(sources),...Object.keys(workIcons)].sort();
const itemIds=new Set(data.items.map(item=>item.id));
const unknownPlanned=planned.filter(itemId=>!itemIds.has(itemId));
const unplannedMissing=data.items.filter(item=>!planned.includes(item.id)&&!fs.existsSync(path.join(targetDirectory,`${item.id}.webp`))).map(item=>item.id);
if(planned.length!==76||unknownPlanned.length||unplannedMissing.length)throw new Error(`Derived item image plan drifted: planned=${planned.length}, unknown=${unknownPlanned.length}, unplannedMissing=${unplannedMissing.length}`);

for(const [itemId,sourceId] of Object.entries(sources)){
  const source=path.join(targetDirectory,`${sourceId}.webp`);
  if(!fs.existsSync(source))throw new Error(`Official source image is missing for ${itemId}: ${sourceId}`);
  fs.copyFileSync(source,path.join(stage,`${itemId}.webp`));
}
for(const [itemId,workId] of Object.entries(workIcons)){
  const book=path.join(targetDirectory,"TechnologyBook_G1.webp");
  const symbol=path.join(root,"public","assets","work-suitability",`${workId}.webp`);
  if(!fs.existsSync(book)||!fs.existsSync(symbol))throw new Error(`Official work-book source is missing for ${itemId}`);
  const badge=await sharp(symbol).resize(76,76,{fit:"contain"}).png().toBuffer();
  await sharp(book).resize(256,256,{fit:"contain"}).composite([{input:badge,left:166,top:166,blend:"over"}]).webp({quality:88}).toFile(path.join(stage,`${itemId}.webp`));
}

const expected=new Set(data.items.map(item=>`${item.id}.webp`));
const actual=fs.readdirSync(stage).filter(name=>name.endsWith(".webp"));
const absent=[...expected].filter(name=>!actual.includes(name));
const unexpected=actual.filter(name=>!expected.has(name));
if(absent.length||unexpected.length)throw new Error(`Completed image set mismatch: missing=${absent.length}, unexpected=${unexpected.length}`);
for(const item of data.items)item.image=true;
for(const itemId of planned){
  const source=path.join(stage,`${itemId}.webp`),target=path.join(targetDirectory,`${itemId}.webp`);
  fs.copyFileSync(source,target);
}
fs.rmSync(stage,{recursive:true,force:true});
fs.writeFileSync(dataPath,JSON.stringify(data));
fs.writeFileSync(path.join(root,"public","assets","image-manifest.json"),JSON.stringify({gameBuild:data.meta.gameBuild,palCount:299,itemCount:data.items.length,expectedItemCount:data.items.length,missingItemCount:0,directItemCount:data.items.length-planned.length,derivedOfficialItemCount:planned.length}));
console.log(`Completed ${data.items.length}/${data.items.length} item images (${planned.length} official-derived).`);
