import type {Locale} from "../config";
import {guideCopy,guideDefinitions,guideStructureCopy,findGuide,guideRoute,type GuideSnapshotData} from "../guide-content.ts";
import {messages} from "../i18n.ts";
import {plannerCopy} from "../planner-i18n.ts";
import {skillLabels} from "../skill-i18n.ts";
import {questCopy} from "../quest-i18n.ts";
import {technologyCopy} from "../technology-i18n.ts";
import {structureCopy} from "../structure-i18n.ts";
import {expeditionCopy} from "../expedition-i18n.ts";
import {elementCopy} from "../element-i18n.ts";
import {healthCopy} from "../health-i18n.ts";
import {breedingPathCopy} from "../breeding-path-i18n.ts";
import {palToolsCopy} from "../pal-tools-i18n.ts";
import {ivCopy} from "../iv-i18n.ts";

const escape=(value:string)=>value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]!);

export type GuidePageModel={title:string;description:string;body:string;type:"CollectionPage"|"Article";parent?:{route:string;label:string}};

function routeLabel(locale:Locale,route:string){
  const m=messages(locale),planner=plannerCopy[locale];
  if(route==="map")return m.map;
  if(route==="pals")return m.palDex;
  if(route==="calculators/base")return planner.baseTitle;
  if(route==="database/quests")return questCopy[locale].title;
  if(route==="database/technology")return technologyCopy[locale].title;
  if(route==="database/expeditions")return expeditionCopy[locale].title;
  if(route==="calculators/breeding")return m.breeding;
  if(route==="calculators/breeding-path")return breedingPathCopy[locale].title;
  if(route==="calculators/team-builder")return palToolsCopy[locale].teamTitle;
  if(route==="calculators/iv")return ivCopy[locale].title;
  if(route==="skills/passive")return skillLabels[locale].passive;
  if(route==="skills/active")return skillLabels[locale].active;
  if(route==="calculators/crafting")return m.crafting;
  if(route==="database")return m.itemDatabase;
  if(route==="database/structures")return structureCopy[locale].title;
  if(route==="server-tools/settings-generator")return m.serverTitle;
  if(route==="database/elements")return elementCopy[locale].title;
  if(route==="database/health")return healthCopy[locale].title;
  return skillLabels[locale].active;
}

export function guidePageModel(locale:Locale,route:string,href:(route:string)=>string,snapshotData:GuideSnapshotData|null=null):GuidePageModel|null{
  const copy=guideCopy[locale],m=messages(locale),hero=(title:string)=>`<section class="page-hero"><p class="eyebrow">${escape(copy.eyebrow)}</p><h1>${escape(title)}</h1></section>`;
  if(route==="guides"){
    const cards=guideDefinitions.map(guide=>{const text=copy.guides[guide.id];return `<article class="panel guide-card"><h2><a href="${escape(href(guideRoute(guide.slug)))}" data-link>${escape(text.title)}</a></h2><p>${escape(text.description)}</p><a class="guide-card-link" href="${escape(href(guideRoute(guide.slug)))}" data-link>${escape(copy.open)} <span aria-hidden="true">→</span></a></article>`}).join("");
    return {title:copy.hubTitle,description:copy.hubDescription,type:"CollectionPage",body:`${hero(copy.hubTitle)}<section class="section guide-hub"><p class="collection-intro">${escape(copy.hubDescription)}</p><div class="guide-grid">${cards}</div></section>`};
  }
  const guide=findGuide(route);
  if(!guide)return null;
  const text=copy.guides[guide.id],structure=guideStructureCopy[locale],format=(template:string,name:string)=>template.replace("{name}",name),links=guide.related.map((target,index)=>{const label=routeLabel(locale,target);return `<li><a href="${escape(href(target))}" data-link><span class="guide-step-number">${(index+1).toLocaleString(locale)}</span><span><strong>${escape(label)}</strong><small>${escape(structure.stepAction)}</small></span><span aria-hidden="true">→</span></a></li>`}).join(""),preparation=guide.related.map(target=>{const label=routeLabel(locale,target);return `<li><a href="${escape(href(target))}" data-link>${escape(label)} <span aria-hidden="true">↗</span></a></li>`}).join(""),checks=guide.related.map(target=>`<li>${escape(format(structure.confirm,routeLabel(locale,target)))}</li>`).join(""),metrics=snapshotData?.guides[guide.id]?.metrics||[],coverage=metrics.length?`<section class="panel guide-coverage"><h2>${escape(structure.coverage)}</h2><p>${escape(structure.coverageIntro)}</p><dl>${metrics.map(metric=>`<div><dt><a href="${escape(href(metric.route))}" data-link>${escape(routeLabel(locale,metric.route))}</a></dt><dd>${metric.count.toLocaleString(locale)} <small>${escape(structure.entries)}</small></dd></div>`).join("")}</dl></section>`:"";
  const breadcrumb=`<nav class="breadcrumbs" aria-label="${escape(m.home)}"><a href="${escape(href(""))}" data-link>${escape(m.home)}</a><a href="${escape(href("guides"))}" data-link>${escape(copy.hubTitle)}</a><span aria-current="page">${escape(text.title)}</span></nav>`;
  const body=`${hero(text.title)}<article class="section guide-detail">${breadcrumb}<section class="panel guide-intro"><h2>${escape(structure.problem)}</h2><p>${escape(text.description)}</p></section>${coverage}<section class="panel guide-preparation"><h2>${escape(structure.preparation)}</h2><p>${escape(structure.preparationIntro)}</p><ul>${preparation}</ul></section><section class="guide-workflow"><h2>${escape(structure.procedure)}</h2><p>${escape(copy.workflowIntro)}</p><ol>${links}</ol></section><section class="panel guide-result"><h2>${escape(structure.result)}</h2><p>${escape(structure.resultIntro)}</p><ul>${checks}</ul></section><aside class="panel guide-scope"><h2>${escape(copy.scope)}</h2><p>${escape(copy.scopeText)}</p></aside><nav class="guide-related" aria-label="${escape(copy.related)}"><a href="${escape(href("guides"))}" data-link>← ${escape(copy.hubTitle)}</a></nav></article>`;
  return {title:text.title,description:text.description,body,type:"Article",parent:{route:"guides",label:copy.hubTitle}};
}

export function renderGuidesPage({locale,route,href,setMeta,snapshotData}:{locale:Locale;route:string;href:(route:string)=>string;setMeta:(title:string,description:string)=>void;snapshotData:GuideSnapshotData|null}){
  const model=guidePageModel(locale,route.replace(/^\//,""),href,snapshotData);
  if(!model)return null;
  setMeta(model.title,model.description);
  return model.body;
}
