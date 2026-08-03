import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {deploymentFileBudget,supportedLocales} from "../src/route-manifest.ts";

const parseNumber=(name,fallback)=>{
  const argument=process.argv.find(value=>value.startsWith(`--${name}=`));
  const value=argument?Number(argument.slice(argument.indexOf("=")+1)):fallback;
  if(!Number.isInteger(value)||value<0)throw new Error(`${name} must be a non-negative integer`);
  return value;
};

const plannedLocalizedRouteFamilies=parseNumber("planned-localized-routes",7);
const plannedAssetFiles=parseNumber("planned-assets",32);
const dist=path.resolve("dist"),files=[];

async function collect(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())await collect(target);
    else files.push(path.relative(dist,target).replaceAll("\\","/"));
  }
}

await collect(dist);
const report=JSON.parse(await readFile(path.join(dist,"prerender-report.json"),"utf8"));
const releaseCeiling=deploymentFileBudget.hardLimit-deploymentFileBudget.reservedHeadroom;
const localizedRouteFiles=plannedLocalizedRouteFamilies*supportedLocales.length;
const forecastFiles=files.length+localizedRouteFiles+plannedAssetFiles;
const htmlFiles=files.filter(file=>file.endsWith(".html")).length;
const routeFamilies=[
  ...report.routeFamilies.collections.map(family=>({family:family.path||"(home)",kind:"collection",indexableUrls:family.indexableUrls,prerenderedFiles:family.prerenderedUrls})),
  ...report.routeFamilies.entities.map(family=>({family:family.prefix,kind:"entity",indexableUrls:family.indexableUrls,prerenderedFiles:family.prerenderedUrls})),
].sort((a,b)=>b.prerenderedFiles-a.prerenderedFiles||a.family.localeCompare(b.family));

const budgetReport={
  schema:1,
  generatedAt:new Date().toISOString(),
  current:{deployableFiles:files.length,htmlFiles,nonHtmlFiles:files.length-htmlFiles,indexableUrls:report.indexableUrlCount,prerenderedRoutes:report.initialHtmlSeoCoverage},
  budget:{hardLimit:deploymentFileBudget.hardLimit,reservedHeadroom:deploymentFileBudget.reservedHeadroom,releaseCeiling,currentSlack:releaseCeiling-files.length},
  releaseAForecast:{plannedLocalizedRouteFamilies,localeCount:supportedLocales.length,localizedRouteFiles,plannedAssetFiles,forecastFiles,slack:releaseCeiling-forecastFiles,passes:forecastFiles<=releaseCeiling},
  routeFamilies,
};

const output=path.resolve("private","planning","release-a-deployment-budget.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(budgetReport,null,2)+"\n");

console.log([
  `Current artifact: ${files.length} files (${htmlFiles} HTML, ${files.length-htmlFiles} non-HTML).`,
  `Release ceiling: ${releaseCeiling} files (${deploymentFileBudget.reservedHeadroom} reserved below ${deploymentFileBudget.hardLimit}).`,
  `Release A forecast: ${forecastFiles} files = current ${files.length} + ${localizedRouteFiles} localized route files + ${plannedAssetFiles} asset allowance.`,
  `Forecast slack: ${releaseCeiling-forecastFiles} files.`,
  `Report: ${path.relative(process.cwd(),output)}`,
].join("\n"));

if(files.length>releaseCeiling)throw new Error(`Current artifact exceeds the ${releaseCeiling}-file release ceiling`);
if(forecastFiles>releaseCeiling)throw new Error(`Release A forecast exceeds the ${releaseCeiling}-file release ceiling`);
