import type {Locale} from "../config.ts";
import type {Messages} from "../i18n.ts";
import {questCopy} from "../quest-i18n.ts";

type QuestRewardItem={itemId:string;names:Record<Locale,string>;quantity:number;image:boolean};
type Quest={slug:string;kind:"main"|"side";order:number;parallel:boolean;names:Record<Locale,string>;descriptions:Record<Locale,string>;objectiveGroups:{steps:{texts:Record<Locale,string>}[]}[];rewards:{experience:number;items:QuestRewardItem[];additionalRewardStatus?:"unavailable"};previousSlugs:string[];nextSlugs:string[]};
type QuestData={quests:Quest[]};
type DatabaseTab="items"|"npcs"|"dungeons"|"technology"|"health"|"elements"|"structures"|"expeditions"|"quests";

type RenderContext={
  locale:Locale;
  defaultLocale:Locale;
  messages:Messages;
  questData:QuestData|null;
  questLoadError:boolean;
  href:(path:string)=>string;
  escape:(value:string)=>string;
  setMeta:(title:string,description?:string)=>void;
  hero:(title:string,...descriptions:string[])=>string;
  databaseTabs:(active:DatabaseTab)=>string;
  placeholder:(title:string)=>string;
};

type BindContext={
  document:Document;
  history:History;
  location:Pick<Location,"pathname"|"search">;
  locale:Locale;
  messages:Messages;
  trackEvent:(name:string,params:Record<string,string|number|boolean>)=>boolean;
  trackOnce:(key:string,name:string,params:Record<string,string|number|boolean>)=>boolean;
};

export function renderQuestsPage(slug:string|null,context:RenderContext){
  const {locale,defaultLocale,messages:m,questData,questLoadError,href,escape:esc,setMeta,hero,databaseTabs,placeholder}=context;
  const localizedRecord=(value:Record<Locale,string>)=>value[locale]||value[defaultLocale]||"";
  const questName=(quest:Quest)=>localizedRecord(quest.names);
  const questDescription=(quest:Quest)=>localizedRecord(quest.descriptions);
  const questKindLabel=(quest:Quest)=>quest.kind==="main"?questCopy[locale].main:questCopy[locale].side;
  function questCard(quest:Quest){const copy=questCopy[locale],objectiveText=quest.objectiveGroups.flatMap(group=>group.steps.flatMap(step=>Object.values(step.texts))),rewardText=quest.rewards.items.flatMap(item=>Object.values(item.names)),search=[quest.slug,...Object.values(quest.names),...Object.values(quest.descriptions),...objectiveText,...rewardText].join(" ").toLocaleLowerCase(locale);return `<article class="quest-card panel" data-quest="${esc(search)}" data-kind="${quest.kind}"><div class="quest-card-head"><span class="quest-kind ${quest.kind}">${esc(questKindLabel(quest))}</span><span class="quest-order">${esc(copy.sequence)} ${Number(quest.order+1).toLocaleString(locale)}</span>${quest.parallel?`<span class="quest-parallel">${esc(copy.parallel)}</span>`:""}</div><h2><a href="${href(`/database/quests/${quest.slug}`)}" data-link>${esc(questName(quest))}</a></h2><p class="quest-card-description">${esc(questDescription(quest).replace(/\s+/g," "))}</p><div class="quest-reward-summary"><span>${esc(copy.experience)} ${quest.rewards.experience.toLocaleString(locale)}</span><span>${esc(copy.items)} ${quest.rewards.items.length.toLocaleString(locale)}</span></div><a class="button quest-card-action" href="${href(`/database/quests/${quest.slug}`)}" data-link>${esc(copy.details)}</a></article>`}
  function questCollectionPage(){const copy=questCopy[locale],quests=[...(questData?.quests||[])].sort((a,b)=>(a.kind==="main"?0:1)-(b.kind==="main"?0:1)||a.order-b.order||a.slug.localeCompare(b.slug));setMeta(copy.title,copy.intro);if(questLoadError)return `${hero(copy.title)}<section class="section">${databaseTabs("quests")}<p class="notice">${esc(copy.loadError)}</p></section>`;return `${hero(copy.title)}<section class="section quest-catalog">${databaseTabs("quests")}<p class="collection-intro">${esc(copy.intro)}</p><div class="quest-filters"><label>${esc(copy.search)}<input id="quest-search" type="search" autocomplete="off"></label><label>${esc(copy.title)}<select id="quest-kind"><option value="">${esc(copy.all)}</option><option value="main">${esc(copy.main)}</option><option value="side">${esc(copy.side)}</option></select></label><button class="button" id="quest-reset" type="button">${esc(copy.reset)}</button></div><p id="quest-count" role="status">${quests.length.toLocaleString(locale)} ${m.results}</p><p id="quest-empty" class="empty-compact" hidden>${esc(copy.noResults)}</p><div class="quest-grid">${quests.map(questCard).join("")}</div></section>`}
  function questRelationList(slugs:string[]){return slugs.map(relationSlug=>{const quest=questData?.quests.find(entry=>entry.slug===relationSlug);return quest?`<li><a href="${href(`/database/quests/${quest.slug}`)}" data-link>${esc(questName(quest))}</a></li>`:""}).join("")}
  function questDetail(detailSlug:string){const copy=questCopy[locale],quest=questData?.quests.find(entry=>entry.slug===detailSlug);if(!quest)return questData?placeholder("404"):questLoadError?`${hero(copy.title)}<section class="section"><p class="notice">${esc(copy.loadError)}</p></section>`:"";const title=questName(quest),description=questDescription(quest);setMeta(title,description);const objectiveContent=quest.objectiveGroups.length?`<div class="quest-objective-groups">${quest.objectiveGroups.map(group=>`<ol class="quest-objective-group">${group.steps.map(step=>`<li>${esc(localizedRecord(step.texts))}</li>`).join("")}</ol>`).join("")}</div>`:`<p class="notice">${esc(copy.noObjectives)}</p>`;const itemRewards=quest.rewards.items.map(item=>`<li><a href="${href(`/items/${encodeURIComponent(item.itemId)}`)}" data-link>${item.image?`<img src="/assets/items/${encodeURIComponent(item.itemId)}.webp" alt="" width="44" height="44" loading="lazy">`:""}<span><strong>${esc(localizedRecord(item.names))}</strong> × ${item.quantity.toLocaleString(locale)}</span></a></li>`).join("");return `${hero(title)}<section class="section quest-detail"><a class="back-link" href="${href("/database/quests")}" data-link>← ${esc(copy.back)}</a><div class="quest-card-meta"><span class="quest-kind ${quest.kind}">${esc(questKindLabel(quest))}</span><span class="quest-order">${esc(copy.sequence)} ${Number(quest.order+1).toLocaleString(locale)}</span>${quest.parallel?`<span class="quest-parallel">${esc(copy.parallel)}</span>`:""}</div><article class="panel"><p class="quest-description">${esc(description)}</p></article><div class="quest-detail-grid"><section class="panel"><h2>${esc(copy.objectives)}</h2>${objectiveContent}<p class="quest-notice">${esc(copy.objectiveNotice)}</p></section><aside class="panel quest-rewards"><h2>${esc(copy.rewards)}</h2><dl><div><dt>${esc(copy.experience)}</dt><dd>${quest.rewards.experience.toLocaleString(locale)}</dd></div><div><dt>${esc(copy.items)}</dt><dd>${quest.rewards.items.length.toLocaleString(locale)}</dd></div></dl>${itemRewards?`<ul class="quest-reward-list">${itemRewards}</ul>`:""}${quest.rewards.additionalRewardStatus?`<p class="notice warning">${esc(copy.additionalUnavailable)}</p>`:""}</aside></div>${quest.previousSlugs.length||quest.nextSlugs.length?`<div class="quest-chain">${quest.previousSlugs.length?`<section class="panel"><h2>${esc(copy.previous)}</h2><ul>${questRelationList(quest.previousSlugs)}</ul></section>`:"<div></div>"}${quest.nextSlugs.length?`<section class="panel"><h2>${esc(copy.next)}</h2><ul>${questRelationList(quest.nextSlugs)}</ul></section>`:""}</div>`:""}</section>`}
  return slug===null?questCollectionPage():questDetail(slug);
}

