import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium} from "playwright-core";
import {findChromiumExecutable} from "./browser-runtime.mjs";

const bundle=await build({entryPoints:["src/owned-pal-import-worker.ts"],bundle:true,format:"iife",platform:"browser",write:false,logLevel:"silent"});
const workerSource=bundle.outputFiles[0].text;
const browser=await chromium.launch({executablePath:await findChromiumExecutable(),headless:true});

try{
  const context=await browser.newContext(),page=await context.newPage(),consoleMessages=[],requests=[];
  page.on("console",message=>consoleMessages.push(`${message.type()}:${message.text()}`));
  page.on("pageerror",error=>consoleMessages.push(`pageerror:${error.message}`));
  context.on("request",request=>requests.push(request.url()));
  await page.setContent("<!doctype html><title>Owned Pal worker harness</title>");
  await page.evaluate(source=>{
    const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"})),worker=new Worker(url),pending=[];
    worker.onmessage=event=>pending.shift()?.(event.data);
    window.runOwnedPalWorker=request=>new Promise(resolve=>{pending.push(resolve);worker.postMessage(request)});
    window.ownedPalWorkerUrl=url;
  },workerSource);
  const result=await page.evaluate(async()=>{
    const property=value=>({value}),guid=value=>property({ID:property(value)}),slot=instanceId=>({RawData:property({instance_id:instanceId})});
    const container=(id,instances)=>({key:{ID:property(id)},value:{Slots:property({values:instances.map(slot)})}});
    const character=(instanceId,palId)=>({key:{InstanceId:property(instanceId)},value:{RawData:property({object:{SaveParameter:property({CharacterID:property(palId),Gender:property({value:"EPalGenderType::Male"}),Rank:property({value:1}),FavoriteIndex:property(0),IsPlayer:property(false)})}})}});
    const decoded={gameBuild:"current-build",playerSave:{SaveData:property({OtomoCharacterContainerId:guid("party"),PalStorageContainerId:guid("box")})},world:{CharacterContainerSaveData:property([container("party",["one"]),container("box",["two"]),container("base",["base"])]),CharacterSaveParameterMap:property([character("one","Anubis"),character("two","Alpaca"),character("base","BasePal")])}};
    const bytes=new TextEncoder().encode(JSON.stringify(decoded));
    return window.runOwnedPalWorker({type:"decode-owned-pals",bytes,decoder:"synthetic-decoded-save-json-v1",expectedGameBuild:"current-build",knownPalIds:["Anubis","Alpaca","BasePal"]});
  });
  await page.waitForTimeout(100);
  assert.deepEqual(result.ok&&{records:result.recordCount,species:result.speciesCount,pals:result.projection.records.map(record=>record.palId).toSorted()},{records:2,species:2,pals:["Alpaca","Anubis"]},"the browser Worker must decode bytes, keep personal containers, and exclude the base container");
  const externalRequests=requests.filter(url=>!url.startsWith("blob:"));
  assert.deepEqual(externalRequests,[],`the Worker decode must not issue external network requests: ${externalRequests.join(", ")}`);
  assert.equal(page.url(),"about:blank","the Worker decode must not change the harness URL");
  assert.deepEqual(consoleMessages,[],`the Worker harness must remain silent: ${consoleMessages.join(" | ")}`);
  await page.evaluate(()=>{URL.revokeObjectURL(window.ownedPalWorkerUrl)});
  console.log("Passed the isolated Owned Pal byte-decoder Worker browser harness with zero decode-time network, URL, or console activity.");
}finally{
  await browser.close();
}
