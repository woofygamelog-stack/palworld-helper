export const collectionRoutes = [
  "",
  "map",
  "pals",
  "skills",
  "skills/active",
  "skills/passive",
  "skills/partner",
  "calculators",
  "calculators/breeding",
  "calculators/crafting",
  "database",
  "server-tools/settings-generator",
] as const;

export const previewRoutes = [] as const;

export const entityRouteFamilies = [
  { prefix: "pals", dataset: "pals" },
  { prefix: "items", dataset: "items" },
  { prefix: "skills/active", dataset: "activeSkills" },
  { prefix: "skills/passive", dataset: "passiveSkills" },
  { prefix: "skills/partner", dataset: "partnerSkills" },
] as const;

export const supportedLocales = ["en-US","zh-CN","zh-TW","ja-JP","fr-FR","it-IT","de-DE","es-ES","pt-BR","ru-RU","ko-KR","id-ID","es-419","th-TH","tr-TR","vi-VN","pl-PL"] as const;
