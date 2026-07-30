export type ElementGraphNode={slug:string;name:string;icon:string};
export type ElementGraphRelation={attacker:string;defender:string};

type GraphPoint={x:number;y:number};
type GraphLayout={viewBox:string;positions:Record<string,GraphPoint>;paths:Record<string,string>};

const wide:GraphLayout={
  viewBox:"0 0 1200 430",
  positions:{
    electric:{x:90,y:95},water:{x:250,y:95},fire:{x:410,y:95},ice:{x:590,y:95},dragon:{x:770,y:95},dark:{x:950,y:95},neutral:{x:1110,y:95},
    grass:{x:410,y:330},ground:{x:170,y:330}
  },
  paths:{
    "electric>water":"M 142 95 L 198 95",
    "water>fire":"M 302 95 L 358 95",
    "fire>ice":"M 462 95 L 538 95",
    "ice>dragon":"M 642 95 L 718 95",
    "dragon>dark":"M 822 95 L 898 95",
    "dark>neutral":"M 1002 95 L 1058 95",
    "fire>grass":"M 410 147 L 410 278",
    "grass>ground":"M 358 330 L 222 330",
    "ground>electric":"M 170 278 C 170 214 90 214 90 147"
  }
};

const compact:GraphLayout={
  viewBox:"-20 0 440 670",
  positions:{
    electric:{x:55,y:55},water:{x:200,y:55},fire:{x:345,y:55},
    ground:{x:55,y:245},grass:{x:200,y:245},ice:{x:345,y:245},
    dragon:{x:345,y:405},dark:{x:200,y:560},neutral:{x:55,y:560}
  },
  paths:{
    "electric>water":"M 107 55 L 148 55",
    "water>fire":"M 252 55 L 293 55",
    "fire>grass":"M 319 91 C 298 141 255 197 234 212",
    "grass>ground":"M 148 245 L 107 245",
    "ground>electric":"M 55 193 L 55 107",
    "fire>ice":"M 345 107 L 345 193",
    "ice>dragon":"M 345 297 L 345 353",
    "dragon>dark":"M 312 445 C 286 485 252 526 235 538",
    "dark>neutral":"M 148 560 L 107 560"
  }
};

const layouts={wide,compact} as const;
export const elementGraphNodeKeys=Object.freeze(Object.keys(wide.positions).sort());
export const elementGraphGeometryKeys=Object.freeze(Object.keys(wide.paths).sort());

const esc=(value:unknown)=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]!);
const edgeKey=(relation:ElementGraphRelation)=>`${relation.attacker}>${relation.defender}`;

function renderDiagram(kind:keyof typeof layouts,nodes:ElementGraphNode[],relations:ElementGraphRelation[],selectedAttacker?:string,selectedDefender?:string){
  const layout=layouts[kind],marker=`element-graph-arrow-${kind}`;
  const hasSelection=Boolean(selectedAttacker),selectedNeighbors=new Set(relations.flatMap(relation=>relation.attacker===selectedAttacker?[relation.defender]:relation.defender===selectedAttacker?[relation.attacker]:[]));
  const edges=relations.map(relation=>{const key=edgeKey(relation),path=layout.paths[key];if(!path)return "";const states=hasSelection?[relation.attacker===selectedAttacker?"is-outgoing":"",relation.defender===selectedAttacker?"is-incoming":"",relation.attacker===selectedAttacker&&relation.defender===selectedDefender?"is-selected":""].filter(Boolean).join(" "):"";return `<g class="element-graph-edge-group${states?` ${states}`:""}" data-element-edge="${esc(key)}"><path class="element-graph-edge-shadow" d="${path}"></path><path class="element-graph-edge" d="${path}" marker-end="url(#${marker})"></path></g>`}).join("");
  const nodeMarkup=nodes.map(node=>{const point=layout.positions[node.slug];if(!point)return "";const role=node.slug===selectedAttacker?"source":node.slug===selectedDefender?"target":selectedNeighbors.has(node.slug)?"related":"";return `<g class="element-graph-node${role?` is-${role}`:""}" data-element-node="${esc(node.slug)}"${role?` data-element-role="${role}"`:""} transform="translate(${point.x} ${point.y})"><circle class="element-graph-node-halo" r="50"></circle><circle class="element-graph-node-surface" r="42"></circle><image href="${esc(node.icon)}" x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid meet"></image><foreignObject x="-72" y="48" width="144" height="48"><div xmlns="http://www.w3.org/1999/xhtml" class="element-graph-node-label">${esc(node.name)}</div></foreignObject></g>`}).join("");
  return `<svg class="element-graph-diagram element-graph-diagram--${kind}${hasSelection?" has-selection":""}" viewBox="${layout.viewBox}" aria-hidden="true" focusable="false"><defs><marker id="${marker}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11 Z"></path></marker></defs>${edges}${nodeMarkup}</svg>`;
}

export function renderElementMatchupGraph({nodes,relations,title,description,strongLabel,baseHref,selectedAttacker,selectedDefender}:{nodes:ElementGraphNode[];relations:ElementGraphRelation[];title:string;description:string;strongLabel:string;baseHref:string;selectedAttacker?:string;selectedDefender?:string}){
  const bySlug=new Map(nodes.map(node=>[node.slug,node]));
  const relationList=relations.map(relation=>{const attacker=bySlug.get(relation.attacker),defender=bySlug.get(relation.defender);if(!attacker||!defender)return "";const url=`${baseHref}?attack=${encodeURIComponent(relation.attacker)}&defend=${encodeURIComponent(relation.defender)}`,selected=relation.attacker===selectedAttacker&&relation.defender===selectedDefender;return `<li data-element-relation="${esc(edgeKey(relation))}"><a href="${esc(url)}" data-link${selected?' class="is-selected" aria-current="true"':""}><img src="${esc(attacker.icon)}" alt="" width="34" height="34"><strong>${esc(attacker.name)}</strong><span aria-hidden="true">→</span><img src="${esc(defender.icon)}" alt="" width="34" height="34"><strong>${esc(defender.name)}</strong><small>${esc(strongLabel)}</small></a></li>`}).join("");
  return `<figure class="panel element-matchup-graph" aria-labelledby="element-graph-title" aria-describedby="element-graph-description"><header><h2 id="element-graph-title">${esc(title)}</h2><p id="element-graph-description">${esc(description)}</p></header><div class="element-graph-stage">${renderDiagram("wide",nodes,relations,selectedAttacker,selectedDefender)}${renderDiagram("compact",nodes,relations,selectedAttacker,selectedDefender)}</div><figcaption><ol class="element-graph-relations" aria-label="${esc(title)}">${relationList}</ol></figcaption></figure>`;
}
