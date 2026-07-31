export type ElementGraphNode={slug:string;name:string;icon:string};
export type ElementGraphRelation={attacker:string;defender:string};

type GraphPoint={x:number;y:number};
type GraphLayout={viewBox:string;positions:Record<string,GraphPoint>;paths:Record<string,string>};

const wide:GraphLayout={
  viewBox:"0 0 1200 505",
  positions:{
    electric:{x:110,y:130},water:{x:295,y:95},fire:{x:485,y:140},ice:{x:675,y:95},dragon:{x:865,y:135},
    grass:{x:390,y:350},ground:{x:175,y:360},dark:{x:1050,y:255},neutral:{x:950,y:400}
  },
  paths:{
    "electric>water":"M 158 121 C 190 115 218 108 247 104",
    "water>fire":"M 343 106 C 379 113 410 121 437 129",
    "fire>ice":"M 533 129 C 570 119 600 110 627 106",
    "ice>dragon":"M 723 105 C 760 112 790 121 817 125",
    "dragon>dark":"M 906 162 C 947 179 983 202 1009 228",
    "dark>neutral":"M 1022 295 C 1010 321 994 344 978 360",
    "fire>grass":"M 447 171 C 418 210 395 262 395 302",
    "grass>ground":"M 342 352 C 304 353 263 356 223 358",
    "ground>electric":"M 143 324 C 75 292 48 223 85 170"
  }
};

const compact:GraphLayout={
  viewBox:"0 0 440 750",
  positions:{
    electric:{x:60,y:65},water:{x:210,y:65},fire:{x:360,y:65},
    ground:{x:60,y:220},grass:{x:210,y:220},ice:{x:360,y:220},
    dragon:{x:360,y:365},dark:{x:255,y:500},neutral:{x:100,y:640}
  },
  paths:{
    "electric>water":"M 108 65 C 125 65 143 65 162 65",
    "water>fire":"M 258 65 C 275 65 293 65 312 65",
    "fire>grass":"M 337 106 C 317 136 276 184 233 180",
    "grass>ground":"M 162 220 C 145 220 127 220 108 220",
    "ground>electric":"M 60 172 C 60 152 60 132 60 113",
    "fire>ice":"M 360 113 C 360 132 360 152 360 172",
    "ice>dragon":"M 360 268 C 360 284 360 301 360 317",
    "dragon>dark":"M 331 403 C 316 424 296 450 284 462",
    "dark>neutral":"M 220 532 C 194 555 162 585 135 608"
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
  const edges=relations.map(relation=>{const key=edgeKey(relation),path=layout.paths[key];if(!path)return "";const states=hasSelection?[relation.attacker===selectedAttacker?"is-outgoing":"",relation.defender===selectedAttacker?"is-incoming":"",relation.attacker===selectedAttacker&&relation.defender===selectedDefender?"is-selected":""].filter(Boolean).join(" "):"";return `<g class="element-graph-edge-group${states?` ${states}`:""}" data-element-edge="${esc(key)}"><path class="element-graph-edge-shadow" d="${path}" vector-effect="non-scaling-stroke"></path><path class="element-graph-edge" d="${path}" marker-end="url(#${marker})" vector-effect="non-scaling-stroke"></path></g>`}).join("");
  const nodeMarkup=nodes.map(node=>{const point=layout.positions[node.slug];if(!point)return "";const role=node.slug===selectedAttacker?"source":node.slug===selectedDefender?"target":selectedNeighbors.has(node.slug)?"related":"";return `<g class="element-graph-node${role?` is-${role}`:""}" data-element-node="${esc(node.slug)}"${role?` data-element-role="${role}"`:""} transform="translate(${point.x} ${point.y})"><circle class="element-graph-node-halo" r="47" vector-effect="non-scaling-stroke"></circle><circle class="element-graph-node-surface" r="39" vector-effect="non-scaling-stroke"></circle><image href="${esc(node.icon)}" x="-29" y="-29" width="58" height="58" preserveAspectRatio="xMidYMid meet"></image><foreignObject x="-76" y="49" width="152" height="50"><div xmlns="http://www.w3.org/1999/xhtml" class="element-graph-node-label">${esc(node.name)}</div></foreignObject></g>`}).join("");
  return `<svg class="element-graph-diagram element-graph-diagram--${kind}${hasSelection?" has-selection":""}" viewBox="${layout.viewBox}" aria-hidden="true" focusable="false"><defs><marker id="${marker}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="18" markerHeight="18" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M 2 2 L 10 6 L 2 10 Z"></path></marker></defs>${edges}${nodeMarkup}</svg>`;
}

export function renderElementMatchupGraph({nodes,relations,title,description,strongLabel,baseHref,selectedAttacker,selectedDefender}:{nodes:ElementGraphNode[];relations:ElementGraphRelation[];title:string;description:string;strongLabel:string;baseHref:string;selectedAttacker?:string;selectedDefender?:string}){
  const bySlug=new Map(nodes.map(node=>[node.slug,node]));
  const relationList=relations.map(relation=>{const attacker=bySlug.get(relation.attacker),defender=bySlug.get(relation.defender);if(!attacker||!defender)return "";const url=`${baseHref}?attack=${encodeURIComponent(relation.attacker)}&defend=${encodeURIComponent(relation.defender)}`,selected=relation.attacker===selectedAttacker&&relation.defender===selectedDefender;return `<li data-element-relation="${esc(edgeKey(relation))}"><a href="${esc(url)}" data-link${selected?' class="is-selected" aria-current="true"':""}><img src="${esc(attacker.icon)}" alt="" width="34" height="34"><strong>${esc(attacker.name)}</strong><span aria-hidden="true">→</span><img src="${esc(defender.icon)}" alt="" width="34" height="34"><strong>${esc(defender.name)}</strong><small>${esc(strongLabel)}</small></a></li>`}).join("");
  return `<figure class="panel element-matchup-graph" aria-labelledby="element-graph-title" aria-describedby="element-graph-description"><header><h2 id="element-graph-title">${esc(title)}</h2><p id="element-graph-description">${esc(description)}</p></header><div class="element-graph-stage">${renderDiagram("wide",nodes,relations,selectedAttacker,selectedDefender)}${renderDiagram("compact",nodes,relations,selectedAttacker,selectedDefender)}</div><figcaption><ol class="element-graph-relations" aria-label="${esc(title)}">${relationList}</ol></figcaption></figure>`;
}
