import {messages} from "../src/i18n.ts";
import {itemCategoryFieldLabels,itemCategoryLabel} from "../src/item-categories.ts";
import {npcCopy} from "../src/npc-i18n.ts";
import {dungeonCopy} from "../src/dungeon-i18n.ts";
import {technologyCopy} from "../src/technology-i18n.ts";
import {partnerLabel,passiveUiLabels,skillLabels} from "../src/skill-i18n.ts";
import {collectionRoutes,entityRouteFamilies,routeFamilies,shellNavigation,supportedLocales} from "../src/route-manifest.ts";

export const productionOrigin="https://palworld-helper.woofy.blog";
export const defaultLocale="en-US";
const siteName="Palworld Helper";

export const mapSeoCopy={
  "en-US":{title:"Palpagos interactive map",body:"Explore verified bosses, fast travel points and Pal habitats on the game map."},"ko-KR":{title:"팔파고스 탐험 지도",body:"게임 지도에서 검증된 보스 팰, 빠른 이동 지점과 팰 서식지를 찾아보세요."},"ja-JP":{title:"パルパゴス探索マップ",body:"検証済みのボス、ファストトラベル、パルの生息地をゲームマップで探索できます。"},"zh-CN":{title:"帕洛斯群岛探索地图",body:"在游戏地图上查找经过验证的首领帕鲁、快速移动点和帕鲁栖息地。"},"zh-TW":{title:"帕洛斯群島探索地圖",body:"在遊戲地圖上尋找經過驗證的頭目帕魯、快速移動點與帕魯棲息地。"},"fr-FR":{title:"Carte interactive de Palpagos",body:"Explorez les boss, points de voyage rapide et habitats de Pals vérifiés."},"it-IT":{title:"Mappa interattiva di Palpagos",body:"Esplora boss, punti di viaggio rapido e habitat dei Pal verificati."},"de-DE":{title:"Interaktive Palpagos-Karte",body:"Erkunde verifizierte Bosse, Schnellreisepunkte und Pal-Lebensräume."},"es-ES":{title:"Mapa interactivo de Palpagos",body:"Explora jefes, puntos de viaje rápido y hábitats de Pals verificados."},"es-419":{title:"Mapa interactivo de Palpagos",body:"Explora jefes, puntos de viaje rápido y hábitats de Pals verificados."},"pt-BR":{title:"Mapa interativo de Palpagos",body:"Explore chefes, pontos de viagem rápida e habitats de Pals verificados."},"ru-RU":{title:"Интерактивная карта Палпагоса",body:"Исследуйте проверенные места боссов, быстрого перемещения и обитания Палов."},"id-ID":{title:"Peta interaktif Palpagos",body:"Jelajahi bos, titik perjalanan cepat, dan habitat Pal yang terverifikasi."},"th-TH":{title:"แผนที่สำรวจพัลพากอส",body:"สำรวจบอส จุดเดินทางด่วน และถิ่นอาศัยของพัลที่ผ่านการตรวจสอบ"},"tr-TR":{title:"Palpagos etkileşimli haritası",body:"Doğrulanmış bossları, hızlı seyahat noktalarını ve Pal yaşam alanlarını keşfet."},"vi-VN":{title:"Bản đồ tương tác Palpagos",body:"Khám phá boss, điểm dịch chuyển nhanh và môi trường sống của Pal đã xác minh."},"pl-PL":{title:"Interaktywna mapa Palpagos",body:"Odkrywaj zweryfikowane bossy, punkty szybkiej podróży i siedliska Pali."}
};
export const mapSeoTranslationProvenance=Object.fromEntries(supportedLocales.map(locale=>[locale,"gpt"]));

