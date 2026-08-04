export {buildServerIni,officialServerSettings,parseServerIni,serverDefaultValues,serverSettingsDiff,serverSettingsInventory,supportedServerSettings,validateServerSettings} from "./server-settings.ts";
export type {ServerIniWarning,ServerSettingDefinition,ServerSettingsInput,ServerSettingsValues} from "./server-settings.ts";
export type Recipe={id:string;output:number;ingredients:Record<string,number>};
export function expandRecipe(target:string,quantity:number,recipes:Record<string,Recipe>,owned:Record<string,number>={}){
  if(!target||!Number.isFinite(quantity)||quantity<=0)throw new Error("Invalid recipe target or quantity");
  const nodes=new Set<string>(),edges=new Map<string,string[]>(),visiting=new Set<string>(),visited=new Set<string>();
  const discover=(id:string,path:string[])=>{
    if(visiting.has(id))throw new Error(`Recipe cycle: ${[...path,id].join(" -> ")}`);
    if(visited.has(id))return;
    visiting.add(id);nodes.add(id);
    const recipe=recipes[id];
    if(recipe){
      if(!Number.isFinite(recipe.output)||recipe.output<=0)throw new Error(`Invalid recipe output: ${recipe.id}`);
      const children=Object.entries(recipe.ingredients).filter(([,count])=>Number.isFinite(count)&&count>0).map(([child])=>child);
      if(children.length!==Object.keys(recipe.ingredients).length)throw new Error(`Invalid recipe ingredient: ${recipe.id}`);
      edges.set(id,children);
      for(const child of children)discover(child,[...path,id]);
    }else edges.set(id,[]);
    visiting.delete(id);visited.add(id);
  };
  discover(target,[]);
  const indegree=new Map([...nodes].map(id=>[id,0]));
  for(const children of edges.values())for(const child of children)indegree.set(child,(indegree.get(child)||0)+1);
  const queue=[...nodes].filter(id=>indegree.get(id)===0).sort(),order:string[]=[];
  while(queue.length){const id=queue.shift()!;order.push(id);for(const child of edges.get(id)||[]){const next=(indegree.get(child)||0)-1;indegree.set(child,next);if(next===0){queue.push(child);queue.sort()}}}
  if(order.length!==nodes.size)throw new Error("Recipe cycle detected");
  const demand:Record<string,number>={[target]:quantity},inventory:Record<string,number>={};
  for(const [id,amount] of Object.entries(owned))inventory[id]=Number.isFinite(amount)&&amount>0?amount:0;
  const totals:Record<string,number>={};
  for(const id of order){
    const requested=demand[id]||0,used=Math.min(requested,inventory[id]||0),needed=requested-used;
    inventory[id]=(inventory[id]||0)-used;
    if(needed<=0)continue;
    const recipe=recipes[id];
    if(!recipe){totals[id]=(totals[id]||0)+needed;continue}
    const crafts=Math.ceil(needed/recipe.output);
    for(const [child,count] of Object.entries(recipe.ingredients))demand[child]=(demand[child]||0)+crafts*count;
  }
  return totals;
}
