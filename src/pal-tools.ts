export type CondensingStage={fromStars:number;toStars:number;required:number;cumulative:number};

export function normalizePalSelection(segments:readonly string[],slugToId:ReadonlyMap<string,string>,maximum:number){
  const selected:string[]=[];
  for(const segment of segments){const id=slugToId.get(segment);if(id&&!selected.includes(id))selected.push(id);if(selected.length===maximum)break}
  return selected;
}

export function differentComparisonRows(rows:readonly {key:string;values:readonly string[]}[],differencesOnly:boolean){
  if(!differencesOnly)return [...rows];
  return rows.filter(row=>new Set(row.values).size>1);
}

export function teamCoverage<T extends {id:string;elementSlugs:readonly string[];work:Readonly<Record<string,number>>;partnerSkillId?:string}>(pals:readonly T[]){
  const elementCounts:Record<string,number>={},workMaximums:Record<string,number>={},partnerCounts:Record<string,number>={};
  for(const pal of pals){for(const element of pal.elementSlugs)elementCounts[element]=(elementCounts[element]||0)+1;for(const [work,level] of Object.entries(pal.work))if(level>0)workMaximums[work]=Math.max(workMaximums[work]||0,level);if(pal.partnerSkillId)partnerCounts[pal.partnerSkillId]=(partnerCounts[pal.partnerSkillId]||0)+1}
  return {elements:Object.keys(elementCounts).sort(),work:Object.keys(workMaximums).sort(),elementCounts,workMaximums,duplicateElements:Object.entries(elementCounts).filter(([,count])=>count>1).map(([id])=>id).sort(),duplicatePartnerSkills:Object.entries(partnerCounts).filter(([,count])=>count>1).map(([id])=>id).sort()};
}

export function condensingPlan(stages:readonly CondensingStage[],fromStars:number,toStars:number,owned:number){
  if(!Number.isInteger(fromStars)||!Number.isInteger(toStars)||fromStars<0||toStars<=fromStars||toStars>stages.length)throw new Error("Invalid condensing range");
  const selected=stages.filter(stage=>stage.fromStars>=fromStars&&stage.toStars<=toStars);
  if(selected.length!==toStars-fromStars)throw new Error("Incomplete condensing stages");
  const incremental=selected.reduce((sum,stage)=>sum+stage.required,0),cumulativeValue=stages.find(stage=>stage.toStars===toStars)?.cumulative;
  if(!Number.isInteger(cumulativeValue))throw new Error("Missing cumulative condensing requirement");
  const cumulative=cumulativeValue as number;
  const boundedOwned=Number.isFinite(owned)?Math.max(0,Math.floor(owned)):0;
  return {incremental,cumulative,owned:boundedOwned,remaining:Math.max(0,incremental-boundedOwned)};
}
