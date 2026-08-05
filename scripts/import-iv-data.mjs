import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),evidenceRoot=path.join(root,"private","verification","calculators","build-24467282");
const [pals,parameters,ranks,report]=await Promise.all([
  readFile(path.join(root,"public","data","pals.json"),"utf8").then(JSON.parse),
  readFile(path.join(root,"private","extracted","build-24467282-calculators","pal-parameters.raw.json"),"utf8").then(JSON.parse),
  readFile(path.join(root,"private","extracted","build-24467282-calculators","friendship-ranks.raw.json"),"utf8").then(JSON.parse),
  readFile(path.join(evidenceRoot,"iv-friendship-bridge-report.json"),"utf8").then(JSON.parse)
]);
if(pals.pals.length!==299||report.status!=="verified"||report.gameBuild!==String(pals.meta.gameBuild)||report.exactFloat32FormulaMatch!==true||report.independentSessionPayloadsMatch!==true)throw new Error("Verified current-build IV formula evidence is required.");
const coefficientMap=(baseField,coefficientField)=>Object.fromEntries([...new Map(pals.pals.map(pal=>{
  const row=parameters[pal.id];
  if(!row||row[coefficientField]<=0)throw new Error(`Missing ${coefficientField} for ${pal.id}.`);
  return [String(pal[baseField]),row[coefficientField]];
})).entries()].sort((a,b)=>Number(a[0])-Number(b[0])));
const friendshipRanks=Object.values(ranks).filter(row=>row.FriendshipRank>=0).sort((a,b)=>a.FriendshipRank-b.FriendshipRank).map(row=>({rank:row.FriendshipRank,points:row.RequiredPoint}));
if(friendshipRanks.length!==11||friendshipRanks[0].points!==0||friendshipRanks.at(-1).rank!==10)throw new Error("Friendship rank thresholds are incomplete.");
const output={meta:{schema:1,verification:"verified",palCount:299,maxLevel:80,maxIv:100,maxStars:4,maxSoulRank:4,maxFriendshipRank:10},constants:{talentPerPoint:Math.fround(.003),condensingPerStar:Math.fround(.05),soulPerRank:Math.fround(.03),hp:{fixed:500,levelFixed:5,levelMultiplier:Math.fround(.5)},attack:{fixed:100,levelFixed:0,levelMultiplier:Math.fround(.075)},defense:{fixed:50,levelFixed:0,levelMultiplier:Math.fround(.075)}},friendshipRanks,friendshipByBase:{hp:coefficientMap("hp","Friendship_HP"),attack:coefficientMap("attack","Friendship_ShotAttack"),defense:coefficientMap("defense","Friendship_Defense")}};
const serialized=`${JSON.stringify(output)}\n`;
await writeFile(path.join(root,"public","data","iv.json"),serialized);
await mkdir(path.join(root,"private","provenance"),{recursive:true});
await writeFile(path.join(root,"private","provenance","iv.json"),`${JSON.stringify({schema:1,gameBuild:String(pals.meta.gameBuild),runtimeReportSha256:createHash("sha256").update(JSON.stringify(report)).digest("hex"),publicOutputSha256:createHash("sha256").update(serialized).digest("hex"),verification:{palCount:299,friendshipRanks:11,formulaCasesPerSession:31500,independentSessions:2}},null,2)}\n`);
console.log("Imported verified IV constants and friendship coefficients for 299 Pals.");
