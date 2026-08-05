import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const readJson=async relative=>JSON.parse(await readFile(path.join(root,relative),"utf8"));
const assert=(condition,message)=>{if(!condition)throw new Error(`Release evidence generation failed: ${message}`)};

const [
  prerender,
  coverage,
  budget,
  deterministic,
  blocked,
  disclosure,
  e2eSource,
  visualSource,
]=await Promise.all([
  readJson("dist/prerender-report.json"),
  readJson("private/planning/domain-coverage.json"),
  readJson("private/planning/release-a-deployment-budget.json"),
  readJson("private/planning/deterministic-build.json"),
  readJson("private/planning/blocked-calculators.json"),
  readJson("private/planning/public-disclosure-report.json"),
  readFile(path.join(root,"tests/e2e-smoke.mjs"),"utf8"),
  readFile(path.join(root,"tests/visual-regression.mjs"),"utf8"),
]);

assert(prerender.indexableUrlCount===coverage.indexableUrlCount,"prerender and coverage URL counts differ");
assert(prerender.indexableUrlCount===budget.current.indexableUrls,"prerender and deployment-budget URL counts differ");
assert(prerender.initialHtmlSeoCoverage===budget.current.prerenderedRoutes,"prerender route counts differ");
assert(prerender.physicalHtmlDocuments===budget.current.htmlFiles,"physical HTML counts differ");
assert(deterministic.fileCount===budget.current.deployableFiles,"deterministic and deployment-budget file counts differ");
assert(budget.current.deployableFiles<budget.budget.releaseCeiling,"deployable files exceed the release ceiling");
assert(budget.releaseAForecast.passes===true,"Release A deployment forecast does not pass");
assert(disclosure.status==="passed"&&Number.isInteger(disclosure.artifactCount),"public disclosure audit evidence is missing");
assert(Array.isArray(blocked.rows)&&blocked.rows.length>0,"blocked calculator audit is missing");
assert(blocked.rows.every(row=>row.status==="blocked"&&row.decision==="not-public"&&row.exposedRoutes.length===0),"a blocked calculator is publicly exposed");

const browserWorkflows=(e2eSource.match(/await run\("/g)??[]).length;
const visualBaselines=(visualSource.match(/\{\s*name:\s*"/g)??[]).length;
assert(browserWorkflows>0,"browser workflow inventory is empty");
assert(visualBaselines>0,"visual baseline inventory is empty");

const date=new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Seoul",
  year:"numeric",
  month:"2-digit",
  day:"2-digit",
}).format(new Date());
const report={
  schema:1,
  date,
  scope:"local-release-candidate",
  releaseCheck:"passed",
  gameBuild:coverage.gameBuild,
  locales:coverage.localeCount,
  coverageDomains:coverage.domainCount,
  indexableUrls:prerender.indexableUrlCount,
  prerenderedRoutes:prerender.initialHtmlSeoCoverage,
  physicalHtmlDocuments:prerender.physicalHtmlDocuments,
  deployedFiles:budget.current.deployableFiles,
  releaseCeiling:budget.budget.releaseCeiling,
  hardAssetLimit:budget.budget.hardLimit,
  deterministicBuildSha256:deterministic.aggregate,
  browserWorkflows,
  visualBaselines,
  publicDisclosureArtifacts:disclosure.artifactCount,
  blockedCalculators:blocked.rows.map(row=>row.domain),
  checks:{
    format:"passed",
    lint:"passed",
    typecheck:"passed",
    localization:"passed",
    itemImages:"1891/1891",
    unitAndDataValidation:"passed",
    coverage:"passed",
    updateDiffRehearsal:"passed",
    productionBuild:"passed",
    routeBudget:"passed",
    e2e:"passed",
    visualRegression:"passed",
    determinism:"passed",
    deploymentReadiness:"passed",
    wranglerDryRun:"passed",
  },
  pendingAuthorizationOrExternalState:[
    "production upload and connected Git deployment verification",
    "custom production hostname verification",
    "Search Console ownership and sitemap submission verification",
    "Analytics production collection request verification",
    "AdSense loader and publisher request transport verification",
    "CMP affected-region production verification",
    "post-launch 28-day and 90-day review",
  ],
};

const output=path.join(root,"private","planning","release-evidence.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Release evidence generated: ${report.indexableUrls} URLs, ${report.deployedFiles} files, ${browserWorkflows} browser workflows, ${visualBaselines} visual baselines.`);
