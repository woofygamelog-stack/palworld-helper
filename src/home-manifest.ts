import type {IconName} from "./icons";

export type HomeQuickActionId="map"|"pals"|"breeding"|"crafting"|"base"|"server";
export type HomeCatalogGroupId="pals-and-skills"|"items-and-progression"|"exploration"|"combat-and-management";
export type HomeTrustItemId="verified"|"unknowns"|"locales";

export type HomeRouteLink={id:string;path:string};
export type HomeQuickAction=HomeRouteLink&{id:HomeQuickActionId;icon:IconName};
export type HomeCatalogGroup={id:HomeCatalogGroupId;icon:IconName;links:readonly HomeRouteLink[]};

export const homeQuickActions = [
  {id:"map",path:"map",icon:"map"},
  {id:"pals",path:"pals",icon:"pals"},
  {id:"breeding",path:"calculators/breeding",icon:"calculator"},
  {id:"crafting",path:"calculators/crafting",icon:"calculator"},
  {id:"base",path:"calculators/base",icon:"pals"},
  {id:"server",path:"server-tools/settings-generator",icon:"server"},
] as const satisfies readonly HomeQuickAction[];

export const homeCatalogGroups = [
  {id:"pals-and-skills",icon:"pals",links:[
    {id:"pals",path:"pals"},
    {id:"skills",path:"skills"},
    {id:"active-skills",path:"skills/active"},
    {id:"passive-skills",path:"skills/passive"},
    {id:"partner-skills",path:"skills/partner"},
  ]},
  {id:"items-and-progression",icon:"database",links:[
    {id:"items",path:"database"},
    {id:"structures",path:"database/structures"},
    {id:"technology",path:"database/technology"},
    {id:"quests",path:"database/quests"},
  ]},
  {id:"exploration",icon:"map",links:[
    {id:"map",path:"map"},
    {id:"npcs",path:"database/npcs"},
    {id:"dungeons",path:"database/dungeons"},
    {id:"expeditions",path:"database/expeditions"},
  ]},
  {id:"combat-and-management",icon:"skills",links:[
    {id:"elements",path:"database/elements"},
    {id:"health",path:"database/health"},
    {id:"base-planner",path:"calculators/base"},
  ]},
] as const satisfies readonly HomeCatalogGroup[];

export function validateHomeManifest(implementedRoutes:readonly string[]){
  const allowed=new Set(implementedRoutes),catalogLinks=homeCatalogGroups.reduce<HomeRouteLink[]>((all,group)=>{all.push(...group.links);return all},[]),links:HomeRouteLink[]=[...homeQuickActions,...catalogLinks];
  const invalid=links.filter(link=>!allowed.has(link.path));
  if(invalid.length)throw new Error(`Home links reference unimplemented routes: ${invalid.map(link=>`${link.id}:${link.path}`).join(", ")}`);
  if(new Set(homeQuickActions.map(action=>action.id)).size!==homeQuickActions.length)throw new Error("Home quick-action IDs must be unique");
  if(new Set(homeCatalogGroups.map(group=>group.id)).size!==homeCatalogGroups.length)throw new Error("Home catalog-group IDs must be unique");
  return true;
}
