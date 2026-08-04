export type ServerSettingGroup="performance"|"management"|"features"|"balance";
export type ServerSettingType="boolean"|"integer"|"number"|"text"|"enum"|"list";
export type ServerSettingValue=string|number|boolean|string[];
export type ServerSettingsValues=Record<string,ServerSettingValue>;
export type ServerSettingStatus="supported"|"deprecated";

export type ServerSettingDefinition={
  key:string;
  group:ServerSettingGroup;
  type:ServerSettingType;
  status:ServerSettingStatus;
  defaultValue?:ServerSettingValue;
  min?:number;
  max?:number;
  step?:number;
  options?:readonly string[];
  sensitive?:boolean;
  placeholder?:string;
  description:string;
  basic:boolean;
};

export type ServerIniWarningCode=
  |"unsupportedKey"|"deprecatedKey"|"duplicateKey"|"malformedEntry"|"missingHeader"
  |"boolean"|"number"|"integer"|"range"|"enum"|"list"
  |"dependency"|"security"|"performance";
export type ServerIniWarning={code:ServerIniWarningCode;key:string;relatedKey?:string;severity:"error"|"warning"|"info"};
export type ServerSettingsInput={players:number;pvp:boolean;backup:boolean;values?:ServerSettingsValues};

export const serverSettingKeys={
  performance:["BaseCampMaxNum","BaseCampMaxNumInGuild","BaseCampWorkerMaxNum","ItemContainerForceMarkDirtyInterval","MaxBuildingLimitNum","PhysicsActiveDropItemMaxNum","ServerReplicatePawnCullDistance"],
  management:["AdminPassword","AllowConnectPlatform","bAllowClientMod","bEnableBuildingPlayerUIdDisplay","bIsShowJoinLeftMessage","bIsUseBackupSaveData","ChatPostLimitPerMinute","CrossplayPlatforms","LogFormatType","PublicIP","PublicPort","RCONEnabled","RCONPort","RESTAPIEnabled","RESTAPIPort","ServerDescription","ServerName","ServerPassword","ServerPlayerMaxNum"],
  features:["AutoResetGuildTimeNoOnlinePlayers","bAllowEnhanceStat_Attack","bAllowEnhanceStat_Health","bAllowEnhanceStat_Stamina","bAllowEnhanceStat_Weight","bAllowEnhanceStat_WorkSpeed","bAllowGlobalPalboxExport","bAllowGlobalPalboxImport","bAutoResetGuildNoOnlinePlayers","bBuildAreaLimit","bCharacterRecreateInHardcore","bDisplayPvPItemNumOnWorldMap_BaseCamp","bDisplayPvPItemNumOnWorldMap_Player","bEnableFastTravel","bEnableFastTravelOnlyBaseCamp","bEnableInvaderEnemy","bEnableVoiceChat","bExistPlayerAfterLogout","bHardcore","bInvisibleOtherGuildBaseCampAreaFX","bIsPvP","bIsRandomizerPalLevelRandom","bIsStartLocationSelectByMap","bShowPlayerList","RandomizerSeed","RandomizerType","VoiceChatMaxVolumeDistance","VoiceChatZeroVolumeDistance"],
  balance:["AdditionalDropItemNumWhenPlayerKillingInPvPMode","AdditionalDropItemWhenPlayerKillingInPvPMode","bAdditionalDropItemWhenPlayerKillingInPvPMode","BlockRespawnTime","bPalLost","BuildObjectDamageRate","BuildObjectDeteriorationDamageRate","CollectionDropRate","CollectionObjectHpRate","CollectionObjectRespawnSpeedRate","DayTimeSpeedRate","DeathPenalty","DenyTechnologyList","EnemyDropItemRate","EquipmentDurabilityDamageRate","ExpRate","GuildPlayerMaxNum","GuildRejoinCooldownMinutes","ItemCorruptionMultiplier","ItemWeightRate","MonsterFarmActionSpeedRate","NightTimeSpeedRate","PalAutoHPRegeneRate","PalAutoHpRegeneRateInSleep","PalCaptureRate","PalDamageRateAttack","PalDamageRateDefense","PalEggDefaultHatchingTime","PalSpawnNumRate","PalStaminaDecreaceRate","PalStomachDecreaceRate","PlayerAutoHPRegeneRate","PlayerAutoHpRegeneRateInSleep","PlayerDamageRateAttack","PlayerDamageRateDefense","PlayerStaminaDecreaceRate","PlayerStomachDecreaceRate","RespawnPenaltyDurationThreshold","RespawnPenaltyTimeScale","SupplyDropSpan"]
} as const satisfies Record<ServerSettingGroup,readonly string[]>;
type ServerSettingKey=(typeof serverSettingKeys)[ServerSettingGroup][number];

