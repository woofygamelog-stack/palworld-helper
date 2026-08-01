import {readFile,readdir,stat} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const textExtensions=new Set([".css",".html",".js",".json",".md",".svg",".ts",".txt",".webmanifest",".xml"]);
const publicSourceRoots=["src","public","docs"];
const publicSourceFiles=["index.html","README.md","IMPLEMENTATION_STATUS_KO.md"];
const patterns=[
  ["game-file wording",/\bgame[- ]files?(?:[- ](?:first|derived|based))?\b/iu],
  ["installed-game wording",/\binstalled (?:copy|game(?: files?)?)\b/iu],
  ["acquisition wording",/\b(?:data[- ]?min(?:e|ed|ing)|datamin(?:e|ed|ing)|reverse[- ]?engineer(?:ed|ing)?|extract(?:ed|ing|ion)(?: from| of)? (?:the )?(?:installed )?game|unpack(?:ed|ing)?(?: from)? (?:the )?game)\b/iu],
  ["private metadata key",/"(?:extractedAt|extraction|mappingHash|pakHash|sourceDirectory|sourcePath|sourceType|toolVersion)"\s*:/iu],
  ["private tool or archive residue",/(?:CUE4Parse|UAssetGUI|\.usmap\b|(?:^|[/\\])[^/\\\s"']*\.pak\b)/iu],
  ["Korean acquisition wording",/(?:게임\s*파일|설치(?:된|한)\s*게임|게임\s*데이터.{0,12}추출|추출(?:된|한|해서)\s*게임|데이터\s*마이닝|리버스\s*엔지니어링|역공학)/u],
  ["Japanese acquisition wording",/(?:ゲームファイル|インストール済みゲーム|ゲームデータ.{0,8}抽出|抽出したゲームデータ)/u],
  ["Chinese acquisition wording",/(?:游戏文件|遊戲檔案|已安装的游戏|已安裝的遊戲|提取的游戏数据|擷取的遊戲資料)/u],
  ["French acquisition wording",/(?:fichiers? du jeu|jeu installé|données extraites)/iu],
  ["Italian acquisition wording",/(?:file di gioco|gioco installato|dati estratti)/iu],
  ["German acquisition wording",/(?:Spieldatei(?:en)?|installierten Spiels?|extrahierten Spieldaten)/iu],
  ["Spanish acquisition wording",/(?:archivos? del juego|juego instalado|datos extraídos)/iu],
  ["Portuguese acquisition wording",/(?:arquivos? do jogo|jogo instalado|dados extraídos)/iu],
  ["Russian acquisition wording",/(?:файл(?:ов|ы|ами)? игры|установленной игры|извлечённых данных)/iu],
  ["Indonesian acquisition wording",/(?:file game|game yang terpasang|data ekstraksi)/iu],
  ["Thai acquisition wording",/(?:ไฟล์เกม|เกมที่ติดตั้ง|ข้อมูลที่สกัด)/u],
  ["Turkish acquisition wording",/(?:oyun dosya(?:sı|ları|larından)|kurulu oyun|çıkarılan oyun ver)/iu],
  ["Vietnamese acquisition wording",/(?:tệp trò chơi|trò chơi đã cài|dữ liệu trích xuất)/iu],
  ["Polish acquisition wording",/(?:plik(?:i|ach|ów)? gry|zainstalowanej gry)/iu],
];

const files=[];
async function collect(target){
  const info=await stat(target);
  if(info.isDirectory()){
    for(const entry of await readdir(target))await collect(path.join(target,entry));
    return;
  }
  if(textExtensions.has(path.extname(target).toLowerCase())||path.basename(target)==="site.webmanifest")files.push(target);
}

for(const relative of publicSourceRoots)await collect(path.join(root,relative));
for(const relative of publicSourceFiles)await collect(path.join(root,relative));
if(!process.argv.includes("--source-only"))try{await collect(path.join(root,"dist"))}catch(error){if(error.code!=="ENOENT")throw error}

const violations=[];
for(const file of files){
  const relative=path.relative(root,file).replaceAll("\\","/");
  for(const [label,pattern] of patterns){
    pattern.lastIndex=0;
    if(pattern.test(relative))violations.push(`${relative}: filename contains ${label}`);
  }
  const value=await readFile(file,"utf8");
  for(const [label,pattern] of patterns){
    pattern.lastIndex=0;
    const match=pattern.exec(value);
    if(!match)continue;
    const line=value.slice(0,match.index).split(/\r?\n/).length;
    violations.push(`${relative}:${line}: ${label} (${JSON.stringify(match[0])})`);
  }
}

if(violations.length)throw new Error(`Public disclosure audit failed:\n${violations.join("\n")}`);
console.log(`Public disclosure audit passed for ${files.length} source and built text artifacts.`);
