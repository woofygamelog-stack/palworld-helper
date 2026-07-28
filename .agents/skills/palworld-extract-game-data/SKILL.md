---
name: palworld-extract-game-data
description: Extract, refresh, normalize, and validate Palworld data and assets from the user's legally installed game files for this repository. Use when working with Palworld PAK assets, build-matched USMAP mappings, CUE4Parse, data tables, localization, item icons or missing-image coverage, direct-versus-derived asset provenance, map textures, map bounds, boss or habitat coordinates, patch diffs, or the repository's private-to-public data import pipeline.
---

# Palworld Game Data Extraction

Use the global `extract-game-data`, `build-game-helper-sites`, and project `palworld-helper` skills together with this skill.

## Load context

1. Read `../../../AGENTS.md`, `../../../PALWORLD_HELPER_PLAN_KO.md`, and `../palworld-helper/references/release-checklist.md`.
2. Read [references/pipeline.md](references/pipeline.md) completely.
3. Inspect the extractor, relevant importer, validators, current generated dataset metadata, `.gitignore`, and staged files before changing or publishing data.

## Extract safely

1. Confirm the exact Palworld installation, platform, game build, PAK directory, build-matched `.usmap`, requested entity families, and task-specific private output directory.
2. Limit reads to the confirmed installation and requested assets. Never scan saves, accounts, unrelated libraries, or user profiles.
3. Treat the installed game as read-only. Write only under `private/` or another explicitly approved staging directory outside the game installation.
4. Stop on missing mappings, encryption, DRM, authentication, anti-cheat, protected-memory access, or any access-control workaround. Never guess decoded fields.
5. Record the `.usmap` hash and prove compatibility by decoding representative table, texture, and map packages before a broad run. A mapping that decodes only some packages is not accepted as build-compatible.
6. Run the repository-owned CUE4Parse extractor with explicit absolute inputs. Preserve its raw JSON, source images, manifest, logs, local paths, and fingerprints as private artifacts.
7. Treat `FName` values such as item `IconName` as lookup keys, not asset paths. Follow authoritative DataTable, Blueprint/CDO, soft-object, redirector, material, sprite, and atlas references before using filename heuristics.
8. Keep discovery candidates separate from verified sources. A filename match or successful decode alone does not prove that a texture belongs to an item.
9. Extend `tools/game-data-extractor/Program.cs` when new game-file facts are needed. Extract the narrowest authoritative table or asset and keep output deterministic.

## Normalize and publish

1. Update the relevant `scripts/import-*.mjs` generator instead of hand-editing generated public JSON.
2. Preserve raw identifiers internally for joins and validation, but expose only localized names, approved player-facing numbers, and project-owned public slugs.
3. Preserve `missing`, `unknown`, `notApplicable`, and numeric zero as distinct states.
4. Attach internal `gameBuild`, extraction time, source type, hashes where appropriate, and verification status. Keep this provenance out of visible UI, SEO, structured data, sitemap, and public assets.
5. Publish only rights-reviewed normalized JSON and optimized images required by the site. Never publish raw archives, `.usmap`, extraction logs, private manifests, local paths, source URLs, tool binaries, or installed-game exports.
6. Use community data only for discovery or discrepancy detection. Do not promote it to verified game-file data without independent validation.
7. Classify every published image as `direct`, `shared-official`, `atlas-official`, or `derived-official`. Never label copied or composed images as directly extracted. Keep `missing` distinct from every publishable class.
8. Use an official-derived image only when no authoritative unique icon resolves and the product explicitly requires complete visual coverage. Use only extracted official assets, record the deterministic source mapping in repository code, and do not substitute a semantically unrelated category image silently.

## Validate changes

1. Check schema, required fields, stable keys, duplicates, referential integrity, numeric ranges, locale coverage, image decoding and dimensions, and deterministic ordering.
2. For image work, validate file count, manifest count, per-entity flags, nonzero dimensions, nontransparent pixels, duplicate hashes, and representative visual samples. Explain expected shared hashes instead of treating them as unique icons.
3. For maps, verify world bounds, axes, origin, scale, texture alignment, per-world marker bounds, and at least two known landmark conversions before publishing coordinates.
4. Compare the new output with the last accepted build. Fail closed on unexplained removals, large count changes, locale loss, schema drift, broken references, or unexpected image-coverage loss.
5. Run the relevant import command, `npm run typecheck`, `npm test`, `npm run check:i18n`, and `npm run build`.
6. Inspect the built artifact and staged file list for local paths, private data, logs, source URLs, raw object identifiers, secrets, and accidental build output.

## Report

Report the game build, exact extracted families, mapping hash and compatibility evidence, normalized outputs, count and diff results, checks passed, blocked assets or fields, and anything derived, community-sourced, or unverified. For images, report direct, shared, atlas, derived, and missing counts separately. Never describe complete UI coverage as complete source extraction, and never imply that a successful decode proves a gameplay formula or coordinate transform without representative validation.
