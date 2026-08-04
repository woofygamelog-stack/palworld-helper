import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { preview } from "vite";

const browserCandidates = [
  process.env.PLAYWRIGHT_BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/microsoft-edge",
  "/usr/bin/chromium",
].filter(Boolean);

export async function findChromiumExecutable() {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No supported local Chromium browser was found. Set PLAYWRIGHT_BROWSER_PATH.");
}

async function availablePort(){
  for(let port=4173;port<=4210;port++){
    const probe=createServer();
    const available=await new Promise(resolve=>{probe.once("error",()=>resolve(false));probe.listen(port,"127.0.0.1",()=>resolve(true))});
    if(!available)continue;
    await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
    return port;
  }
  throw new Error("Unable to reserve a safe local preview port.");
}

export async function startPreviewServer(){
  const port=await availablePort();
  const server=await preview({configFile:false,preview:{host:"127.0.0.1",port,strictPort:true}});
  return {server,origin:`http://127.0.0.1:${port}`};
}
