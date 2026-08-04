import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";

const repositoryFiles=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z","--","src","scripts","tests","vite.config.ts"],{encoding:"buffer"}).toString("utf8").split("\0").filter(file=>/\.(?:ts|mjs|js)$/.test(file)&&file!=="scripts/check-lint.mjs");
const failures=[];

for(const file of repositoryFiles){
  const source=await readFile(file,"utf8"),rules=[
    [/@ts-(?:ignore|nocheck)/g,"TypeScript suppression"],
    [/\bdebugger\b/g,"debugger statement"],
    [/\.(?:only)\s*\(/g,"focused test"],
  ];
  if(file.startsWith("src/"))rules.push([/console\.log\s*\(/g,"runtime console.log"]);
  for(const [pattern,label] of rules)for(const match of source.matchAll(pattern)){const line=source.slice(0,match.index).split("\n").length;failures.push(`${file}:${line}: ${label}`)}
}

if(failures.length)throw new Error(`Lint check failed:\n${failures.join("\n")}`);
console.log(`Lint hygiene check passed for ${repositoryFiles.length} TypeScript and JavaScript files.`);
