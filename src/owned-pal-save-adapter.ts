import {ownedPalProjectionKind,ownedPalProjectionSchema,type OwnedPalProjection,type OwnedPalProjectionRecord} from "./owned-pal-save-import.ts";

export type OwnedPalSaveAdapterErrorCode="invalid-decoded-save"|"missing-player-containers"|"missing-character-container"|"too-many-characters"|"too-many-slots"|"missing-character"|"invalid-character";

export class OwnedPalSaveAdapterError extends Error{
  readonly code:OwnedPalSaveAdapterErrorCode;
  constructor(code:OwnedPalSaveAdapterErrorCode){super(code);this.name="OwnedPalSaveAdapterError";this.code=code}
}

const limits={maximumCharacters:20_000,maximumSlots:10_000} as const;
const object=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
const child=(value:unknown,key:string)=>object(value)?.[key];
const propertyValue=(value:unknown):unknown=>{let current=value;for(let depth=0;depth<6;depth++){const next=child(current,"value");if(next===undefined)return current;current=next}return current};
const stringValue=(value:unknown)=>{const resolved=propertyValue(value);return typeof resolved==="string"&&resolved.length>0?resolved:null};
const numberValue=(value:unknown)=>{const resolved=propertyValue(value);return typeof resolved==="number"&&Number.isFinite(resolved)?resolved:null};
const nested=(value:unknown,keys:readonly string[])=>keys.reduce<unknown>((current,key)=>child(current,key),value);
const containerId=(value:unknown)=>stringValue(nested(value,["value","ID"]));
const entryId=(entry:unknown,key:string)=>stringValue(nested(entry,["key",key]));
const saveParameter=(entry:unknown)=>object(nested(entry,["value","RawData","value","object","SaveParameter","value"]));

function gender(value:unknown):OwnedPalProjectionRecord["gender"]{
  const resolved=stringValue(value)?.split("::").at(-1)?.toLowerCase();
  return resolved==="male"?"male":resolved==="female"?"female":"unknown";
}

export function projectDecodedOwnedPals(decoded:unknown):OwnedPalProjection{
  const source=object(decoded),gameBuild=source&&typeof source.gameBuild==="string"?source.gameBuild:null,playerSave=object(source?.playerSave),world=object(source?.world);
  if(!source||!gameBuild||!playerSave||!world)throw new OwnedPalSaveAdapterError("invalid-decoded-save");
  const saveData=object(nested(playerSave,["SaveData","value"])),partyId=containerId(saveData?.OtomoCharacterContainerId),storageId=containerId(saveData?.PalStorageContainerId);
  if(!partyId||!storageId||partyId===storageId)throw new OwnedPalSaveAdapterError("missing-player-containers");
  const characters=nested(world,["CharacterSaveParameterMap","value"]),containers=nested(world,["CharacterContainerSaveData","value"]);
  if(!Array.isArray(characters)||!Array.isArray(containers))throw new OwnedPalSaveAdapterError("invalid-decoded-save");
  if(characters.length>limits.maximumCharacters)throw new OwnedPalSaveAdapterError("too-many-characters");
  const instances:string[]=[];
  for(const id of [partyId,storageId]){
    const container=containers.find(entry=>entryId(entry,"ID")===id);
    if(!container)throw new OwnedPalSaveAdapterError("missing-character-container");
    const slots=nested(container,["value","Slots","value","values"]);
    if(!Array.isArray(slots))throw new OwnedPalSaveAdapterError("missing-character-container");
    for(const slot of slots){
      const instanceId=stringValue(nested(slot,["RawData","value","instance_id"]));
      if(instanceId)instances.push(instanceId);
      if(instances.length>limits.maximumSlots)throw new OwnedPalSaveAdapterError("too-many-slots");
    }
  }
  const byInstance=new Map<string,unknown>();
  for(const character of characters){const id=entryId(character,"InstanceId");if(id){if(byInstance.has(id))throw new OwnedPalSaveAdapterError("invalid-character");byInstance.set(id,character)}}
  const records:OwnedPalProjectionRecord[]=[];
  for(const instanceId of new Set(instances)){
    const character=byInstance.get(instanceId);if(!character)throw new OwnedPalSaveAdapterError("missing-character");
    const parameter=saveParameter(character),palId=stringValue(parameter?.CharacterID),rank=numberValue(parameter?.Rank),favoriteIndex=numberValue(parameter?.FavoriteIndex)??0,isPlayer=propertyValue(parameter?.IsPlayer);
    if(!parameter||!palId||isPlayer===true||rank===null||!Number.isInteger(rank)||rank<1||rank>5||!Number.isInteger(favoriteIndex)||favoriteIndex<0)throw new OwnedPalSaveAdapterError("invalid-character");
    records.push({palId,gender:gender(parameter.Gender),stars:(rank-1) as 0|1|2|3|4,favorite:favoriteIndex>0});
  }
  return {schema:ownedPalProjectionSchema,kind:ownedPalProjectionKind,gameBuild,records};
}
