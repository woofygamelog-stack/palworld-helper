import type {IconName} from "../icons";
import type {Locale} from "../config.ts";
import {guideCopy,guideDefinitions,guideRoute} from "../guide-content.ts";
import {mapLayerLabels} from "../map-labels.ts";
import {mapExtraLabels} from "../map-extra-labels.ts";
import {mapPointCategoryDefinitions} from "../map-point-categories.ts";

type Localized<Locale extends string>=Record<Locale,string>;

export type GlobalSearchPal<Locale extends string>={
  id:string;
  dex:number;
  variant:boolean;
  names:Localized<Locale>;
  work:Record<string,number>;
  image?:boolean;
};

export type GlobalSearchItem<Locale extends string>={
  id:string;
  names:Localized<Locale>;
  descriptions?:Localized<Locale>;
  type:string;
  subtype:string;
  image?:boolean;
  searchTerms?:readonly string[];
};

export type GlobalSearchActiveSkill<Locale extends string>={id:string;elementId:string;names:Localized<Locale>};
export type GlobalSearchPassiveSkill<Locale extends string>={id:string;names:Localized<Locale>;descriptions:Localized<Locale>};
export type GlobalSearchPartnerSkill<Locale extends string>={id:string;palId:string;names:Localized<Locale>;palDescriptions:Localized<Locale>};

export type GlobalSearchResult={title:string;meta:string;path:string;image?:string;icon?:IconName};
export type GlobalSearchRoute={title:string;meta:string;path:string;keywords:readonly string[];icon?:IconName};
export type GlobalSearchKind="locations"|"pals"|"items"|"skills"|"technology"|"structures"|"guides"|"calculators"|"server"|"npcs"|"dungeons"|"expeditions"|"quests"|"health"|"elements"|"database";

export function globalSearchKindFromHref(href:string):GlobalSearchKind{
  const pathname=new URL(href,"https://palworld-helper.invalid").pathname.replace(/^\/[a-z]{2}(?:-[a-z0-9]+)?(?=\/|$)/i,"");
  if(pathname==="/map")return "locations";
  if(pathname==="/pals"||pathname.startsWith("/pals/"))return "pals";
  if(pathname==="/database")return "items";
  if(pathname.startsWith("/items/"))return "items";
  if(pathname.startsWith("/skills"))return "skills";
  if(pathname.startsWith("/database/technology"))return "technology";
  if(pathname.startsWith("/database/structures"))return "structures";
  if(pathname.startsWith("/database/npcs"))return "npcs";
  if(pathname.startsWith("/database/dungeons"))return "dungeons";
  if(pathname.startsWith("/database/expeditions"))return "expeditions";
  if(pathname.startsWith("/database/quests"))return "quests";
  if(pathname.startsWith("/database/health"))return "health";
  if(pathname.startsWith("/database/elements"))return "elements";
  if(pathname.startsWith("/guides"))return "guides";
  if(pathname.startsWith("/calculators"))return "calculators";
  if(pathname.startsWith("/server-tools"))return "server";
  return "database";
}

export function finalizeGlobalSearchResults({target,status,locale,resultLabel,kindLabels,limit=40}:{target:HTMLElement;status:HTMLElement;locale:string;resultLabel:string;kindLabels:Record<GlobalSearchKind,string>;limit?:number}){
  const seen=new Set<string>();
  let uniqueCount=0;
  for(const result of target.querySelectorAll<HTMLAnchorElement>("a[data-global-result]")){
    const key=result.getAttribute("href")||"";
    if(seen.has(key)){result.remove();continue}
    seen.add(key);
    uniqueCount++;
    if(uniqueCount>limit){result.remove();continue}
    const kind=globalSearchKindFromHref(result.href),label=kindLabels[kind],copy=result.querySelector<HTMLElement>("strong")?.parentElement,detail=copy?.querySelector<HTMLElement>("small");
    result.dataset.searchKind=kind;
    if(detail?.textContent===label)detail.remove();
    else if(detail?.textContent?.startsWith(`${label} · `))detail.textContent=detail.textContent.slice(label.length+3);
    copy?.querySelector(".search-result-kind")?.remove();
    const title=copy?.querySelector("strong");
    if(title){const badge=target.ownerDocument.createElement("span");badge.className="search-result-kind";badge.textContent=label;title.insertAdjacentElement("afterend",badge)}
  }
  if(uniqueCount)target.querySelector(".empty-compact")?.remove();
  status.textContent=`${Math.min(uniqueCount,limit).toLocaleString(locale)} ${resultLabel}`;
  return Math.min(uniqueCount,limit);
}

