export type IvStat="hp"|"attack"|"defense";
export type IvData={meta:{schema:1;verification:"verified";palCount:299;maxLevel:80;maxIv:100;maxStars:4;maxSoulRank:4;maxFriendshipRank:10};constants:{talentPerPoint:number;condensingPerStar:number;soulPerRank:number;hp:IvStatConstants;attack:IvStatConstants;defense:IvStatConstants};friendshipRanks:{rank:number;points:number}[];friendshipByBase:Record<IvStat,Record<string,number>>};
type IvStatConstants={fixed:number;levelFixed:number;levelMultiplier:number};
export type IvInputs={base:number;level:number;iv:number;stars:number;soulRank:number;friendshipRank:number};
const integer=(value:number,min:number,max:number)=>Number.isInteger(value)&&value>=min&&value<=max;
export function calculateIvStat(stat:IvStat,input:IvInputs,data:IvData){
  if(!integer(input.level,1,data.meta.maxLevel)||!integer(input.iv,0,data.meta.maxIv)||!integer(input.stars,0,data.meta.maxStars)||!integer(input.soulRank,0,data.meta.maxSoulRank)||!integer(input.friendshipRank,0,data.meta.maxFriendshipRank))throw new Error("Invalid IV calculator input");
  const config=data.constants[stat],friendship=data.friendshipByBase[stat][String(input.base)];
  if(!Number.isFinite(friendship))throw new Error(`Missing IV friendship coefficient for ${stat} base ${input.base}`);
  const f=Math.fround,effectiveBase=f(input.base+f(friendship*input.friendshipRank)),talentMultiplier=f(1+f(input.iv*f(data.constants.talentPerPoint))),left=f(effectiveBase*talentMultiplier),right=f(config.levelMultiplier*input.level),fixed=f(config.fixed+config.levelFixed*input.level),base=Math.floor(f(fixed+left*right)),condensed=Math.floor(f(base*f(1+f(input.stars*f(data.constants.condensingPerStar)))));
  return Math.floor(f(condensed*f(1+f(input.soulRank*f(data.constants.soulPerRank)))));
}
export function findIvRange(stat:IvStat,displayed:number,input:Omit<IvInputs,"iv">,data:IvData){
  if(!integer(displayed,0,Number.MAX_SAFE_INTEGER))return [];
  const matches:number[]=[];
  for(let iv=0;iv<=data.meta.maxIv;iv++)if(calculateIvStat(stat,{...input,iv},data)===displayed)matches.push(iv);
  return matches;
}
