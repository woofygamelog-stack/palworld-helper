import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { deploymentFileBudget } from "../src/route-manifest.ts";

const root = process.cwd();
const dist = path.join(root, "dist");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const [packageJson, wrangler, report, redirects, adsTxt, envExample, config] = await Promise.all([
  readJson("package.json"),
  readJson("wrangler.jsonc"),
  readJson(path.join(dist, "prerender-report.json")),
  readFile(path.join(dist, "_redirects"), "utf8"),
  readFile(path.join(dist, "ads.txt"), "utf8"),
  readFile(".env.example", "utf8"),
  readFile("src/config.ts", "utf8"),
]);

const fail = (message) => {
  throw new Error(`Deployment readiness failed: ${message}`);
};

if (wrangler.name !== packageJson.name || wrangler.name !== "palworld-helper") fail("the package and Cloudflare project names must match");
if (wrangler.main !== undefined) fail("an assets-only deployment must not define a Worker entrypoint");
if (wrangler.workers_dev !== false || wrangler.preview_urls !== false) fail("public preview hostnames must stay disabled");
if (wrangler.assets?.directory !== "./dist") fail("Cloudflare may deploy only the verified dist directory");
if (wrangler.assets?.not_found_handling !== "single-page-application") fail("the documented hybrid SPA fallback must remain enabled");
if (wrangler.assets?.html_handling !== "drop-trailing-slash") fail("Cloudflare routing must follow the canonical no-trailing-slash policy");

const wranglerVersion = packageJson.devDependencies?.wrangler;
if (!/^\d+\.\d+\.\d+$/.test(wranglerVersion || "")) fail("Wrangler must be pinned to an exact project dependency");
if (packageJson.scripts?.["deploy:production"] !== "npm run release:check && wrangler deploy") fail("production deploys must retain the full release gate");
if (!packageJson.scripts?.["release:check"]?.includes("deploy:dry-run")) fail("the release gate must include Wrangler dry-run packaging");

const redirectRules = redirects.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
if (redirectRules.length !== 1 || redirectRules[0] !== "/ /en-US 308") fail("only the narrow root locale redirect is allowed");
if (/^\/\*\s+\/index\.html\s+200\s*$/m.test(redirects)) fail("a catch-all redirect cannot coexist with Workers SPA fallback");
if (adsTxt.trim() !== "google.com, pub-1986785092914105, DIRECT, f08c47fec0942fa0") fail("ads.txt does not match the approved publisher account");
if (/\.example|\.invalid|localhost|127\.0\.0\.1/i.test(`${envExample}\n${config}`)) fail("placeholder or local origins remain in public configuration");
if (!/^VITE_SUPPORT_URL=\s*$/m.test(envExample)) fail("the example support destination must stay empty until the owner supplies one");

const files = [];
let directoryCount = 0;
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      directoryCount += 1;
      await collect(target);
    }
    else files.push(path.relative(dist, target).replaceAll("\\", "/"));
  }
}
await collect(dist);

const forbiddenFiles = files.filter((file) =>
  /(^|\/)(?:private|provenance|raw-private|node_modules|functions)(\/|$)|(^|\/)_worker\.js$|\.env(?:\.|$)|\.log$/i.test(file),
);
if (forbiddenFiles.length) fail(`forbidden files entered dist: ${forbiddenFiles.slice(0, 5).join(", ")}`);
const fileCeiling = deploymentFileBudget.hardLimit - deploymentFileBudget.reservedHeadroom;
if (files.length > fileCeiling) fail(`the artifact contains ${files.length} files and no longer preserves the ${deploymentFileBudget.reservedHeadroom}-file reserve below the ${deploymentFileBudget.hardLimit}-file budget`);
if (report.architecture !== "hybrid-prerender-plus-spa" || report.indexableUrlCount <= 0 || report.physicalHtmlDocuments <= 1 || report.initialHtmlSeoCoverage <= 0) fail("the hybrid rendering report is incomplete");

console.log([
  `Deployment ready with Wrangler ${wranglerVersion}.`,
  `${files.length} deployable files stay within the ${fileCeiling}-file release ceiling; Wrangler also scans ${directoryCount} directories.`,
  `${report.indexableUrlCount} indexable URLs, ${report.physicalHtmlDocuments} HTML documents, and ${report.initialHtmlSeoCoverage} initial-HTML routes were reported.`,
  "Production upload, custom-domain state, Search Console, Analytics collection, and AdSense approval still require authorized live verification.",
].join("\n"));
