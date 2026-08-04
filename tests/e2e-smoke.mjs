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

  await run("home-pals-detail-back",async()=>{
    const palChunkRequests=[];
    const recordPalChunk=request=>{if(/\/pals-[^/]+\.js$/.test(new URL(request.url()).pathname))palChunkRequests.push(request.url())};
    page.on("request",recordPalChunk);
    await visit("/en-US");
    assert.equal(palChunkRequests.length,0,"Pal page code must stay out of the initial Home request graph");
    const palLink=page.locator('[data-home-action="pals"]');
    await palLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/pals");
    await page.locator("#pal-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".pal-grid .pal-card").count()>0,"Pal collection must render cards");
    assert.equal(palChunkRequests.length,1,"Pal page code must load exactly once on first route entry");
    await page.locator(".pal-card h2 a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/pals/"));
    await page.locator(".pal-detail").waitFor({state:"visible"});
    assert.equal(await page.locator('.contextual-guide-link a[href="/en-US/guides/breeding"]').count(),1,"Pal details must expose the related breeding guide");
    assert.equal(palChunkRequests.length,1,"Pal details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/pals");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await palLink.waitFor({state:"visible"});
    await palLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/pals");
    await page.locator("#pal-search").waitFor({state:"visible"});
    assert.equal(palChunkRequests.length,1,"repeat Pal navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordPalChunk);
  });

  await run("home-skills-detail-back",async()=>{
    const skillChunkRequests=[];
    const recordSkillChunk=request=>{if(/\/skills-[^/]+\.js$/.test(new URL(request.url()).pathname))skillChunkRequests.push(request.url())};
    page.on("request",recordSkillChunk);
    await visit("/en-US");
    assert.equal(skillChunkRequests.length,0,"Skill page code must stay out of the initial Home request graph");
    const skillLink=page.locator('[data-home-group="pals-and-skills"] a[href="/en-US/skills"]');
    await skillLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/skills");
    await page.locator("#skill-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".skill-grid .skill-card").count()>0,"Skill collection must render cards");
    assert.equal(skillChunkRequests.length,1,"Skill page code must load exactly once on first route entry");
    await page.locator('.skill-card[data-kind="active"] h2 a[data-link]').first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/skills/active/"));
    await page.locator(".entity-detail").waitFor({state:"visible"});
    assert.equal(skillChunkRequests.length,1,"Skill details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/skills");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await skillLink.waitFor({state:"visible"});
    await skillLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/skills");
    await page.locator("#skill-search").waitFor({state:"visible"});
    assert.equal(skillChunkRequests.length,1,"repeat Skill navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordSkillChunk);
  });

  await run("home-items-detail-back",async()=>{
    const itemChunkRequests=[];
    const recordItemChunk=request=>{if(/\/items-[^/]+\.js$/.test(new URL(request.url()).pathname))itemChunkRequests.push(request.url())};
    page.on("request",recordItemChunk);
    await visit("/en-US");
    assert.equal(itemChunkRequests.length,0,"Item page code must stay out of the initial Home request graph");
    const itemLink=page.locator('[data-home-group="items-and-progression"] a[href="/en-US/database"]');
    await itemLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database");
    await page.locator("#item-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".item-card").count()>0,"the Item collection must render verified entries");
    assert.equal(itemChunkRequests.length,1,"Item page code must load exactly once on first route entry");
    await page.locator(".item-card h2 a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/items/"));
    await page.locator(".item-detail").waitFor({state:"visible"});
    assert.equal(itemChunkRequests.length,1,"Item details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await itemLink.waitFor({state:"visible"});
    await itemLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database");
    await page.locator("#item-search").waitFor({state:"visible"});
    assert.equal(itemChunkRequests.length,1,"repeat Item navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordItemChunk);
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

  await run("pal-compare",async()=>{
    await visit("/en-US/calculators/pal-compare");
    await page.locator("[data-pal-picker]").waitFor({state:"visible"});
    for(let count=1;count<=2;count++){
      const value=await page.locator('[data-pal-picker] option:not([value=""])').first().getAttribute("value");
      assert.ok(value,"Pal comparison must expose a public-slug option");
      await page.locator("[data-pal-picker]").selectOption(value);
      await page.locator("[data-add-pal]").click();
      await page.waitForFunction(expected=>document.querySelectorAll(".pal-selection-list article").length===expected,count);
    }
    assert.match(page.url(),/\?pals=\d{3}[a-z0-9-]+%2C\d{3}[a-z0-9-]+/,"Pal comparison URL must preserve only public slugs");
    assert.ok(await page.locator(".pal-tool-table tbody tr").count()>5,"Pal comparison must render verified comparison rows");
    await page.locator("[data-differences-only]").check();
    assert.match(page.url(),/diff=1/,"difference-only comparison state must be URL-restorable");
  });

  await run("team-builder",async()=>{
    await visit("/ko-KR/calculators/team-builder");
    for(let count=1;count<=2;count++){
      const value=await page.locator('[data-pal-picker] option:not([value=""])').first().getAttribute("value");
      await page.locator("[data-pal-picker]").selectOption(value);
      await page.locator("[data-add-pal]").click();
      await page.waitForFunction(expected=>document.querySelectorAll(".pal-selection-list article").length===expected,count);
    }
    await page.locator("[data-team-purpose]").selectOption("movement");
    assert.match(page.url(),/purpose=movement/,"team purpose must be URL-restorable");
    assert.equal(await page.locator(".team-coverage-grid article").count(),3,"team builder must show neutral element, work, and overlap coverage");
    assert.ok((await page.locator(".notice").allTextContents()).some(text=>text.trim()),"unverified role weights must have a visible boundary note");
  });

  await run("condensing",async()=>{
    await visit("/en-US/calculators/condensing");
    await page.locator("[data-condense-from]").selectOption("1");
    await page.locator("[data-condense-owned]").fill("10");
    await page.locator("[data-condense-owned]").press("Tab");
    await page.waitForFunction(()=>document.querySelector("[data-condense-remaining]")?.textContent?.trim()==="18");
    assert.equal((await page.locator("[data-condense-incremental]").textContent())?.trim(),"28","one-to-four-star condensation must require 28 matching Pals");
    assert.equal((await page.locator("[data-condense-remaining]").textContent())?.trim(),"18","owned matching Pals must be subtracted exactly once");
    assert.equal(await page.locator(".pal-tool-table tbody tr").count(),4,"condensing must expose the four verified stage rows");
    assert.match(page.url(),/from=1.*to=4.*owned=10/,"condensing inputs must be URL-restorable");
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
    await page.locator('[data-map-panel="results"]').click();
    const firstProgress=page.locator('.map-result:not([hidden]) [data-map-progress]').first();
    await firstProgress.click();
    assert.match(await page.evaluate(()=>localStorage.getItem("pw-map-progress:palpagos")||""),/boss:/,"map completion state must remain in world-specific local storage");
    await page.locator('[data-map-panel="filters"]').click();
    await page.locator("#map-unfinished-only").check();
    assert.equal(await page.locator('.map-result.is-complete:not([hidden])').count(),0,"unfinished-only mode must hide locally completed results");
    await page.locator("#map-unfinished-only").uncheck();
    await page.locator('[data-map-panel="results"]').click();
    await page.locator('.map-result.is-complete [data-map-progress]').first().click();
    await page.evaluate(()=>localStorage.removeItem("pw-map-progress:palpagos"));
    await page.locator('[data-map-panel="filters"]').click();
    await page.locator("#map-pin-name").fill("Local test pin");
    await page.locator("#map-pin-x").fill("0");
    await page.locator("#map-pin-y").fill("0");
    await page.locator("#map-pin-form button[type=submit]").click();
    assert.match(await page.evaluate(()=>localStorage.getItem("pw-map-pins:palpagos")||""),/Local test pin/,"personal pins must remain in world-specific local storage");
    await page.locator("#local-pin-layer").uncheck();
    assert.equal(new URL(page.url()).searchParams.get("pins"),"0","local-pin visibility must restore from URL state");
    await page.locator("#local-pin-layer").check();
    await page.locator('[data-map-panel="results"]').click();
    await page.locator('[data-map-result="localPin"] [data-remove-pin]').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("pw-map-pins:palpagos")||"[]").length),0,"personal pins must be removable without a network service");
    await page.locator('[data-map-panel="filters"]').click();
    const denseLayer=await page.locator("[data-point-layer]").evaluateAll(inputs=>{const input=inputs.find(node=>Number(node.closest("label")?.querySelector("b")?.textContent)>120);return input?.getAttribute("data-point-layer")||""});
    assert.ok(denseLayer,"the verified map dataset must retain at least one dense layer for aggregation coverage");
    await page.locator(`[data-point-layer="${denseLayer}"]`).evaluate(input=>{const group=input.closest("details");if(group)group.open=true});
    await page.locator(`[data-point-layer="${denseLayer}"]`).check();
    await page.waitForFunction(category=>document.querySelectorAll(`.map-marker-cluster[data-map-category="${category}"]`).length>0,denseLayer);
    const aggregateParity=await page.evaluate(category=>({visual:[...document.querySelectorAll(`.map-marker-cluster[data-map-category="${category}"]`)].reduce((sum,node)=>sum+Number((node).dataset.clusterCount||0),0),results:document.querySelectorAll(`.map-result[data-map-result="${category}"]`).length}),denseLayer);
    assert.equal(aggregateParity.visual,aggregateParity.results,"cluster member counts must equal the accessible result-list count");
    assert.match(new URL(page.url()).search,/layers=/,"enabled dense layers must restore from URL state");
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

  await run("home-elements-back",async()=>{
    const elementChunkRequests=[];
    const recordElementChunk=request=>{if(/\/elements-[^/]+\.js$/.test(new URL(request.url()).pathname))elementChunkRequests.push(request.url())};
    page.on("request",recordElementChunk);
    await visit("/en-US");
    assert.equal(elementChunkRequests.length,0,"element comparison code must stay out of the initial Home request graph");
    const elementLink=page.locator('[data-home-group="combat-and-management"] a[href="/en-US/database/elements"]');
    await elementLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/elements");
    await page.locator("#element-attacker").waitFor({state:"visible"});
    assert.equal(await page.locator(".element-matchup-graph").count(),1,"the element route must retain its verified matchup graph");
    assert.equal(elementChunkRequests.length,1,"element comparison code must load exactly once on first route entry");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await elementLink.waitFor({state:"visible"});
    await elementLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/elements");
    await page.locator("#element-attacker").waitFor({state:"visible"});
    assert.equal(elementChunkRequests.length,1,"repeat element navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordElementChunk);
  });

  await run("home-technology-detail-back",async()=>{
    const technologyChunkRequests=[];
    const recordTechnologyChunk=request=>{if(/\/technology-(?!i18n-)[^/]+\.js$/.test(new URL(request.url()).pathname))technologyChunkRequests.push(request.url())};
    page.on("request",recordTechnologyChunk);
    await visit("/en-US");
    assert.equal(technologyChunkRequests.length,0,"technology page code must stay out of the initial Home request graph");
    const technologyLink=page.locator('[data-home-group="items-and-progression"] a[href="/en-US/database/technology"]');
    await technologyLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/technology");
    await page.locator("#technology-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".technology-card").count()>0,"the technology collection must render verified entries");
    assert.equal(technologyChunkRequests.length,1,"technology page code must load exactly once on first route entry");
    await page.locator(".technology-card-link").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/technology/"));
    await page.locator(".technology-detail").waitFor({state:"visible"});
    assert.equal(technologyChunkRequests.length,1,"technology details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/technology");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await technologyLink.waitFor({state:"visible"});
    await technologyLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/technology");
    await page.locator("#technology-search").waitFor({state:"visible"});
    assert.equal(technologyChunkRequests.length,1,"repeat technology navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordTechnologyChunk);
  });

  await run("home-structures-detail-back",async()=>{
    const structureChunkRequests=[];
    const recordStructureChunk=request=>{if(/\/structures-[^/]+\.js$/.test(new URL(request.url()).pathname))structureChunkRequests.push(request.url())};
    page.on("request",recordStructureChunk);
    await visit("/en-US");
    assert.equal(structureChunkRequests.length,0,"structure page code must stay out of the initial Home request graph");
    const structureLink=page.locator('[data-home-group="items-and-progression"] a[href="/en-US/database/structures"]');
    await structureLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/structures");
    await page.locator("#structure-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".structure-card").count()>0,"the structure collection must render verified entries");
    assert.equal(structureChunkRequests.length,1,"structure page code must load exactly once on first route entry");
    await page.locator(".structure-card a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/structures/"));
    await page.locator(".structure-detail").waitFor({state:"visible"});
    assert.equal(structureChunkRequests.length,1,"structure details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/structures");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await structureLink.waitFor({state:"visible"});
    await structureLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/structures");
    await page.locator("#structure-search").waitFor({state:"visible"});
    assert.equal(structureChunkRequests.length,1,"repeat structure navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordStructureChunk);
  });

  await run("home-npcs-detail-back",async()=>{
    const npcChunkRequests=[];
    const recordNpcChunk=request=>{if(/\/npc-[^/]+\.js$/.test(new URL(request.url()).pathname))npcChunkRequests.push(request.url())};
    page.on("request",recordNpcChunk);
    await visit("/en-US");
    assert.equal(npcChunkRequests.length,0,"NPC page code must stay out of the initial Home request graph");
    const npcLink=page.locator('[data-home-group="exploration"] a[href="/en-US/database/npcs"]');
    await npcLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/npcs");
    await page.locator("#npc-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".npc-card").count()>0,"the NPC collection must render verified entries");
    assert.equal(npcChunkRequests.length,1,"NPC page code must load exactly once on first route entry");
    await page.locator(".npc-card h2 a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/npcs/"));
    await page.locator(".npc-detail").waitFor({state:"visible"});
    assert.equal(npcChunkRequests.length,1,"NPC details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/npcs");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await npcLink.waitFor({state:"visible"});
    await npcLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/npcs");
    await page.locator("#npc-search").waitFor({state:"visible"});
    assert.equal(npcChunkRequests.length,1,"repeat NPC navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordNpcChunk);
  });

  await run("home-dungeons-detail-back",async()=>{
    const dungeonChunkRequests=[];
    const recordDungeonChunk=request=>{if(/\/dungeons-[^/]+\.js$/.test(new URL(request.url()).pathname))dungeonChunkRequests.push(request.url())};
    page.on("request",recordDungeonChunk);
    await visit("/en-US");
    assert.equal(dungeonChunkRequests.length,0,"Dungeon page code must stay out of the initial Home request graph");
    const dungeonLink=page.locator('[data-home-group="exploration"] a[href="/en-US/database/dungeons"]');
    await dungeonLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/dungeons");
    await page.locator("#dungeon-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".dungeon-card").count()>0,"the Dungeon collection must render verified entries");
    assert.equal(dungeonChunkRequests.length,1,"Dungeon page code must load exactly once on first route entry");
    await page.locator(".dungeon-card h2 a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/dungeons/"));
    await page.locator(".dungeon-detail").waitFor({state:"visible"});
    assert.equal(dungeonChunkRequests.length,1,"Dungeon details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/dungeons");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await dungeonLink.waitFor({state:"visible"});
    await dungeonLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/dungeons");
    await page.locator("#dungeon-search").waitFor({state:"visible"});
    assert.equal(dungeonChunkRequests.length,1,"repeat Dungeon navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordDungeonChunk);
  });

  await run("home-expeditions-detail-back",async()=>{
    const expeditionChunkRequests=[];
    const recordExpeditionChunk=request=>{if(/\/expeditions-[^/]+\.js$/.test(new URL(request.url()).pathname))expeditionChunkRequests.push(request.url())};
    page.on("request",recordExpeditionChunk);
    await visit("/en-US");
    assert.equal(expeditionChunkRequests.length,0,"expedition page code must stay out of the initial Home request graph");
    const expeditionLink=page.locator('[data-home-group="exploration"] a[href="/en-US/database/expeditions"]');
    await expeditionLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/expeditions");
    await page.locator("#expedition-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".expedition-card").count()>0,"the expedition collection must render verified entries");
    assert.equal(expeditionChunkRequests.length,1,"expedition page code must load exactly once on first route entry");
    await page.locator(".expedition-card a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/expeditions/"));
    await page.locator(".expedition-detail").waitFor({state:"visible"});
    assert.equal(expeditionChunkRequests.length,1,"expedition details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/expeditions");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await expeditionLink.waitFor({state:"visible"});
    await expeditionLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/expeditions");
    await page.locator("#expedition-search").waitFor({state:"visible"});
    assert.equal(expeditionChunkRequests.length,1,"repeat expedition navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordExpeditionChunk);
  });

  await run("home-quests-detail-back",async()=>{
    const questChunkRequests=[];
    const recordQuestChunk=request=>{if(/\/quests-[^/]+\.js$/.test(new URL(request.url()).pathname))questChunkRequests.push(request.url())};
    page.on("request",recordQuestChunk);
    await visit("/en-US");
    assert.equal(questChunkRequests.length,0,"quest page code must stay out of the initial Home request graph");
    const questLink=page.locator('[data-home-group="items-and-progression"] a[href="/en-US/database/quests"]');
    await questLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/quests");
    await page.locator("#quest-search").waitFor({state:"visible"});
    assert.ok(await page.locator(".quest-card").count()>0,"the quest collection must render verified entries");
    assert.equal(questChunkRequests.length,1,"quest page code must load exactly once on first route entry");
    await page.locator(".quest-card h2 a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/quests/"));
    await page.locator(".quest-detail").waitFor({state:"visible"});
    assert.equal(questChunkRequests.length,1,"quest details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/quests");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await questLink.waitFor({state:"visible"});
    await questLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/quests");
    await page.locator("#quest-search").waitFor({state:"visible"});
    assert.equal(questChunkRequests.length,1,"repeat quest navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordQuestChunk);
  });

  await run("home-health-detail-back",async()=>{
    const healthChunkRequests=[];
    const recordHealthChunk=request=>{if(/\/health-(?!i18n-)[^/]+\.js$/.test(new URL(request.url()).pathname))healthChunkRequests.push(request.url())};
    page.on("request",recordHealthChunk);
    await visit("/en-US");
    assert.equal(healthChunkRequests.length,0,"Health page code must stay out of the initial Home request graph");
    const healthLink=page.locator('[data-home-group="combat-and-management"] a[href="/en-US/database/health"]');
    await healthLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/health");
    await page.locator("#health-search").waitFor({state:"visible"});
    assert.ok(await page.locator("[data-health-entry]").count()>0,"the Health collection must render verified entries");
    assert.equal(healthChunkRequests.length,1,"Health page code must load exactly once on first route entry");
    await page.locator(".health-card h3 a[data-link]").first().click();
    await page.waitForURL(url=>url.pathname.startsWith("/en-US/database/health/conditions/"));
    await page.locator(".health-condition-detail").waitFor({state:"visible"});
    assert.equal(healthChunkRequests.length,1,"Health details must reuse the loaded collection module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/database/health");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US");
    await healthLink.waitFor({state:"visible"});
    await healthLink.click();
    await page.waitForURL(url=>url.pathname==="/en-US/database/health");
    await page.locator("#health-search").waitFor({state:"visible"});
    assert.equal(healthChunkRequests.length,1,"repeat Health navigation must reuse the loaded module without a duplicate request");
    page.off("request",recordHealthChunk);
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
    assert.equal(await page.locator("[data-server-key]").count(),93,"the server form must expose every supported official setting");
    const basicVisible=await page.locator("[data-server-scope=basic]:visible").count();
    assert.ok(basicVisible>0&&basicVisible<93,"basic mode must present a focused subset of the complete schema");
    await page.locator('[data-server-mode="advanced"]').click();
    assert.equal(await page.locator("[data-server-scope]:visible").count(),93,"advanced mode must reveal the complete supported schema");
    await page.locator('input[name="ServerPlayerMaxNum"][type="number"]').fill("12");
    assert.equal(await page.locator("#server-form").evaluate(form=>form.querySelector('input[name="ServerPlayerMaxNum"][data-server-key]')?.value),"12","the lazy server form must retain edited values before generation");
    await page.locator('#server-form button[type="submit"]').click();
    assert.match(await page.locator("#ini-output").inputValue(),/ServerPlayerMaxNum=12/,"the lazy server route must generate INI from the bound form");
    assert.match(await page.locator("#server-diff").textContent(),/ServerPlayerMaxNum/,"the server route must summarize settings that differ from official defaults");
    await page.locator('select[name="RCONEnabled"]').selectOption("True");
    assert.match(await page.locator("#ini-warnings").textContent(),/RCONEnabled.*AdminPassword/s,"the server validator must surface the RCON credential dependency without transmitting the value");
    await page.locator('input[name="AdminPassword"]').fill("local-secret-only");
    await page.locator('#server-form button[type="submit"]').click();
    assert.equal(new URL(page.url()).search,"","sensitive server values must not be written to the URL");
    assert.doesNotMatch(await page.evaluate(()=>JSON.stringify(localStorage)),/local-secret-only/,"sensitive server values must not be written to local storage");
    await page.locator("#ini-file").setInputFiles({name:"PalWorldSettings.ini",mimeType:"text/plain",buffer:Buffer.from("[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(ServerPlayerMaxNum=16,UnknownKey=1)")});
    assert.equal(await page.locator('input[name="ServerPlayerMaxNum"][type="number"]').inputValue(),"16","the lazy server route must import official settings locally");
    assert.match(await page.locator("#ini-warnings").textContent(),/UnknownKey/,"the local INI import must report unsupported keys");
    const downloadPromise=page.waitForEvent("download");
    await page.locator("#download-ini").click();
    const download=await downloadPromise;
    assert.equal(download.suggestedFilename(),"PalWorldSettings.ini","the server route must download the generated configuration with the expected filename");
    for(const width of [360,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      await visit("/ko-KR/server-tools/settings-generator");
      await page.locator("#server-form").waitFor({state:"visible"});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`the localized server form must not overflow at ${width}px`);
    }
    await page.setViewportSize({width:360,height:800});
    await page.evaluate(()=>localStorage.setItem("pw-theme","dark"));
    await page.reload({waitUntil:"networkidle"});
    assert.equal(await page.locator("html").getAttribute("data-theme"),"dark","the mobile server flow must render in the stored dark theme");
    await page.locator('[data-server-mode="advanced"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("[data-server-scope]:visible").count(),93,"the advanced server mode must be keyboard operable on mobile");
    await page.evaluate(()=>localStorage.removeItem("pw-theme"));
    await page.setViewportSize({width:1365,height:900});
    page.off("request",recordServerChunk);
  });

  await run("home-guides-detail-search",async()=>{
    const guideChunkRequests=[];
    const recordGuideChunk=request=>{if(/\/guides-[^/]+\.js$/.test(new URL(request.url()).pathname))guideChunkRequests.push(request.url())};
    page.on("request",recordGuideChunk);
    await visit("/en-US");
    assert.equal(guideChunkRequests.length,0,"guide content must stay out of the initial Home request graph");
    await page.locator('.home-guides-link a[href="/en-US/guides"]').click();
    await page.waitForURL(url=>url.pathname==="/en-US/guides");
    await page.locator(".guide-hub").waitFor({state:"visible"});
    assert.equal(await page.locator(".guide-card").count(),6,"the guide hub must expose all six workflows");
    assert.equal(guideChunkRequests.length,1,"guide content must load once on first route entry");
    await page.locator('.guide-card a[href="/en-US/guides/server"]').first().click();
    await page.waitForURL(url=>url.pathname==="/en-US/guides/server");
    await page.locator(".guide-detail").waitFor({state:"visible"});
    assert.equal(await page.locator(".guide-step-number").count(),3,"the server guide must expose its three linked workflow steps");
    assert.equal(guideChunkRequests.length,1,"guide details must reuse the loaded guide module");
    await page.goBack({waitUntil:"networkidle"});
    await page.waitForURL(url=>url.pathname==="/en-US/guides");
    await page.locator("header [data-open-search]").click();
    await page.locator("#global-search-input").fill("backup");
    await page.locator('#global-search-results a[href="/en-US/guides/server"]').waitFor({state:"visible"});
    for(const width of [360,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      await visit("/ko-KR/guides/combat");
      await page.locator(".guide-detail").waitFor({state:"visible"});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`the localized guide must not overflow at ${width}px`);
    }
    await page.setViewportSize({width:360,height:800});
    await page.evaluate(()=>localStorage.setItem("pw-theme","dark"));
    await visit("/ko-KR/guides/combat");
    assert.equal(await page.locator("html").getAttribute("data-theme"),"dark","the Korean mobile guide must support the explicit dark theme");
    await page.evaluate(()=>localStorage.removeItem("pw-theme"));
    await page.setViewportSize({width:1365,height:900});
    page.off("request",recordGuideChunk);
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
  assert.ok(passed.length>=20,"the browser baseline must cover at least twenty workflows");
  console.log(`Passed ${passed.length} browser workflows with ${path.basename(executablePath)}: ${passed.join(", ")}.`);
}finally{
  await browser.close();
  await server.close();
}
