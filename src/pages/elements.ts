import type {Locale} from "../config.ts";
import type {Messages} from "../i18n.ts";
import {elementCopy} from "../element-i18n.ts";
import {elementMatchupCopy} from "../element-matchup-i18n.ts";
import {evaluateElementMatchup,qualitativeElementOutcome,type ElementMatchupRules} from "../element-matchup.ts";
import {renderElementMatchupGraph} from "../element-graph.ts";

type Pal={id:string;dex:number;variant:boolean;names:Record<Locale,string>;elementSlugs:string[];image?:boolean};
type ActiveSkill={id:string;names:Record<Locale,string>;elementId:string;power:number;cooldown:number};
type PublicElement={slug:string;names:Record<Locale,string>;icon:string;order:number;strongAgainst:string[];weakTo:string[]};
type ElementRelation={attacker:string;defender:string;effect:"strong";multiplier:1.5;verification:"matchup-and-runtime-verified"};
type ElementData={elements:PublicElement[];relations:ElementRelation[];rules:ElementMatchupRules};

type RenderContext={
  locale:Locale;
  defaultLocale:Locale;
  messages:Messages;
  data:{pals:Pal[]}|null;
  skillData:{activeSkills:ActiveSkill[]}|null;
  elementData:ElementData|null;
  location:Pick<Location,"search">;
  href:(path:string)=>string;
  escape:(value:string)=>string;
  sourceElementSlug:(id:string)=>string;
  setMeta:(title:string,description:string)=>void;
  hero:(title:string,...descriptions:string[])=>string;
  databaseTabs:(active:"elements"|"items"|"structures"|"technology"|"quests"|"npcs"|"dungeons"|"expeditions"|"health")=>string;
  elementLoadError:boolean;
};

type BindContext={
  document:Document;
  window:Window;
  history:History;
  location:Pick<Location,"pathname"|"search">;
  data:{pals:Pal[]}|null;
  render:()=>void;
  trackEvent:(name:string,params:Record<string,string|number|boolean>)=>boolean;
};

