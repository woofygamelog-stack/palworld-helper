import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = process.env.PAL_DATA_SOURCE || path.join(root, "private", "palcalc-source");
const localExport = process.env.PAL_LOCAL_EXPORT || path.join(root, "private", "raw", "build-24181527", "DT_PalMonsterParameter.json");
const extractedRoot = process.env.PAL_EXTRACTED_SOURCE || path.join(root, "private", "extracted", "build-24181527-work-icons");
const elementExtractedRoot = process.env.PAL_ELEMENT_EXTRACTED_SOURCE || path.join(root, "private", "extracted", "build-24181527-elements");
const gameBuild = process.env.PAL_GAME_BUILD || "24181527";
const dbPath = path.join(sourceRoot, "PalCalc.Model", "db.json");
const breedingPath = path.join(sourceRoot, "PalCalc.Model", "breeding.json");
const [dbBytes, breedingBytes, localBytes, longDescriptionBytes, shortDescriptionBytes, uiCommonBytes, skillNameBytes, palParameterBytes] = await Promise.all([
  readFile(dbPath), readFile(breedingPath), readFile(localExport),
  readFile(path.join(extractedRoot,"pal-long-descriptions.raw.json")),
  readFile(path.join(extractedRoot,"pal-short-descriptions.raw.json")),
  readFile(path.join(extractedRoot,"ui-common.raw.json")),
  readFile(path.join(extractedRoot,"skill-names.raw.json")),
  readFile(path.join(elementExtractedRoot,"pal-parameters.raw.json"))
]);
const db = JSON.parse(dbBytes.toString("utf8"));
const breeding = JSON.parse(breedingBytes.toString("utf8"));
const localNameMap = new Set(JSON.parse(localBytes.toString("utf8")).NameMap || []);
const longDescriptions = JSON.parse(longDescriptionBytes.toString("utf8"));
const shortDescriptions = JSON.parse(shortDescriptionBytes.toString("utf8"));
const uiCommon = JSON.parse(uiCommonBytes.toString("utf8"));
const skillNames = JSON.parse(skillNameBytes.toString("utf8"));
const palParameters = JSON.parse(palParameterBytes.toString("utf8"));
const localeMap = { de:"de-DE", en:"en-US", "es-MX":"es-419", es:"es-ES", fr:"fr-FR", id:"id-ID", it:"it-IT", ko:"ko-KR", pl:"pl-PL", "pt-BR":"pt-BR", ru:"ru-RU", th:"th-TH", tr:"tr-TR", vi:"vi-VN", "zh-Hans":"zh-CN", "zh-Hant":"zh-TW", ja:"ja-JP" };
const localizedExtracted=(tables,key)=>Object.fromEntries(Object.entries(localeMap).map(([from,to])=>[to,tables[from]?.[key]||tables.en?.[key]||""]));
const workSuitabilityKeys={Kindling:"EmitFlame",Watering:"Watering",Planting:"Seeding",GenerateElectricity:"GenerateElectricity",Handiwork:"Handcraft",Gathering:"Collection",Lumbering:"Deforest",Mining:"Mining",MedicineProduction:"ProductMedicine",Cooling:"Cool",Transporting:"Transport",Farming:"MonsterFarm"};
const workSuitabilities=Object.entries(workSuitabilityKeys).map(([id,key])=>({id,names:localizedExtracted(uiCommon,`COMMON_WORK_SUITABILITY_${key}`),icon:`/assets/work-suitability/${id}.webp`}));
const elementSlugBySource={Normal:"neutral",Fire:"fire",Water:"water",Leaf:"grass",Electricity:"electric",Ice:"ice",Earth:"ground",Dark:"dark",Dragon:"dragon"};
const palElementSlugs=id=>{
  const source=palParameters[id];
  if(!source)throw new Error(`Pal element source missing: ${id}`);
  const raw=[source.ElementType1,source.ElementType2].map(value=>String(value||"").replace(/^EPalElementType::/,"")).filter(value=>value&&value!=="None");
  const slugs=[...new Set(raw.map(value=>elementSlugBySource[value]||""))];
  if(slugs.length<1||slugs.length>2||slugs.some(value=>!value))throw new Error(`Invalid Pal elements for ${id}: ${raw.join(", ")}`);
  return slugs;
};
const characterAliases={GhostAnglerFish:"GhostAnglerfish",GhostAnglerFish_Fire:"GhostAnglerfish_Fire",Mothmon:"Mothman",SnowTigerBeastMan:"SnowTigerBeastman"};
const palSourceById=new Map(db.Pals.map(pal=>[pal.InternalName,pal]));
const hasKoreanFinalConsonant=value=>{const character=[...value].at(-1)||"",code=character.charCodeAt(0);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28!==0};
const resolveKoreanParticles=value=>value.replace(/([가-힣]+)(이\(가\)|은\(는\)|을\(를\)|과\(와\))/g,(_,word,particle)=>{const final=hasKoreanFinalConsonant(word),forms={"이(가)":["이","가"],"은(는)":["은","는"],"을(를)":["을","를"],"과(와)":["과","와"]};return `${word}${forms[particle][final?0:1]}`});
const normalizeDescription=(value,sourceLocale)=>{
  let normalized=value.split(/\r?\n/).filter(line=>!line.includes("Error_Code:126DC")).join("\n");
  normalized=normalized.replace(/<characterName id=\|([^|]+)\|\/>/g,(_,rawId)=>{const id=characterAliases[rawId]||rawId,pal=palSourceById.get(id);if(!pal)throw new Error(`Unknown character-name reference: ${rawId}`);return pal.LocalizedNames[sourceLocale]||pal.LocalizedNames.en||id});
  normalized=normalized.replace(/<activeSkillName id=\|([^|]+)\|\/>/g,(_,id)=>skillNames[sourceLocale]?.[`ACTION_SKILL_${id}`]||skillNames.en?.[`ACTION_SKILL_${id}`]||id);
  normalized=normalized.replace(/\|/g,"").replace(/[ \t]+\n/g,"\n").trim();
  if(sourceLocale==="ko")normalized=resolveKoreanParticles(normalized);
  if(/<[^>]+>|Error_Code:|\|/.test(normalized))throw new Error(`Unresolved description markup in ${sourceLocale}: ${normalized}`);
  return normalized;
};
const localizedDescription=key=>Object.fromEntries(Object.entries(localeMap).map(([from,to])=>[to,normalizeDescription(longDescriptions[from]?.[key]||longDescriptions.en?.[key]||"",from)]));

