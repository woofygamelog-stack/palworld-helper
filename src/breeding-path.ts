import type {BreedingRow,Gender} from "./breeding.ts";

export type BreedingPathWeights={
  generations:number;
  uniqueOwned:number;
  genderConstraints:number;
  specialSteps:number;
  repeatedOwnedUses:number;
};

export type BreedingPathComponents={
  generations:number;
  uniqueOwned:number;
  genderConstraints:number;
  specialSteps:number;
  repeatedOwnedUses:number;
};

export type BreedingPathNode={
  pal:number;
  source:"owned"|"bred";
  depth:number;
  signature:string;
  row?:BreedingRow;
  parents?:readonly [BreedingPathNode,BreedingPathNode];
};

export type BreedingPathPlan={
  node:BreedingPathNode;
  components:BreedingPathComponents;
  score:number;
};

export type BreedingPathResult={
  shortest:BreedingPathPlan|null;
  practical:BreedingPathPlan|null;
  alternatives:BreedingPathPlan[];
  evaluatedCandidates:number;
  truncated:boolean;
};

export type BreedingPathOptions={
  maxDepth?:number;
  maxPlansPerPal?:number;
  maxCandidates?:number;
  weights?:Partial<BreedingPathWeights>;
};

export const defaultBreedingPathWeights:BreedingPathWeights={generations:10,uniqueOwned:4,genderConstraints:2,specialSteps:3,repeatedOwnedUses:1};

const boundedInteger=(value:number|undefined,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,Math.floor(value!))):fallback;
const boundedWeight=(value:number|undefined,fallback:number)=>Number.isFinite(value)?Math.max(0,Math.min(100,Number(value))):fallback;

export function normalizeBreedingPathWeights(value:Partial<BreedingPathWeights>={}):BreedingPathWeights{
  return {
    generations:boundedWeight(value.generations,defaultBreedingPathWeights.generations),
    uniqueOwned:boundedWeight(value.uniqueOwned,defaultBreedingPathWeights.uniqueOwned),
    genderConstraints:boundedWeight(value.genderConstraints,defaultBreedingPathWeights.genderConstraints),
    specialSteps:boundedWeight(value.specialSteps,defaultBreedingPathWeights.specialSteps),
    repeatedOwnedUses:boundedWeight(value.repeatedOwnedUses,defaultBreedingPathWeights.repeatedOwnedUses),
  };
}

export function breedingPathScore(components:BreedingPathComponents,weights:BreedingPathWeights){
  return components.generations*weights.generations+components.uniqueOwned*weights.uniqueOwned+components.genderConstraints*weights.genderConstraints+components.specialSteps*weights.specialSteps+components.repeatedOwnedUses*weights.repeatedOwnedUses;
}

function collect(node:BreedingPathNode,ownedUses:Map<number,number>,summary:{genderConstraints:number;specialSteps:number}){
  if(node.source==="owned"){
    ownedUses.set(node.pal,(ownedUses.get(node.pal)||0)+1);
    return;
  }
  const row=node.row;
  if(row){
    const constraints=[row[3],row[4]].filter((gender):gender is Exclude<Gender,"WILDCARD">=>gender!=="WILDCARD").length;
    summary.genderConstraints+=constraints;
    if(constraints>0)summary.specialSteps++;
  }
  node.parents?.forEach(parent=>collect(parent,ownedUses,summary));
}

export function breedingPathComponents(node:BreedingPathNode):BreedingPathComponents{
  const ownedUses=new Map<number,number>(),summary={genderConstraints:0,specialSteps:0};
  collect(node,ownedUses,summary);
  const totalUses=[...ownedUses.values()].reduce((sum,value)=>sum+value,0);
  return {generations:node.depth,uniqueOwned:ownedUses.size,genderConstraints:summary.genderConstraints,specialSteps:summary.specialSteps,repeatedOwnedUses:Math.max(0,totalUses-ownedUses.size)};
}

function containsPal(node:BreedingPathNode,pal:number):boolean{
  return node.pal===pal||Boolean(node.parents?.some(parent=>containsPal(parent,pal)));
}

function shortestCompare(left:BreedingPathPlan,right:BreedingPathPlan){
  const a=left.components,b=right.components;
  return a.generations-b.generations||a.uniqueOwned-b.uniqueOwned||a.genderConstraints-b.genderConstraints||a.specialSteps-b.specialSteps||a.repeatedOwnedUses-b.repeatedOwnedUses||left.node.signature.localeCompare(right.node.signature);
}

