import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {collectionRoutes,shellNavigation} from "../src/route-manifest.ts";

const candidates=[
  {domain:"capture",forbiddenRoutes:["calculators/capture","calculators/capture-probability"],missing:["build-matched constants","modifier order","caps and rounding","independent golden cases"]},
  {domain:"iv",forbiddenRoutes:["calculators/iv","calculators/iv-calculator"],missing:["build-matched stat formula","condensing and soul correction order","rounding behavior","independent golden cases"]},
  {domain:"production",forbiddenRoutes:["calculators/production","calculators/production-rate"],missing:["build-matched workload formula","facility and work-suitability order","passive and world-setting order","independent golden cases"]},
];
const navigationRoutes=shellNavigation.flatMap(item=>[item.path,...("children" in item?item.children.map(child=>child.path):[])]),publicRoutes=new Set([...collectionRoutes,...navigationRoutes]);
const rows=candidates.map(candidate=>{const exposed=candidate.forbiddenRoutes.filter(route=>publicRoutes.has(route));return {...candidate,status:"blocked",decision:"not-public",exposedRoutes:exposed}});
if(rows.some(row=>row.exposedRoutes.length))throw new Error(`Blocked calculator route is publicly exposed: ${rows.flatMap(row=>row.exposedRoutes).join(", ")}`);
const palData=JSON.parse(await readFile("public/data/pals.json","utf8"));
const report={schema:1,gameBuild:palData.meta.gameBuild,decisionRule:"Publish exact calculator output only after every listed proof requirement and independent golden cases pass.",rows};
const output=path.resolve("private","planning","blocked-calculators.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Validated ${rows.length} blocked calculator decisions with no public routes.`);
console.log(`Report: ${path.relative(process.cwd(),output)}`);
