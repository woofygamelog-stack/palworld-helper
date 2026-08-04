import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const readJson=file=>readFile(file,"utf8").then(JSON.parse),hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sources={
  pals:["public/data/pals.json","pals","id"],items:["public/data/items.json","items","id"],activeSkills:["public/data/skills.json","activeSkills","id"],passiveSkills:["public/data/skills.json","passiveSkills","id"],partnerSkills:["public/data/skills.json","partnerSkills","id"],npcs:["public/data/npcs.json","npcs","slug"],dungeons:["public/data/dungeons.json","dungeons","slug"],technology:["public/data/technology.json","technologies","slug"],structures:["public/data/structures.json","structures","slug"],expeditions:["public/data/expeditions.json","expeditions","slug"],quests:["public/data/quests.json","quests","slug"],conditions:["public/data/health.json","conditions","slug"],elements:["public/data/elements.json","elements","slug"],condensing:["public/data/condensing.json","stages","toStars"],
};
const fileCache=new Map(),current={};
for(const [domain,[file,field,key]] of Object.entries(sources)){if(!fileCache.has(file))fileCache.set(file,await readJson(file));const entities=fileCache.get(file)[field];current[domain]=Object.fromEntries(entities.map(entity=>[String(entity[key]),hash(entity)]))}

// Exercise every diff state without publishing invented game facts. The fixture is
// deliberately synthetic and exists only in the ignored private rehearsal report.
const previous=structuredClone(current),firstPal=Object.keys(previous.pals).sort()[0],lastPal=Object.keys(previous.pals).sort().at(-1);
previous.pals[firstPal]="simulated-previous-content";
delete previous.pals[lastPal];
previous.pals["__simulated_removed_record__"]="simulated-removed-content";

const routeByDomain={pals:["pals","calculators/pal-compare","calculators/team-builder"],items:["database","calculators/crafting"],activeSkills:["skills/active"],passiveSkills:["skills/passive"],partnerSkills:["skills/partner"],npcs:["database/npcs","map"],dungeons:["database/dungeons","map"],technology:["database/technology"],structures:["database/structures"],expeditions:["database/expeditions"],quests:["database/quests"],conditions:["database/health"],elements:["database/elements","calculators/team-builder"],condensing:["calculators/condensing"]};
const rows=Object.keys(current).sort().map(domain=>{const before=previous[domain],after=current[domain],beforeIds=new Set(Object.keys(before)),afterIds=new Set(Object.keys(after)),added=[...afterIds].filter(id=>!beforeIds.has(id)).sort(),removed=[...beforeIds].filter(id=>!afterIds.has(id)).sort(),changed=[...afterIds].filter(id=>beforeIds.has(id)&&before[id]!==after[id]).sort();return {domain,previousCount:beforeIds.size,currentCount:afterIds.size,added,changed,removed,unresolved:[],affectedRoutes:added.length||changed.length||removed.length?routeByDomain[domain]:[]}});
const palRow=rows.find(row=>row.domain==="pals");
if(palRow.added.length!==1||palRow.changed.length!==1||palRow.removed.length!==1||rows.some(row=>row.unresolved.length))throw new Error("Update rehearsal did not exercise deterministic added, changed, and removed states");
const report={schema:1,mode:"synthetic-private-rehearsal",currentBuild:fileCache.get("public/data/pals.json").meta.gameBuild,previousBuild:"simulated-previous",rows};
report.contentHash=hash(report);
const output=path.resolve("private","planning","update-diff-rehearsal.json");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
console.log(`Update rehearsal covered ${rows.length} domains with deterministic added, changed, removed, and affected-route output.`);
console.log(`Report: ${path.relative(process.cwd(),output)}`);