function practicalCompare(left:BreedingPathPlan,right:BreedingPathPlan){return left.score-right.score||shortestCompare(left,right)}

function dominates(left:BreedingPathPlan,right:BreedingPathPlan){
  const a=left.components,b=right.components,keys=(Object.keys(a) as (keyof BreedingPathComponents)[]);
  return keys.every(key=>a[key]<=b[key])&&keys.some(key=>a[key]<b[key]);
}

function retainPlans(current:BreedingPathPlan[],candidate:BreedingPathPlan,limit:number){
  if(current.some(plan=>plan.node.signature===candidate.node.signature||dominates(plan,candidate)))return current;
  const eligible=current.filter(plan=>!dominates(candidate,plan));eligible.push(candidate);
  if(eligible.length<=limit)return eligible;
  const selected=new Map<string,BreedingPathPlan>();
  for(const plan of [...eligible].sort(shortestCompare).slice(0,Math.ceil(limit/2)))selected.set(plan.node.signature,plan);
  for(const plan of [...eligible].sort(practicalCompare)){if(selected.size>=limit)break;selected.set(plan.node.signature,plan)}
  return [...selected.values()];
}

function rowSignature(row:BreedingRow,left:BreedingPathNode,right:BreedingPathNode){
  const parents=[`${row[3]}:${left.signature}`,`${row[4]}:${right.signature}`].sort();
  return `b${row[2]}(${parents.join("+")})`;
}

export function findBreedingPaths(rows:readonly BreedingRow[],owned:readonly number[],target:number,options:BreedingPathOptions={}):BreedingPathResult{
  const maxDepth=boundedInteger(options.maxDepth,1,4,3),maxPlansPerPal=boundedInteger(options.maxPlansPerPal,2,12,6),maxCandidates=boundedInteger(options.maxCandidates,1000,2_000_000,900_000),weights=normalizeBreedingPathWeights(options.weights);
  const uniqueOwned=[...new Set(owned.filter(value=>Number.isInteger(value)&&value>=0))].sort((a,b)=>a-b),plans=new Map<number,BreedingPathPlan[]>();
  for(const pal of uniqueOwned){const node:BreedingPathNode={pal,source:"owned",depth:0,signature:`o${pal}`},components=breedingPathComponents(node);plans.set(pal,[{node,components,score:breedingPathScore(components,weights)}])}
  let evaluatedCandidates=0,truncated=false;
  for(let depth=1;depth<=maxDepth&&!truncated;depth++){
    const snapshot=new Map([...plans].map(([pal,value])=>[pal,[...value]])),proposals=new Map<number,BreedingPathPlan[]>();
    for(const row of rows){
      const leftPlans=snapshot.get(row[0]),rightPlans=snapshot.get(row[1]);if(!leftPlans||!rightPlans)continue;
      for(const left of leftPlans){for(const right of rightPlans){
        if(Math.max(left.node.depth,right.node.depth)+1!==depth||containsPal(left.node,row[2])||containsPal(right.node,row[2]))continue;
        evaluatedCandidates++;if(evaluatedCandidates>maxCandidates){truncated=true;break}
        const node:BreedingPathNode={pal:row[2],source:"bred",depth,signature:rowSignature(row,left.node,right.node),row,parents:[left.node,right.node]},components=breedingPathComponents(node),candidate={node,components,score:breedingPathScore(components,weights)};
        proposals.set(row[2],retainPlans(proposals.get(row[2])||[],candidate,maxPlansPerPal));
      }if(truncated)break}if(truncated)break;
    }
    for(const [pal,candidates] of proposals){let current=plans.get(pal)||[];for(const candidate of candidates)current=retainPlans(current,candidate,maxPlansPerPal);plans.set(pal,current)}
  }
  const alternatives=[...(plans.get(target)||[])].filter(plan=>plan.node.source==="bred");
  return {shortest:[...alternatives].sort(shortestCompare)[0]||null,practical:[...alternatives].sort(practicalCompare)[0]||null,alternatives:[...alternatives].sort(practicalCompare),evaluatedCandidates,truncated};
}

export function flattenBreedingPath(node:BreedingPathNode){
  const steps:{pal:number;row:BreedingRow;generation:number}[]=[];
  const visit=(current:BreedingPathNode)=>{current.parents?.forEach(visit);if(current.source==="bred"&&current.row)steps.push({pal:current.pal,row:current.row,generation:current.depth})};
  visit(node);return steps;
}
