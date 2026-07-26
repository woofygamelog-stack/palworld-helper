export type ServerSettingDefinition={key:string;group:"performance"|"management"|"features"|"balance";type:"boolean"|"integer"|"number"|"text"|"enum";min?:number;max?:number;step?:number;options?:string[];sensitive?:boolean;placeholder?:string;defaultValue?:string|number|boolean};
export const officialServerSettings:ServerSettingDefinition[] = [
  {key:"ServerPlayerMaxNum",group:"management",type:"integer",min:1,max:32,defaultValue:32},{key:"ServerName",group:"management",type:"text",placeholder:"My Palworld Server"},{key:"ServerDescription",group:"management",type:"text",placeholder:"Co-op Palworld server"},{key:"ServerPassword",group:"management",type:"text",sensitive:true,placeholder:"Enter only when required"},{key:"AdminPassword",group:"management",type:"text",sensitive:true,placeholder:"Use a long unique password"},{key:"PublicIP",group:"management",type:"text",placeholder:"203.0.113.10"},{key:"PublicPort",group:"management",type:"integer",min:1,max:65535,placeholder:"8211"},{key:"RCONEnabled",group:"management",type:"boolean"},{key:"RCONPort",group:"management",type:"integer",min:1,max:65535,placeholder:"25575"},{key:"RESTAPIEnabled",group:"management",type:"boolean"},{key:"RESTAPIPort",group:"management",type:"integer",min:1,max:65535,placeholder:"8212"},{key:"CrossplayPlatforms",group:"management",type:"text",placeholder:"(Steam,Xbox,PS5,Mac)"},{key:"bAllowClientMod",group:"management",type:"boolean"},{key:"bIsShowJoinLeftMessage",group:"management",type:"boolean"},{key:"bIsUseBackupSaveData",group:"management",type:"boolean",defaultValue:true},{key:"ChatPostLimitPerMinute",group:"management",type:"integer",min:1,placeholder:"10"},
  {key:"BaseCampMaxNum",group:"performance",type:"integer",min:1},{key:"BaseCampMaxNumInGuild",group:"performance",type:"integer",min:1,max:10},{key:"BaseCampWorkerMaxNum",group:"performance",type:"integer",min:1,max:50},{key:"MaxBuildingLimitNum",group:"performance",type:"integer",min:1},{key:"PhysicsActiveDropItemMaxNum",group:"performance",type:"integer",min:0},{key:"ServerReplicatePawnCullDistance",group:"performance",type:"integer",min:5000,max:15000},
  {key:"bIsPvP",group:"features",type:"boolean",defaultValue:false},{key:"bEnableFastTravel",group:"features",type:"boolean"},{key:"bEnableFastTravelOnlyBaseCamp",group:"features",type:"boolean"},{key:"bEnableInvaderEnemy",group:"features",type:"boolean"},{key:"bEnableVoiceChat",group:"features",type:"boolean"},{key:"bShowPlayerList",group:"features",type:"boolean"},{key:"bHardcore",group:"features",type:"boolean"},{key:"bAutoResetGuildNoOnlinePlayers",group:"features",type:"boolean"},{key:"AutoResetGuildTimeNoOnlinePlayers",group:"features",type:"number",min:0},
  {key:"ExpRate",group:"balance",type:"number",min:0},{key:"PalCaptureRate",group:"balance",type:"number",min:0},{key:"PalSpawnNumRate",group:"balance",type:"number",min:0},{key:"DayTimeSpeedRate",group:"balance",type:"number",min:0},{key:"NightTimeSpeedRate",group:"balance",type:"number",min:0},{key:"CollectionDropRate",group:"balance",type:"number",min:0},{key:"CollectionObjectRespawnSpeedRate",group:"balance",type:"number",min:0},{key:"EnemyDropItemRate",group:"balance",type:"number",min:0},{key:"GuildPlayerMaxNum",group:"balance",type:"integer",min:1},{key:"DeathPenalty",group:"balance",type:"enum",options:["None","Item","ItemAndEquipment","All"]},{key:"PalEggDefaultHatchingTime",group:"balance",type:"number",min:0},{key:"BuildObjectDamageRate",group:"balance",type:"number",min:0},{key:"BuildObjectDeteriorationDamageRate",group:"balance",type:"number",min:0},{key:"EquipmentDurabilityDamageRate",group:"balance",type:"number",min:0}
];
export type ServerSettingsInput={players:number;pvp:boolean;backup:boolean;values?:Record<string,string|number|boolean>};
const quote=(value:string)=>`"${value.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`;
export function buildServerIni(input:ServerSettingsInput|Record<string,string|number|boolean>):string {
  const legacy=input as ServerSettingsInput,values:Record<string,string|number|boolean>={...(legacy.values||{})};
  if("players" in input)values.ServerPlayerMaxNum=Math.min(32,Math.max(1,Math.round(Number(legacy.players))));
  if("pvp" in input)values.bIsPvP=legacy.pvp;if("backup" in input)values.bIsUseBackupSaveData=legacy.backup;
  const known=new Map(officialServerSettings.map(setting=>[setting.key,setting]));
  const output=Object.entries(values).filter(([key,value])=>known.has(key)&&value!=="").map(([key,value])=>{const setting=known.get(key)!;if(setting.type==="boolean")return `${key}=${value?"True":"False"}`;if(setting.type==="text")return `${key}=${quote(String(value))}`;return `${key}=${value}`});
  return `[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(${output.join(",")})`;
}
function splitSettings(body:string){const parts:string[]=[];let current="",quoted=false,escaped=false,depth=0;for(const char of body){if(escaped){current+=char;escaped=false;continue}if(char==="\\"&&quoted){current+=char;escaped=true;continue}if(char==='"')quoted=!quoted;if(!quoted&&char==="(")depth++;if(!quoted&&char===")")depth--;if(char===","&&!quoted&&depth===0){parts.push(current);current=""}else current+=char}if(current.trim())parts.push(current);return parts}
export function parseServerIni(text:string):{value:ServerSettingsInput;values:Record<string,string|number|boolean>;warnings:string[]}{
  const warnings:string[]=[],match=text.match(/OptionSettings\s*=\s*\(([\s\S]*)\)\s*$/i),body=match?.[1]||text,definitions=new Map(officialServerSettings.map(setting=>[setting.key,setting])),values:Record<string,string|number|boolean>={};
  for(const part of splitSettings(body)){const separator=part.indexOf("=");if(separator<1)continue;const key=part.slice(0,separator).trim(),raw=part.slice(separator+1).trim(),setting=definitions.get(key);if(!setting){warnings.push(`Unsupported key ignored: ${key}`);continue}if(setting.type==="boolean"){if(!/^(true|false|1|0)$/i.test(raw)){warnings.push(`${key} must be True or False.`);continue}values[key]=/^(true|1)$/i.test(raw)}else if(setting.type==="integer"||setting.type==="number"){const number=Number(raw);if(!Number.isFinite(number)){warnings.push(`${key} must be a number.`);continue}const normalized=setting.type==="integer"?Math.round(number):number;if((setting.min!==undefined&&normalized<setting.min)||(setting.max!==undefined&&normalized>setting.max)){warnings.push(`${key} is outside the supported range.`);continue}values[key]=normalized}else{values[key]=raw.replace(/^"|"$/g,"").replace(/\\"/g,'"')}}
  const players=Number(values.ServerPlayerMaxNum??32),pvp=Boolean(values.bIsPvP??false),backup=Boolean(values.bIsUseBackupSaveData??true);
  return {value:{players,pvp,backup},values,warnings};
}
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
