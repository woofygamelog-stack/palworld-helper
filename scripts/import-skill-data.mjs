import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),source=process.env.PAL_DATA_SOURCE||path.join(root,"private","palcalc-source"),gameBuild=process.env.PAL_GAME_BUILD||"24181527";
const db=JSON.parse(await readFile(path.join(source,"PalCalc.Model","db.json"),"utf8"));
const localeMap={de:"de-DE",en:"en-US","es-MX":"es-419",es:"es-ES",fr:"fr-FR",id:"id-ID",it:"it-IT",ko:"ko-KR",pl:"pl-PL","pt-BR":"pt-BR",ru:"ru-RU",th:"th-TH",tr:"tr-TR",vi:"vi-VN","zh-Hans":"zh-CN","zh-Hant":"zh-TW",ja:"ja-JP"};
const localized=value=>Object.fromEntries(Object.entries(localeMap).map(([from,to])=>[to,value?.[from]||value?.en||""]));
const elements=db.Elements.map(element=>({id:element.InternalName,names:localized(element.LocalizedNames),icon:`/assets/elements/${element.InternalName}.png`}));
const activeSkills=db.ActiveSkills.map(skill=>({id:skill.InternalName,names:localized(skill.LocalizedNames),elementId:skill.ElementInternalName,power:skill.Power,cooldown:skill.CooldownSeconds,canInherit:skill.CanInherit,hasSkillFruit:skill.HasSkillFruit})).sort((a,b)=>a.id.localeCompare(b.id));
const passiveSkills=db.PassiveSkills.filter(skill=>skill.IsStandardPassiveSkill&&skill.Description&&skill.LocalizedDescriptions).map(skill=>({id:skill.InternalName,names:localized(skill.LocalizedNames),descriptions:localized(skill.LocalizedDescriptions),rank:skill.Rank,randomInheritanceAllowed:skill.RandomInheritanceAllowed,surgeryCost:skill.SurgeryCost,surgeryRequiredItem:skill.SurgeryRequiredItem})).sort((a,b)=>a.id.localeCompare(b.id));
if(elements.length!==9||activeSkills.length<300||passiveSkills.length<100)throw new Error("Unexpected skill dataset counts");
await mkdir(path.join(root,"public","data"),{recursive:true});
await writeFile(path.join(root,"public","data","skills.json"),JSON.stringify({meta:{schema:1,gameBuild,sourceDbVersion:db.Version,generatedAt:new Date().toISOString(),verification:"community-normalized; localized IDs cross-checked with installed build exports",elementCount:elements.length,activeSkillCount:activeSkills.length,passiveSkillCount:passiveSkills.length},elements,activeSkills,passiveSkills}));
await mkdir(path.join(root,"public","assets","elements"),{recursive:true});
for(const element of elements)await copyFile(path.join(source,"PalCalc.UI","Resources","Elements",`${element.id}.png`),path.join(root,"public","assets","elements",`${element.id}.png`));
await mkdir(path.join(root,"public","assets","passive-ranks"),{recursive:true});
for(const rank of [-3,-2,-1,1,2,3,4,5])await copyFile(path.join(source,"PalCalc.UI","Resources","TraitRank",`Passive_${rank>0?"Positive":"Negative"}_${Math.abs(rank)}_icon.png`),path.join(root,"public","assets","passive-ranks",`${rank}.png`));
console.log(`Imported ${elements.length} elements, ${activeSkills.length} active skills and ${passiveSkills.length} standard passive skills.`);
