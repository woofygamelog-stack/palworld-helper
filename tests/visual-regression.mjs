import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { findChromiumExecutable, startPreviewServer } from "./browser-runtime.mjs";

const update = process.argv.includes("--update");
const baselineDirectory = path.resolve("tests", "visual-baselines");
const failureDirectory = path.resolve("private", "visual-failures");
const scenarios = [
  { name: "home-mobile-ko-dark", route: "/ko-KR", viewport: { width: 360, height: 800 }, theme: "dark", ready: "[data-home-action=\"breeding\"]" },
  { name: "home-desktop-en-light", route: "/en-US", viewport: { width: 1440, height: 1000 }, theme: "light", ready: "[data-home-action=\"breeding\"]" },
  { name: "breeding-tablet-ja-light", route: "/ja-JP/calculators/breeding", viewport: { width: 768, height: 1024 }, theme: "light", ready: "#parent-a + .pal-combobox .pal-combobox-button" },
  { name: "map-desktop-en-dark", route: "/en-US/map", viewport: { width: 1024, height: 900 }, theme: "dark", ready: ".map-viewport" },
];

async function compareImages(actualBuffer, baselineBuffer, name) {
  const actual = await sharp(actualBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const baseline = await sharp(baselineBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(actual.info, baseline.info, `${name} screenshot dimensions or channels changed`);
  let changedPixels = 0;
  for (let offset = 0; offset < actual.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(actual.data[offset] - baseline.data[offset]),
      Math.abs(actual.data[offset + 1] - baseline.data[offset + 1]),
      Math.abs(actual.data[offset + 2] - baseline.data[offset + 2]),
      Math.abs(actual.data[offset + 3] - baseline.data[offset + 3]),
    );
    if (delta > 12) changedPixels += 1;
  }
  const pixelCount = actual.info.width * actual.info.height;
  const ratio = changedPixels / pixelCount;
  assert.ok(ratio <= 0.002, `${name} visual difference ${(ratio * 100).toFixed(3)}% exceeds 0.200%`);
}

const executablePath = await findChromiumExecutable();
const { origin, server } = await startPreviewServer();
const browser = await chromium.launch({ executablePath, headless: true });
const passed = [];

try {
  if (update) await mkdir(baselineDirectory, { recursive: true });
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario.viewport, locale: scenario.route.split("/")[1], colorScheme: scenario.theme });
    await context.addInitScript(theme => localStorage.setItem("pw-theme", theme), scenario.theme);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => consoleErrors.push(error.message));
    await page.goto(`${origin}${scenario.route}`, { waitUntil: "networkidle" });
    await page.locator(scenario.ready).waitFor({ state: "visible" });
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${scenario.name} must not overflow horizontally`);
    assert.deepEqual(consoleErrors, [], `${scenario.name} browser console errors: ${consoleErrors.join(" | ")}`);
    const screenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
    const baselinePath = path.join(baselineDirectory, `${scenario.name}.webp`);
    if (update) {
      await writeFile(baselinePath, await sharp(screenshot).webp({ lossless: true, effort: 6 }).toBuffer());
    } else {
      try {
        await compareImages(screenshot, await readFile(baselinePath), scenario.name);
      } catch (error) {
        await mkdir(failureDirectory, { recursive: true });
        await writeFile(path.join(failureDirectory, `${scenario.name}.png`), screenshot);
        throw error;
      }
    }
    passed.push(scenario.name);
    await context.close();
  }
  console.log(`${update ? "Updated" : "Passed"} ${passed.length} visual baselines with ${path.basename(executablePath)}: ${passed.join(", ")}.`);
} finally {
  await browser.close();
  await server.close();
}
