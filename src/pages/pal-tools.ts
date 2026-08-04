import type {Locale} from "../config.ts";
import type {Messages} from "../i18n.ts";
import {activeSkillOwner} from "../public-slugs.ts";
import {condensingPlan,differentComparisonRows,normalizePalSelection,teamCoverage,type CondensingStage} from "../pal-tools.ts";
import {palToolsCopy} from "../pal-tools-i18n.ts";

export type PalToolKind="compare"|"team"|"condensing";
type Work=Record<string,number>;
type Pal={id:string;dex:number;variant:boolean;names:Record<Locale,string>;hp:number;attack:number;defense:number;rarity:number;nocturnal:boolean;work:Work;elementSlugs:string[];guaranteedPassiveIds:string[]};
type PalData={pals:Pal[];workSuitabilities:{id:string;names:Record<Locale,string>}[]};
type Named={id:string;names:Record<Locale,string>};
type SkillData={elements:Named[];activeSkills:(Named&{elementId:string;power:number;cooldown:number})[];passiveSkills:Named[];partnerSkills:(Named&{palId:string})[]};
type MapData={bosses:{palId:string}[];habitats:{pals:{palId:string}[]}[]};
export type CondensingData={meta:{schema:number;gameBuild:string;verification:"verified";maxStars:number;stageCount:number};stages:CondensingStage[]};

type SharedContext={locale:Locale;defaultLocale:Locale;messages:Messages;data:PalData|null;skillData:SkillData|null;mapData:MapData|null;condensingData:CondensingData|null;location:Location;href:(path:string)=>string;escape:(value:string)=>string;palSlug:(pal:Pal)=>string};
type RenderContext=SharedContext&{setMeta:(title:string,description?:string)=>void;hero:(title:string)=>string};
type BindContext=SharedContext&{document:Document;history:History;render:()=>void;trackOnce:(key:string,name:string,params:Record<string,string>)=>unknown};