const descriptions={
  BaseCampMaxNum:"Total server-wide base limit.",BaseCampMaxNumInGuild:"Maximum bases per guild.",BaseCampWorkerMaxNum:"Maximum Pals assigned to each base.",ItemContainerForceMarkDirtyInterval:"Container resynchronization interval in seconds.",MaxBuildingLimitNum:"Per-player building count limit; zero is unlimited.",PhysicsActiveDropItemMaxNum:"Maximum dropped items using physics.",ServerReplicatePawnCullDistance:"Pal synchronization distance from players in centimeters.",
  AdminPassword:"Password for server administration.",AllowConnectPlatform:"Deprecated platform allowlist; use CrossplayPlatforms.",bAllowClientMod:"Allow clients with mods to connect.",bEnableBuildingPlayerUIdDisplay:"Show the creator player ID on buildings.",bIsShowJoinLeftMessage:"Show join and leave messages.",bIsUseBackupSaveData:"Enable periodic world backups.",ChatPostLimitPerMinute:"Maximum chat messages per minute.",CrossplayPlatforms:"Platforms allowed to connect.",LogFormatType:"Server log output format.",PublicIP:"External address advertised by a community server.",PublicPort:"External port advertised by a community server.",RCONEnabled:"Enable remote console access.",RCONPort:"Port used for remote console access.",RESTAPIEnabled:"Enable the server REST API.",RESTAPIPort:"Port used by the server REST API.",ServerDescription:"Description shown for the server.",ServerName:"Name shown for the server.",ServerPassword:"Password required to join.",ServerPlayerMaxNum:"Maximum simultaneous players.",
  AutoResetGuildTimeNoOnlinePlayers:"Offline duration before automatic guild cleanup.",bAllowEnhanceStat_Attack:"Allow stat points in Attack.",bAllowEnhanceStat_Health:"Allow stat points in Health.",bAllowEnhanceStat_Stamina:"Allow stat points in Stamina.",bAllowEnhanceStat_Weight:"Allow stat points in Carry Weight.",bAllowEnhanceStat_WorkSpeed:"Allow stat points in Work Speed.",bAllowGlobalPalboxExport:"Allow saving Pals to the Global Palbox.",bAllowGlobalPalboxImport:"Allow loading Pals from the Global Palbox.",bAutoResetGuildNoOnlinePlayers:"Remove inactive guild structures and base Pals.",bBuildAreaLimit:"Restrict building near protected structures.",bCharacterRecreateInHardcore:"Allow character recreation after Hardcore death.",bDisplayPvPItemNumOnWorldMap_BaseCamp:"Show PvP item counts at bases on the map.",bDisplayPvPItemNumOnWorldMap_Player:"Show player positions and PvP item counts on the map.",bEnableFastTravel:"Enable fast travel.",bEnableFastTravelOnlyBaseCamp:"Restrict fast travel to bases.",bEnableInvaderEnemy:"Enable base invasion enemies.",bEnableVoiceChat:"Enable in-game voice chat.",bExistPlayerAfterLogout:"Leave players sleeping in the world after logout.",bHardcore:"Enable Hardcore mode.",bInvisibleOtherGuildBaseCampAreaFX:"Control visibility of other guild base boundaries.",bIsPvP:"Enable player-versus-player rules.",bIsRandomizerPalLevelRandom:"Randomize wild Pal levels without regional bounds.",bIsStartLocationSelectByMap:"Allow map-based starting location selection.",bShowPlayerList:"Show the player list in the menu.",RandomizerSeed:"Seed used for randomized Pal spawns.",RandomizerType:"Pal spawn randomization mode.",VoiceChatMaxVolumeDistance:"Distance before voice volume starts attenuating.",VoiceChatZeroVolumeDistance:"Distance where voice volume reaches zero.",
  AdditionalDropItemNumWhenPlayerKillingInPvPMode:"Quantity of the additional PvP death item.",AdditionalDropItemWhenPlayerKillingInPvPMode:"Item ID added to PvP death drops.",bAdditionalDropItemWhenPlayerKillingInPvPMode:"Enable an additional PvP death item.",BlockRespawnTime:"Base respawn cooldown in seconds.",bPalLost:"Permanently lose Pals on death.",BuildObjectDamageRate:"Damage multiplier applied to buildings.",BuildObjectDeteriorationDamageRate:"Building deterioration multiplier.",CollectionDropRate:"Gatherable item quantity multiplier.",CollectionObjectHpRate:"Gatherable object health multiplier.",CollectionObjectRespawnSpeedRate:"Gatherable object respawn interval multiplier.",DayTimeSpeedRate:"Daytime progression speed multiplier.",DeathPenalty:"Items or Pals lost on death.",DenyTechnologyList:"Technology IDs disabled on the server.",EnemyDropItemRate:"Enemy item drop quantity multiplier.",EquipmentDurabilityDamageRate:"Equipment durability loss multiplier.",ExpRate:"Experience gain multiplier.",GuildPlayerMaxNum:"Maximum players per guild.",GuildRejoinCooldownMinutes:"Cooldown before joining another guild.",ItemCorruptionMultiplier:"Item corruption speed multiplier.",ItemWeightRate:"Item weight multiplier.",MonsterFarmActionSpeedRate:"Ranch production speed multiplier.",NightTimeSpeedRate:"Nighttime progression speed multiplier.",PalAutoHPRegeneRate:"Pal natural health regeneration multiplier.",PalAutoHpRegeneRateInSleep:"Palbox sleep health regeneration multiplier.",PalCaptureRate:"Pal capture rate multiplier.",PalDamageRateAttack:"Damage dealt by Pals multiplier.",PalDamageRateDefense:"Damage received by Pals multiplier.",PalEggDefaultHatchingTime:"Huge Egg incubation time in hours.",PalSpawnNumRate:"Pal spawn quantity multiplier.",PalStaminaDecreaceRate:"Pal stamina depletion multiplier.",PalStomachDecreaceRate:"Pal hunger depletion multiplier.",PlayerAutoHPRegeneRate:"Player natural health regeneration multiplier.",PlayerAutoHpRegeneRateInSleep:"Player sleep health regeneration multiplier.",PlayerDamageRateAttack:"Damage dealt by players multiplier.",PlayerDamageRateDefense:"Damage received by players multiplier.",PlayerStaminaDecreaceRate:"Player stamina depletion multiplier.",PlayerStomachDecreaceRate:"Player hunger depletion multiplier.",RespawnPenaltyDurationThreshold:"Survival threshold for scaled respawn penalties.",RespawnPenaltyTimeScale:"Multiplier applied to the respawn cooldown.",SupplyDropSpan:"Meteorite and supply drop interval in minutes."
} satisfies Record<ServerSettingKey,string>;

