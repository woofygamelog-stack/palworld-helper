import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import {findChromiumExecutable,startPreviewServer} from "./browser-runtime.mjs";

const executablePath=await findChromiumExecutable(),{origin,server}=await startPreviewServer(),browser=await chromium.launch({executablePath,headless:true});

try{
  const context=await browser.newContext({viewport:{width:1365,height:900},locale:"en-US",reducedMotion:"reduce"}),page=await context.newPage(),routeRequests=[];
  page.on("request",request=>routeRequests.push(new URL(request.url()).pathname));
  await page.goto(`${origin}/en-US/guides/getting-started`,{waitUntil:"networkidle"});
  assert.equal(routeRequests.some(path=>/\/assets\/(?:map|breeding-path-worker)-/i.test(path)),false,"guide routes must not load map or breeding-path Worker chunks");
  await page.locator("header [data-open-search]").click();
  await page.locator("#global-search-input").fill("Lamball");
  await page.locator('#global-search-results a[href*="/en-US/pals/"]').first().waitFor({state:"visible"});
  const searchMilliseconds=await page.evaluate(()=>{
    const input=document.querySelector("#global-search-input"),started=performance.now();
    input.value="Cake";
    input.dispatchEvent(new Event("input",{bubbles:true}));
    const elapsed=performance.now()-started;
    if(!document.querySelector('#global-search-results a[href*="/en-US/items/"]'))throw new Error("the measured search did not render an item result");
    return elapsed;
  });
  assert.ok(searchMilliseconds<=100,`warm global search response ${searchMilliseconds.toFixed(1)}ms exceeds the 100ms target`);
  assert.equal(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches),true,"the reduced-motion browser preference must reach the application");
  const transitionMilliseconds=await page.evaluate(()=>{const button=document.createElement("button");button.className="button";document.body.append(button);const duration=parseFloat(getComputedStyle(button).transitionDuration)*1000;button.remove();return duration});
  assert.ok(transitionMilliseconds<=.01,`reduced-motion transitions must be effectively disabled, received ${transitionMilliseconds}ms`);

  await page.goto(`${origin}/en-US/map`,{waitUntil:"networkidle"});
  await page.locator(".map-viewport").waitFor({state:"visible"});
  await page.evaluate(()=>{window.phaseSixLongTasks=[];window.phaseSixObserver=new PerformanceObserver(list=>window.phaseSixLongTasks.push(...list.getEntries().map(entry=>entry.duration)));window.phaseSixObserver.observe({type:"longtask",buffered:false})});
  const mapMilliseconds=await page.evaluate(()=>new Promise(resolve=>{
    const button=document.querySelector('[data-map-panel="results"]'),started=performance.now();
    button.click();
    requestAnimationFrame(()=>resolve(performance.now()-started));
  }));
  assert.ok(mapMilliseconds<=100,`map result-sheet response ${mapMilliseconds.toFixed(1)}ms exceeds the 100ms interaction target`);
  await page.waitForTimeout(250);
  const longTasks=await page.evaluate(()=>{window.phaseSixObserver.disconnect();return window.phaseSixLongTasks});
  assert.equal(longTasks.filter(duration=>duration>200).length,0,`map interaction produced long tasks over 200ms: ${longTasks.join(", ")}`);
  await context.close();

  const zoomContext=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:2,locale:"ko-KR",colorScheme:"dark",reducedMotion:"reduce"}),zoomPage=await zoomContext.newPage();
  for(const route of ["/ko-KR","/ko-KR/map","/ko-KR/guides/getting-started"]){
    await zoomPage.goto(`${origin}${route}`,{waitUntil:"networkidle"});
    assert.equal(await zoomPage.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`${route} must not overflow at a 360 CSS-pixel viewport backed by 720 device pixels`);
  }
  await zoomContext.close();
  console.log(`Passed Phase 6 performance/accessibility gates: search ${searchMilliseconds.toFixed(1)}ms, map ${mapMilliseconds.toFixed(1)}ms, no >200ms interaction long tasks, reduced motion, and effective 200% mobile zoom coverage.`);
}finally{
  await browser.close();
  await server.close();
}
