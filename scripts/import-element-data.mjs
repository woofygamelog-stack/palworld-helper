import {createHash} from "node:crypto";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const sourceRoot=process.env.PAL_ELEMENT_EXTRACTED_SOURCE||path.join(root,"private","extracted","build-24181527-elements");
const gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const localeMap={de:"de-DE",en:"en-US","es-MX":"es-419",es:"es-ES",fr:"fr-FR",id:"id-ID",it:"it-IT",ko:"ko-KR",pl:"pl-PL","pt-BR":"pt-BR",ru:"ru-RU",th:"th-TH",tr:"tr-TR",vi:"vi-VN","zh-Hans":"zh-CN","zh-Hant":"zh-TW",ja:"ja-JP"};
const definitions=[
  {source:"Normal",slug:"neutral",icon:0},
  {source:"Fire",slug:"fire",icon:1},
  {source:"Water",slug:"water",icon:2},
  {source:"Electricity",slug:"electric",icon:3},
  {source:"Leaf",slug:"grass",icon:4},
  {source:"Dark",slug:"dark",icon:5},
  {source:"Dragon",slug:"dragon",icon:6},
  {source:"Earth",slug:"ground",icon:7},
  {source:"Ice",slug:"ice",icon:8},
];
// Transcribed from the installed game's official element-matchup UI chart.
const relationPairs=[
  ["electric","water"],
  ["water","fire"],
  ["fire","grass"],
  ["fire","ice"],
  ["grass","ground"],
  ["ground","electric"],
  ["ice","dragon"],
  ["dragon","dark"],
  ["dark","neutral"],
];
const [uiBytes,palBytes,skillBytes,manifestBytes,chartBytes]=await Promise.all([
  readFile(path.join(sourceRoot,"ui-common.raw.json")),
  readFile(path.join(sourceRoot,"pal-parameters.raw.json")),
  readFile(path.join(root,"public","data","skills.json")),
  readFile(path.join(sourceRoot,"element-manifest.json")),
  readFile(path.join(sourceRoot,"element-matchup-chart.webp")),
]);
const ui=JSON.parse(uiBytes.toString("utf8")),palParameters=JSON.parse(palBytes.toString("utf8")),skills=JSON.parse(skillBytes.toString("utf8")),manifest=JSON.parse(manifestBytes.toString("utf8"));
const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
if(gameBuild!=="24181527"||manifest.mappingHash!=="C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851")throw new Error("Element extraction does not match the verified build mapping");
if(manifest.localeCount!==17||manifest.elementIconCount!==9||sha256(chartBytes).toUpperCase()!=="93BC7116E59463E93FA92968B825F566CBF9F0D55006E6906DC4DCB39658CA52")throw new Error("Official element UI assets drifted from the verified extraction");
const localizedName=source=>Object.fromEntries(Object.entries(localeMap).map(([from,to])=>{
  const value=ui[from]?.[`COMMON_ELEMENT_NAME_${source}`]||ui.en?.[`COMMON_ELEMENT_NAME_${source}`]||"";
  if(!value.trim())throw new Error(`Element name missing: ${source} ${from}`);
  return [to,value.trim()];
}));
const slugBySource=new Map(definitions.map(value=>[value.source,value.slug]));
const countByElement=new Map(definitions.map(value=>[value.slug,0]));
for(const pal of Object.values(palParameters)){
  for(const value of new Set([pal.ElementType1,pal.ElementType2].map(item=>String(item||"").replace(/^EPalElementType::/,"")).filter(item=>item&&item!=="None"))){
    const slug=slugBySource.get(value);
    if(slug)countByElement.set(slug,countByElement.get(slug)+1);
  }
}
const publicPals=JSON.parse(await readFile(path.join(root,"public","data","pals.json"),"utf8")).pals;
if(publicPals.length!==299)throw new Error(`Unexpected public Pal count: ${publicPals.length}`);
const publicCountByElement=new Map(definitions.map(value=>[value.slug,0]));
for(const pal of publicPals){
  if(!Array.isArray(pal.elementSlugs)||pal.elementSlugs.length<1||pal.elementSlugs.length>2)throw new Error(`Public Pal elements missing: ${pal.id}`);
  for(const slug of pal.elementSlugs){
    if(!publicCountByElement.has(slug))throw new Error(`Unknown public element slug: ${slug}`);
    publicCountByElement.set(slug,publicCountByElement.get(slug)+1);
  }
}
const activeCountBySource=new Map(definitions.map(value=>[value.source,0]));
for(const skill of skills.activeSkills){
  if(!activeCountBySource.has(skill.elementId))throw new Error(`Unknown active-skill element: ${skill.elementId}`);
  activeCountBySource.set(skill.elementId,activeCountBySource.get(skill.elementId)+1);
}
const relationKeys=new Set(relationPairs.map(([attacker,defender])=>`${attacker}:${defender}`));
if(relationKeys.size!==9)throw new Error("Element relationships must be unique");
const elementSlugs=new Set(definitions.map(value=>value.slug));
if(relationPairs.some(pair=>pair.some(slug=>!elementSlugs.has(slug))))throw new Error("Element relationship references an unknown slug");
const elements=definitions.map((definition,order)=>({
  slug:definition.slug,
  names:localizedName(definition.source),
  icon:`/assets/elements/${definition.slug}.webp`,
  order,
  palCount:publicCountByElement.get(definition.slug),
  activeSkillCount:activeCountBySource.get(definition.source),
  strongAgainst:relationPairs.filter(([attacker])=>attacker===definition.slug).map(([,defender])=>defender),
  weakTo:relationPairs.filter(([,defender])=>defender===definition.slug).map(([attacker])=>attacker),
}));
if(elements.some(element=>Object.keys(element.names).length!==17||element.palCount<1||element.activeSkillCount<1))throw new Error("Element localization or entity coverage is incomplete");
const relations=relationPairs.map(([attacker,defender])=>({attacker,defender,effect:"strong",multiplier:null,verification:"game-ui-chart"}));
const generatedAt=manifest.extractedAt;
const output={
  meta:{schema:1,gameBuild,generatedAt,verification:"game-ui-chart-and-game-files",localeCount:17,elementCount:9,relationCount:9,palCount:299,numericMultipliersVerified:false,dualElementRuleVerified:false,iconProvenance:{direct:9,sharedOfficial:0,atlasOfficial:0,derivedOfficial:0,missing:0}},
  chartImage:"/assets/elements/matchup-chart.webp",
  elements,
  relations,
  rules:{numericMultipliers:null,dualElement:null},
};
const dataTarget=path.join(root,"public","data","elements.json"),assetTarget=path.join(root,"public","assets","elements");
await mkdir(path.dirname(dataTarget),{recursive:true});
await mkdir(assetTarget,{recursive:true});
await writeFile(dataTarget,JSON.stringify(output));
for(const definition of definitions)await copyFile(path.join(sourceRoot,"element-icons",`${String(definition.icon).padStart(2,"0")}.webp`),path.join(assetTarget,`${definition.slug}.webp`));
await copyFile(path.join(sourceRoot,"element-matchup-chart.webp"),path.join(assetTarget,"matchup-chart.webp"));
await mkdir(path.join(root,"private","provenance"),{recursive:true});
await writeFile(path.join(root,"private","provenance","elements.json"),JSON.stringify({schema:1,gameBuild,generatedAt,sourceType:"installed-game files and official in-game UI chart",sourcePaths:{uiCommon:path.relative(root,path.join(sourceRoot,"ui-common.raw.json")),palParameters:path.relative(root,path.join(sourceRoot,"pal-parameters.raw.json")),chart:path.relative(root,path.join(sourceRoot,"element-matchup-chart.webp")),icons:path.relative(root,path.join(sourceRoot,"element-icons")),manifest:path.relative(root,path.join(sourceRoot,"element-manifest.json"))},hashes:{uiCommon:sha256(uiBytes),palParameters:sha256(palBytes),chart:sha256(chartBytes),manifest:sha256(manifestBytes)},mappingHash:manifest.mappingHash,verification:{officialNames:9,officialIcons:9,qualitativeRelations:9,publicPals:299,numericMultipliers:false,dualElementRule:false}},null,2));
console.log(`Imported ${elements.length} elements, ${relations.length} qualitative relationships and element assignments for ${publicPals.length} Pals.`);