const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const clean=value=>String(value??"").replace(/\s+/g," ").trim();
const useful=value=>{const text=clean(value);return text&&!/Error_Code:|\||\(\s*\)/.test(text)?text:""};
const localized=(entity,locale,field="names")=>clean(entity?.[field]?.[locale]||entity?.[field]?.[defaultLocale]||"");
const localizedDescription=(entity,locale,field="descriptions")=>useful(entity?.[field]?.[locale]||entity?.[field]?.[defaultLocale]||"");
const href=(locale,route="")=>`/${locale}${route?`/${route.replace(/^\//,"")}`:""}`;
const absolute=(origin,locale,route="")=>`${origin}${href(locale,route)}`;
const entityId=entity=>entity.slug??entity.id;
const addCount=(map,key,value=1)=>map.set(key,(map.get(key)||0)+value);

export function createEntityDatasets({palData,itemData,skillData,npcData,dungeonData,technologyData}){
  return {pals:palData.pals,items:itemData.items,activeSkills:skillData.activeSkills,passiveSkills:skillData.passiveSkills,partnerSkills:skillData.partnerSkills,npcs:npcData.npcs,dungeons:dungeonData.dungeons,technologies:technologyData.technologies};
}

function relationScores({palData,itemData,skillData,npcData,dungeonData,technologyData}){
  const item=new Map(),active=new Map(),passive=new Map(),partner=new Map(),technology=new Map();
  for(const recipe of itemData.recipes){addCount(item,recipe.productId,14);for(const ingredient of recipe.ingredients)addCount(item,ingredient.itemId,4)}
  for(const drop of itemData.drops)addCount(item,drop.itemId,8);
  for(const dungeon of dungeonData.dungeons){
    const pools=[...dungeon.itemPools,...dungeon.rewardSources.flatMap(source=>source.itemPools||[])];
    for(const candidate of pools.flatMap(pool=>pool.slots.flatMap(slot=>slot.candidates)))addCount(item,candidate.itemId,10);
  }
  for(const npc of npcData.npcs){
    const offers=npc.merchant?.type==="items"?(npc.merchant.offers||[]):npc.merchant?.type==="item-profiles"?npc.merchant.profiles.flatMap(profile=>profile.offers||[]):[];
    for(const offer of offers)addCount(item,offer.itemId,6);
    for(const step of npc.events?.steps||[]){if(step.requestItemId)addCount(item,step.requestItemId,5);for(const reward of step.rewards||[])addCount(item,reward.itemId,6)}
  }
  for(const pal of palData.pals)for(const id of pal.guaranteedPassiveIds||[])addCount(passive,id,18);
  for(const skill of skillData.activeSkills){addCount(active,skill.id,(skill.power>0?4:0)+(skill.canInherit?3:0)+(skill.hasSkillFruit?5:0))}
  for(const skill of skillData.passiveSkills)addCount(passive,skill.id,Math.abs(skill.rank||0)+(skill.surgeryCost>0?3:0));
  for(const skill of skillData.partnerSkills)addCount(partner,skill.id,12);
  for(const entry of technologyData.technologies){addCount(technology,entry.slug,entry.unlocks.length*3+entry.dependents.length*8+(entry.prerequisite?10:0)+(entry.towerBossRequired?8:0)+(entry.labResearch?12:0));if(entry.prerequisite)addCount(technology,entry.prerequisite.slug,12)}
  return {items:item,activeSkills:active,passiveSkills:passive,partnerSkills:partner,technologies:technology};
}

export function selectPrerenderEntities(data){
  const datasets=createEntityDatasets(data),scores=relationScores(data),selection={};
  for(const family of entityRouteFamilies){
    const entities=datasets[family.dataset];
    if(family.prerender==="all"){selection[family.dataset]=entities;continue}
    const scoreMap=scores[family.dataset]||new Map();
    selection[family.dataset]=[...entities].sort((a,b)=>{
      const descriptionScore=entity=>Object.values(entity.descriptions||entity.palDescriptions||{}).filter(useful).length*2;
      const score=entity=>descriptionScore(entity)+(scoreMap.get(entityId(entity))||0);
      return score(b)-score(a)||String(entityId(a)).localeCompare(String(entityId(b)));
    }).slice(0,family.priorityLimit);
  }
  return selection;
}

export function buildIndexableGroups(data,origin=productionOrigin){
  const datasets=createEntityDatasets(data);
  const collections=supportedLocales.flatMap(locale=>collectionRoutes.map(route=>absolute(origin,locale,route)));
  const groups={collections};
  for(const family of entityRouteFamilies)groups[family.sitemap]=supportedLocales.flatMap(locale=>datasets[family.dataset].map(entity=>absolute(origin,locale,`${family.prefix}/${encodeURIComponent(entityId(entity))}`)));
  return groups;
}

export function buildPrerenderEntries(data){
  const selected=selectPrerenderEntities(data),entries=[];
  for(const locale of supportedLocales){
    for(const route of collectionRoutes)entries.push({locale,route,kind:"collection"});
    for(const family of entityRouteFamilies)for(const entity of selected[family.dataset])entries.push({locale,route:`${family.prefix}/${encodeURIComponent(entityId(entity))}`,kind:"entity",dataset:family.dataset,entity});
  }
  return {entries,selected};
}

function shellLabel(item,locale,m){return item.id==="home"?m.home:item.id==="map"?m.map:item.id==="pals"?m.pals:item.id==="skills"?skillLabels[locale].title:item.id==="calculators"?m.calculators:item.id==="database"?m.database:m.server}
function shell(locale,route,title,content){
  const m=messages(locale),links=shellNavigation.map(item=>`<a href="${href(locale,item.path)}"${route===item.path||item.path&&route.startsWith(`${item.path}/`)?' aria-current="page"':""}>${esc(shellLabel(item,locale,m))}</a>`).join("");
  return `<a class="skip-link" href="#main">${esc(m.skip)}</a><header class="site-header prerender-header"><a class="brand" href="${href(locale)}"><span class="brand-mark"><img src="/favicon.svg" alt="" width="34" height="34"></span><span>${siteName}</span></a><nav class="primary-nav" aria-label="${esc(m.home)}">${links}</nav></header><main id="main" data-prerender-content>${content}</main><footer><div><strong>${siteName}</strong><p>${esc(m.footer)}</p></div></footer>`;
}
const hero=(m,title)=>`<section class="page-hero"><p class="eyebrow">${esc(m.verified)}</p><h1>${esc(title)}</h1></section>`;
const relationLinks=links=>links.length?`<div class="relation-list entity-relation-list seo-link-list">${links.map(link=>`<a href="${esc(link.href)}">${link.image?`<img src="${esc(link.image)}" alt="" width="48" height="48" loading="lazy">`:""}<span><strong>${esc(link.label)}</strong>${link.detail?`<small>${esc(link.detail)}</small>`:""}</span></a>`).join("")}</div>`:"";
const uniqueLinks=links=>[...new Map(links.filter(link=>link?.label).map(link=>[link.href,link])).values()];
const breadcrumb=(locale,parentRoute,parentLabel,title)=>`<nav class="breadcrumbs" aria-label="${esc(messages(locale).home)}"><a href="${href(locale)}">${esc(messages(locale).home)}</a><a href="${href(locale,parentRoute)}">${esc(parentLabel)}</a><span aria-current="page">${esc(title)}</span></nav>`;
const details=facts=>`<dl class="detail-stats">${facts.filter(([,value])=>value!==undefined&&value!==null&&value!=="").map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;

function pageStructuredData({origin,locale,route,title,description,type,parent}){
  if(!type)return null;
  const url=absolute(origin,locale,route),page={"@type":type,name:title,url,description,inLanguage:locale};
  if(type==="WebApplication"){page.applicationCategory="GameApplication";page.operatingSystem="Any"}
  if(type==="WebSite")return {"@context":"https://schema.org",...page};
  const graph=[page];
  if(parent)graph.push({"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:messages(locale).home,item:absolute(origin,locale)},{"@type":"ListItem",position:2,name:parent.label,item:absolute(origin,locale,parent.route)},{"@type":"ListItem",position:3,name:title,item:url}]});
  return {"@context":"https://schema.org","@graph":graph};
}

function collectionModel(route,locale,data,selection){
  const {palData,itemData,skillData,npcData,dungeonData}=data,m=messages(locale),skills=skillLabels[locale],dungeons=dungeonCopy[locale],npcs=npcCopy[locale],technology=technologyCopy[locale];
  let title,description,links=[],type="CollectionPage";
  if(route===""){title=m.hero;description=m.tagline;type="WebSite";links=[{href:href(locale,"pals"),label:m.palDex},{href:href(locale,"calculators/breeding"),label:m.breeding},{href:href(locale,"database"),label:m.itemDatabase},{href:href(locale,"database/technology"),label:technology.title},{href:href(locale,"database/dungeons"),label:dungeons.title}]}
  else if(route==="map"){({title,body:description}=mapSeoCopy[locale]);type="WebApplication";links=[{href:href(locale,"pals"),label:m.palDex},{href:href(locale,"database/dungeons"),label:dungeons.title},{href:href(locale,"database/npcs"),label:npcs.catalogTitle}]}
  else if(route==="pals"){title=m.palDex;description=`${m.palDex}. ${m.tagline}`;links=[...palData.pals].sort((a,b)=>a.dex-b.dex||Number(a.variant)-Number(b.variant)||a.id.localeCompare(b.id)).map(pal=>({href:href(locale,`pals/${encodeURIComponent(pal.id)}`),label:`#${pal.dex}${pal.variant?"B":""} ${localized(pal,locale)}`,image:`/assets/pals/${encodeURIComponent(pal.id)}.png`}))}
  else if(route==="skills"||route.startsWith("skills/")){const group=route.split("/")[1];title=group==="active"?skills.active:group==="passive"?skills.passive:group==="partner"?partnerLabel[locale]:skills.title;description=[skills.active,skills.passive,partnerLabel[locale]].join(" · ");const datasets=group==="active"?["activeSkills"]:group==="passive"?["passiveSkills"]:group==="partner"?["partnerSkills"]:["activeSkills","passiveSkills","partnerSkills"];links=datasets.flatMap(dataset=>selection[dataset].map(entity=>({href:href(locale,`${dataset==="activeSkills"?"skills/active":dataset==="passiveSkills"?"skills/passive":"skills/partner"}/${encodeURIComponent(entity.id)}`),label:localized(entity,locale)||localized(palData.pals.find(pal=>pal.id===entity.palId),locale)})))}
  else if(route==="calculators"||route==="calculators/breeding"){title=route==="calculators"?m.calculators:m.breeding;description=m.breedingBody;type="WebApplication";links=[{href:href(locale,"pals"),label:m.palDex},{href:href(locale,"calculators/crafting"),label:m.crafting}]}
  else if(route==="calculators/crafting"){title=m.crafting;description=m.craftingBody;type="WebApplication";links=selection.items.map(item=>({href:href(locale,`items/${encodeURIComponent(item.id)}`),label:localized(item,locale),image:`/assets/items/${encodeURIComponent(item.id)}.webp`}))}
  else if(route==="database"){title=m.itemDatabase;description=m.itemDatabaseBody;links=selection.items.map(item=>({href:href(locale,`items/${encodeURIComponent(item.id)}`),label:localized(item,locale),image:`/assets/items/${encodeURIComponent(item.id)}.webp`,detail:itemCategoryLabel(item.type,locale)}))}
  else if(route==="database/technology"){title=technology.title;description=technology.intro;links=[...selection.technologies].sort((a,b)=>a.level-b.level||a.order-b.order||a.slug.localeCompare(b.slug)).map(entry=>({href:href(locale,`database/technology/${entry.slug}`),label:localized(entry,locale),image:`/assets/technology/${encodeURIComponent(entry.slug)}.webp`,detail:`${technology.level} ${entry.level.toLocaleString(locale)} · ${entry.kind==="ancient"?technology.ancient:technology.regular}`}))}
  else if(route==="database/npcs"){title=npcs.catalogTitle;description=npcs.catalogIntro;links=[...npcData.npcs].sort((a,b)=>new Intl.Collator(locale,{numeric:true}).compare(localized(a,locale),localized(b,locale))||a.slug.localeCompare(b.slug)).map(npc=>({href:href(locale,`database/npcs/${npc.slug}`),label:localized(npc,locale)}))}
  else if(route==="database/dungeons"){title=dungeons.title;description=dungeons.intro;links=[...dungeonData.dungeons].sort((a,b)=>(a.encounterLevel?.min??999)-(b.encounterLevel?.min??999)||new Intl.Collator(locale).compare(localized(a,locale),localized(b,locale))).map(dungeon=>({href:href(locale,`database/dungeons/${dungeon.slug}`),label:localized(dungeon,locale),image:"/assets/map-icons/dungeon.webp"}))}
  else {title=m.serverTitle;description=m.footer;type="WebApplication";links=[]}
  const body=route===""?`<section class="hero"><div class="hero-copy"><p class="eyebrow">${esc(m.verified)}</p><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p>${relationLinks(links)}</div></section>`:`${hero(m,title)}<section class="section"><p class="collection-intro">${esc(description)}</p>${relationLinks(links)}</section>`;
  return {title,description,body,type};
}

function palModel(locale,pal,data){
  const {palData,itemData,skillData,dungeonData}=data,m=messages(locale),title=localized(pal,locale),description=localizedDescription(pal,locale)||m.tagline,itemsById=new Map(itemData.items.map(item=>[item.id,item])),passives=new Map(skillData.passiveSkills.map(skill=>[skill.id,skill]));
  const workById=new Map(palData.workSuitabilities.map(work=>[work.id,work])),work=Object.entries(pal.work).filter(([,level])=>level>0).sort((a,b)=>b[1]-a[1]).map(([id,level])=>`${localized(workById.get(id),locale)} ${level}`).join(" · ");
  const itemLinks=itemData.drops.filter(drop=>drop.palId===pal.id).map(drop=>{const item=itemsById.get(drop.itemId);return item?{href:href(locale,`items/${encodeURIComponent(item.id)}`),label:localized(item,locale),image:`/assets/items/${encodeURIComponent(item.id)}.webp`}:null});
  const dungeonLinks=dungeonData.dungeons.filter(dungeon=>dungeon.encounterGroups.some(group=>group.members.some(member=>member.palId===pal.id))).map(dungeon=>({href:href(locale,`database/dungeons/${dungeon.slug}`),label:localized(dungeon,locale),image:"/assets/map-icons/dungeon.webp"}));
  const passiveLinks=(pal.guaranteedPassiveIds||[]).map(id=>passives.get(id)).filter(Boolean).map(skill=>({href:href(locale,`skills/passive/${encodeURIComponent(skill.id)}`),label:localized(skill,locale)}));
  const facts=details([[m.hp,pal.hp],[m.attack,pal.attack],[m.defense,pal.defense],[m.rarity,pal.rarity],[m.work,work],[m.nocturnal,pal.nocturnal?m.yes:m.no]]);
  const body=`${hero(m,title)}<article class="entity-detail pal-detail panel"><img class="detail-image" src="/assets/pals/${encodeURIComponent(pal.id)}.png" alt="${esc(title)}" width="240" height="240"><div class="entity-detail-content">${breadcrumb(locale,"pals",m.palDex,title)}<p class="pal-number">#${pal.dex}${pal.variant?"B":""}</p><p class="entity-description">${esc(description)}</p>${facts}${passiveLinks.length?`<section class="detail-section"><h2>${esc(skillLabels[locale].passive)}</h2>${relationLinks(passiveLinks)}</section>`:""}${itemLinks.length?`<section class="detail-section"><h2>${esc(m.itemDatabase)}</h2>${relationLinks(uniqueLinks(itemLinks))}</section>`:""}${dungeonLinks.length?`<section class="detail-section"><h2>${esc(dungeonCopy[locale].title)}</h2>${relationLinks(dungeonLinks)}</section>`:""}<div class="detail-actions"><a class="button primary" href="${href(locale,"calculators/breeding")}">${esc(m.openBreed)}</a><a class="button" href="${href(locale,"map")}?pal=${encodeURIComponent(pal.id)}">${esc(m.map)}</a></div></div></article>`;
  return {title,description,body,type:null};
}

function itemModel(locale,item,data){
  const {palData,itemData,dungeonData}=data,m=messages(locale),title=localized(item,locale),description=localizedDescription(item,locale)||m.itemDatabaseBody,itemsById=new Map(itemData.items.map(entry=>[entry.id,entry])),palsById=new Map(palData.pals.map(pal=>[pal.id,pal]));
  const recipes=itemData.recipes.filter(recipe=>recipe.productId===item.id),usedIn=itemData.recipes.filter(recipe=>recipe.ingredients.some(ingredient=>ingredient.itemId===item.id));
  const ingredients=recipes.flatMap(recipe=>recipe.ingredients).map(ingredient=>{const related=itemsById.get(ingredient.itemId);return related?{href:href(locale,`items/${encodeURIComponent(related.id)}`),label:localized(related,locale),image:`/assets/items/${encodeURIComponent(related.id)}.webp`,detail:`× ${ingredient.count.toLocaleString(locale)}`}:null});
  const products=usedIn.map(recipe=>itemsById.get(recipe.productId)).filter(Boolean).map(product=>({href:href(locale,`items/${encodeURIComponent(product.id)}`),label:localized(product,locale),image:`/assets/items/${encodeURIComponent(product.id)}.webp`}));
  const drops=itemData.drops.filter(drop=>drop.itemId===item.id).map(drop=>palsById.get(drop.palId)).filter(Boolean).map(pal=>({href:href(locale,`pals/${encodeURIComponent(pal.id)}`),label:`#${pal.dex}${pal.variant?"B":""} ${localized(pal,locale)}`,image:`/assets/pals/${encodeURIComponent(pal.id)}.png`}));
  const dungeons=dungeonData.dungeons.filter(dungeon=>[...dungeon.itemPools,...dungeon.rewardSources.flatMap(source=>source.itemPools||[])].some(pool=>pool.slots.some(slot=>slot.candidates.some(candidate=>candidate.itemId===item.id)))).map(dungeon=>({href:href(locale,`database/dungeons/${dungeon.slug}`),label:localized(dungeon,locale),image:"/assets/map-icons/dungeon.webp"}));
  const facts=details([[itemCategoryFieldLabels[locale],itemCategoryLabel(item.type,locale)],[m.rank,item.rank],[m.rarity,item.rarity],[m.stack,item.maxStack.toLocaleString(locale)],[m.weight,item.weight.toLocaleString(locale)],[m.price,item.price.toLocaleString(locale)]]);
  const body=`${hero(m,title)}<article class="entity-detail item-detail panel"><img class="detail-image" src="/assets/items/${encodeURIComponent(item.id)}.webp" alt="${esc(title)}" width="192" height="192"><div class="entity-detail-content">${breadcrumb(locale,"database",m.itemDatabase,title)}<p class="entity-description">${esc(description)}</p>${facts}${ingredients.length?`<section class="detail-section"><h2>${esc(m.crafting)}</h2>${relationLinks(uniqueLinks(ingredients))}</section>`:""}${products.length?`<section class="detail-section"><h2>${esc(m.results)}</h2>${relationLinks(uniqueLinks(products))}</section>`:""}${drops.length?`<section class="detail-section"><h2>${esc(m.pals)}</h2>${relationLinks(uniqueLinks(drops))}</section>`:""}${dungeons.length?`<section class="detail-section"><h2>${esc(dungeonCopy[locale].title)}</h2>${relationLinks(dungeons)}</section>`:""}</div></article>`;
  return {title,description,body,type:null};
}

function skillModel(locale,skill,dataset,data){
  const {palData,skillData}=data,m=messages(locale),labels=skillLabels[locale],palById=new Map(palData.pals.map(pal=>[pal.id,pal])),title=localized(skill,locale)||localized(palById.get(skill.palId),locale),description=localizedDescription(skill,locale,dataset==="partnerSkills"?"palDescriptions":"descriptions")||(dataset==="activeSkills"?labels.active:dataset==="passiveSkills"?labels.passive:partnerLabel[locale]);
  let facts=[],links=[],image="";
  if(dataset==="activeSkills"){const element=skillData.elements.find(entry=>entry.id===skill.elementId);facts=[[labels.elements,localized(element,locale)],[labels.power,skill.power],[labels.cooldown,skill.cooldown],[labels.inherit,skill.canInherit?m.yes:m.no]];image=element?.icon||""}
  else if(dataset==="passiveSkills")facts=[[passiveUiLabels[locale].rank,`${skill.rank>=0?"+":""}${skill.rank}`],[labels.inherit,skill.randomInheritanceAllowed?m.yes:m.no],[passiveUiLabels[locale].surgery,skill.surgeryCost.toLocaleString(locale)]];
  else {const pal=palById.get(skill.palId);if(pal){links=[{href:href(locale,`pals/${encodeURIComponent(pal.id)}`),label:`#${pal.dex}${pal.variant?"B":""} ${localized(pal,locale)}`,image:`/assets/pals/${encodeURIComponent(pal.id)}.png`}];image=`/assets/pals/${encodeURIComponent(pal.id)}.png`}}
  const parent=dataset==="activeSkills"?"skills/active":dataset==="passiveSkills"?"skills/passive":"skills/partner",parentLabel=dataset==="activeSkills"?labels.active:dataset==="passiveSkills"?labels.passive:partnerLabel[locale];
  const body=`${hero(m,title)}<article class="entity-detail panel">${image?`<img class="detail-image" src="${esc(image)}" alt="${esc(title)}" width="192" height="192">`:""}<div class="entity-detail-content">${breadcrumb(locale,parent,parentLabel,title)}<p class="entity-description">${esc(description)}</p>${details(facts)}${relationLinks(links)}</div></article>`;
  return {title,description,body,type:null};
}

function technologyModel(locale,technology){
  const m=messages(locale),copy=technologyCopy[locale],title=localized(technology,locale),description=clean(technology.descriptions?.[locale]||technology.descriptions?.[defaultLocale]||copy.intro).replace(/\|/g,""),kind=technology.kind==="ancient"?copy.ancient:copy.regular,category=technology.category==="building"?copy.building:copy.item,pointLabel=technology.kind==="ancient"?copy.ancientPoints:copy.regularPoints;
  const conditions=[];
  if(technology.prerequisite)conditions.push({href:href(locale,`database/technology/${technology.prerequisite.slug}`),label:localized(technology.prerequisite,locale),detail:copy.prerequisite});
  const tower=technology.towerBossRequired?`<p class="notice"><strong>${esc(copy.towerBoss)}</strong> — ${esc(copy.towerBossNote)}</p>`:"";
  const research=technology.labResearch?`<section class="detail-section"><h2>${esc(copy.research)}</h2><p><strong>${esc(localized(technology.labResearch,locale))}</strong></p>${details([[copy.researchWork,technology.labResearch.workAmount.toLocaleString(locale)],[copy.researchPrerequisite,localized(technology.labResearch.prerequisiteNames?{names:technology.labResearch.prerequisiteNames}:null,locale)]])}${technology.labResearch.materials.length?`<h3>${esc(copy.researchMaterials)}</h3><ul>${technology.labResearch.materials.map(material=>`<li>${esc(localized(material,locale))} × ${material.count.toLocaleString(locale)}</li>`).join("")}</ul>`:""}</section>`:"";
  const unlocks=`<ul class="technology-unlocks">${technology.unlocks.map(unlock=>`<li><span>${esc(unlock.kind==="building"?copy.building:copy.item)}</span><strong>${esc(localized(unlock,locale))}</strong></li>`).join("")}</ul>`;
  const dependents=technology.dependents.map(relation=>({href:href(locale,`database/technology/${relation.slug}`),label:localized(relation,locale)}));
  const body=`${hero(m,title)}<article class="entity-detail technology-summary panel ${technology.kind}"><img class="detail-image" src="/assets/technology/${encodeURIComponent(technology.slug)}.webp" alt="${esc(title)}" width="220" height="220"><div class="entity-detail-content">${breadcrumb(locale,"database/technology",copy.title,title)}<p class="entity-description">${esc(description)}</p>${details([[copy.requiredLevel,technology.level.toLocaleString(locale)],[copy.pointCost,`${technology.pointCost.toLocaleString(locale)} ${pointLabel}`],[copy.kind,kind],[copy.category,category]])}${conditions.length?`<section class="detail-section"><h2>${esc(copy.conditions)}</h2>${relationLinks(conditions)}</section>`:""}${tower}${research}<section class="detail-section"><h2>${esc(copy.unlocks)}</h2>${unlocks}</section>${dependents.length?`<section class="detail-section"><h2>${esc(copy.dependents)}</h2>${relationLinks(dependents)}</section>`:""}<p class="technology-scope-note">${esc(copy.scopeNote)}</p></div></article>`;
  return {title,description,body,type:"WebPage",parent:{route:"database/technology",label:copy.title}};
}

function npcDescription(npc,locale){const copy=npcCopy[locale];return npc.merchant?.type==="items"||npc.merchant?.type==="item-profiles"?copy.itemMerchantDescription:npc.merchant?.type==="pals"?copy.palMerchantDescription:npc.events?.type==="achievement"?copy.achievementDescription:npc.events?.type==="item-request"?copy.foodDescription:npc.events?.type==="pal-request"?copy.palCriticDescription:npc.kind==="merchant"?copy.stockUnavailable:npc.kind==="quest"?copy.questDescription:npc.kind==="guide"?copy.guideDescription:npc.kind==="combat"?copy.combatDescription:npc.kind==="reward"?copy.rewardDescription:copy.characterDescription}
function npcModel(locale,npc,data){
  const {palData,itemData}=data,m=messages(locale),copy=npcCopy[locale],title=localized(npc,locale),description=npcDescription(npc,locale),items=new Map(itemData.items.map(item=>[item.id,item])),pals=new Map(palData.pals.map(pal=>[pal.id,pal]));
  const offers=npc.merchant?.type==="items"?(npc.merchant.offers||[]):npc.merchant?.type==="item-profiles"?npc.merchant.profiles.flatMap(profile=>profile.offers||[]):[];
  const itemLinks=[...offers.map(offer=>items.get(offer.itemId)),...(npc.events?.steps||[]).flatMap(step=>(step.rewards||[]).map(reward=>items.get(reward.itemId)))].filter(Boolean).map(item=>({href:href(locale,`items/${encodeURIComponent(item.id)}`),label:localized(item,locale),image:`/assets/items/${encodeURIComponent(item.id)}.webp`}));
  const palLinks=npc.merchant?.type==="pals"?npc.merchant.profiles.flatMap(profile=>profile.palIds.map(id=>pals.get(id))).filter(Boolean).map(pal=>({href:href(locale,`pals/${encodeURIComponent(pal.id)}`),label:`#${pal.dex}${pal.variant?"B":""} ${localized(pal,locale)}`,image:`/assets/pals/${encodeURIComponent(pal.id)}.png`})):[];
  const body=`${hero(m,title)}<article class="entity-detail panel"><img class="detail-image" src="/assets/map-icons/${npc.kind==="merchant"?"merchant":npc.kind==="combat"?"wanted":"npc"}.webp" alt="" width="128" height="128"><div class="entity-detail-content">${breadcrumb(locale,"database/npcs",copy.catalogTitle,title)}<p class="entity-description">${esc(description)}</p>${details([[copy.roles,npc.roles.length.toLocaleString(locale)],[copy.fixedLocations,npc.encounters.length.toLocaleString(locale)],[copy.level,npc.level?`${npc.level.min.toLocaleString(locale)}${npc.level.min===npc.level.max?"":`–${npc.level.max.toLocaleString(locale)}`}`:copy.noFixedLocation]])}${itemLinks.length?`<section class="detail-section"><h2>${esc(copy.soldItems)}</h2>${relationLinks(uniqueLinks(itemLinks).slice(0,40))}</section>`:""}${palLinks.length?`<section class="detail-section"><h2>${esc(m.pals)}</h2>${relationLinks(uniqueLinks(palLinks).slice(0,40))}</section>`:""}</div></article>`;
  return {title,description,body,type:"WebPage",parent:{route:"database/npcs",label:copy.catalogTitle}};
}

function dungeonModel(locale,dungeon,data){
  const {palData,itemData}=data,m=messages(locale),copy=dungeonCopy[locale],title=localized(dungeon,locale),description=`${title} — ${copy.intro}`,pals=new Map(palData.pals.map(pal=>[pal.id,pal])),items=new Map(itemData.items.map(item=>[item.id,item]));
  const palLinks=dungeon.encounterGroups.flatMap(group=>group.members).map(member=>pals.get(member.palId)).filter(Boolean).map(pal=>({href:href(locale,`pals/${encodeURIComponent(pal.id)}`),label:`#${pal.dex}${pal.variant?"B":""} ${localized(pal,locale)}`,image:`/assets/pals/${encodeURIComponent(pal.id)}.png`}));
  const pools=[...dungeon.itemPools,...dungeon.rewardSources.flatMap(source=>source.itemPools||[])],itemLinks=pools.flatMap(pool=>pool.slots.flatMap(slot=>slot.candidates)).map(candidate=>items.get(candidate.itemId)).filter(Boolean).map(item=>({href:href(locale,`items/${encodeURIComponent(item.id)}`),label:localized(item,locale),image:`/assets/items/${encodeURIComponent(item.id)}.webp`}));
  const level=dungeon.encounterLevel?`${dungeon.encounterLevel.min.toLocaleString(locale)}${dungeon.encounterLevel.min===dungeon.encounterLevel.max?"":`–${dungeon.encounterLevel.max.toLocaleString(locale)}`}`:copy.noData;
  const body=`${hero(m,title)}<article class="dungeon-detail section"><section class="dungeon-summary panel"><img src="/assets/map-icons/dungeon.webp" alt="" width="96" height="96"><div>${breadcrumb(locale,"database/dungeons",copy.title,title)}<p class="entity-description">${esc(description)}</p>${details([[copy.encounterLevel,level],[copy.entrances,dungeon.summary.entranceCount.toLocaleString(locale)],[copy.possiblePals,dungeon.summary.palCount.toLocaleString(locale)],[copy.encounterGroups,dungeon.summary.encounterGroupCount.toLocaleString(locale)],[copy.itemCandidates,dungeon.summary.itemCandidateCount.toLocaleString(locale)]])}</div></section>${palLinks.length?`<section class="detail-section"><h2>${esc(copy.possiblePals)}</h2>${relationLinks(uniqueLinks(palLinks))}</section>`:""}${itemLinks.length?`<section class="detail-section"><h2>${esc(copy.possibleItems)}</h2><p class="notice">${esc(copy.itemNotice)}</p>${relationLinks(uniqueLinks(itemLinks).slice(0,80))}</section>`:""}</article>`;
  return {title,description,body,type:"WebPage",parent:{route:"database/dungeons",label:copy.title}};
}

export function renderRouteModel(entry,data,selection){
  if(entry.kind==="collection")return collectionModel(entry.route,entry.locale,data,selection);
  if(entry.dataset==="pals")return palModel(entry.locale,entry.entity,data);
  if(entry.dataset==="items")return itemModel(entry.locale,entry.entity,data);
  if(entry.dataset==="activeSkills"||entry.dataset==="passiveSkills"||entry.dataset==="partnerSkills")return skillModel(entry.locale,entry.entity,entry.dataset,data);
  if(entry.dataset==="npcs")return npcModel(entry.locale,entry.entity,data);
  if(entry.dataset==="technologies")return technologyModel(entry.locale,entry.entity);
  return dungeonModel(entry.locale,entry.entity,data);
}

export function renderHtmlDocument(template,entry,model,origin=productionOrigin){
  const canonical=absolute(origin,entry.locale,entry.route),title=`${model.title} · ${siteName}`,alternates=supportedLocales.map(locale=>`<link rel="alternate" hreflang="${locale}" href="${absolute(origin,locale,entry.route)}" data-dynamic-meta="true">`).join(""),structured=pageStructuredData({origin,locale:entry.locale,route:entry.route,title:model.title,description:model.description,type:model.type,parent:model.parent});
  const metadata=`<meta name="description" content="${esc(model.description)}" data-dynamic-meta="true"><link rel="canonical" href="${canonical}" data-dynamic-meta="true">${alternates}<link rel="alternate" hreflang="x-default" href="${absolute(origin,defaultLocale,entry.route)}" data-dynamic-meta="true"><meta property="og:type" content="website" data-dynamic-meta="true"><meta property="og:title" content="${esc(title)}" data-dynamic-meta="true"><meta property="og:description" content="${esc(model.description)}" data-dynamic-meta="true"><meta property="og:url" content="${canonical}" data-dynamic-meta="true"><meta property="og:image" content="${origin}/og-image.png" data-dynamic-meta="true"><meta name="twitter:card" content="summary_large_image" data-dynamic-meta="true"><meta name="twitter:title" content="${esc(title)}" data-dynamic-meta="true"><meta name="twitter:description" content="${esc(model.description)}" data-dynamic-meta="true"><meta name="twitter:image" content="${origin}/og-image.png" data-dynamic-meta="true">${structured?`<script type="application/ld+json" data-route-structured-data>${JSON.stringify(structured).replace(/</g,"\\u003c")}</script>`:""}`;
  return template.replace('<html lang="en-US"',`<html lang="${entry.locale}"`).replace(/<title>[^<]*<\/title>/,`<title>${esc(title)}</title>${metadata}`).replace('<div id="app"></div>',`<div id="app" data-prerender-route="/${entry.locale}/${esc(entry.route)}">${shell(entry.locale,entry.route,model.title,model.body)}</div>`);
}

export function routeRenderingReport(data,selection){
  const datasets=createEntityDatasets(data),collections=routeFamilies.map(route=>({path:route.path,mode:route.mode,indexable:route.indexable,searchIntent:route.searchIntent,indexableUrls:supportedLocales.length,prerenderedUrls:supportedLocales.length})),entities=entityRouteFamilies.map(family=>({prefix:family.prefix,dataset:family.dataset,mode:family.mode,searchIntent:family.searchIntent,indexableUrls:datasets[family.dataset].length*supportedLocales.length,prerenderedUrls:selection[family.dataset].length*supportedLocales.length,selection:family.prerender}));
  return {collections,entities};
}
