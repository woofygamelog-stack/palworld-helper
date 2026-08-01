export type RenderMode="static"|"prerendered"|"client"|"hybrid";
export const routeFamilies = [
  {path:"",mode:"prerendered",indexable:true,searchIntent:"site-overview"},
  {path:"map",mode:"hybrid",indexable:true,searchIntent:"verified-locations"},
  {path:"pals",mode:"hybrid",indexable:true,searchIntent:"pal-catalog"},
  {path:"skills",mode:"hybrid",indexable:true,searchIntent:"skill-catalog"},
  {path:"skills/active",mode:"hybrid",indexable:true,searchIntent:"active-skill-catalog"},
  {path:"skills/passive",mode:"hybrid",indexable:true,searchIntent:"passive-skill-catalog"},
  {path:"skills/partner",mode:"hybrid",indexable:true,searchIntent:"partner-skill-catalog"},
  {path:"calculators",mode:"hybrid",indexable:true,searchIntent:"calculator-overview"},
  {path:"calculators/breeding",mode:"hybrid",indexable:true,searchIntent:"breeding-calculator"},
  {path:"calculators/crafting",mode:"hybrid",indexable:true,searchIntent:"crafting-calculator"},
  {path:"calculators/base",mode:"hybrid",indexable:true,searchIntent:"base-team-planner"},
  {path:"database",mode:"hybrid",indexable:true,searchIntent:"item-catalog"},
  {path:"database/quests",mode:"prerendered",indexable:true,searchIntent:"quest-catalog"},
  {path:"database/structures",mode:"hybrid",indexable:true,searchIntent:"structure-catalog"},
  {path:"database/expeditions",mode:"prerendered",indexable:true,searchIntent:"pal-expedition-catalog"},
  {path:"database/elements",mode:"prerendered",indexable:true,searchIntent:"element-matchup-guide"},
  {path:"database/technology",mode:"hybrid",indexable:true,searchIntent:"technology-catalog"},
  {path:"database/health",mode:"prerendered",indexable:true,searchIntent:"pal-health-guide"},
  {path:"database/npcs",mode:"hybrid",indexable:true,searchIntent:"npc-catalog"},
  {path:"database/dungeons",mode:"hybrid",indexable:true,searchIntent:"dungeon-catalog"},
  {path:"server-tools/settings-generator",mode:"hybrid",indexable:true,searchIntent:"server-settings"},
] as const satisfies readonly {path:string;mode:RenderMode;indexable:boolean;searchIntent:string}[];

export const collectionRoutes = routeFamilies.filter(route=>route.indexable).map(route=>route.path);

type ShellRouteMatch={path:string;exact?:boolean};
type ShellNavigationLeaf={id:string;path:string;active:readonly ShellRouteMatch[]};
type ShellNavigationLink=ShellNavigationLeaf&{icon:string;children?:never};
type ShellNavigationGroup={id:string;path:string;icon:string;active:readonly ShellRouteMatch[];children:readonly ShellNavigationLeaf[]};

export type ShellNavigationItem=ShellNavigationLink|ShellNavigationGroup;

