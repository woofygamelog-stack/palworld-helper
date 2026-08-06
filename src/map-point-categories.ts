export type MapPointGroup="location"|"collectible"|"npc"|"resource"|"activity";
export type MapPointLabelSource="layer"|"extra"|"item";
export type MapPointDetailKind="eggGrade";

export const mapPointCategoryDefinitions=[
  {id:"dungeon",group:"location",labelSource:"layer",labelKey:"dungeon",iconPath:"/assets/map-icons/dungeon.webp"},
  {id:"oilRig",group:"location",labelSource:"extra",labelKey:"oilRig",iconPath:"/assets/map-icons/oil-rig.webp"},
  {id:"egg",group:"collectible",labelSource:"layer",labelKey:"egg",iconPrefix:"/assets/items/PalEgg_",detailKind:"eggGrade"},
  {id:"skillFruit",group:"collectible",labelSource:"layer",labelKey:"skillFruit",iconPath:"/assets/items/SkillCard_AirCanon.webp"},
  {id:"treasure",group:"collectible",labelSource:"layer",labelKey:"treasure",iconPath:"/assets/map-icons/treasure.webp"},
  {id:"collectibleShrine",group:"collectible",labelSource:"layer",labelKey:"collectibleShrine",iconPath:"/assets/map-icons/pal-statue.webp"},
  {id:"palStatue",group:"collectible",labelSource:"layer",labelKey:"palStatue",iconPath:"/assets/map-icons/pal-statue.webp"},
  {id:"note",group:"collectible",labelSource:"extra",labelKey:"note",iconPath:"/assets/map-icons/treasure.webp"},
  {id:"npc",group:"npc",labelSource:"layer",labelKey:"npc",iconPath:"/assets/map-icons/npc.webp"},
  {id:"merchant",group:"npc",labelSource:"layer",labelKey:"merchant",iconPath:"/assets/map-icons/merchant.webp"},
  {id:"palMerchant",group:"npc",labelSource:"layer",labelKey:"palMerchant",iconPath:"/assets/map-icons/merchant.webp"},
  {id:"bounty",group:"npc",labelSource:"layer",labelKey:"bounty",iconPath:"/assets/map-icons/wanted.webp"},
  {id:"camp",group:"npc",labelSource:"extra",labelKey:"camp",iconPath:"/assets/map-icons/npc.webp"},
  {id:"redBerry",group:"resource",labelSource:"item",labelKey:"Berries",iconPath:"/assets/items/Berries.webp"},
  {id:"mushroom",group:"resource",labelSource:"item",labelKey:"Mushroom",iconPath:"/assets/items/Mushroom.webp"},
  {id:"oil",group:"resource",labelSource:"item",labelKey:"CrudeOil",iconPath:"/assets/items/CrudeOil.webp"},
  {id:"ore",group:"resource",labelSource:"item",labelKey:"CopperOre",iconPath:"/assets/items/CopperOre.webp"},
  {id:"coal",group:"resource",labelSource:"item",labelKey:"Coal",iconPath:"/assets/items/Coal.webp"},
  {id:"sulfur",group:"resource",labelSource:"item",labelKey:"Sulfur",iconPath:"/assets/items/Sulfur.webp"},
  {id:"quartz",group:"resource",labelSource:"item",labelKey:"Quartz",iconPath:"/assets/items/Quartz.webp"},
  {id:"fishing",group:"activity",labelSource:"layer",labelKey:"fishing",iconPath:"/assets/map-icons/fishing.webp"},
  {id:"randomEvent",group:"activity",labelSource:"layer",labelKey:"randomEvent",iconPath:"/assets/map-icons/random-event.webp"},
  {id:"supplyDrop",group:"activity",labelSource:"extra",labelKey:"supplyDrop",iconPath:"/assets/map-icons/treasure.webp"},
] as const satisfies readonly {id:string;group:MapPointGroup;labelSource:MapPointLabelSource;labelKey:string;iconPath?:string;iconPrefix?:string;detailKind?:MapPointDetailKind}[];

export type MapPointCategory=(typeof mapPointCategoryDefinitions)[number]["id"];

export const mapPointCategoryById=new Map(mapPointCategoryDefinitions.map(definition=>[definition.id,definition]));

export function publicMapPointDetail(kind:MapPointDetailKind|undefined,subtype:string,gradeLabel:string){
  if(kind!=="eggGrade")return "";
  const match=subtype.match(/(?:^| · )Grade ([1-5])$/);
  return match?`${gradeLabel} ${match[1]}`:"";
}
