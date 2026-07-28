export type DropRelation={palId:string;itemId:string;level:number;rate:number;min:number;max:number};
export type DropPal={id:string;dex:number;variant:boolean};

export function groupItemDropSources<TPal extends DropPal, TDrop extends DropRelation>(itemId:string,pals:readonly TPal[],drops:readonly TDrop[]){
  const palsById=new Map(pals.map(pal=>[pal.id,pal]));
  const grouped=new Map<string,TDrop[]>();
  for(const drop of drops){
    if(drop.itemId!==itemId)continue;
    grouped.set(drop.palId,[...(grouped.get(drop.palId)||[]),drop]);
  }
  return [...grouped]
    .map(([palId,relations])=>({pal:palsById.get(palId),drops:relations.sort((a,b)=>a.level-b.level||a.itemId.localeCompare(b.itemId))}))
    .filter((entry):entry is {pal:TPal;drops:TDrop[]}=>!!entry.pal)
    .sort((a,b)=>a.pal.dex-b.pal.dex||Number(a.pal.variant)-Number(b.pal.variant)||a.pal.id.localeCompare(b.pal.id));
}
