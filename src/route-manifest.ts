export type RenderMode="static"|"prerendered"|"client"|"hybrid";
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
  {path:"server-tools/settings-generator",mode:"client",indexable:true},
] as const satisfies readonly {path:string;mode:RenderMode;indexable:boolean}[];

export const collectionRoutes = routeFamilies.filter(route=>route.indexable).map(route=>route.path);

export const previewRoutes = [] as const;

export const entityRouteFamilies = [
  {prefix:"pals",dataset:"pals",mode:"prerendered",priority:"all"},
  {prefix:"items",dataset:"items",mode:"hybrid",priority:"scored-subset"},
  {prefix:"skills/active",dataset:"activeSkills",mode:"prerendered",priority:"all"},
  {prefix:"skills/passive",dataset:"passiveSkills",mode:"prerendered",priority:"all"},
  {prefix:"skills/partner",dataset:"partnerSkills",mode:"hybrid",priority:"spa-fallback"},
] as const;

export const itemPrerenderLimit=50;
export const deploymentFileBudget={hardLimit:20_000,reservedHeadroom:4_000} as const;

export const supportedLocales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"] as const;
