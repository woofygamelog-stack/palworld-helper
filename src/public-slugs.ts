type NamedEntity={id:string;names?:Record<string,string>};
type PalSlugEntity=NamedEntity&{dex:number;variant?:boolean};
type ItemSlugEntity=NamedEntity&{rank:number;rarity:number};
type ActiveSkillSlugEntity=NamedEntity&{elementId:string;power:number;cooldown:number};
type PassiveSkillSlugEntity=NamedEntity&{rank:number};
type PartnerSkillSlugEntity=NamedEntity&{palId:string};

export type PublicSlugDataset={
  pals:PalSlugEntity[];
  items:ItemSlugEntity[];
  activeSkills:ActiveSkillSlugEntity[];
  passiveSkills:PassiveSkillSlugEntity[];
  partnerSkills:PartnerSkillSlugEntity[];
};

export type PublicSlugFamily=keyof PublicSlugDataset;

export type PublicSlugRegistry={
  byId:Record<PublicSlugFamily,Map<string,string>>;
  bySlug:Record<PublicSlugFamily,Map<string,string>>;
};

const englishName=(entity:NamedEntity)=>entity.names?.["en-US"]?.trim()||"";

export function publicNameSlug(value:string){
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").replace(/-{2,}/g,"-");
}

export function palPublicSlug(pal:PalSlugEntity){
  return `${String(pal.dex).padStart(3,"0")}${pal.variant?"b":""}-${publicNameSlug(englishName(pal))||"pal"}`;
}

export function itemPublicSlug(item:ItemSlugEntity){
  return `${publicNameSlug(englishName(item))||"item"}-rank-${item.rank}-rarity-${item.rarity}`;
}

export function passiveSkillPublicSlug(skill:PassiveSkillSlugEntity){
  const rank=skill.rank<0?`minus-${Math.abs(skill.rank)}`:`plus-${skill.rank}`;
  return `${publicNameSlug(englishName(skill))||"passive-skill"}-rank-${rank}`;
}

export function activeSkillOwner<T extends PalSlugEntity>(skill:ActiveSkillSlugEntity,pals:T[]):T|undefined{
  const marker="Unique_",source=skill.id.startsWith(marker)?skill.id.slice(marker.length):skill.id;
  return [...pals].sort((a,b)=>b.id.length-a.id.length).find(pal=>source===pal.id||source.startsWith(`${pal.id}_`));
}

function uniqueSlug(base:string,used:Set<string>,fallbackIndex:number){
  if(!used.has(base)){used.add(base);return base}
  let index=fallbackIndex;
  while(used.has(`${base}-variant-${index}`))index++;
  const slug=`${base}-variant-${index}`;used.add(slug);return slug;
}

function createFamilyMaps<T extends NamedEntity>(entities:T[],slugFor:(entity:T,index:number)=>string){
  const byId=new Map<string,string>(),bySlug=new Map<string,string>(),used=new Set<string>();
  entities.forEach((entity,index)=>{const slug=uniqueSlug(slugFor(entity,index),used,index+1);byId.set(entity.id,slug);bySlug.set(slug,entity.id)});
  return {byId,bySlug};
}

export function createPublicSlugRegistry(data:PublicSlugDataset):PublicSlugRegistry{
  const pals=createFamilyMaps(data.pals,palPublicSlug),items=createFamilyMaps(data.items,itemPublicSlug),passiveSkills=createFamilyMaps(data.passiveSkills,passiveSkillPublicSlug);
  const activeNameCounts=new Map<string,number>();
  for(const skill of data.activeSkills){const base=publicNameSlug(englishName(skill))||"active-skill";activeNameCounts.set(base,(activeNameCounts.get(base)||0)+1)}
  const activeSkills=createFamilyMaps(data.activeSkills,(skill,index)=>{
    const base=publicNameSlug(englishName(skill))||"active-skill";
    if((activeNameCounts.get(base)||0)===1)return base;
    const owner=activeSkillOwner(skill,data.pals);
    return owner?`${base}-${palPublicSlug(owner)}`:`${base}-${publicNameSlug(skill.elementId)}-${skill.power}-${skill.cooldown}-variant-${index+1}`;
  });
  const partnerSkills=createFamilyMaps(data.partnerSkills,skill=>{
    const pal=data.pals.find(entry=>entry.id===skill.palId),base=publicNameSlug(englishName(skill))||"partner-skill";
    return pal?`${base}-${palPublicSlug(pal)}`:base;
  });
  return {
    byId:{pals:pals.byId,items:items.byId,activeSkills:activeSkills.byId,passiveSkills:passiveSkills.byId,partnerSkills:partnerSkills.byId},
    bySlug:{pals:pals.bySlug,items:items.bySlug,activeSkills:activeSkills.bySlug,passiveSkills:passiveSkills.bySlug,partnerSkills:partnerSkills.bySlug}
  };
}

export function publicSlug(registry:PublicSlugRegistry,family:PublicSlugFamily,id:string){
  const slug=registry.byId[family].get(id);
  if(!slug)throw new Error(`Missing public slug for ${family}`);
  return slug;
}

export function resolvePublicSlug(registry:PublicSlugRegistry,family:PublicSlugFamily,segment:string){
  const id=registry.bySlug[family].get(segment);
  if(id)return {id,slug:segment,legacy:false};
  const slug=registry.byId[family].get(segment);
  return slug?{id:segment,slug,legacy:true}:null;
}

export function assertPublicSlugRegistry(data:PublicSlugDataset,registry=createPublicSlugRegistry(data)){
  for(const family of Object.keys(data) as PublicSlugFamily[]){
    const expected=data[family].length;
    if(registry.byId[family].size!==expected||registry.bySlug[family].size!==expected)throw new Error(`Public slug collision in ${family}`);
    for(const slug of registry.bySlug[family].keys())if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error(`Invalid public slug in ${family}`);
  }
  return registry;
}
