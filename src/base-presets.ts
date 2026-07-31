export const baseWorkSuitabilityIds = [
  "Kindling",
  "Watering",
  "Planting",
  "GenerateElectricity",
  "Handiwork",
  "Gathering",
  "Lumbering",
  "Mining",
  "MedicineProduction",
  "Cooling",
  "Transporting",
  "Farming",
] as const;

export type BaseWorkSuitabilityId = typeof baseWorkSuitabilityIds[number];
export type BasePresetGroup = "general" | "food" | "resources" | "production";
export type BasePresetId =
  | "all"
  | "food"
  | "crops"
  | "ranch"
  | "cake-breeding"
  | "production"
  | "resources"
  | "mining"
  | "logging"
  | "cold-storage"
  | "medicine";
export type BasePresetSelection = BasePresetId | "custom";

export type BasePreset = {
  id: BasePresetId;
  group: BasePresetGroup;
  roles: readonly BaseWorkSuitabilityId[];
  provenance: "reviewed-product-rule";
};

const allRoles = [...baseWorkSuitabilityIds] as const;

export const basePresets: readonly BasePreset[] = [
  {id:"all",group:"general",roles:allRoles,provenance:"reviewed-product-rule"},
  {id:"food",group:"food",roles:["Planting","Watering","Gathering","Kindling","Cooling","Transporting"],provenance:"reviewed-product-rule"},
  {id:"crops",group:"food",roles:["Planting","Watering","Gathering","Transporting"],provenance:"reviewed-product-rule"},
  {id:"ranch",group:"food",roles:["Farming","Transporting"],provenance:"reviewed-product-rule"},
  {id:"cake-breeding",group:"food",roles:["Planting","Watering","Gathering","Farming","Kindling","Cooling","Transporting"],provenance:"reviewed-product-rule"},
  {id:"resources",group:"resources",roles:["Lumbering","Mining","Transporting"],provenance:"reviewed-product-rule"},
  {id:"mining",group:"resources",roles:["Mining","Transporting"],provenance:"reviewed-product-rule"},
  {id:"logging",group:"resources",roles:["Lumbering","Transporting"],provenance:"reviewed-product-rule"},
  {id:"production",group:"production",roles:["Kindling","GenerateElectricity","Handiwork","Transporting"],provenance:"reviewed-product-rule"},
  {id:"cold-storage",group:"production",roles:["Cooling","Transporting"],provenance:"reviewed-product-rule"},
  {id:"medicine",group:"production",roles:["Planting","Gathering","MedicineProduction","Transporting"],provenance:"reviewed-product-rule"},
] as const;

export const basePresetById = new Map<BasePresetId,BasePreset>(basePresets.map(preset=>[preset.id,preset]));

const publicRoleSlugById: Record<BaseWorkSuitabilityId,string> = {
  Kindling:"kindling",
  Watering:"watering",
  Planting:"planting",
  GenerateElectricity:"electricity",
  Handiwork:"handiwork",
  Gathering:"gathering",
  Lumbering:"lumbering",
  Mining:"mining",
  MedicineProduction:"medicine",
  Cooling:"cooling",
  Transporting:"transporting",
  Farming:"farming",
};
const roleIdByPublicSlug = new Map(Object.entries(publicRoleSlugById).map(([id,slug])=>[slug,id as BaseWorkSuitabilityId]));

export type BasePlannerState = {
  preset: BasePresetSelection;
  roles: BaseWorkSuitabilityId[];
  minimumLevel: number;
  teamLimit: number;
  preferNocturnal: boolean;
};

export const defaultBasePlannerState: BasePlannerState = {
  preset:"all",
  roles:[...allRoles],
  minimumLevel:1,
  teamLimit:10,
  preferNocturnal:false,
};

const clampInteger = (value:string|null,min:number,max:number,fallback:number) => {
  if(value===null||!value.trim())return fallback;
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,Math.floor(parsed))):fallback;
};

export function parseBasePlannerState(params:URLSearchParams):BasePlannerState{
  const requested=params.get("preset"),preset=basePresetById.has(requested as BasePresetId)?requested as BasePresetId:requested==="custom"?"custom":"all";
  const roles=preset==="custom"
    ? [...new Set((params.get("roles")||"").split(",").map(slug=>roleIdByPublicSlug.get(slug)).filter((role):role is BaseWorkSuitabilityId=>Boolean(role)))]
    : [...(basePresetById.get(preset)?.roles||allRoles)];
  return {
    preset,
    roles,
    minimumLevel:clampInteger(params.get("level"),1,5,defaultBasePlannerState.minimumLevel),
    teamLimit:clampInteger(params.get("limit"),1,15,defaultBasePlannerState.teamLimit),
    preferNocturnal:params.get("night")==="1",
  };
}

export function writeBasePlannerState(params:URLSearchParams,state:BasePlannerState):URLSearchParams{
  for(const key of ["preset","roles","level","limit","night"])params.delete(key);
  if(state.preset!=="all")params.set("preset",state.preset);
  if(state.preset==="custom"){
    const roles=[...new Set(state.roles)].map(role=>publicRoleSlugById[role]).filter(Boolean).sort();
    if(roles.length)params.set("roles",roles.join(","));
  }
  if(state.minimumLevel!==defaultBasePlannerState.minimumLevel)params.set("level",String(state.minimumLevel));
  if(state.teamLimit!==defaultBasePlannerState.teamLimit)params.set("limit",String(state.teamLimit));
  if(state.preferNocturnal)params.set("night","1");
  return params;
}

export function requirementsForBaseRoles(roles:readonly BaseWorkSuitabilityId[],minimumLevel:number):Record<string,number>{
  const level=Math.max(1,Math.min(5,Math.floor(minimumLevel)));
  return Object.fromEntries([...new Set(roles)].map(role=>[role,level]));
}

export function validateBasePresets(){
  const known=new Set<string>(baseWorkSuitabilityIds),ids=new Set<string>(),roleSets=new Set<string>();
  for(const preset of basePresets){
    if(ids.has(preset.id))throw new Error(`Duplicate base preset: ${preset.id}`);
    ids.add(preset.id);
    if(!preset.roles.length)throw new Error(`Empty base preset: ${preset.id}`);
    if(new Set(preset.roles).size!==preset.roles.length)throw new Error(`Duplicate role in base preset: ${preset.id}`);
    if(preset.roles.some(role=>!known.has(role)))throw new Error(`Unknown role in base preset: ${preset.id}`);
    const signature=[...preset.roles].sort().join("|");
    if(roleSets.has(signature))throw new Error(`Duplicate base preset role set: ${preset.id}`);
    roleSets.add(signature);
  }
  return true;
}