const defaultOptionSettings='RandomizerType=None,RandomizerSeed="",bIsRandomizerPalLevelRandom=False,DayTimeSpeedRate=1.000000,NightTimeSpeedRate=1.000000,ExpRate=1.000000,PalCaptureRate=1.000000,PalSpawnNumRate=1.000000,PalDamageRateAttack=1.000000,PalDamageRateDefense=1.000000,PlayerDamageRateAttack=1.000000,PlayerDamageRateDefense=1.000000,PlayerStomachDecreaceRate=1.000000,PlayerStaminaDecreaceRate=1.000000,PlayerAutoHPRegeneRate=1.000000,PlayerAutoHpRegeneRateInSleep=1.000000,PalStomachDecreaceRate=1.000000,PalStaminaDecreaceRate=1.000000,PalAutoHPRegeneRate=1.000000,PalAutoHpRegeneRateInSleep=1.000000,BuildObjectDamageRate=1.000000,BuildObjectDeteriorationDamageRate=1.000000,CollectionDropRate=1.000000,CollectionObjectHpRate=1.000000,CollectionObjectRespawnSpeedRate=1.000000,EnemyDropItemRate=1.000000,DeathPenalty=Item,bEnableInvaderEnemy=True,PhysicsActiveDropItemMaxNum=-1,BaseCampMaxNum=128,BaseCampWorkerMaxNum=15,bAutoResetGuildNoOnlinePlayers=False,AutoResetGuildTimeNoOnlinePlayers=72.000000,GuildPlayerMaxNum=20,BaseCampMaxNumInGuild=4,PalEggDefaultHatchingTime=1.000000,bIsPvP=False,bHardcore=False,bPalLost=False,bCharacterRecreateInHardcore=False,bEnableFastTravel=True,bEnableFastTravelOnlyBaseCamp=False,bIsStartLocationSelectByMap=False,bExistPlayerAfterLogout=False,bInvisibleOtherGuildBaseCampAreaFX=False,bBuildAreaLimit=False,ItemWeightRate=1.000000,ServerPlayerMaxNum=32,ServerName="Default Palworld Server",ServerDescription="",AdminPassword="",ServerPassword="",bAllowClientMod=True,PublicPort=8211,PublicIP="",RCONEnabled=False,RCONPort=25575,RESTAPIEnabled=False,RESTAPIPort=8212,bShowPlayerList=False,ChatPostLimitPerMinute=30,CrossplayPlatforms=(Steam,Xbox,PS5,Mac),bIsUseBackupSaveData=True,LogFormatType=Text,bIsShowJoinLeftMessage=True,SupplyDropSpan=180,MaxBuildingLimitNum=0,ServerReplicatePawnCullDistance=15000.000000,bAllowGlobalPalboxExport=True,bAllowGlobalPalboxImport=False,EquipmentDurabilityDamageRate=1.000000,ItemContainerForceMarkDirtyInterval=1.000000,ItemCorruptionMultiplier=1.000000,MonsterFarmActionSpeedRate=1.000000,DenyTechnologyList=,GuildRejoinCooldownMinutes=0,BlockRespawnTime=5.000000,RespawnPenaltyDurationThreshold=0.000000,RespawnPenaltyTimeScale=2.000000,bDisplayPvPItemNumOnWorldMap_BaseCamp=False,bDisplayPvPItemNumOnWorldMap_Player=False,AdditionalDropItemWhenPlayerKillingInPvPMode="PlayerDropItem",AdditionalDropItemNumWhenPlayerKillingInPvPMode=1,bAdditionalDropItemWhenPlayerKillingInPvPMode=False,bEnableVoiceChat=False,VoiceChatMaxVolumeDistance=3000.000000,VoiceChatZeroVolumeDistance=15000.000000,bAllowEnhanceStat_Health=True,bAllowEnhanceStat_Attack=True,bAllowEnhanceStat_Stamina=True,bAllowEnhanceStat_Weight=True,bAllowEnhanceStat_WorkSpeed=True,bEnableBuildingPlayerUIdDisplay=False';

