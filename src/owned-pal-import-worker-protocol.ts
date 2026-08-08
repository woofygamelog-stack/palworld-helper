import {OwnedPalProjectionError,parseOwnedPalProjection,type OwnedPalProjection} from "./owned-pal-save-import.ts";
import {OwnedPalSaveAdapterError,projectDecodedOwnedPals} from "./owned-pal-save-adapter.ts";
import {decodeOwnedPalSourceBytes,OwnedPalByteDecoderError,type OwnedPalByteDecoderId} from "./owned-pal-byte-decoder.ts";

export type OwnedPalImportWorkerRequest={type:"project-owned-pals";decoded:unknown;expectedGameBuild:string;knownPalIds:string[]}|{type:"decode-owned-pals";bytes:Uint8Array;decoder:OwnedPalByteDecoderId;expectedGameBuild:string;knownPalIds:string[]};
export type OwnedPalImportWorkerResponse={ok:true;projection:OwnedPalProjection;recordCount:number;speciesCount:number}|{ok:false;code:"invalid-request"|OwnedPalProjectionError["code"]|OwnedPalSaveAdapterError["code"]|OwnedPalByteDecoderError["code"]};

const validKnownPalIds=(value:unknown):value is string[]=>Array.isArray(value)&&value.length>0&&value.length<=500&&value.every(id=>typeof id==="string"&&id.length>0&&id.length<=100);

export function handleOwnedPalImportWorkerMessage(value:unknown):OwnedPalImportWorkerResponse{
  if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,code:"invalid-request"};
  const request=value as Partial<OwnedPalImportWorkerRequest>;
  if((request.type!=="project-owned-pals"&&request.type!=="decode-owned-pals")||typeof request.expectedGameBuild!=="string"||!validKnownPalIds(request.knownPalIds))return {ok:false,code:"invalid-request"};
  try{
    let decoded:unknown;
    if(request.type==="decode-owned-pals"){
      const decodeRequest=request as Partial<Extract<OwnedPalImportWorkerRequest,{type:"decode-owned-pals"}>>;
      decoded=decodeRequest.bytes instanceof Uint8Array&&typeof decodeRequest.decoder==="string"?decodeOwnedPalSourceBytes(decodeRequest.bytes,decodeRequest.decoder as OwnedPalByteDecoderId):null;
    }else decoded=(request as Partial<Extract<OwnedPalImportWorkerRequest,{type:"project-owned-pals"}>>).decoded;
    if(decoded===null)throw new OwnedPalByteDecoderError("decoder-failed");
    const projection=projectDecodedOwnedPals(decoded),bytes=new TextEncoder().encode(JSON.stringify(projection)),preview=parseOwnedPalProjection(bytes,request.expectedGameBuild,new Set(request.knownPalIds));
    return {ok:true,projection,recordCount:preview.recordCount,speciesCount:preview.speciesCount};
  }catch(error){
    if(error instanceof OwnedPalProjectionError||error instanceof OwnedPalSaveAdapterError||error instanceof OwnedPalByteDecoderError)return {ok:false,code:error.code};
    return {ok:false,code:"invalid-request"};
  }
}