export function mapCategorySearchRoutes({locale,defaultLocale,items,mapTitle}:{locale:Locale;defaultLocale:Locale;items:readonly {id:string;names:Record<Locale,string>}[];mapTitle:string}){const layerLabels=mapLayerLabels[locale],extraLabels=mapExtraLabels[locale],itemsById=new Map(items.map(item=>[item.id,item]));return mapPointCategoryDefinitions.flatMap(definition=>{const label=definition.labelSource==="item"?(itemsById.get(definition.labelKey)?.names[locale]||itemsById.get(definition.labelKey)?.names[defaultLocale]):definition.labelSource==="extra"?extraLabels[definition.labelKey as keyof typeof extraLabels]:layerLabels[definition.labelKey as keyof typeof layerLabels];return label?[{title:label,meta:mapTitle,path:`/map?layers=${definition.id}`,keywords:[definition.id,definition.group,label],icon:"map" as const}]:[]})}

type GlobalSearchData<Locale extends string>={
  pals:GlobalSearchPal<Locale>[];
  items:GlobalSearchItem<Locale>[];
  activeSkills:GlobalSearchActiveSkill<Locale>[];
  passiveSkills:GlobalSearchPassiveSkill<Locale>[];
  partnerSkills:GlobalSearchPartnerSkill<Locale>[];
};

type GlobalSearchLabels={pals:string;database:string;active:string;passive:string;partner:string;results:string;noResult:string};

export function findGlobalSearchResults<Locale extends string>({
  query,
  locale,
  defaultLocale,
  data,
  labels,
  palName,
  itemName,
  partnerSkillName,
  routes=[],
  palSlug=pal=>pal.id,
  itemSlug=item=>item.id,
  activeSkillSlug=skill=>skill.id,
  passiveSkillSlug=skill=>skill.id,
  partnerSkillSlug=skill=>skill.id
}:{
  query:string;
  locale:Locale;
  defaultLocale:Locale;
  data:GlobalSearchData<Locale>;
  labels:GlobalSearchLabels;
  palName:(pal:GlobalSearchPal<Locale>)=>string;
  itemName:(item:GlobalSearchItem<Locale>)=>string;
  partnerSkillName:(skill:GlobalSearchPartnerSkill<Locale>,pal:GlobalSearchPal<Locale>|undefined)=>string;
  routes?:readonly GlobalSearchRoute[];
  palSlug?:(pal:GlobalSearchPal<Locale>)=>string;
  itemSlug?:(item:GlobalSearchItem<Locale>)=>string;
  activeSkillSlug?:(skill:GlobalSearchActiveSkill<Locale>)=>string;
  passiveSkillSlug?:(skill:GlobalSearchPassiveSkill<Locale>)=>string;
  partnerSkillSlug?:(skill:GlobalSearchPartnerSkill<Locale>)=>string;
}){
  const normalized=query.trim().toLocaleLowerCase(locale);
  if(!normalized)return [];
  const matches=(values:(string|number)[])=>values.join(" ").toLocaleLowerCase(locale).includes(normalized);
  const localizedValues=(names:Localized<Locale>|undefined)=>names?Object.values(names) as string[]:[];
  const localized=(names:Localized<Locale>)=>names[locale]||names[defaultLocale];
  const results:GlobalSearchResult[]=[];

  for(const route of routes)if(matches([route.title,route.meta,...route.keywords]))results.push({title:route.title,meta:route.meta,path:route.path,icon:route.icon});

  if(locale in guideCopy){
    const copy=guideCopy[locale as keyof typeof guideCopy];
    for(const guide of guideDefinitions){
      const text=copy.guides[guide.id];
      if(matches([guide.id,guide.slug,text.title,text.description,copy.hubTitle]))results.push({title:text.title,meta:copy.hubTitle,path:`/${guideRoute(guide.slug)}`,icon:"database"});
    }
  }

  for(const pal of data.pals){
    if(matches([pal.id,pal.dex,...localizedValues(pal.names),...Object.keys(pal.work).filter(key=>pal.work[key]>0)])){
      results.push({title:palName(pal),meta:`${labels.pals} · #${pal.dex}${pal.variant?"B":""}`,path:`/pals/${encodeURIComponent(palSlug(pal))}`,image:pal.image?`/assets/pals/${encodeURIComponent(pal.id)}.png`:undefined});
    }
  }
  for(const item of data.items){
    if(matches([item.id,item.type,item.subtype,...localizedValues(item.names),...localizedValues(item.descriptions),...(item.searchTerms||[])])){
      results.push({title:itemName(item),meta:`${labels.database} · ${item.type}`,path:`/items/${encodeURIComponent(itemSlug(item))}`,image:item.image?`/assets/items/${encodeURIComponent(item.id)}.webp`:undefined});
    }
  }
  for(const skill of data.activeSkills){
    if(matches([skill.id,skill.elementId,...localizedValues(skill.names)])){
      results.push({title:localized(skill.names),meta:labels.active,path:`/skills/active/${encodeURIComponent(activeSkillSlug(skill))}`,icon:"skills"});
    }
  }
  for(const skill of data.passiveSkills){
    if(matches([skill.id,...localizedValues(skill.names),...localizedValues(skill.descriptions)])){
      results.push({title:localized(skill.names),meta:labels.passive,path:`/skills/passive/${encodeURIComponent(passiveSkillSlug(skill))}`,icon:"skills"});
    }
  }
  const palsById=new Map(data.pals.map(pal=>[pal.id,pal]));
  for(const skill of data.partnerSkills){
    if(matches([skill.id,skill.palId,...localizedValues(skill.names),...localizedValues(skill.palDescriptions)])){
      const title=partnerSkillName(skill,palsById.get(skill.palId));
      if(title)results.push({title,meta:labels.partner,path:`/skills/partner/${encodeURIComponent(partnerSkillSlug(skill))}`,icon:"skills"});
    }
  }
  const titleScore=(result:GlobalSearchResult)=>{const title=result.title.toLocaleLowerCase(locale),pathSegment=decodeURIComponent(result.path.split("?")[0].split("/").at(-1)||"").toLocaleLowerCase(locale);return title===normalized||pathSegment===normalized?0:title.startsWith(normalized)||pathSegment.startsWith(`${normalized}-`)?1:2};
  return results.sort((a,b)=>titleScore(a)-titleScore(b));
}