const enumOptions:Record<string,readonly string[]>={DeathPenalty:["None","Item","ItemAndEquipment","All"],LogFormatType:["Text","Json"],RandomizerType:["None","Region","All"]};
const listOptions:Record<string,readonly string[]|undefined>={CrossplayPlatforms:["Steam","Xbox","PS5","Mac"],DenyTechnologyList:undefined};
const integerKeys=new Set(["AdditionalDropItemNumWhenPlayerKillingInPvPMode","BaseCampMaxNum","BaseCampMaxNumInGuild","BaseCampWorkerMaxNum","ChatPostLimitPerMinute","GuildPlayerMaxNum","GuildRejoinCooldownMinutes","MaxBuildingLimitNum","PhysicsActiveDropItemMaxNum","PublicPort","RCONPort","RESTAPIPort","ServerPlayerMaxNum","SupplyDropSpan"]);
const textKeys=new Set(["AdditionalDropItemWhenPlayerKillingInPvPMode","AdminPassword","PublicIP","RandomizerSeed","ServerDescription","ServerName","ServerPassword"]);
const basicKeys=new Set(["AdminPassword","bAllowClientMod","bEnableFastTravel","bEnableInvaderEnemy","bIsPvP","bIsUseBackupSaveData","CrossplayPlatforms","DeathPenalty","ExpRate","PalCaptureRate","PalSpawnNumRate","ServerName","ServerDescription","ServerPassword","ServerPlayerMaxNum"]);
const ranges:Record<string,{min?:number;max?:number}>={BaseCampMaxNumInGuild:{min:1,max:10},BaseCampWorkerMaxNum:{min:1,max:50},ChatPostLimitPerMinute:{min:1},GuildPlayerMaxNum:{min:1},MaxBuildingLimitNum:{min:0},PublicPort:{min:1,max:65535},RCONPort:{min:1,max:65535},RESTAPIPort:{min:1,max:65535},ServerPlayerMaxNum:{min:1,max:32},ServerReplicatePawnCullDistance:{min:5000,max:15000}};
const placeholders:Record<string,string>={PublicIP:"203.0.113.10",RandomizerSeed:"seed",ServerDescription:"Co-op Palworld server",ServerName:"My Palworld Server"};

