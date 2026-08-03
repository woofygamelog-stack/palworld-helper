import assert from "node:assert/strict";
import {access,mkdir} from "node:fs/promises";
import path from "node:path";
import {preview} from "vite";
import {chromium} from "playwright-core";

const browserCandidates=[
  process.env.PLAYWRIGHT_BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/microsoft-edge",
  "/usr/bin/chromium",
].filter(Boolean);

let executablePath="";
for(const candidate of browserCandidates){
  try{await access(candidate);executablePath=candidate;break}catch{}
}
if(!executablePath)throw new Error("No supported local Chromium browser was found. Set PLAYWRIGHT_BROWSER_PATH.");

const server=await preview({configFile:false,preview:{host:"127.0.0.1",port:4174,strictPort:true}});
const browser=await chromium.launch({executablePath,headless:true});
const failures=path.resolve("private","e2e-failures");

try{
  const context=await browser.newContext({viewport:{width:1365,height:900},locale:"ko-KR"});
  const page=await context.newPage(),consoleErrors=[];
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text())});
  page.on("pageerror",error=>consoleErrors.push(error.message));
  try{
    await page.goto("http://127.0.0.1:4174/ko-KR",{waitUntil:"networkidle"});
    await page.locator('[data-home-action="breeding"]').click();
    await page.waitForURL(url=>url.pathname==="/ko-KR/calculators/breeding");
    await page.locator("#parent-a").waitFor({state:"attached"});
    assert.equal(await page.locator("main h1").count(),1,"the breeding route must retain one main heading");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/ko-KR");
    await page.locator('[data-home-action="breeding"]').waitFor({state:"visible"});
    assert.equal(await page.locator("main h1").count(),1,"the restored home route must retain one main heading");
    assert.deepEqual(consoleErrors,[],`browser console errors: ${consoleErrors.join(" | ")}`);
  }catch(error){
    await mkdir(failures,{recursive:true});
    await page.screenshot({path:path.join(failures,"home-breeding-back.png"),fullPage:true}).catch(()=>{});
    throw error;
  }finally{
    await context.close();
  }
  console.log(`Passed browser smoke: ko-KR home → breeding → browser back (${path.basename(executablePath)}).`);
}finally{
  await browser.close();
  await server.close();
}
