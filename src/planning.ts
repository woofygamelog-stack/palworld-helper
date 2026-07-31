export type CraftRecipe={id:string;productId:string;output:number;workAmount:number;ingredients:{itemId:string;count:number}[]};
export type CraftTarget={recipeId:string;quantity:number};
export type CraftPlan={demand:Record<string,number>;crafts:Record<string,number>;workAmount:number;ambiguous:string[]};

export function buildCraftPlan(targets:CraftTarget[],recipes:CraftRecipe[],owned:Record<string,number>={},choices:Record<string,string>={}):CraftPlan{
  const byId=new Map(recipes.map(recipe=>[recipe.id,recipe])),byProduct=new Map<string,CraftRecipe[]>();
  for(const recipe of recipes){const list=byProduct.get(recipe.productId)||[];list.push(recipe);byProduct.set(recipe.productId,list)}
  const selected=new Map<string,CraftRecipe>();
  for(const [productId,recipeId] of Object.entries(choices)){const recipe=byId.get(recipeId);if(!recipe||recipe.productId!==productId)throw new Error("Invalid recipe choice");selected.set(productId,recipe)}
  const rootDemand=new Map<string,number>();
  for(const target of targets){
    const recipe=byId.get(target.recipeId),quantity=Math.floor(target.quantity);
    if(!recipe||!Number.isFinite(quantity)||quantity<=0)throw new Error("Invalid crafting target");
    const existing=selected.get(recipe.productId);
    if(existing&&existing.id!==recipe.id)throw new Error("Conflicting recipes for the same product");
    selected.set(recipe.productId,recipe);
    rootDemand.set(recipe.productId,(rootDemand.get(recipe.productId)||0)+quantity);
  }
  if(rootDemand.size===0)throw new Error("No crafting targets");
  for(const [productId,list] of byProduct)if(list.length===1&&!selected.has(productId))selected.set(productId,list[0]);

  const nodes=new Set<string>(),edges=new Map<string,string[]>(),visiting=new Set<string>(),visited=new Set<string>();
  const discover=(id:string,path:string[])=>{
    if(visiting.has(id))throw new Error(`Recipe cycle: ${[...path,id].join(" -> ")}`);
    if(visited.has(id))return;
    visiting.add(id);nodes.add(id);
    const recipe=selected.get(id),children=recipe?recipe.ingredients.map(ingredient=>ingredient.itemId):[];
    edges.set(id,children);
    for(const child of children)discover(child,[...path,id]);
    visiting.delete(id);visited.add(id);
  };
  for(const id of rootDemand.keys())discover(id,[]);
  const indegree=new Map([...nodes].map(id=>[id,0]));
  for(const children of edges.values())for(const child of children)indegree.set(child,(indegree.get(child)||0)+1);
  const queue=[...nodes].filter(id=>indegree.get(id)===0).sort(),order:string[]=[];
  while(queue.length){const id=queue.shift()!;order.push(id);for(const child of edges.get(id)||[]){const next=(indegree.get(child)||0)-1;indegree.set(child,next);if(next===0){queue.push(child);queue.sort()}}}
  if(order.length!==nodes.size)throw new Error("Recipe cycle detected");

  const demand=Object.fromEntries(rootDemand),inventory=Object.fromEntries(Object.entries(owned).map(([id,value])=>[id,Number.isFinite(value)&&value>0?value:0])),totals:Record<string,number>={},crafts:Record<string,number>={},ambiguous=new Set<string>();
  let workAmount=0;
  for(const id of order){
    const requested=demand[id]||0,used=Math.min(requested,inventory[id]||0),needed=requested-used;
    inventory[id]=(inventory[id]||0)-used;
    if(needed<=0)continue;
    const recipe=selected.get(id);
    if(!recipe){totals[id]=(totals[id]||0)+needed;if((byProduct.get(id)?.length||0)>1)ambiguous.add(id);continue}
    if(!Number.isFinite(recipe.output)||recipe.output<=0||recipe.ingredients.some(ingredient=>!Number.isFinite(ingredient.count)||ingredient.count<=0))throw new Error("Invalid recipe data");
    const count=Math.ceil(needed/recipe.output);crafts[id]=(crafts[id]||0)+count;workAmount+=count*recipe.workAmount;
    for(const ingredient of recipe.ingredients)demand[ingredient.itemId]=(demand[ingredient.itemId]||0)+count*ingredient.count;
  }
  return {demand:totals,crafts,workAmount,ambiguous:[...ambiguous].sort()};
}

export type PlannerPal={id:string;nocturnal:boolean;work:Record<string,number>};
export type TeamPlan={team:string[];covered:string[];uncovered:string[];score:number};

export function planBaseTeam(pals:PlannerPal[],requirements:Record<string,number>,teamLimit:number,preferNocturnal=false):TeamPlan{
  const roles=Object.entries(requirements).filter(([,level])=>Number.isFinite(level)&&level>0).map(([id])=>id).sort();
  const limit=Math.max(1,Math.floor(teamLimit));
  if(!roles.length)return {team:[],covered:[],uncovered:[],score:0};
  const candidates=pals.map(pal=>{
    let mask=0,score=preferNocturnal&&pal.nocturnal?1:0;
    roles.forEach((role,index)=>{const level=pal.work[role]||0;if(level>=(requirements[role]||1)){mask|=1<<index;score+=level*10}});
    return {pal,mask,score};
  }).filter(candidate=>candidate.mask);
  type State={team:string[];score:number};
  const states=new Map<number,State>([[0,{team:[],score:0}]]);
  const better=(left:State|undefined,right:State)=>!left||right.team.length<left.team.length||right.team.length===left.team.length&&(right.score>left.score||right.score===left.score&&right.team.join("|")<left.team.join("|"));
  for(const candidate of candidates){
    const snapshot=[...states.entries()];
    for(const [mask,state] of snapshot){if(state.team.length>=limit)continue;const nextMask=mask|candidate.mask;if(nextMask===mask)continue;const next={team:[...state.team,candidate.pal.id],score:state.score+candidate.score},current=states.get(nextMask);if(better(current,next))states.set(nextMask,next)}
  }
  let bestMask=0,best=states.get(0)!;
  for(const [mask,state] of states){const covered=countBits(mask),bestCovered=countBits(bestMask);if(covered>bestCovered||covered===bestCovered&&better(best,state)){bestMask=mask;best=state}}
  const covered=roles.filter((_,index)=>Boolean(bestMask&(1<<index))),uncovered=roles.filter((_,index)=>!(bestMask&(1<<index)));
  return {team:best.team,covered,uncovered,score:best.score};
}

function countBits(value:number){let count=0;for(;value;value&=value-1)count++;return count}
