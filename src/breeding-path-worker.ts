import {findBreedingPaths,type BreedingPathOptions} from "./breeding-path.ts";
import type {BreedingRow} from "./breeding.ts";

type Request={rows:BreedingRow[];owned:number[];target:number;options:BreedingPathOptions};

self.onmessage=(event:MessageEvent<Request>)=>{
  const {rows,owned,target,options}=event.data;
  self.postMessage(findBreedingPaths(rows,owned,target,options));
};