export function renderElementsPage(context:RenderContext){
  const {locale,defaultLocale,messages:m,data,skillData,elementData,location,href,escape:esc,sourceElementSlug,setMeta,hero,databaseTabs,elementLoadError}=context,localizedRecord=(values:Record<Locale,string>)=>values[locale]||values[defaultLocale],elementName=(element:PublicElement)=>localizedRecord(element.names),palName=(pal:Pal)=>localizedRecord(pal.names);
  function elementOutcome(attacker:string,defender:string):"strong"|"weak"|"neutral"{return qualitativeElementOutcome(attacker,defender,elementData?.relations||[])}
  function elementIcon(element:PublicElement,size=48){return `<img src="${element.icon}" alt="" width="${size}" height="${size}">`}
  function elementLink(element:PublicElement,defenders:string[]=[]){return `<a class="element-link" href="${href("/database/elements")}?attack=${element.slug}${defenders.length?`&defend=${defenders.join(",")}`:""}" data-link>${elementIcon(element,40)}<span>${esc(elementName(element))}</span></a>`}
  function elementMultiplier(value:number|null){return value===null?"?×":`${value.toLocaleString(locale,{maximumFractionDigits:3})}×`}
  function elementScore(outcome:"strong"|"weak"|"neutral"){return outcome==="strong"?1:outcome==="weak"?-1:0}
  function elementScoreLabel(value:number){return value>0?`+${value}`:String(value)}
  function sameElementPair(left:readonly string[],right:readonly string[]){return left.length===right.length&&left.every(value=>right.includes(value))}
  function elementCollectionPage(){
    const copy=elementCopy[locale],matchupCopy=elementMatchupCopy[locale],elements=[...(elementData?.elements||[])].sort((a,b)=>a.order-b.order),bySlug=new Map(elements.map(element=>[element.slug,element])),params=new URLSearchParams(location.search),requestedAttack=params.get("attack")||"fire",attacker=bySlug.get(requestedAttack)||bySlug.get("fire")||elements[0],fallbackDefense=attacker?.strongAgainst[0]||"neutral",requestedDefenders=(params.get("defend")||fallbackDefense).split(",").filter(Boolean).slice(0,2),defenderPrimary=bySlug.get(requestedDefenders[0])||bySlug.get(fallbackDefense)||elements[0],secondaryCandidate=bySlug.get(requestedDefenders[1]||""),defenderSecondary=secondaryCandidate&&secondaryCandidate.slug!==defenderPrimary?.slug?secondaryCandidate:undefined;
    setMeta(copy.title,copy.intro);
    if(elementLoadError)return `${hero(copy.title)}<section class="section">${databaseTabs("elements")}<p class="notice">${esc(m.noResult)}</p></section>`;
    if(!attacker||!defenderPrimary)return `${hero(copy.title)}<section class="section">${databaseTabs("elements")}</section>`;
    const defenders=[defenderPrimary,...(defenderSecondary?[defenderSecondary]:[])],defenderSlugs=defenders.map(element=>element.slug),comparison=evaluateElementMatchup(attacker.slug,defenderSlugs,elementData?.relations||[],elementData?.rules||{numericMultipliers:null,dualElement:null}),selectedPals=[...(data?.pals||[])].filter(pal=>pal.elementSlugs.includes(attacker.slug)).sort((a,b)=>a.dex-b.dex||Number(a.variant)-Number(b.variant)||a.id.localeCompare(b.id)),selectedSkills=[...(skillData?.activeSkills||[])].filter(skill=>sourceElementSlug(skill.elementId)===attacker.slug).sort((a,b)=>new Intl.Collator(locale,{numeric:true}).compare(localizedRecord(a.names),localizedRecord(b.names))||a.id.localeCompare(b.id)),related=(slugs:string[])=>slugs.map(slug=>bySlug.get(slug)).filter(Boolean) as PublicElement[],dualPals=[...(data?.pals||[])].filter(pal=>pal.elementSlugs.length===2).sort((a,b)=>a.dex-b.dex||Number(a.variant)-Number(b.variant)||a.id.localeCompare(b.id)),selectedDualPal=dualPals.find(pal=>pal.id===params.get("pal")&&sameElementPair(pal.elementSlugs,defenderSlugs));
    const attackerOptions=elements.map(element=>`<option value="${element.slug}" ${element.slug===attacker.slug?"selected":""}>${esc(elementName(element))}</option>`).join(""),primaryOptions=elements.map(element=>`<option value="${element.slug}" ${element.slug===defenderPrimary.slug?"selected":""}>${esc(elementName(element))}</option>`).join(""),secondaryOptions=`<option value="">${esc(matchupCopy.noSecondElement)}</option>${elements.map(element=>`<option value="${element.slug}" ${element.slug===defenderSecondary?.slug?"selected":""}>${esc(elementName(element))}</option>`).join("")}`,dualPalOptions=dualPals.map(pal=>{const elementNames=pal.elementSlugs.map(slug=>bySlug.get(slug)).filter(Boolean).map(element=>elementName(element as PublicElement)).join(" + ");return `<option value="${esc(pal.id)}" ${selectedDualPal?.id===pal.id?"selected":""}>#${pal.dex}${pal.variant?"B":""} ${esc(palName(pal))} · ${esc(elementNames)}</option>`}).join("");
    const cell=(row:PublicElement,column:PublicElement)=>{const value=elementOutcome(row.slug,column.slug),label=copy[value],multiplier=elementData?.rules.numericMultipliers?.[value]??null;return `<td class="element-cell ${value}"><span aria-label="${esc(`${elementName(row)} → ${elementName(column)}: ${label}, ${elementMultiplier(multiplier)}`)}" title="${esc(`${label} · ${elementMultiplier(multiplier)}`)}"><b>${elementMultiplier(multiplier)}</b><small>${esc(label)}</small></span></td>`};
    const relationLinks=(slugs:string[],empty=copy.neutral)=>related(slugs).map(element=>elementLink(element)).join("")||`<span class="element-none">${esc(empty)}</span>`;
    const graph=renderElementMatchupGraph({nodes:elements.map(element=>({slug:element.slug,name:elementName(element),icon:element.icon})),relations:elementData?.relations||[],title:copy.chartTitle,description:copy.chartDescription,strongLabel:copy.strong,baseHref:href("/database/elements"),selectedAttacker:params.has("attack")?attacker.slug:undefined,selectedDefender:params.has("defend")&&defenders.length===1?defenderPrimary.slug:undefined});
    const componentCards=comparison.components.map(component=>{const defender=bySlug.get(component.defender)!,label=copy[component.outcome],score=elementScore(component.outcome);return `<article class="element-component ${component.outcome}"><header>${elementIcon(defender,52)}<div><small>${esc(copy.defender)}</small><strong>${esc(elementName(defender))}</strong></div><b>${esc(label)}</b></header><dl><div><dt>${esc(matchupCopy.relationScore)}</dt><dd>${elementScoreLabel(score)}</dd></div><div><dt>${esc(matchupCopy.damageMultiplier)}</dt><dd><strong>${elementMultiplier(component.multiplier)}</strong></dd></div></dl></article>`}).join("");
    const weakCount=comparison.components.reduce((sum,component)=>sum+elementScore(component.outcome),0),factorCards=comparison.components.map(component=>{const defender=bySlug.get(component.defender)!,score=elementScore(component.outcome);return `<span class="element-formula-factor">${elementIcon(defender,32)}<span>${esc(elementName(defender))}</span><b>${elementScoreLabel(score)}</b></span>`}).join(`<span class="element-formula-operator" aria-hidden="true">+</span>`),ruleGuide=`<aside class="element-rule-guide"><div><strong>+1</strong><span>${esc(copy.strong)}</span></div><div><strong>0</strong><span>${esc(copy.neutral)}</span></div><div><strong>−1</strong><span>${esc(copy.weak)}</span></div><p>${esc(matchupCopy.sameElementRule)}</p><p>${esc(matchupCopy.neutralRule)}</p></aside>`;
    const compare=`<section class="panel element-compare"><h2>${esc(copy.compareTitle)}</h2><div class="element-selectors"><label>${esc(copy.attacker)}<select id="element-attacker">${attackerOptions}</select></label><span aria-hidden="true">→</span><label>${esc(matchupCopy.primaryDefender)}<select id="element-defender-primary">${primaryOptions}</select></label><label>${esc(matchupCopy.secondaryDefender)}<select id="element-defender-secondary">${secondaryOptions}</select></label></div><label class="element-pal-shortcut">${esc(matchupCopy.dualPal)}<select id="element-dual-pal"><option value="">${esc(matchupCopy.manualSelection)}</option>${dualPalOptions}</select></label><div class="element-matchup-result" aria-live="polite"><div class="element-matchup-route"><span class="element-route-node">${elementIcon(attacker,60)}<span><small>${esc(copy.attacker)}</small><strong>${esc(elementName(attacker))}</strong></span></span><span class="element-route-arrow" aria-hidden="true">→</span><span class="element-route-defenders">${defenders.map(defender=>`<span class="element-route-node">${elementIcon(defender,52)}<strong>${esc(elementName(defender))}</strong></span>`).join("")}</span></div><section class="element-component-section" aria-labelledby="element-component-title"><h3 id="element-component-title">${esc(matchupCopy.componentEffects)}</h3><div class="element-components">${componentCards}</div></section><section class="element-formula"><header><h3>${esc(defenders.length===2?matchupCopy.combinationRule:matchupCopy.finalMultiplier)}</h3><span>${esc(matchupCopy.runtimeVerified)}</span></header><div class="element-formula-expression">${factorCards}<span class="element-formula-equals" aria-hidden="true">→</span>${defenders.length===2?`<span class="element-score-total"><small>${esc(matchupCopy.scoreSum)}</small><b>${elementScoreLabel(weakCount)}</b></span><span class="element-formula-equals" aria-hidden="true">→</span>`:""}<strong>${elementMultiplier(comparison.combinedMultiplier)}</strong></div>${ruleGuide}<p class="element-damage-context">${esc(matchupCopy.damageContext)}</p></section></div><div class="element-focus" aria-label="${esc(elementName(attacker))}"><section><h3>${esc(copy.weakTo)}</h3><div>${relationLinks(attacker.weakTo)}</div></section><div class="element-focus-center">${elementIcon(attacker,72)}<strong>${esc(elementName(attacker))}</strong></div><section><h3>${esc(copy.strongAgainst)}</h3><div>${relationLinks(attacker.strongAgainst)}</div></section></div></section>`;
    const picker=`<nav class="element-picker" aria-label="${esc(copy.attacker)}">${elements.map(element=>elementLink(element,defenderSlugs)).join("")}</nav>`;
    const matrix=`<section class="panel element-matrix-section"><h2>${esc(copy.matrixTitle)}</h2><p>${esc(copy.matrixDescription)}</p><div class="element-matrix-scroll"><table class="element-matrix"><caption>${esc(copy.matrixDescription)}</caption><thead><tr><th scope="col">${esc(copy.attacker)} ↓ / ${esc(copy.defender)} →</th>${elements.map(element=>`<th scope="col">${elementIcon(element,32)}<span>${esc(elementName(element))}</span></th>`).join("")}</tr></thead><tbody>${elements.map(row=>`<tr><th scope="row">${elementIcon(row,32)}<span>${esc(elementName(row))}</span></th>${elements.map(column=>cell(row,column)).join("")}</tr>`).join("")}</tbody></table></div><p class="element-legend"><span class="strong">1.5× ${esc(copy.strong)}</span><span class="weak">0.66× ${esc(copy.weak)}</span><span class="neutral">1× ${esc(copy.neutral)}</span></p></section>`;
    const relatedContent=`<div class="element-related"><section class="panel"><h2>${esc(copy.relatedPals)} <span>${selectedPals.length.toLocaleString(locale)} ${esc(copy.palsCount)}</span></h2><div class="element-pal-list">${selectedPals.map(pal=>`<a href="${href(`/pals/${encodeURIComponent(pal.id)}`)}" data-link>${pal.image?`<img src="/assets/pals/${encodeURIComponent(pal.id)}.png" alt="" width="64" height="64" loading="lazy">`:""}<span><small>#${pal.dex}${pal.variant?"B":""}</small><strong>${esc(palName(pal))}</strong></span></a>`).join("")}</div></section><section class="panel"><h2>${esc(copy.relatedSkills)} <span>${selectedSkills.length.toLocaleString(locale)} ${esc(copy.skillsCount)}</span></h2><div class="element-skill-list">${selectedSkills.map(skill=>`<a href="${href(`/skills/active/${encodeURIComponent(skill.id)}`)}" data-link>${elementIcon(attacker,38)}<span><strong>${esc(localizedRecord(skill.names))}</strong><small>${skill.power.toLocaleString(locale)} · ${skill.cooldown.toLocaleString(locale)}s</small></span></a>`).join("")}</div></section></div>`;
    return `${hero(copy.title)}<section class="section element-page">${databaseTabs("elements")}<p class="collection-intro">${esc(copy.intro)}</p>${graph}${compare}${picker}${matrix}${relatedContent}</section>`;
  }

  return elementCollectionPage();
}

