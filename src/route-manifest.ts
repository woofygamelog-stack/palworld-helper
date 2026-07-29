export type RenderMode="static"|"client"|"hybrid";
export const routeFamilies = [
  {path:"",mode:"static",indexable:true},
  {path:"map",mode:"client",indexable:true},
  {path:"pals",mode:"static",indexable:true},
  {path:"skills",mode:"static",indexable:true},
  {path:"skills/active",mode:"static",indexable:true},
  {path:"skills/passive",mode:"static",indexable:true},
  {path:"skills/partner",mode:"static",indexable:true},
  {path:"calculators",mode:"client",indexable:true},
  {path:"calculators/breeding",mode:"client",indexable:true},
  {path:"calculators/crafting",mode:"client",indexable:true},
  {path:"database",mode:"static",indexable:true},
  {path:"database/npcs",mode:"static",indexable:true},
  {path:"database/dungeons",mode:"static",indexable:true},
  {path:"server-tools/settings-generator",mode:"client",indexable:true},
] as const satisfies readonly {path:string;mode:RenderMode;indexable:boolean}[];

export const collectionRoutes = routeFamilies.filter(route=>route.indexable).map(route=>route.path);

export const shellNavigation = [
  {id:"home",path:"",icon:"home"},
  {id:"map",path:"map",icon:"map"},
  {id:"pals",path:"pals",icon:"pals"},
  {id:"skills",path:"skills",icon:"skills"},
  {id:"calculators",path:"calculators/breeding",icon:"calculator"},
  {id:"database",path:"database",icon:"database"},
  {id:"server",path:"server-tools/settings-generator",icon:"server"},
] as const;

export const previewRoutes = [] as const;

export const entityRouteFamilies = [
  {prefix:"pals",dataset:"pals",mode:"client",priority:"all"},
  {prefix:"items",dataset:"items",mode:"client",priority:"all"},
  {prefix:"skills/active",dataset:"activeSkills",mode:"client",priority:"all"},
  {prefix:"skills/passive",dataset:"passiveSkills",mode:"client",priority:"all"},
  {prefix:"skills/partner",dataset:"partnerSkills",mode:"client",priority:"all"},
  {prefix:"database/npcs",dataset:"npcs",mode:"client",priority:"all"},
  {prefix:"database/dungeons",dataset:"dungeons",mode:"client",priority:"all"},
] as const;

export const deploymentFileBudget={hardLimit:20_000,reservedHeadroom:4_000} as const;

export const supportedLocales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"] as const;
