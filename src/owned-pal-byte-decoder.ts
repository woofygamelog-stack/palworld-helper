export const ownedPalSourceByteLimits={maximumBytes:128*1024*1024} as const;
export const ownedPalSyntheticDecoder="synthetic-decoded-save-json-v1" as const;

export type OwnedPalByteDecoderId=typeof ownedPalSyntheticDecoder;
export type OwnedPalByteDecoderErrorCode="empty-source"|"source-too-large"|"unsupported-decoder"|"decoder-failed";

export class OwnedPalByteDecoderError extends Error{
  readonly code:OwnedPalByteDecoderErrorCode;
  constructor(code:OwnedPalByteDecoderErrorCode){super(code);this.name="OwnedPalByteDecoderError";this.code=code}
}

export function validateOwnedPalSourceByteLength(byteLength:number){
  if(byteLength===0)throw new OwnedPalByteDecoderError("empty-source");
  if(!Number.isSafeInteger(byteLength)||byteLength<0||byteLength>ownedPalSourceByteLimits.maximumBytes)throw new OwnedPalByteDecoderError("source-too-large");
}

function decodeSyntheticJson(bytes:Uint8Array):unknown{
  let text:string;
  try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes)}catch{throw new OwnedPalByteDecoderError("decoder-failed")}
  try{return JSON.parse(text)}catch{throw new OwnedPalByteDecoderError("decoder-failed")}
}

export function decodeOwnedPalSourceBytes(bytes:Uint8Array,decoder:OwnedPalByteDecoderId):unknown{
  validateOwnedPalSourceByteLength(bytes.byteLength);
  if(decoder!==ownedPalSyntheticDecoder)throw new OwnedPalByteDecoderError("unsupported-decoder");
  return decodeSyntheticJson(bytes);
}