export function bindElementsPage(context:BindContext){
  const {document,window,history,location,data,render,trackEvent}=context;
  const elementAttacker=document.querySelector<HTMLSelectElement>("#element-attacker"),elementDefenderPrimary=document.querySelector<HTMLSelectElement>("#element-defender-primary"),elementDefenderSecondary=document.querySelector<HTMLSelectElement>("#element-defender-secondary"),elementDualPal=document.querySelector<HTMLSelectElement>("#element-dual-pal");
  const syncElementComparison=(event:Event)=>{
    if(!elementAttacker||!elementDefenderPrimary||!elementDefenderSecondary)return;
    const changed=event.currentTarget as HTMLSelectElement,params=new URLSearchParams(location.search);
    if(changed===elementDualPal&&elementDualPal?.value){
      const pal=data?.pals.find(entry=>entry.id===elementDualPal.value&&entry.elementSlugs.length===2);
      if(pal){elementDefenderPrimary.value=pal.elementSlugs[0];elementDefenderSecondary.value=pal.elementSlugs[1];params.set("pal",pal.id)}
    }else if(changed===elementDefenderPrimary||changed===elementDefenderSecondary){params.delete("pal")}
    if(elementDefenderSecondary.value===elementDefenderPrimary.value)elementDefenderSecondary.value="";
    const attacker=elementAttacker.value,defenders=[elementDefenderPrimary.value,...(elementDefenderSecondary.value?[elementDefenderSecondary.value]:[])],focusId=changed.id;
    params.set("attack",attacker);params.set("defend",defenders.join(","));if(!elementDualPal?.value)params.delete("pal");
    history.replaceState({},"",`${location.pathname}?${params}`);
    trackEvent("tool_action",{tool:"element_matchup",action:defenders.length===2?"dual_compare":"single_compare"});
    window.setTimeout(()=>{render();window.requestAnimationFrame(()=>document.querySelector<HTMLElement>(`#${focusId}`)?.focus())},100);
  };
  [elementAttacker,elementDefenderPrimary,elementDefenderSecondary,elementDualPal].forEach(control=>control?.addEventListener("change",syncElementComparison));
}