export function renderPrimaryGlobalSearch<Locale extends string>({
  query,
  document,
  locale,
  defaultLocale,
  data,
  labels,
  palName,
  itemName,
  partnerSkillName,
  routes,
  palSlug,
  itemSlug,
  activeSkillSlug,
  passiveSkillSlug,
  partnerSkillSlug,
  href,
  renderIcon,
  escape,
  publicAssetHtml
}:{
  query:string;
  document:Document;
  locale:Locale;
  defaultLocale:Locale;
  data:GlobalSearchData<Locale>;
  labels:GlobalSearchLabels;
  palName:(pal:GlobalSearchPal<Locale>)=>string;
  itemName:(item:GlobalSearchItem<Locale>)=>string;
  partnerSkillName:(skill:GlobalSearchPartnerSkill<Locale>,pal:GlobalSearchPal<Locale>|undefined)=>string;
  routes?:readonly GlobalSearchRoute[];
  palSlug?:(pal:GlobalSearchPal<Locale>)=>string;
  itemSlug?:(item:GlobalSearchItem<Locale>)=>string;
  activeSkillSlug?:(skill:GlobalSearchActiveSkill<Locale>)=>string;
  passiveSkillSlug?:(skill:GlobalSearchPassiveSkill<Locale>)=>string;
  partnerSkillSlug?:(skill:GlobalSearchPartnerSkill<Locale>)=>string;
  href:(path:string)=>string;
  renderIcon:(name:IconName)=>string;
  escape:(value:string)=>string;
  publicAssetHtml:(html:string)=>string;
}){
  const target=document.querySelector<HTMLElement>("#global-search-results"),status=document.querySelector<HTMLElement>("#global-search-status");
  if(!target||!status)return 0;
  if(!query.trim()){
    target.innerHTML="";
    status.textContent="";
    return 0;
  }
  const results=findGlobalSearchResults({query,locale,defaultLocale,data,labels,palName,itemName,partnerSkillName,routes,palSlug,itemSlug,activeSkillSlug,passiveSkillSlug,partnerSkillSlug});
  const shown=results.slice(0,40);
  status.textContent=`${results.length.toLocaleString(locale)} ${labels.results}`;
  target.innerHTML=publicAssetHtml(shown.map(result=>`<a href="${href(result.path)}" data-global-result>${result.image?`<img src="${result.image}" alt="" width="52" height="52">`:`<span class="search-result-icon">${renderIcon(result.icon||"search")}</span>`}<span><strong>${escape(result.title)}</strong><small>${escape(result.meta)}</small></span></a>`).join("")||`<p class="empty-compact">${escape(labels.noResult)}</p>`);
  return results.length;
}
