export const sourceLocaleToSiteLocale = Object.freeze({
  en:"en-US","zh-Hans":"zh-CN","zh-Hant":"zh-TW",ja:"ja-JP",fr:"fr-FR",it:"it-IT",de:"de-DE",
  es:"es-ES","pt-BR":"pt-BR",ru:"ru-RU",ko:"ko-KR",id:"id-ID","es-MX":"es-419",th:"th-TH",tr:"tr-TR",vi:"vi-VN",pl:"pl-PL"
});

export const dungeonPublicDefinitions = Object.freeze({
  NAME_RandomDungeon_grass01:{slug:"hillside-cavern",kind:"rotating"},
  NAME_RandomDungeon_grass02:{slug:"ravine-grotto",kind:"rotating"},
  NAME_RandomDungeon_forest01:{slug:"mountain-stream-grotto",kind:"rotating"},
  NAME_RandomDungeon_volcano01:{slug:"volcanic-cavern",kind:"rotating"},
  NAME_RandomDungeon_dessert01:{slug:"cavern-of-the-dunes",kind:"rotating"},
  NAME_RandomDungeon_snow01:{slug:"astral-mountains-cavern",kind:"rotating"},
  NAME_RandomDungeon_PvP:{slug:"isolated-island-cavern",kind:"rotating"},
  NAME_RandomDungeon_Sakura01:{slug:"cherry-blossom-cave",kind:"rotating"},
  NAME_RandomDungeon_Viking01:{slug:"feybreak-cavern",kind:"rotating"},
  NAME_RandomDungeon_Skyland01:{slug:"sunreach-skies",kind:"rotating"},
  NAME_FixedDungeon_grass_1:{slug:"sealed-realm-frozen-wings",kind:"fixed"},
  NAME_FixedDungeon_grass_2:{slug:"sealed-realm-ardent",kind:"fixed"},
  NAME_FixedDungeon_grass_3:{slug:"sealed-realm-myriad-flames",kind:"fixed"},
  NAME_FixedDungeon_grass_4:{slug:"sealed-realm-swordmaster",kind:"fixed"},
  NAME_FixedDungeon_grass_5:{slug:"sealed-realm-frost-flower",kind:"fixed"},
  NAME_FixedDungeon_grass_6:{slug:"sealed-realm-frigid-fox",kind:"fixed"},
  NAME_FixedDungeon_grass_7:{slug:"sealed-realm-luxurious-thicket",kind:"fixed"},
  NAME_FixedDungeon_forest_1:{slug:"sealed-realm-sorcerer",kind:"fixed"},
  NAME_FixedDungeon_forest_2:{slug:"sealed-realm-guardian",kind:"fixed"},
  NAME_FixedDungeon_forest_3:{slug:"sealed-realm-swift",kind:"fixed"},
  NAME_FixedDungeon_forest_4:{slug:"sealed-realm-esoteric",kind:"fixed"},
  NAME_FixedDungeon_forest_5:{slug:"sealed-realm-pristine",kind:"fixed"},
  NAME_FixedDungeon_DarkIsland_1:{slug:"sealed-realm-wardenstone",kind:"fixed"},
  NAME_FixedDungeon_DarkIsland_2:{slug:"sealed-realm-little-hero",kind:"fixed"},
  NAME_FixedDungeon_DarkIsland_3:{slug:"sealed-realm-indigo",kind:"fixed"},
  NAME_FixedDungeon_DarkIsland_4:{slug:"sealed-realm-soul",kind:"fixed"},
  NAME_FixedDungeon_SmallIsland03:{slug:"sealed-realm-glacial-core",kind:"fixed"},
  NAME_FixedDungeon_SkyIsland_01:{slug:"sealed-realm-astral-vow",kind:"fixed"}
});

export const supportedDungeonNameIds = new Set(Object.keys(dungeonPublicDefinitions));
