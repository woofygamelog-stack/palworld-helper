import {OwnedPalProjectionError,parseOwnedPalProjection,type OwnedPalProjection} from "./owned-pal-save-import.ts";
import {OwnedPalSaveAdapterError,projectDecodedOwnedPals} from "./owned-pal-save-adapter.ts";

export type OwnedPalImportWorkerRequest={type:"project-owned-pals";decoded:unknown;expectedGameBuild:string;knownPalIds:string[]};
export type OwnedPalImportWorkerResponse={ok:true;projection:OwnedPalProjection;recordCount:number;speciesCount:number}|{ok:false;code:"invalid-request"|OwnedPalProjectionError["code"]|OwnedPalSaveAdapterError["code"]};

export function handleOwnedPalImportWorkerMessage(value:unknown):OwnedPalImportWorkerResponse{
  if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,code:"invalid-request"};
  const request=value as Partial<OwnedPalImportWorkerRequest>;
  if(request.type!=="project-owned-pals"||typeof request.expectedGameBuild!=="string"||!Array.isArray(request.knownPalIds)||request.knownPalIds.length===0||request.knownPalIds.length>500||request.knownPalIds.some(id=>typeof id!=="string"||id.length===0||id.length>100))return {ok:false,code:"invalid-request"};
  try{
    const projection=projectDecodedOwnedPals(request.decoded),bytes=new TextEncoder().encode(JSON.stringify(projection)),preview=parseOwnedPalProjection(bytes,request.expectedGameBuild,new Set(request.knownPalIds));
    return {ok:true,projection,recordCount:preview.recordCount,speciesCount:preview.speciesCount};
  }catch(error){
    if(error instanceof OwnedPalProjectionError||error instanceof OwnedPalSaveAdapterError)return {ok:false,code:error.code};
    return {ok:false,code:"invalid-request"};
  }
}
