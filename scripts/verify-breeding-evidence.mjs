import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) throw new Error(`Invalid argument near ${key ?? "<end>"}.`);
  args.set(key.slice(2), value);
}

const root = process.cwd();
const sourceRoot = path.resolve(root, args.get("source-root") ?? "private/extracted/build-24467282-calculators");
const publicPath = path.resolve(root, args.get("public-data") ?? "public/data/pals.json");
const outputPath = path.resolve(root, args.get("output") ?? "private/verification/calculators/build-24467282/breeding-report.json");
const manifestPath = path.join(sourceRoot, "calculator-manifest.json");
const parameterPath = path.join(sourceRoot, "pal-parameters.raw.json");
const tablesPath = path.join(sourceRoot, "calculator-tables.raw.json");

const [manifestBytes, parameterBytes, tablesBytes, publicBytes] = await Promise.all([
  readFile(manifestPath),
  readFile(parameterPath),
  readFile(tablesPath),
  readFile(publicPath),
]);
const manifest = JSON.parse(manifestBytes);
const parameters = JSON.parse(parameterBytes);
const tables = JSON.parse(tablesBytes);
const published = JSON.parse(publicBytes);

if (manifest.mode !== "calculator" || manifest.runtimeBlueprintFailureCount !== 0) {
  throw new Error("Calculator evidence extraction is incomplete.");
}
if (String(published.meta.gameBuild) !== path.basename(sourceRoot).match(/\d+/)?.[0]) {
  throw new Error(`Build mismatch: ${published.meta.gameBuild} does not match ${sourceRoot}.`);
}
if (published.pals.length !== 299 || published.pairs.length !== 44_851) {
  throw new Error(`Unexpected published breeding baseline: ${published.pals.length} Pals and ${published.pairs.length} rows.`);
}

const specialTable = tables.tables?.["Pal/Content/Pal/DataTable/Character/DT_PalCombiUnique"];
if (!specialTable) throw new Error("The special breeding table is missing.");

const palById = new Map(published.pals.map(pal => [pal.id, pal]));
const palByLowerId = new Map(published.pals.map(pal => [pal.id.toLowerCase(), pal]));
const sourcePal = new Map();
for (const pal of published.pals) {
  const source = parameters[pal.id];
  if (!source) throw new Error(`Published Pal ${pal.id} is missing from the build-matched parameter table.`);
  sourcePal.set(pal.id, {
    id: pal.id,
    index: pal.i,
    rank: source.CombiRank,
    priority: source.CombiDuplicatePriority,
    ignored: source.IgnoreCombi,
    variant: pal.variant,
  });
}

const enumValue = (value) => String(value).split("::").at(-1);
const canonicalPalId = (value) => palByLowerId.get(enumValue(value).toLowerCase())?.id ?? enumValue(value);
const genderValue = (value) => {
  const gender = enumValue(value);
  if (gender === "None") return null;
  if (gender === "Male") return "MALE";
  if (gender === "Female") return "FEMALE";
  throw new Error(`Unsupported breeding gender ${value}.`);
};
const allSpecialRows = Object.entries(specialTable).map(([rowId, row]) => ({
  rowId,
  parentA: canonicalPalId(row.ParentTribeA),
  genderA: genderValue(row.ParentGenderA),
  parentB: canonicalPalId(row.ParentTribeB),
  genderB: genderValue(row.ParentGenderB),
  child: canonicalPalId(row.ChildCharacterID),
}));
const specialRows = allSpecialRows.filter(row => palById.has(row.parentA) && palById.has(row.parentB) && palById.has(row.child));
const excludedSpecialRows = allSpecialRows.filter(row => !specialRows.includes(row));
const specialChildren = new Set(specialRows.map(row => row.child));
const generalCandidates = [...sourcePal.values()].filter(pal => !pal.ignored && !specialChildren.has(pal.id));

