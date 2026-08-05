export const ownedPalStorageKey="pw-owned-pals:v1";
export const ownedPalSchema=1 as const;
export type OwnedPalEntry={palId:string;male:number;female:number;unknown:number;highestStars:0|1|2|3|4;favorite:boolean};
export type OwnedPalLedger={schema:typeof ownedPalSchema;entries:OwnedPalEntry[]};
type ReadStorage=Pick<Storage,"getItem">;
type WriteStorage=Pick<Storage,"getItem"|"setItem"|"removeItem">;

const integer=(value:unknown,minimum:number,maximum:number)=>typeof value==="number"&&Number.isInteger(value)&&value>=minimum&&value<=maximum?value:null;
export function normalizeOwnedPalLedger(value:unknown,knownPalIds?:ReadonlySet<string>):OwnedPalLedger{
  if(!value||typeof value!=="object"||(value as {schema?:unknown}).schema!==ownedPalSchema||!Array.isArray((value as {entries?:unknown}).entries))return {schema:ownedPalSchema,entries:[]};
  const merged=new Map<string,OwnedPalEntry>();
  for(const candidate of (value as {entries:unknown[]}).entries){
    if(!candidate||typeof candidate!=="object")continue;
    const raw=candidate as Partial<OwnedPalEntry>,palId=typeof raw.palId==="string"?raw.palId:"";
    if(!palId||palId.length>100||knownPalIds&&!knownPalIds.has(palId))continue;
    const male=integer(raw.male,0,9999),female=integer(raw.female,0,9999),unknown=integer(raw.unknown,0,9999),highestStars=integer(raw.highestStars,0,4);
    if(male===null||female===null||unknown===null||highestStars===null||typeof raw.favorite!=="boolean"||male+female+unknown===0)continue;
    const previous=merged.get(palId);
    merged.set(palId,previous?{palId,male:Math.min(9999,previous.male+male),female:Math.min(9999,previous.female+female),unknown:Math.min(9999,previous.unknown+unknown),highestStars:Math.max(previous.highestStars,highestStars) as 0|1|2|3|4,favorite:previous.favorite||raw.favorite}:{palId,male,female,unknown,highestStars:highestStars as 0|1|2|3|4,favorite:raw.favorite});
  }
  return {schema:ownedPalSchema,entries:[...merged.values()].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.palId.localeCompare(b.palId)).slice(0,299)};
}
export function readOwnedPalLedger(storage:ReadStorage,knownPalIds?:ReadonlySet<string>):OwnedPalLedger{
  try{return normalizeOwnedPalLedger(JSON.parse(storage.getItem(ownedPalStorageKey)||"null"),knownPalIds)}catch{return {schema:ownedPalSchema,entries:[]}}
}
export function writeOwnedPalLedger(storage:WriteStorage,ledger:OwnedPalLedger,knownPalIds?:ReadonlySet<string>){
  const normalized=normalizeOwnedPalLedger(ledger,knownPalIds);
  if(normalized.entries.length)storage.setItem(ownedPalStorageKey,JSON.stringify(normalized));else storage.removeItem(ownedPalStorageKey);
  return normalized;
}
export function ownedPalCount(entry:OwnedPalEntry){return entry.male+entry.female+entry.unknown}
export function exportOwnedPalLedger(ledger:OwnedPalLedger){return `${JSON.stringify(normalizeOwnedPalLedger(ledger),null,2)}\n`}
export function importOwnedPalLedger(text:string,knownPalIds:ReadonlySet<string>){
  let parsed:unknown;
  try{parsed=JSON.parse(text)}catch{throw new Error("invalid-json")}
  const normalized=normalizeOwnedPalLedger(parsed,knownPalIds);
  if(!normalized.entries.length)throw new Error("no-valid-entries");
  return normalized;
}