const name=(entity:{names:Record<Locale,string>},context:SharedContext)=>entity.names[context.locale]||entity.names[context.defaultLocale];
function selectedPals(context:SharedContext,maximum:number){
  const bySlug=new Map((context.data?.pals||[]).map(pal=>[context.palSlug(pal),pal.id]));
  const ids=normalizePalSelection(new URLSearchParams(context.location.search).get("pals")?.split(",").filter(Boolean)||[],bySlug,maximum);
  const byId=new Map((context.data?.pals||[]).map(pal=>[pal.id,pal]));
  return ids.map(id=>byId.get(id)).filter((pal):pal is Pal=>Boolean(pal));
}
function tabs(active:PalToolKind,context:SharedContext){
  const {messages:m,locale,href,escape:esc}=context,copy=palToolsCopy[locale];
  const entries=[
    ["breeding","/calculators/breeding",m.breeding],["crafting","/calculators/crafting",m.crafting],["base","/calculators/base",m.calculators],
    ["compare","/calculators/pal-compare",copy.compareTitle],["team","/calculators/team-builder",copy.teamTitle],["condensing","/calculators/condensing",copy.condensingTitle]
  ];
  return `<nav class="section-tabs calculator-tabs" aria-label="${esc(m.calculators)}">${entries.map(([id,path,label])=>`<a href="${href(path)}" data-link ${id===active?'aria-current="page"':""}>${esc(label)}</a>`).join("")}</nav>`;
}
function palPicker(selected:Pal[],maximum:number,context:SharedContext){
  const {messages:m,locale,escape:esc}=context,copy=palToolsCopy[locale],selectedIds=new Set(selected.map(pal=>pal.id));
  const options=[...(context.data?.pals||[])].filter(pal=>!selectedIds.has(pal.id)).sort((a,b)=>new Intl.Collator(locale,{numeric:true}).compare(name(a,context),name(b,context))||a.dex-b.dex).map(pal=>`<option value="${esc(context.palSlug(pal))}">#${pal.dex}${pal.variant?"B":""} ${esc(name(pal,context))}</option>`).join("");
  return `<div class="pal-tool-picker"><label>${esc(copy.addPal)}<select data-pal-picker ${selected.length>=maximum?"disabled":""}><option value="">${esc(m.choose)}</option>${options}</select></label><button class="button" type="button" data-add-pal ${selected.length>=maximum?"disabled":""}>${esc(copy.addPal)}</button></div><div class="pal-selection-list" aria-label="${esc(copy.selectedPals)}">${selected.map(pal=>`<article><a href="${context.href(`/pals/${pal.id}`)}" data-link><strong>#${pal.dex}${pal.variant?"B":""} ${esc(name(pal,context))}</strong></a><button type="button" class="button" data-remove-pal="${esc(context.palSlug(pal))}">${esc(copy.remove)}</button></article>`).join("")}</div>`;
}
function comparisonRows(selected:Pal[],context:SharedContext){
  const {messages:m,locale,escape:esc,skillData,mapData}=context,copy=palToolsCopy[locale];
  const elementById=new Map(skillData?.elements.map(entry=>[entry.id,entry])||[]),workById=new Map(context.data?.workSuitabilities.map(entry=>[entry.id,entry])||[]),passiveById=new Map(skillData?.passiveSkills.map(entry=>[entry.id,entry])||[]),partnerByPal=new Map(skillData?.partnerSkills.map(entry=>[entry.palId,entry])||[]);
  const uniqueByPal=new Map<string,string[]>();
  for(const skill of skillData?.activeSkills||[]){const owner=activeSkillOwner(skill,context.data?.pals||[]);if(owner)uniqueByPal.set(owner.id,[...(uniqueByPal.get(owner.id)||[]),name(skill,context)])}
  const list=(values:string[])=>values.filter(Boolean).join(", ")||"—";
  const rows=[
    {key:m.hp,values:selected.map(pal=>pal.hp.toLocaleString(locale))},{key:m.attack,values:selected.map(pal=>pal.attack.toLocaleString(locale))},{key:m.defense,values:selected.map(pal=>pal.defense.toLocaleString(locale))},{key:m.rarity,values:selected.map(pal=>pal.rarity.toLocaleString(locale))},{key:m.nocturnal,values:selected.map(pal=>pal.nocturnal?m.yes:m.no)},
    {key:copy.elements,values:selected.map(pal=>list(pal.elementSlugs.map(id=>elementById.get(id)).filter((entry):entry is Named=>Boolean(entry)).map(entry=>name(entry,context))))},
    {key:copy.work,values:selected.map(pal=>list(Object.entries(pal.work).filter(([,level])=>level>0).map(([id,level])=>{const work=workById.get(id);return work?`${name(work,context)} ${level}`:""})))},
    {key:copy.partnerSkills,values:selected.map(pal=>{const skill=partnerByPal.get(pal.id);return skill?name(skill,context):"—"})},
    {key:copy.uniqueSkills,values:selected.map(pal=>list(uniqueByPal.get(pal.id)||[]))},
    {key:copy.guaranteedPassives,values:selected.map(pal=>list(pal.guaranteedPassiveIds.map(id=>passiveById.get(id)).filter((entry):entry is Named=>Boolean(entry)).map(entry=>name(entry,context))))},
    {key:copy.habitats,values:selected.map(pal=>(mapData?.habitats.filter(region=>region.pals.some(entry=>entry.palId===pal.id)).length||0).toLocaleString(locale))},
    {key:copy.bosses,values:selected.map(pal=>(mapData?.bosses.filter(entry=>entry.palId===pal.id).length||0).toLocaleString(locale))}
  ];
  const only=new URLSearchParams(context.location.search).get("diff")==="1",visible=differentComparisonRows(rows,only);
  return `<label class="check-row"><input type="checkbox" data-differences-only ${only?"checked":""}> ${esc(copy.differencesOnly)}</label>${selected.length<2?`<p class="notice">${esc(copy.compareIntro)}</p>`:`<div class="pal-tool-table"><table><thead><tr><th scope="col">${esc(m.stats)}</th>${selected.map(pal=>`<th scope="col">${esc(name(pal,context))}</th>`).join("")}</tr></thead><tbody>${visible.map(row=>`<tr><th scope="row">${esc(row.key)}</th>${row.values.map(value=>`<td>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}`;
}
function comparePage(context:RenderContext){const copy=palToolsCopy[context.locale],selected=selectedPals(context,4);context.setMeta(copy.compareTitle,copy.compareIntro);return `${context.hero(copy.compareTitle)}<section class="section calculator-workspace pal-tool-page">${tabs("compare",context)}<p class="collection-intro">${context.escape(copy.compareIntro)}</p><div class="panel">${palPicker(selected,4,context)}${comparisonRows(selected,context)}</div></section>`}
function teamPage(context:RenderContext){
  const copy=palToolsCopy[context.locale],selected=selectedPals(context,6),params=new URLSearchParams(context.location.search),purpose=params.get("purpose")||"combat",partnerByPal=new Map(context.skillData?.partnerSkills.map(entry=>[entry.palId,entry.id])||[]),coverage=teamCoverage(selected.map(pal=>({...pal,partnerSkillId:partnerByPal.get(pal.id)}))),elementById=new Map(context.skillData?.elements.map(entry=>[entry.id,entry])||[]),workById=new Map(context.data?.workSuitabilities.map(entry=>[entry.id,entry])||[]),partnerById=new Map(context.skillData?.partnerSkills.map(entry=>[entry.id,entry])||[]),esc=context.escape;
  context.setMeta(copy.teamTitle,copy.teamIntro);
  const elementList=coverage.elements.map(id=>{const entry=elementById.get(id);return entry?`${name(entry,context)} ×${coverage.elementCounts[id]}`:id}).join(", ")||"—",workList=coverage.work.map(id=>{const entry=workById.get(id);return entry?`${name(entry,context)} ${coverage.workMaximums[id]}`:id}).join(", ")||"—",duplicatePartners=coverage.duplicatePartnerSkills.map(id=>{const entry=partnerById.get(id);return entry?name(entry,context):id}).join(", ")||"—";
  return `${context.hero(copy.teamTitle)}<section class="section calculator-workspace pal-tool-page">${tabs("team",context)}<p class="collection-intro">${esc(copy.teamIntro)}</p><div class="panel">${palPicker(selected,6,context)}<label>${esc(copy.purpose)}<select data-team-purpose>${[["combat",copy.combat],["movement",copy.movement],["gathering",copy.gathering],["capture",copy.capture]].map(([id,label])=>`<option value="${id}" ${purpose===id?"selected":""}>${esc(label)}</option>`).join("")}</select></label>${["movement","capture"].includes(purpose)?`<p class="notice">${esc(copy.unavailableRoleRanking)}</p>`:""}<p class="notice">${esc(copy.neutralCoverage)}</p><div class="team-coverage-grid"><article><h2>${esc(copy.elements)}</h2><p>${esc(elementList)}</p></article><article><h2>${esc(copy.work)}</h2><p>${esc(workList)}</p></article><article><h2>${esc(copy.duplicates)}</h2><p>${esc(duplicatePartners)}</p></article></div></div></section>`;
}
function condensingPage(context:RenderContext){
  const copy=palToolsCopy[context.locale],params=new URLSearchParams(context.location.search),from=Math.min(3,Math.max(0,Number(params.get("from"))||0)),to=Math.min(4,Math.max(from+1,Number(params.get("to"))||4)),owned=Math.min(9999,Math.max(0,Math.floor(Number(params.get("owned"))||0))),plan=context.condensingData?condensingPlan(context.condensingData.stages,from,to,owned):null,esc=context.escape;
  context.setMeta(copy.condensingTitle,copy.condensingIntro);
  return `${context.hero(copy.condensingTitle)}<section class="section calculator-workspace pal-tool-page">${tabs("condensing",context)}<p class="collection-intro">${esc(copy.condensingIntro)}</p><div class="panel"><div class="condensing-controls"><label>${esc(copy.currentStars)}<select data-condense-from>${[0,1,2,3].map(value=>`<option value="${value}" ${value===from?"selected":""}>${value}</option>`).join("")}</select></label><label>${esc(copy.targetStars)}<select data-condense-to>${[1,2,3,4].filter(value=>value>from).map(value=>`<option value="${value}" ${value===to?"selected":""}>${value}</option>`).join("")}</select></label><label>${esc(copy.ownedPals)}<input data-condense-owned type="number" min="0" max="9999" step="1" value="${owned}"></label></div>${plan?`<div class="condensing-summary"><article><span>${esc(copy.incremental)}</span><strong data-condense-incremental>${plan.incremental.toLocaleString(context.locale)}</strong></article><article><span>${esc(copy.cumulative)}</span><strong>${plan.cumulative.toLocaleString(context.locale)}</strong></article><article><span>${esc(copy.remaining)}</span><strong data-condense-remaining>${plan.remaining.toLocaleString(context.locale)}</strong></article></div><h2>${esc(copy.rankTable)}</h2><div class="pal-tool-table"><table><thead><tr><th>${esc(copy.currentStars)}</th><th>${esc(copy.targetStars)}</th><th>${esc(copy.incremental)}</th><th>${esc(copy.cumulative)}</th></tr></thead><tbody>${context.condensingData!.stages.map(stage=>`<tr><td>${stage.fromStars}</td><td>${stage.toStars}</td><td>${stage.required}</td><td>${stage.cumulative}</td></tr>`).join("")}</tbody></table></div>`:""}</div></section>`;
}
export function renderPalToolPage(kind:PalToolKind,context:RenderContext){return kind==="compare"?comparePage(context):kind==="team"?teamPage(context):condensingPage(context)}

function updateSelection(context:BindContext,mutate:(slugs:string[])=>string[]){const params=new URLSearchParams(context.location.search),slugs=params.get("pals")?.split(",").filter(Boolean)||[],next=mutate(slugs);if(next.length)params.set("pals",next.join(","));else params.delete("pals");context.history.pushState({},"",`${context.location.pathname}${params.size?`?${params}`:""}`);context.render()}
function updateParams(context:BindContext,values:Record<string,string|null>){const params=new URLSearchParams(context.location.search);for(const [key,value] of Object.entries(values))if(value===null)params.delete(key);else params.set(key,value);context.history.replaceState({},"",`${context.location.pathname}?${params}`);context.render()}
export function bindPalToolPage(kind:PalToolKind,context:BindContext){
  context.document.querySelector("[data-add-pal]")?.addEventListener("click",()=>{const picker=context.document.querySelector<HTMLSelectElement>("[data-pal-picker]");if(picker?.value)updateSelection(context,slugs=>[...slugs,picker.value])});
  context.document.querySelectorAll<HTMLElement>("[data-remove-pal]").forEach(button=>button.addEventListener("click",()=>updateSelection(context,slugs=>slugs.filter(slug=>slug!==button.dataset.removePal))));
  context.document.querySelector<HTMLInputElement>("[data-differences-only]")?.addEventListener("change",event=>updateParams(context,{diff:(event.currentTarget as HTMLInputElement).checked?"1":null}));
  context.document.querySelector<HTMLSelectElement>("[data-team-purpose]")?.addEventListener("change",event=>updateParams(context,{purpose:(event.currentTarget as HTMLSelectElement).value}));
  const updateCondensing=()=>{const from=context.document.querySelector<HTMLSelectElement>("[data-condense-from]")?.value||"0",to=context.document.querySelector<HTMLSelectElement>("[data-condense-to]")?.value||"4",owned=context.document.querySelector<HTMLInputElement>("[data-condense-owned]")?.value||"0";updateParams(context,{from,to,owned})};
  context.document.querySelectorAll("[data-condense-from],[data-condense-to],[data-condense-owned]").forEach(control=>control.addEventListener("change",updateCondensing));
  context.trackOnce(`pal-tool:${kind}`,"tool_use",{tool:`pal_${kind}`});
}
