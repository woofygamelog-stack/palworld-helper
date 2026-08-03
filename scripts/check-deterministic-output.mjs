import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const mode = process.argv[2];
if (!new Set(["--record", "--verify"]).has(mode)) throw new Error("Use --record or --verify");

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target, root));
    else if (entry.isFile()) files.push(path.relative(root, target).replaceAll("\\", "/"));
  }
  return files;
}

const dist = path.resolve("dist");
const manifestPath = path.resolve("private", "planning", "deterministic-build.json");
const files = await listFiles(dist);
const entries = [];
for (const relativePath of files) {
  const contents = await readFile(path.join(dist, relativePath));
  entries.push({ path: relativePath, bytes: contents.length, sha256: createHash("sha256").update(contents).digest("hex") });
}
const aggregate = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
const manifest = { schema: 1, fileCount: entries.length, aggregate, entries };

if (mode === "--record") {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Recorded deterministic build baseline: ${files.length} files, ${aggregate}.`);
} else {
  const baseline = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.deepEqual(manifest, baseline, "Two consecutive production builds must have identical paths, byte sizes, and contents");
  console.log(`Verified deterministic build output: ${files.length} files, ${aggregate}.`);
}
