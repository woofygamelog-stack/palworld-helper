import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";

const extensions=new Set([".ts",".mjs",".js",".css",".json",".jsonc",".md",".html",".txt",".xml"]);
const repositoryFiles=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"buffer"}).toString("utf8").split("\0").filter(Boolean);
const files=repositoryFiles.filter(file=>!file.startsWith("public/")&&extensions.has(file.slice(file.lastIndexOf("."))));
const decoder=new TextDecoder("utf-8",{fatal:true}),failures=[];

for(const file of files){
  const bytes=await readFile(file);let text;
  try{text=decoder.decode(bytes)}catch{failures.push(`${file}: invalid UTF-8`);continue}
  if(text.charCodeAt(0)===0xfeff)failures.push(`${file}: UTF-8 BOM is not allowed`);
  if(text.includes("\0"))failures.push(`${file}: NUL byte is not allowed`);
  if(text.includes("\r"))failures.push(`${file}: use LF line endings`);
  if(/^[\s\S]*[ \t]+$/m.test(text))failures.push(`${file}: trailing whitespace`);
  if(!text.endsWith("\n"))failures.push(`${file}: missing final newline`);
  if(text.endsWith("\n\n"))failures.push(`${file}: more than one final newline`);
}

if(failures.length)throw new Error(`Format check failed:\n${failures.join("\n")}`);
console.log(`Format check passed for ${files.length} repository text files.`);