export function bindQuestsPage(context:BindContext){
  const {document,history,location,locale,messages:m,trackEvent,trackOnce}=context;
  const questSearch=document.querySelector<HTMLInputElement>("#quest-search"),questKind=document.querySelector<HTMLSelectElement>("#quest-kind");
  const syncQuestUrl=()=>{const params=new URLSearchParams(location.search),query=questSearch?.value.trim()||"",kind=questKind?.value||"";if(query)params.set("q",query);else params.delete("q");if(kind)params.set("type",kind);else params.delete("type");history.replaceState({},"",`${location.pathname}${params.size?`?${params}`:""}`)};
  const filterQuests=()=>{if(!questSearch)return;const query=questSearch.value.trim().toLocaleLowerCase(locale),kind=questKind?.value||"";let count=0;document.querySelectorAll<HTMLElement>(".quest-card").forEach(card=>{const show=(!query||card.dataset.quest?.includes(query))&&(!kind||card.dataset.kind===kind);card.hidden=!show;if(show)count++});const status=document.querySelector<HTMLElement>("#quest-count"),empty=document.querySelector<HTMLElement>("#quest-empty");if(status)status.textContent=`${count.toLocaleString(locale)} ${m.results}`;if(empty)empty.hidden=count!==0;syncQuestUrl()};
  if(!questSearch)return;
  const params=new URLSearchParams(location.search);
  questSearch.value=params.get("q")||"";
  const requestedKind=params.get("type")||"";
  if(questKind&&[...questKind.options].some(option=>option.value===requestedKind))questKind.value=requestedKind;
  filterQuests();
  questSearch.addEventListener("input",()=>{filterQuests();if(questSearch.value.trim())trackOnce("search:quest","collection_search",{collection:"quest"})});
  questKind?.addEventListener("change",()=>{filterQuests();trackEvent("collection_filter",{collection:"quest",filter:"kind"})});
  document.querySelector("#quest-reset")?.addEventListener("click",()=>{questSearch.value="";if(questKind)questKind.value="";filterQuests();questSearch.focus()});
}
