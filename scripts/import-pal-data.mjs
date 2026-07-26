import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = process.env.PAL_DATA_SOURCE || path.join(root, "private", "palcalc-source");
const localExport = process.env.PAL_LOCAL_EXPORT || path.join(root, "private", "raw", "build-24181527", "DT_PalMonsterParameter.json");
const gameBuild = process.env.PAL_GAME_BUILD || "24181527";
const dbPath = path.join(sourceRoot, "PalCalc.Model", "db.json");
const breedingPath = path.join(sourceRoot, "PalCalc.Model", "breeding.json");
const [dbBytes, breedingBytes, localBytes] = await Promise.all([readFile(dbPath), readFile(breedingPath), readFile(localExport)]);
const db = JSON.parse(dbBytes.toString("utf8"));
const breeding = JSON.parse(breedingBytes.toString("utf8"));
const localNameMap = new Set(JSON.parse(localBytes.toString("utf8")).NameMap || []);
const localeMap = { de:"de-DE", en:"en-US", "es-MX":"es-419", es:"es-ES", fr:"fr-FR", id:"id-ID", it:"it-IT", ko:"ko-KR", pl:"pl-PL", "pt-BR":"pt-BR", ru:"ru-RU", th:"th-TH", tr:"tr-TR", vi:"vi-VN", "zh-Hans":"zh-CN", "zh-Hant":"zh-TW", ja:"ja-JP" };

if (db.Pals.length < 250) throw new Error(`Unexpected Pal count: ${db.Pals.length}`);
if (breeding.Breeding.length < 30000) throw new Error(`Unexpected breeding row count: ${breeding.Breeding.length}`);
const missingLocal = db.Pals.filter(p => !localNameMap.has(p.InternalName)).map(p => p.InternalName);
if (missingLocal.length) throw new Error(`IDs missing from local game export: ${missingLocal.join(", ")}`);

const pals = [...db.Pals].sort((a,b) => a.InternalName.localeCompare(b.InternalName)).map((p,index) => ({
  i:index, id:p.InternalName, dex:p.Id.PalDexNo, variant:p.Id.IsVariant, names:Object.fromEntries(Object.entries(localeMap).map(([from,to]) => [to,p.LocalizedNames[from]])),
  power:p.BreedingPower, rarity:p.Rarity, size:p.Size, nocturnal:p.Nocturnal, hp:p.Hp, attack:p.Attack, defense:p.Defense,
  work:p.WorkSuitability
}));
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
  meta:{schema:1,gameBuild,sourceDbVersion:db.Version,generatedAt,palCount:pals.length,breedingCount:pairs.length,localIdMatchCount:pals.length},
  pals,pairs
};
await mkdir(path.join(root,"public","data"),{recursive:true});
await writeFile(path.join(root,"public","data","pals.json"),JSON.stringify(output));
await mkdir(path.join(root,"private","provenance"),{recursive:true});
await writeFile(path.join(root,"private","provenance","pals.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"community-generated data cross-checked against installed game export",sourceRevision:"be2ec7a95c521dea6591469c051e7cb0f6658065",sourcePaths:{database:path.relative(root,dbPath),breeding:path.relative(root,breedingPath),localExport:path.relative(root,localExport)},hashes:{db:sha256(dbBytes),breeding:sha256(breedingBytes),localExport:sha256(localBytes)},verification:{palIdsMatched:pals.length,palIdsMissing:missingLocal.length,breedingRows:pairs.length}},null,2));
console.log(`Imported ${pals.length} Pals and ${pairs.length} breeding rows; ${missingLocal.length} local ID mismatches.`);