const genderMatches = (actual, expected) => expected === null || actual === expected;
const resolveSpecial = (parentA, genderA, parentB, genderB) => specialRows.find(row =>
  (row.parentA === parentA.id && row.parentB === parentB.id && genderMatches(genderA, row.genderA) && genderMatches(genderB, row.genderB))
  || (row.parentA === parentB.id && row.parentB === parentA.id && genderMatches(genderB, row.genderA) && genderMatches(genderA, row.genderB))
);
const resolveChild = (parentA, genderA, parentB, genderB) => {
  if (parentA.id === parentB.id) return parentA;
  const special = resolveSpecial(parentA, genderA, parentB, genderB);
  if (special) return sourcePal.get(special.child);
  const targetRank = Math.floor((parentA.rank + parentB.rank + 1) / 2);
  return generalCandidates.toSorted((left, right) =>
    Math.abs(left.rank - targetRank) - Math.abs(right.rank - targetRank)
    || right.priority - left.priority
    || Number(left.variant) - Number(right.variant)
    || left.id.localeCompare(right.id)
  )[0];
};

const generated = [];
const pals = [...sourcePal.values()].toSorted((left, right) => left.index - right.index);
for (let leftIndex = 0; leftIndex < pals.length; leftIndex += 1) {
  for (let rightIndex = leftIndex; rightIndex < pals.length; rightIndex += 1) {
    const parentA = pals[leftIndex];
    const parentB = pals[rightIndex];
    const femaleMale = resolveChild(parentA, "FEMALE", parentB, "MALE");
    const maleFemale = resolveChild(parentA, "MALE", parentB, "FEMALE");
    if (femaleMale.id === maleFemale.id) {
      generated.push([parentA.index, parentB.index, femaleMale.index, "WILDCARD", "WILDCARD"]);
    } else {
      generated.push([parentA.index, parentB.index, femaleMale.index, "FEMALE", "MALE"]);
      generated.push([parentA.index, parentB.index, maleFemale.index, "MALE", "FEMALE"]);
    }
  }
}

const canonicalRow = ([parentA, parentB, child, genderA, genderB]) => {
  if (parentA <= parentB) return `${parentA}:${genderA}|${parentB}:${genderB}->${child}`;
  return `${parentB}:${genderB}|${parentA}:${genderA}->${child}`;
};
const generatedKeys = new Set(generated.map(canonicalRow));
const publishedKeys = new Set(published.pairs.map(canonicalRow));
const missing = [...publishedKeys].filter(key => !generatedKeys.has(key));
const unexpected = [...generatedKeys].filter(key => !publishedKeys.has(key));
const duplicateGenerated = generated.length - generatedKeys.size;
const duplicatePublished = published.pairs.length - publishedKeys.size;

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const report = {
  meta: {
    schema: 1,
    gameBuild: String(published.meta.gameBuild),
    generatedAt: new Date().toISOString(),
    status: missing.length === 0 && unexpected.length === 0 && duplicateGenerated === 0 && duplicatePublished === 0 ? "verified" : "failed",
  },
  inputs: {
    mappingHash: manifest.mappingHash,
    manifestHash: sha256(manifestBytes),
    parameterTableHash: sha256(parameterBytes),
    calculatorTablesHash: sha256(tablesBytes),
    publishedBreedingHash: sha256(publicBytes),
  },
  coverage: {
    palCount: pals.length,
    unorderedParentPairCount: pals.length * (pals.length + 1) / 2,
    sourceSpecialRowCount: allSpecialRows.length,
    eligibleSpecialRowCount: specialRows.length,
    excludedSpecialRowCount: excludedSpecialRows.length,
    specialChildCount: specialChildren.size,
    generalCandidateCount: generalCandidates.length,
    generatedRowCount: generated.length,
    publishedRowCount: published.pairs.length,
  },
  verification: {
    sourceExtractionFailures: manifest.runtimeBlueprintFailureCount,
    missingPublishedRows: missing.length,
    unexpectedGeneratedRows: unexpected.length,
    duplicateGeneratedRows: duplicateGenerated,
    duplicatePublishedRows: duplicatePublished,
    exactRowMatch: missing.length === 0 && unexpected.length === 0 && duplicateGenerated === 0 && duplicatePublished === 0,
  },
  discrepancies: { missing: missing.slice(0, 100), unexpected: unexpected.slice(0, 100) },
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (report.meta.status !== "verified") {
  throw new Error(`Breeding verification failed with ${missing.length} missing and ${unexpected.length} unexpected rows. See ${outputPath}.`);
}
console.log(`Breeding evidence verified ${generated.length} rows across ${pals.length} Pals; report: ${outputPath}`);
