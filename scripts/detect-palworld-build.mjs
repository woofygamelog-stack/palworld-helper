import {createHash} from "node:crypto";
import {open,readFile,stat,writeFile,mkdir,readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const invariant=(condition,message)=>{if(!condition)throw new Error(message)};

export function parseSteamAppManifest(text){
  const get=name=>text.match(new RegExp(`"${name}"\\s+"([^"]*)"`,"i"))?.[1]??null;
  const appId=get("appid"),buildId=get("buildid"),targetBuildId=get("TargetBuildID"),stateFlags=Number(get("StateFlags"));
  const bytesToDownload=Number(get("BytesToDownload")),bytesDownloaded=Number(get("BytesDownloaded"));
  invariant(appId==="1623730",`Unexpected Steam app ID: ${appId??"missing"}`);
  invariant(/^\d+$/.test(buildId??""),"Steam build ID is missing");
  invariant(!targetBuildId||targetBuildId===buildId,`Steam target build ${targetBuildId} does not match installed build ${buildId}`);
  invariant(Number.isInteger(stateFlags)&&(stateFlags&4)===4,`Steam app is not in the fully installed state (StateFlags ${stateFlags})`);
  invariant(!Number.isFinite(bytesToDownload)||!Number.isFinite(bytesDownloaded)||bytesToDownload===bytesDownloaded,"Steam download is incomplete");
  return {appId,buildId,targetBuildId:targetBuildId??buildId,stateFlags,bytesToDownload:Number.isFinite(bytesToDownload)?bytesToDownload:null,bytesDownloaded:Number.isFinite(bytesDownloaded)?bytesDownloaded:null,lastUpdated:get("LastUpdated"),installDir:get("installdir")};
}

function assertPrivateOutput(outputPath){
  const normalized=path.resolve(outputPath).toLowerCase();
  invariant(!normalized.includes(`${path.sep}public${path.sep}`)&&!normalized.includes(`${path.sep}dist${path.sep}`),"Installation evidence must stay outside public and dist directories");
}

async function sha256File(filePath){
  const hash=createHash("sha256"),handle=await open(filePath,"r");
  try{
    const info=await handle.stat(),chunkSize=Math.min(1024*1024,info.size),first=Buffer.alloc(chunkSize),last=Buffer.alloc(chunkSize);
    await handle.read(first,0,chunkSize,0);
    if(info.size>chunkSize)await handle.read(last,0,chunkSize,Math.max(0,info.size-chunkSize));
    hash.update(first);
    if(info.size>chunkSize)hash.update(last);
    const length=Buffer.alloc(8);length.writeBigUInt64LE(BigInt(info.size));hash.update(length);
    return hash.digest("hex");
  }finally{await handle.close()}
}

async function fileFingerprint(filePath,root){
  const info=await stat(filePath);
  return {relativePath:path.relative(root,filePath).replaceAll("\\","/"),length:info.size,lastWriteTimeUtc:info.mtime.toISOString(),sampledSha256:await sha256File(filePath)};
}

async function shallowFileCount(directory){
  try{return (await readdir(directory,{withFileTypes:true})).filter(value=>value.isFile()).length}catch(error){if(error.code==="ENOENT")return 0;throw error}
}

export async function inspectPalworldInstallation({appManifestPath,gameRoot,mappingPath}){
  const resolvedRoot=path.resolve(gameRoot),manifestPath=path.resolve(appManifestPath),mapping=path.resolve(mappingPath);
  const app=parseSteamAppManifest(await readFile(manifestPath,"utf8"));
  invariant(!app.installDir||path.basename(resolvedRoot).toLowerCase()===app.installDir.toLowerCase(),`Game root does not match Steam installdir ${app.installDir}`);
  const pakPath=path.join(resolvedRoot,"Pal","Content","Paks","Pal-Windows.pak");
  const executablePath=path.join(resolvedRoot,"Palworld.exe");
  const [pak,executable,mappingInfo]=await Promise.all([fileFingerprint(pakPath,resolvedRoot),fileFingerprint(executablePath,resolvedRoot),stat(mapping)]);
  const mappingBytes=await readFile(mapping);
  const modBoundary={
    managedModFileCount:await shallowFileCount(path.join(resolvedRoot,"Mods","ManagedMods")),
    nativeModFileCount:await shallowFileCount(path.join(resolvedRoot,"Mods","NativeMods")),
    pakModFileCount:await shallowFileCount(path.join(resolvedRoot,"Pal","Content","Paks","~mods")),
  };
  return {
    meta:{schema:1,game:"Palworld",platform:"Steam",gameBuild:app.buildId,detectedAt:new Date().toISOString(),status:"installed-build-complete"},
    steam:app,
    localInputs:{gameRoot:resolvedRoot,appManifestPath:manifestPath,mappingPath:mapping},
    fingerprints:{
      pak,
      executable,
      mapping:{length:mappingInfo.size,lastWriteTimeUtc:mappingInfo.mtime.toISOString(),sha256:createHash("sha256").update(mappingBytes).digest("hex")},
      sampledHashDefinition:"sha256(first 1 MiB + last 1 MiB when distinct + uint64 little-endian file length)",
    },
    modBoundary,
  };
}

function argsFrom(argv){
  const result={};
  for(let index=0;index<argv.length;index+=2){
    const key=argv[index];
    invariant(key?.startsWith("--")&&argv[index+1],`Invalid argument near ${key??"end of command"}`);
    result[key.slice(2)]=argv[index+1];
  }
  return result;
}

async function main(){
  const args=argsFrom(process.argv.slice(2));
  for(const name of ["app-manifest","game-root","mapping","output"])invariant(args[name],`--${name} is required`);
  assertPrivateOutput(args.output);
  const report=await inspectPalworldInstallation({appManifestPath:args["app-manifest"],gameRoot:args["game-root"],mappingPath:args.mapping});
  await mkdir(path.dirname(path.resolve(args.output)),{recursive:true});
  await writeFile(path.resolve(args.output),JSON.stringify(report,null,2));
  console.log(`Detected complete Palworld Steam build ${report.meta.gameBuild}.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
