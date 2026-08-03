import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium} from "playwright-core";
import {findChromiumExecutable,startPreviewServer} from "./browser-runtime.mjs";

const executablePath=await findChromiumExecutable();
const {origin,server}=await startPreviewServer(),browser=await chromium.launch({executablePath,headless:true}),failures=path.resolve("private","e2e-failures"),passed=[];

try{
  const context=await browser.newContext({viewport:{width:1365,height:900},locale:"ko-KR"}),page=await context.newPage(),consoleErrors=[];
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text())});
  page.on("pageerror",error=>consoleErrors.push(error.message));
  const visit=route=>page.goto(`${origin}${route}`,{waitUntil:"networkidle"});
  const run=async(name,check)=>{
    const errorStart=consoleErrors.length;
    try{
      await check();
      assert.deepEqual(consoleErrors.slice(errorStart),[],`${name} browser console errors: ${consoleErrors.slice(errorStart).join(" | ")}`);
      passed.push(name);
    }catch(error){
      await mkdir(failures,{recursive:true});
      await page.screenshot({path:path.join(failures,`${name}.png`),fullPage:true}).catch(()=>{});
      throw error;
    }
  };

  await run("home-search",async()=>{
    const searchChunkRequests=[];
    const recordSearchChunk=request=>{if(/\/global-search-[^/]+\.js$/.test(new URL(request.url()).pathname))searchChunkRequests.push(request.url())};
    page.on("request",recordSearchChunk);
    await visit("/ko-KR");
    assert.equal(searchChunkRequests.length,0,"global search code must stay out of the initial Home request graph");
    const calculatorMenu=page.locator(".nav-group-calculators"),calculatorTrigger=calculatorMenu.locator("summary");
    await calculatorTrigger.click();
    assert.equal(await calculatorMenu.getAttribute("open"),"","desktop disclosure menu must open");
    await page.keyboard.press("Escape");
    assert.equal(await calculatorMenu.getAttribute("open"),null,"Escape must close the desktop disclosure menu");
    assert.equal(await calculatorTrigger.evaluate(node=>node===document.activeElement),true,"closing a disclosure menu with Escape must return focus");
    await page.locator("header [data-open-search]").click();
    await page.locator("#global-search-dialog").waitFor({state:"visible"});
    assert.equal(await page.locator("#global-search-input").evaluate(node=>node===document.activeElement),true,"global search must receive focus");
    await page.keyboard.press("Escape");
    await page.locator("#global-search-dialog").waitFor({state:"hidden"});
    await page.keyboard.press("/");
    await page.locator("#global-search-dialog").waitFor({state:"visible"});
    assert.equal(await page.locator("#global-search-input").evaluate(node=>node===document.activeElement),true,"the slash shortcut must reopen and focus global search");
    await page.locator("#global-search-input").fill("Lamball");
    const englishNameMatch=page.locator('#global-search-results a[href*="/ko-KR/pals/"]').first();
    await englishNameMatch.waitFor({state:"visible"});
    assert.ok((await englishNameMatch.textContent())?.trim(),"an official English Pal name must find a localized Pal result");
    assert.equal(searchChunkRequests.length,1,"global search code must load exactly once when search is first opened");
    page.off("request",recordSearchChunk);
  });

  await run("pal-collection",async()=>{
    await visit("/en-US/pals");
    await page.locator("#pal-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".pal-grid .pal-card").count()>0,"Pal collection must render cards");
  });

  await run("home-breeding-back",async()=>{
    const calculatorChunkRequests=[];
    const recordCalculatorChunk=request=>{if(/\/calculators-[^/]+\.js$/.test(new URL(request.url()).pathname))calculatorChunkRequests.push(request.url())};
    page.on("request",recordCalculatorChunk);
    await visit("/ko-KR");
    assert.equal(calculatorChunkRequests.length,0,"calculator code must stay out of the initial Home request graph");
    await page.locator('[data-home-action="breeding"]').click();
    await page.waitForURL(url=>url.pathname==="/ko-KR/calculators/breeding");
    await page.locator("#parent-a").waitFor({state:"attached"});
    assert.equal(await page.locator("main h1").count(),1,"the breeding route must retain one main heading");
    const firstPalValue=await page.locator('#parent-a option:not([value=""])').first().getAttribute("value");
    assert.ok(firstPalValue,"the breeding route must expose Pal choices");
    await page.locator("#parent-a").selectOption(firstPalValue,{force:true});
    assert.ok((await page.locator('#parent-a + .pal-combobox .pal-combobox-button').textContent())?.trim(),"the lazy calculator module must bind the visible Pal selector");
    assert.equal(calculatorChunkRequests.length,1,"calculator code must load exactly once on first calculator navigation");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/ko-KR");
    await page.locator('[data-home-action="breeding"]').waitFor({state:"visible"});
    await page.locator('[data-home-action="breeding"]').click();
    await page.waitForURL(url=>url.pathname==="/ko-KR/calculators/breeding");
    await page.locator('#parent-a + .pal-combobox .pal-combobox-button').waitFor({state:"visible"});
    assert.equal(calculatorChunkRequests.length,1,"repeat calculator navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordCalculatorChunk);
  });

  await run("crafting",async()=>{
    await visit("/en-US/calculators/crafting");
    await page.locator("[data-craft-recipe]").waitFor({state:"attached"});
    assert.equal(await page.locator("#craft-output").count(),1,"crafting output must render once");
  });

  await run("base-planner",async()=>{
    await visit("/en-US/calculators/base");
    await page.locator("#base-planner-form").waitFor({state:"visible"});
    assert.equal(await page.locator("#base-plan-output").count(),1,"base planner output must render once");
  });

  await run("home-map-back",async()=>{
    const mapChunkRequests=[];
    const recordMapChunk=request=>{if(/\/map-[^/]+\.js$/.test(new URL(request.url()).pathname))mapChunkRequests.push(request.url())};
    page.on("request",recordMapChunk);
    await visit("/en-US");
    assert.equal(mapChunkRequests.length,0,"map code must stay out of the initial Home request graph");
    await page.locator('[data-home-action="map"]').click();
    await page.waitForURL(url=>url.pathname==="/en-US/map");
    await page.locator(".map-viewport").waitFor({state:"visible"});
    await page.waitForFunction(()=>Number(document.querySelector("#map-result-count")?.textContent)>0);
    assert.ok(Number(await page.locator("#map-result-count").textContent())>0,"map must expose a non-empty result count");
    assert.equal(mapChunkRequests.length,1,"map code must load exactly once on first map navigation");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await page.locator('[data-home-action="map"]').waitFor({state:"visible"});
    await page.locator('[data-home-action="map"]').click();
    await page.waitForURL(url=>url.pathname==="/en-US/map");
    await page.locator(".map-viewport").waitFor({state:"visible"});
    assert.equal(mapChunkRequests.length,1,"repeat map navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordMapChunk);
  });

  await run("server-settings",async()=>{
    const serverChunkRequests=[];
    const recordServerChunk=request=>{if(/\/server-settings-[^/]+\.js$/.test(new URL(request.url()).pathname))serverChunkRequests.push(request.url())};
    page.on("request",recordServerChunk);
    await visit("/en-US");
    assert.equal(serverChunkRequests.length,0,"server settings code must stay out of the initial Home request graph");
    await page.locator('[data-home-action="server"]').click();
    await page.waitForURL(url=>url.pathname==="/en-US/server-tools/settings-generator");
    await page.locator("#server-form").waitFor({state:"visible"});
    assert.equal(await page.locator("#ini-output").count(),1,"server output must render once");
    assert.equal(serverChunkRequests.length,1,"server settings code must load exactly once on first route entry");
    await page.locator('input[name="ServerPlayerMaxNum"][type="number"]').fill("12");
    assert.equal(await page.locator("#server-form").evaluate(form=>form.querySelector('input[name="ServerPlayerMaxNum"][data-server-key]')?.value),"12","the lazy server form must retain edited values before generation");
    await page.locator("#server-form .button.primary").click();
    assert.match(await page.locator("#ini-output").inputValue(),/ServerPlayerMaxNum=12/,"the lazy server route must generate INI from the bound form");
    await page.locator("#ini-import").fill("[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(ServerPlayerMaxNum=16)");
    await page.locator("#import-ini").click();
    assert.equal(await page.locator('input[name="ServerPlayerMaxNum"][type="number"]').inputValue(),"16","the lazy server route must import official settings locally");
    page.off("request",recordServerChunk);
  });

  await run("locale-change",async()=>{
    await visit("/en-US");
    await page.locator("#locale").selectOption("ko-KR");
    await page.waitForURL(url=>url.pathname==="/ko-KR");
    assert.equal(await page.locator("#locale").inputValue(),"ko-KR","locale choice must survive navigation");
  });

  await run("theme-change",async()=>{
    await visit("/en-US");
    if(!await page.locator(".theme-menu").evaluate(menu=>(menu).open))await page.locator(".theme-menu summary").click();
    await page.locator('[data-theme-choice="dark"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"),"dark","dark theme must apply immediately");
    assert.equal(await page.evaluate(()=>localStorage.getItem("pw-theme")),"dark","explicit theme choice must persist");
    if(!await page.locator(".theme-menu").evaluate(menu=>(menu).open))await page.locator(".theme-menu summary").click();
    await page.locator('[data-theme-choice="system"]').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem("pw-theme")),null,"system theme must clear the explicit override");
    await page.emulateMedia({colorScheme:"dark"});
    await page.waitForFunction(()=>document.querySelector('meta[name="theme-color"]')?.getAttribute("content")==="#071a31");
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"),"#071a31","system theme must react to a dark OS preference");
    await page.emulateMedia({colorScheme:"light"});
    await page.waitForFunction(()=>document.querySelector('meta[name="theme-color"]')?.getAttribute("content")==="#edf7f5");
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute("content"),"#edf7f5","system theme must react to a light OS preference");
  });

  await run("not-found",async()=>{
    await visit("/en-US/definitely-missing");
    assert.equal((await page.locator("main h1").textContent())?.trim(),"404","unknown routes must render a real not-found heading");
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content")||"",/noindex/,"unknown routes must be noindex");
  });

  await context.close();
  assert.ok(passed.length>=10,"the Phase 1 browser baseline must cover at least ten workflows");
  console.log(`Passed ${passed.length} browser workflows with ${path.basename(executablePath)}: ${passed.join(", ")}.`);
}finally{
  await browser.close();
  await server.close();
}