function splitSettings(body:string):{parts:string[];balanced:boolean}{
  const parts:string[]=[];let current="",quoted=false,escaped=false,depth=0,balanced=true;
  for(const char of body){
    if(escaped){current+=char;escaped=false;continue}
    if(char==="\\"&&quoted){current+=char;escaped=true;continue}
    if(char==='"')quoted=!quoted;
    if(!quoted&&char==="(")depth++;
    if(!quoted&&char===")"){depth--;if(depth<0)balanced=false}
    if(char===","&&!quoted&&depth===0){parts.push(current);current=""}else current+=char;
  }
  if(current.trim()||body.endsWith(","))parts.push(current);
  return {parts,balanced:balanced&&!quoted&&depth===0};
}

function unquote(value:string){return value.startsWith('"')&&value.endsWith('"')?value.slice(1,-1).replace(/\\"/g,'"').replace(/\\\\/g,"\\"):value}
function parseList(raw:string):string[]|undefined{
  if(!raw)return [];
  const body=raw.startsWith("(")&&raw.endsWith(")")?raw.slice(1,-1):raw;
  const split=splitSettings(body);if(!split.balanced)return undefined;
  const values=split.parts.map(value=>unquote(value.trim())).filter(Boolean);
  return values.every(value=>/^[A-Za-z0-9_-]+$/.test(value))?values:undefined;
}
function settingType(key:string,raw?:string):ServerSettingType{
  if(key in enumOptions)return "enum";
  if(key in listOptions)return "list";
  if(textKeys.has(key)||key==="AllowConnectPlatform")return "text";
  if(integerKeys.has(key))return "integer";
  if(/^(True|False)$/i.test(raw||"")||key.startsWith("b")||key.endsWith("Enabled"))return "boolean";
  return "number";
}
function parseValue(raw:string,type:ServerSettingType):ServerSettingValue|undefined{
  if(type==="boolean")return /^(true|false)$/i.test(raw)?raw.toLowerCase()==="true":undefined;
  if(type==="integer"||type==="number"){const value=Number(raw);return Number.isFinite(value)?value:undefined}
  if(type==="list")return parseList(raw);
  return unquote(raw);
}
function rawDefaults(){
  const values:ServerSettingsValues={};
  for(const part of splitSettings(defaultOptionSettings).parts){const separator=part.indexOf("=");const key=part.slice(0,separator),raw=part.slice(separator+1);const value=parseValue(raw,settingType(key,raw));if(value!==undefined)values[key]=value}
  return values;
}

export const serverDefaultValues=Object.freeze(rawDefaults());
export const officialServerSettings=Object.freeze((Object.entries(serverSettingKeys) as [ServerSettingGroup,readonly string[]][]).flatMap(([group,keys])=>keys.map(key=>{
  const type=settingType(key,String(serverDefaultValues[key]??"")),range=ranges[key];
  return {key,group,type,status:key==="AllowConnectPlatform"?"deprecated":"supported",defaultValue:serverDefaultValues[key],min:range?.min,max:range?.max,step:type==="integer"?1:undefined,options:enumOptions[key]||listOptions[key],sensitive:key==="AdminPassword"||key==="ServerPassword",placeholder:placeholders[key],description:descriptions[key as ServerSettingKey],basic:basicKeys.has(key)} satisfies ServerSettingDefinition;
})));
export const supportedServerSettings=officialServerSettings.filter(setting=>setting.status==="supported");
const settingByKey=new Map(officialServerSettings.map(setting=>[setting.key,setting]));

function optionSettingsBody(text:string):{body:string;header:boolean;balanced:boolean}{
  const optionIndex=text.search(/OptionSettings\s*=/i);
  if(optionIndex<0)return {body:text.trim(),header:false,balanced:true};
  const open=text.indexOf("(",optionIndex);if(open<0)return {body:"",header:true,balanced:false};
  let quoted=false,escaped=false,depth=0;
  for(let index=open;index<text.length;index++){
    const char=text[index];
    if(escaped){escaped=false;continue}
    if(char==="\\"&&quoted){escaped=true;continue}
    if(char==='"')quoted=!quoted;
    if(quoted)continue;
    if(char==="(")depth++;
    if(char===")"){depth--;if(depth===0)return {body:text.slice(open+1,index),header:true,balanced:true}}
  }
  return {body:text.slice(open+1),header:true,balanced:false};
}

function warning(code:ServerIniWarningCode,key:string,severity:ServerIniWarning["severity"]="error",relatedKey?:string):ServerIniWarning{return {code,key,severity,...(relatedKey?{relatedKey}:{})}}
function equalValue(left:ServerSettingValue|undefined,right:ServerSettingValue|undefined){return Array.isArray(left)&&Array.isArray(right)?left.length===right.length&&left.every((value,index)=>value===right[index]):left===right}

export function validateServerSettings(values:ServerSettingsValues):ServerIniWarning[]{
  const warnings:ServerIniWarning[]=[];
  for(const [key,value] of Object.entries(values)){
    const setting=settingByKey.get(key);
    if(!setting||setting.status!=="supported"){warnings.push(warning("unsupportedKey",key,"warning"));continue}
    if(setting.type==="boolean"&&typeof value!=="boolean"){warnings.push(warning("boolean",key));continue}
    if((setting.type==="integer"||setting.type==="number")&&(typeof value!=="number"||!Number.isFinite(value))){warnings.push(warning("number",key));continue}
    if(setting.type==="integer"&&typeof value==="number"&&!Number.isInteger(value)){warnings.push(warning("integer",key));continue}
    if(setting.type==="list"&&!Array.isArray(value)){warnings.push(warning("list",key));continue}
    if(setting.options&&typeof value==="string"&&!setting.options.includes(value)){warnings.push(warning("enum",key));continue}
    if(setting.options&&Array.isArray(value)&&value.some(option=>!setting.options!.includes(option))){warnings.push(warning("enum",key));continue}
    if(typeof value==="number"&&((setting.min!==undefined&&value<setting.min)||(setting.max!==undefined&&value>setting.max)))warnings.push(warning("range",key));
  }
  if(values.RCONEnabled===true&&!String(values.AdminPassword||"").trim())warnings.push(warning("security","RCONEnabled","warning","AdminPassword"));
  if(values.RESTAPIEnabled===true&&!String(values.AdminPassword||"").trim())warnings.push(warning("security","RESTAPIEnabled","warning","AdminPassword"));
  if(values.bEnableFastTravelOnlyBaseCamp===true&&values.bEnableFastTravel===false)warnings.push(warning("dependency","bEnableFastTravelOnlyBaseCamp","error","bEnableFastTravel"));
  if(values.bAutoResetGuildNoOnlinePlayers===true&&Number(values.AutoResetGuildTimeNoOnlinePlayers)<=0)warnings.push(warning("dependency","bAutoResetGuildNoOnlinePlayers","error","AutoResetGuildTimeNoOnlinePlayers"));
  if(Number(values.PalSpawnNumRate)>Number(serverDefaultValues.PalSpawnNumRate))warnings.push(warning("performance","PalSpawnNumRate","info"));
  for(const key of ["BaseCampMaxNum","BaseCampMaxNumInGuild","BaseCampWorkerMaxNum"]){if(Number(values[key])>Number(serverDefaultValues[key]))warnings.push(warning("performance",key,"info"))}
  return warnings;
}

export function parseServerIni(text:string):{value:ServerSettingsInput;values:ServerSettingsValues;warnings:ServerIniWarning[]}{
  const extracted=optionSettingsBody(text),warnings:ServerIniWarning[]=[],values:ServerSettingsValues={};
  if(!extracted.header)warnings.push(warning("missingHeader","OptionSettings","warning"));
  const split=splitSettings(extracted.body);if(!extracted.balanced||!split.balanced)warnings.push(warning("malformedEntry","OptionSettings"));
  for(const part of split.parts){
    const separator=part.indexOf("=");
    if(separator<1){if(part.trim())warnings.push(warning("malformedEntry",part.trim()));continue}
    const key=part.slice(0,separator).trim(),raw=part.slice(separator+1).trim(),setting=settingByKey.get(key);
    if(!setting){warnings.push(warning("unsupportedKey",key,"warning"));continue}
    if(setting.status==="deprecated"){warnings.push(warning("deprecatedKey",key,"warning"));continue}
    if(key in values)warnings.push(warning("duplicateKey",key,"warning"));
    const value=parseValue(raw,setting.type);
    if(value===undefined){warnings.push(warning(setting.type==="boolean"?"boolean":setting.type==="list"?"list":"number",key));continue}
    if(setting.type==="integer"&&(!Number.isInteger(value)||typeof value!=="number")){warnings.push(warning("integer",key));continue}
    if(setting.options&&typeof value==="string"&&!setting.options.includes(value)){warnings.push(warning("enum",key));continue}
    if(setting.options&&Array.isArray(value)&&value.some(option=>!setting.options!.includes(option))){warnings.push(warning("enum",key));continue}
    if(typeof value==="number"&&((setting.min!==undefined&&value<setting.min)||(setting.max!==undefined&&value>setting.max))){warnings.push(warning("range",key));continue}
    values[key]=value;
  }
  warnings.push(...validateServerSettings(values));
  return {value:{players:Number(values.ServerPlayerMaxNum??serverDefaultValues.ServerPlayerMaxNum),pvp:Boolean(values.bIsPvP??serverDefaultValues.bIsPvP),backup:Boolean(values.bIsUseBackupSaveData??serverDefaultValues.bIsUseBackupSaveData)},values,warnings};
}

const quote=(value:string)=>`"${value.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`;
function serializeValue(setting:ServerSettingDefinition,value:ServerSettingValue){
  if(setting.type==="boolean")return value?"True":"False";
  if(setting.type==="text")return quote(String(value));
  if(setting.type==="list"){const list=value as string[];if(!list.length)return "";return setting.key==="CrossplayPlatforms"?`(${list.join(",")})`:`(${list.map(quote).join(",")})`}
  return String(value);
}
export function buildServerIni(input:ServerSettingsInput|ServerSettingsValues):string{
  const legacy=input as ServerSettingsInput,legacyShape="players" in input||"pvp" in input||"backup" in input||"values" in input;
  const values:ServerSettingsValues=legacyShape?{...(legacy.values||{})}:{...(input as ServerSettingsValues)};
  if("players" in input)values.ServerPlayerMaxNum=Math.min(32,Math.max(1,Math.round(Number(legacy.players))));
  if("pvp" in input)values.bIsPvP=legacy.pvp;
  if("backup" in input)values.bIsUseBackupSaveData=legacy.backup;
  const output:string[]=[];
  for(const setting of supportedServerSettings){const value=values[setting.key];if(value===undefined)continue;output.push(`${setting.key}=${serializeValue(setting,value)}`)}
  return `[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(${output.join(",")})`;
}

export function serverSettingsDiff(values:ServerSettingsValues){return supportedServerSettings.filter(setting=>setting.key in values&&!equalValue(values[setting.key],setting.defaultValue)).map(setting=>({key:setting.key,defaultValue:setting.defaultValue,value:values[setting.key]}))}
export const serverSettingsInventory={documented:officialServerSettings.length,supported:supportedServerSettings.length,deprecated:officialServerSettings.filter(setting=>setting.status==="deprecated").length,withDefaults:supportedServerSettings.filter(setting=>setting.defaultValue!==undefined).length,withDescriptions:officialServerSettings.filter(setting=>setting.description.trim()).length};
