import {normalizeOwnedPalLedger,type OwnedPalLedger} from "./owned-pals.ts";

export const ownedPalProjectionSchema=1 as const;
export const ownedPalProjectionKind="palworld-helper-owned-pal-projection" as const;
export const ownedPalProjectionLimits={maximumBytes:1_000_000,maximumRecords:5_000} as const;

export type OwnedPalProjectionRecord={palId:string;gender:"male"|"female"|"unknown";stars:0|1|2|3|4;favorite:boolean};
export type OwnedPalProjection={schema:typeof ownedPalProjectionSchema;kind:typeof ownedPalProjectionKind;gameBuild:string;records:OwnedPalProjectionRecord[]};
export type OwnedPalProjectionPreview={ledger:OwnedPalLedger;recordCount:number;speciesCount:number};
export type OwnedPalProjectionErrorCode="empty-file"|"file-too-large"|"invalid-encoding"|"invalid-json"|"unsupported-envelope"|"unsupported-build"|"too-many-records"|"invalid-record"|"unknown-pal"|"no-owned-pals";

export class OwnedPalProjectionError extends Error{
  readonly code:OwnedPalProjectionErrorCode;
  constructor(code:OwnedPalProjectionErrorCode){super(code);this.name="OwnedPalProjectionError";this.code=code}
}

const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const recordKeys=["palId","gender","stars","favorite"] as const;

export function parseOwnedPalProjection(bytes:Uint8Array,expectedGameBuild:string,knownPalIds:ReadonlySet<string>):OwnedPalProjectionPreview{
  if(bytes.byteLength===0)throw new OwnedPalProjectionError("empty-file");
  if(bytes.byteLength>ownedPalProjectionLimits.maximumBytes)throw new OwnedPalProjectionError("file-too-large");
  let text:string;
  try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes)}catch{throw new OwnedPalProjectionError("invalid-encoding")}
  let value:unknown;
  try{value=JSON.parse(text)}catch{throw new OwnedPalProjectionError("invalid-json")}
  if(!value||typeof value!=="object"||Array.isArray(value))throw new OwnedPalProjectionError("unsupported-envelope");
  const envelope=value as Record<string,unknown>;
  if(!exactKeys(envelope,["schema","kind","gameBuild","records"])||envelope.schema!==ownedPalProjectionSchema||envelope.kind!==ownedPalProjectionKind||typeof envelope.gameBuild!=="string"||!Array.isArray(envelope.records))throw new OwnedPalProjectionError("unsupported-envelope");
  if(envelope.gameBuild!==expectedGameBuild)throw new OwnedPalProjectionError("unsupported-build");
  if(envelope.records.length>ownedPalProjectionLimits.maximumRecords)throw new OwnedPalProjectionError("too-many-records");
  const entries=[];
  for(const candidate of envelope.records){
    if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))throw new OwnedPalProjectionError("invalid-record");
    const record=candidate as Record<string,unknown>;
    if(!exactKeys(record,recordKeys)||typeof record.palId!=="string"||record.palId.length===0||record.palId.length>100||!(["male","female","unknown"] as unknown[]).includes(record.gender)||!Number.isInteger(record.stars)||Number(record.stars)<0||Number(record.stars)>4||typeof record.favorite!=="boolean")throw new OwnedPalProjectionError("invalid-record");
    if(!knownPalIds.has(record.palId))throw new OwnedPalProjectionError("unknown-pal");
    entries.push({palId:record.palId,male:record.gender==="male"?1:0,female:record.gender==="female"?1:0,unknown:record.gender==="unknown"?1:0,highestStars:record.stars as 0|1|2|3|4,favorite:record.favorite});
  }
  const ledger=normalizeOwnedPalLedger({schema:1,entries},knownPalIds);
  if(!ledger.entries.length)throw new OwnedPalProjectionError("no-owned-pals");
  return {ledger,recordCount:envelope.records.length,speciesCount:ledger.entries.length};
}