if (db.Pals.length < 250) throw new Error(`Unexpected Pal count: ${db.Pals.length}`);
if (breeding.Breeding.length < 30000) throw new Error(`Unexpected breeding row count: ${breeding.Breeding.length}`);
const missingLocal = db.Pals.filter(p => !localNameMap.has(p.InternalName)).map(p => p.InternalName);
if (missingLocal.length) throw new Error(`IDs missing from local game export: ${missingLocal.join(", ")}`);

const pals = [...db.Pals].sort((a,b) => a.InternalName.localeCompare(b.InternalName)).map((p,index) => ({
  i:index, id:p.InternalName, dex:p.Id.PalDexNo, variant:p.Id.IsVariant, names:Object.fromEntries(Object.entries(localeMap).map(([from,to]) => [to,p.LocalizedNames[from]])),
  descriptions:localizedDescription(`PAL_LONG_DESC_${p.InternalName}`), shortDescriptions:localizedExtracted(shortDescriptions,`PAL_SHORT_DESC_${p.InternalName}`),
  power:p.BreedingPower, rarity:p.Rarity, size:p.Size, nocturnal:p.Nocturnal, hp:p.Hp, attack:p.Attack, defense:p.Defense,
  work:p.WorkSuitability, elementSlugs:palElementSlugs(p.InternalName), guaranteedPassiveIds:p.GuaranteedPassivesInternalIds||[]
}));
const palPortraitSource = path.join(sourceRoot,"PalCalc.UI","Resources","Pals");
const palPortraitTarget = path.join(root,"public","assets","pals");
await mkdir(palPortraitTarget,{recursive:true});
let palPortraitCount=0;
for(const pal of pals){
  try{
    await copyFile(path.join(palPortraitSource,`${pal.names["en-US"]}.png`),path.join(palPortraitTarget,`${pal.id}.png`));
    pal.image=true;
    palPortraitCount++;
  }catch(error){
    if(error?.code!=="ENOENT")throw error;
    pal.image=false;
  }
}
const indexById = new Map(pals.map(p => [p.id,p.i]));
const pairs = breeding.Breeding.map(row => {
  const a=indexById.get(row.Parent1InternalName), b=indexById.get(row.Parent2InternalName), child=indexById.get(row.ChildInternalName);
  if (a===undefined || b===undefined || child===undefined) throw new Error(`Unknown breeding ID in ${JSON.stringify(row)}`);
  return [a,b,child,row.Parent1Gender,row.Parent2Gender];
});
const uniquePairKeys = new Set(pairs.map(([a,b,,ga,gb]) => `${a}:${ga}|${b}:${gb}`));
if (uniquePairKeys.size !== pairs.length) throw new Error(`Duplicate gender-aware breeding rows: ${pairs.length-uniquePairKeys.size}`);

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const generatedAt=new Date().toISOString();
const output = {
  meta:{schema:1,gameBuild,sourceDbVersion:db.Version,generatedAt,palCount:pals.length,palPortraitCount,breedingCount:pairs.length,localIdMatchCount:pals.length},
  workSuitabilities,pals,pairs
};
await mkdir(path.join(root,"public","data"),{recursive:true});
await writeFile(path.join(root,"public","data","pals.json"),JSON.stringify(output));
await mkdir(path.join(root,"public","assets","work-suitability"),{recursive:true});
for(const work of workSuitabilities)await copyFile(path.join(extractedRoot,"work-suitability-icons",`${work.id}.webp`),path.join(root,"public","assets","work-suitability",`${work.id}.webp`));
await mkdir(path.join(root,"private","provenance"),{recursive:true});
await writeFile(path.join(root,"private","provenance","pals.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"community-generated data cross-checked against installed game export; element assignments from installed game files",sourceRevision:"be2ec7a95c521dea6591469c051e7cb0f6658065",sourcePaths:{database:path.relative(root,dbPath),breeding:path.relative(root,breedingPath),localExport:path.relative(root,localExport),palParameters:path.relative(root,path.join(elementExtractedRoot,"pal-parameters.raw.json"))},hashes:{db:sha256(dbBytes),breeding:sha256(breedingBytes),localExport:sha256(localBytes),palParameters:sha256(palParameterBytes)},verification:{palIdsMatched:pals.length,palIdsMissing:missingLocal.length,palElementsMatched:pals.filter(pal=>pal.elementSlugs.length>0).length,breedingRows:pairs.length}},null,2));
console.log(`Imported ${pals.length} Pals, ${palPortraitCount} portraits and ${pairs.length} breeding rows; ${missingLocal.length} local ID mismatches.`);
