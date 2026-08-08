import {handleOwnedPalImportWorkerMessage,type OwnedPalImportWorkerRequest} from "./owned-pal-import-worker-protocol.ts";

const workerScope=globalThis as unknown as {onmessage:((event:MessageEvent<OwnedPalImportWorkerRequest>)=>void)|null;postMessage:(message:unknown)=>void};
workerScope.onmessage=(event:MessageEvent<OwnedPalImportWorkerRequest>)=>{
  workerScope.postMessage(handleOwnedPalImportWorkerMessage(event.data));
};