export const shellNavigation = [
  {id:"map",path:"map",icon:"map",active:[{path:"map"}]},
  {id:"pals",path:"pals",icon:"pals",active:[{path:"pals"}]},
  {id:"skills",path:"skills",icon:"skills",active:[{path:"skills"}],children:[
    {id:"skills-active",path:"skills/active",active:[{path:"skills/active"}]},
    {id:"skills-passive",path:"skills/passive",active:[{path:"skills/passive"}]},
    {id:"skills-partner",path:"skills/partner",active:[{path:"skills/partner"}]},
  ]},
  {id:"calculators",path:"calculators",icon:"calculator",active:[{path:"calculators"}],children:[
    {id:"calculators-breeding",path:"calculators/breeding",active:[{path:"calculators/breeding"}]},
    {id:"calculators-crafting",path:"calculators/crafting",active:[{path:"calculators/crafting"}]},
    {id:"calculators-base",path:"calculators/base",active:[{path:"calculators/base"}]},
  ]},
  {id:"database",path:"database",icon:"database",active:[{path:"database"},{path:"items"}],children:[
    {id:"database-items",path:"database",active:[{path:"database",exact:true},{path:"items"}]},
    {id:"database-quests",path:"database/quests",active:[{path:"database/quests"}]},
    {id:"database-structures",path:"database/structures",active:[{path:"database/structures"}]},
    {id:"database-expeditions",path:"database/expeditions",active:[{path:"database/expeditions"}]},
    {id:"database-elements",path:"database/elements",active:[{path:"database/elements"}]},
    {id:"database-technology",path:"database/technology",active:[{path:"database/technology"}]},
    {id:"database-health",path:"database/health",active:[{path:"database/health"}]},
    {id:"database-npcs",path:"database/npcs",active:[{path:"database/npcs"}]},
    {id:"database-dungeons",path:"database/dungeons",active:[{path:"database/dungeons"}]},
  ]},
  {id:"server",path:"server-tools/settings-generator",icon:"server",active:[{path:"server-tools/settings-generator"}]},
] as const satisfies readonly ShellNavigationItem[];

export const mobilePrimaryNavigationIds=["map","pals","calculators"] as const;

export const previewRoutes = [] as const;

export const entityRouteFamilies = [
  {prefix:"pals",dataset:"pals",mode:"prerendered",prerender:"all",priorityLimit:0,sitemap:"pals",searchIntent:"pal-detail"},
  {prefix:"items",dataset:"items",mode:"hybrid",prerender:"priority",priorityLimit:100,sitemap:"items",searchIntent:"item-detail"},
  {prefix:"skills/active",dataset:"activeSkills",mode:"hybrid",prerender:"priority",priorityLimit:40,sitemap:"skills-active",searchIntent:"active-skill-detail"},
  {prefix:"skills/passive",dataset:"passiveSkills",mode:"hybrid",prerender:"priority",priorityLimit:30,sitemap:"skills-passive",searchIntent:"passive-skill-detail"},
  {prefix:"skills/partner",dataset:"partnerSkills",mode:"hybrid",prerender:"priority",priorityLimit:30,sitemap:"skills-partner",searchIntent:"partner-skill-detail"},
  {prefix:"database/npcs",dataset:"npcs",mode:"prerendered",prerender:"all",priorityLimit:0,sitemap:"npcs",searchIntent:"npc-detail"},
  {prefix:"database/dungeons",dataset:"dungeons",mode:"prerendered",prerender:"all",priorityLimit:0,sitemap:"dungeons",searchIntent:"dungeon-detail"},
  {prefix:"database/technology",dataset:"technologies",mode:"hybrid",prerender:"priority",priorityLimit:20,sitemap:"technology",searchIntent:"technology-detail"},
  {prefix:"database/structures",dataset:"structures",mode:"hybrid",prerender:"priority",priorityLimit:5,sitemap:"structures",searchIntent:"structure-detail"},
  {prefix:"database/expeditions",dataset:"expeditions",mode:"prerendered",prerender:"all",priorityLimit:0,sitemap:"expeditions",searchIntent:"pal-expedition-detail"},
  {prefix:"database/quests",dataset:"quests",mode:"hybrid",prerender:"priority",priorityLimit:5,sitemap:"quests",searchIntent:"quest-detail"},
  {prefix:"database/health/conditions",dataset:"conditions",mode:"prerendered",prerender:"all",priorityLimit:0,sitemap:"health-conditions",searchIntent:"condition-treatment-detail"},
] as const;

export const deploymentFileBudget={hardLimit:20_000,reservedHeadroom:4_000} as const;

export const supportedLocales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"] as const;
export type SupportedLocale=(typeof supportedLocales)[number];

// Google Search recognizes language-region pairs but does not accept the UN M49
// region code used by the game's Latin American Spanish locale. Keep the public
// route as es-419 and advertise it as the generic Spanish alternate instead.
export const seoHreflang=(locale:SupportedLocale)=>locale==="es-419"?"es":locale;
