# Palworld Helper extraction pipeline

## Contents

- Repository boundaries
- Extractor invocation and modes
- Current raw outputs
- Normalization routing
- Reference-chain extraction patterns
- Item-image resolution and coverage
- Entity-family publication boundaries
- Map-specific checks
- Known refresh blockers
- Patch refresh gates

## Repository boundaries

- Extractor source: `tools/game-data-extractor/`
- Private raw extraction: `private/extracted/build-<build>/` or a task-specific sibling
- Private provenance: `private/provenance/`
- Public normalized data: `public/data/`
- Public optimized assets: `public/assets/`
- Normalizers: `scripts/import-pal-data.mjs`, `scripts/import-item-data.mjs`, `scripts/import-skill-data.mjs`, `scripts/import-map-data.mjs`, `scripts/import-world-map-points.mjs`, `scripts/import-npcs.mjs`, `scripts/import-dungeon-data.mjs`, `scripts/import-technology-data.mjs`, `scripts/import-structure-data.mjs`, `scripts/import-element-data.mjs`, `scripts/import-expedition-data.mjs`, `scripts/import-health-data.mjs`, `scripts/import-iv-data.mjs`, `scripts/import-images.mjs`
- Validators: `tests/run.mjs`, `scripts/validate-map-data.mjs`, `scripts/validate-npc-data.mjs`, `scripts/validate-dungeon-data.mjs`, `scripts/validate-expedition-data.mjs`, `scripts/check-item-images.mjs`, `scripts/check-i18n.mjs`, `scripts/check-built.mjs`

The ignore rules must continue to exclude `private/`, raw game exports, `.env`, `node_modules/`, `dist/`, logs, and extractor `bin/` and `obj/` directories.

## Extractor invocation

Build and run the repository extractor with three explicit arguments and, for scoped refreshes, an explicit fourth mode:

```powershell
dotnet build tools/game-data-extractor/GameDataExtractor.csproj
dotnet run --project tools/game-data-extractor/GameDataExtractor.csproj -- "<Palworld Paks directory>" "<build-matched Mappings.usmap>" "<private output directory>"
dotnet run --project tools/game-data-extractor/GameDataExtractor.csproj -- "<Palworld Paks directory>" "<build-matched Mappings.usmap>" "<private output directory>" "<mode>"
```

Supported modes are `full`, `npc`, `dungeon`, `technology`, `structure`, `element`, `health`, `expedition`, `quest`, and `calculator`. Use the narrowest mode that owns the requested source facts. The `health` mode extracts worker-event rows, sickness rows, referenced event-class defaults, official condition/SAN text, item descriptions, UI-common text, and a dedicated manifest; it does not reuse the broader technology extraction. The `quest` mode extracts the quest and location tables, every referenced quest-definition CDO, every referenced quest-block CDO, official UI-common text for all 17 locales, discovery inventories, and a dedicated manifest. The `calculator` mode inventories only breeding, capture, IV/stat, and production-related DataTables, Blueprint functions, type mappings, and matching core Pal/item/recipe tables for private formula verification; source discovery from that mode is not by itself runtime proof.

The current extractor uses CUE4Parse with Unreal Engine 5.1 compatibility and requires a build-compatible `.usmap`. A missing or incompatible mapping is a hard stop; do not reuse an older mapping merely because some assets decode. For build `24181527`, current mode importers accept mapping SHA-256 `C3107655159520375F7F75DF5812E9A9976458C56B4F619C7FD0AAF0D42C7851`; a patch must establish and record a new accepted hash instead of weakening that gate.

The extractor initializes Oodle from its application output. Do not copy or commit game/runtime binaries merely to make a local run reproducible.

## Current raw outputs

| Family | Raw output | Source purpose |
|---|---|---|
| Items | `items.raw.json` | Legal item facts and icon references |
| Recipes | `recipes.raw.json` | Products, ingredients, output counts and work values |
| Item localization | `item-names.raw.json`, `item-descriptions.raw.json` | Official shipped item text |
| Skills and Pal text | `skill-names.raw.json`, `skill-descriptions.raw.json`, `pal-long-descriptions.raw.json`, `pal-short-descriptions.raw.json`, `partner-skill-append.raw.json` | Official shipped localized text |
| Pal parameters | `pal-parameters.raw.json` | Pal parameter joins and partner-skill mapping |
| Pal drops | `pal-drops.raw.json`, `pal-drops-common.raw.json` | Level-specific Pal item drops, rates, and quantity ranges |
| Bosses | `boss-spawns.raw.json` | Boss Pal, level and Unreal world location |
| Habitats | `pal-spawner-placement.raw.json`, `pal-wild-spawners.raw.json` | Field placement and spawn composition |
| Maps | `map.raw.json`, `map-meta.raw.json`, `map-worlds-meta.raw.json` | Palpagos/World Tree bounds and texture metadata |
| Map images | `world-map.webp`, `tree-map.webp` | Extracted 8192-pixel source maps for web derivatives |
| Item images | `item-icons/*.webp` | Decoded item icon textures |
| Map UI images | `map-icons/*.webp` | Decoded in-game fast-travel, tower, dungeon, bounty, treasure, and oil-rig marker textures |
| NPCs | `unique-npcs.raw.json`, item/Pal shop tables, talk/event tables, `human-names.raw.json`, `unique-npc-text.raw.json`, `npc-talk-text.raw.json`, `npc-manifest.json` | Official NPC definitions, roles, trade inputs, event relations, and 17-locale text; world placements come from separate actor chunks |
| Dungeons | `dungeon-*.raw.json`, `field-lottery-names.raw.json`, `item-lottery.raw.json`, `dungeon-reward-class-defaults.raw.json`, `dungeon-level-actors.raw.json`, `dungeon-manifest.json` | Dungeon rows, encounters, item pools, referenced reward CDOs, entrance defaults, and candidate level actors while preserving source stages |
| Technology | `technology.raw.json`, `lab-research.raw.json`, build-object tables, localized technology/research/build text, `technology-building-icon-sources.raw.json`, `technology-manifest.json` | Regular/ancient unlock rows, prerequisites, lab research, tower requirements, and directly referenced building icons |
| Structures | `build-objects.raw.json`, map-object/product/farm/assign tables, localized build/category text, `structure-icon-sources.raw.json`, `structure-manifest.json` | Technology-linked build objects, materials, categories, restrictions, verified production candidates, and direct icon references |
| Elements | `pal-parameters.raw.json`, `ui-common.raw.json`, `element-icons/*.webp`, `element-matchup-chart.webp`, widget defaults, `element-runtime-blueprint-exports.raw.json`, `element-damage-settings.raw.json`, `element-damage-mapping-owners.raw.json`, `element-damage-mapping-definitions.raw.json`, `element-manifest.json` | Official localized element names, Pal/skill coverage inputs, direct icons, the installed game's qualitative matchup chart, and private build-matched damage-rule evidence |
| Health | `health-worker-events.raw.json`, `health-sickness.raw.json`, `health-worker-event-text.raw.json`, `health-worker-event-class-defaults.raw.json`, `item-descriptions.raw.json`, `ui-common.raw.json`, `health-manifest.json` | SAN-related worker-event source values, sickness modifiers and effective medicine ranks, referenced event defaults, official 17-locale names/descriptions, and medicine-description inputs |
| Expeditions | `expeditions.raw.json`, `expedition-challenges.raw.json`, field/item lottery tables, `expedition-text.raw.json`, `expedition-images/*.webp`, `expedition-manifest.json` | Mission conditions, base duration/strength, reward slots and quantities, official text, and directly extracted stage images |
| Quests | `quests.raw.json`, `quest-locations.raw.json`, `quest-class-defaults.raw.json`, `quest-block-class-defaults.raw.json`, `quest-manager-defaults.raw.json`, `ui-common.raw.json`, `npc-talk-text.raw.json`, `quest-data-assets.raw.json`, `quest-tables.raw.json`, `quest-manifest.json` | Quest kinds and definitions, active manager configuration, authored block order, objectives, common rewards, prerequisites, fixed-location references, official 17-locale UI and quest text, and private discovery evidence |
| Calculator verification | `calculator-assets.raw.json`, `calculator-tables.raw.json`, `calculator-runtime-blueprint-assets.raw.json`, `calculator-runtime-blueprint-exports.raw.json`, `calculator-mapping-definitions.raw.json`, core Pal/item/recipe tables, `calculator-manifest.json` | Private build-matched discovery evidence for breeding, capture, IV/stat, and production formula sources; every publishable formula still requires an independent runtime route and golden cases |
| Discovery inventories | `text-assets.raw.json`, `skill-text-assets.raw.json`, `map-point-assets.raw.json`, `world-placement-assets.raw.json`, `map-ui-icon-assets.raw.json` | Candidate asset discovery only; paths are not publishable facts |
| Private manifest | `manifest.json` | Extraction time and raw counts; never publish directly |

## Normalization routing

- Run `npm run data:import:items` after item, recipe, item-text, map metadata, or world-map changes. Set `PAL_EXTRACTED_DATA` and `PAL_GAME_BUILD` when not using the default private path.
- Run `npm run data:import:skills` after skill text, Pal descriptions, Pal parameters, or element/skill source changes. Set `PAL_EXTRACTED_SOURCE`, `PAL_DATA_SOURCE`, and `PAL_GAME_BUILD` explicitly for refresh workspaces.
- Run `npm run data:import:map` after boss, spawner, world-bound, or map-texture changes. Verify that the importer selects the intended refresh directory instead of silently falling back.
- Run `npm run data:import:map-points` after verified world-actor chunks or public map-point relations change. Re-run it after NPC or dungeon imports when their verified placements are merged into the shared map-point dataset.
- Run `npm run data:import:pals` only with the expected local Pal export and the separately tracked community-normalized breeding source. Keep its community provenance explicit; local ID agreement does not independently verify breeding outcomes.
- Run `npm run data:import:images` after normalized Pal/item lists exist. Image coverage flags in public JSON must match files actually copied to `public/assets/`.
- Run `npm run data:complete:item-images` only after direct extraction/import has been audited. It creates the reviewed official-derived presentation layer; it does not convert those images into direct extraction results.
- Run `npm run data:npcs` after the `npc` mode output, build-matched world-actor chunks, and public Pal/item/map catalogs exist. The current NPC importer fixes the accepted build and private directory names in source; for another workspace or build, add explicit source/build inputs to the importer instead of copying data into those defaults.
- Run `npm run data:import:dungeons` after the `dungeon` mode output, map refresh, world-actor chunks, and public Pal/item/map catalogs exist. Set `PAL_DUNGEON_SOURCE`, `PAL_MAP_SOURCE`, `PAL_ACTOR_SOURCE`, and `PAL_GAME_BUILD` explicitly for refresh workspaces.
- Run `npm run data:import:technology` after the `technology` mode output and build-matched public item and Pal catalogs exist. Set `PAL_TECHNOLOGY_SOURCE` and `PAL_GAME_BUILD` explicitly.
- Run `npm run data:import:structures` after the `structure` mode output and the matching item, Pal, and technology catalogs exist. Set `PAL_STRUCTURE_SOURCE` and `PAL_GAME_BUILD` explicitly.
- Run `npm run data:import:elements` after the `element` mode output and matching normalized skill data exist. Set `PAL_ELEMENT_EXTRACTED_SOURCE` and `PAL_GAME_BUILD` explicitly. The qualitative relation pairs are transcribed from the hashed official chart; a chart change requires visual review and a mapping update. Keep that chart private and publish only the normalized relationships, direct icons, and an original code-native presentation.
- For numeric or dual-element damage work, prefer the restartable `scripts/run-element-damage-verification.ps1` entry point. It reads the Steam app manifest, rejects incomplete updates, creates a private `build-<build>` workspace, extracts element sources and `BP_PalGameSetting` bytecode, and runs the build-matched source verifier. The bytecode converter waits for a stable parseable UAssetGUI result instead of assuming the child output is immediately complete.
- The source verifier accepts only a reviewed content-addressed `GetWeakScale` function profile and qualitative chart profile. A new build may reuse an already reviewed profile only when the extracted bytes match exactly; a changed function or chart stops automatically for review. Mapping and PAK fingerprints still have to match the same detected installation. Package hashes are recorded as evidence rather than blindly copied from the previous build.
- `npm run data:plan:element-damage-runtime` now emits a machine-only JSONL contract: all five lookup branches, all 405 attacker versus single/unique-dual defender combinations, and representative applied-HP-damage cases. A configured isolated dedicated-server driver writes two fresh sessions without clicks, attacks, or hand-entered values. The runtime validator rejects missing cases, mixed fingerprints, contamination, popup-only damage, and manual-style aggregate samples. Do not populate public numeric multipliers or a dual-element rule unless this generated runtime report passes every gate; a source constant or lookup table by itself remains insufficient publication evidence.
- For IV refreshes, run `npm run data:verify:iv-friendship-bridge` against two complete, independent initialized live-parameter sessions, then run `npm run data:import:iv`. The verifier must cover all 299 current Pal IDs, all 11 public friendship ranks, and the full interaction grid, and must match the float32 calculation and rounding order for every measured value. Use only the safe initialized live stat getters; reject the legacy database save-parameter function route as publication evidence. The importer writes only compact neutral constants, friendship thresholds, and base-stat coefficient maps to `public/data/iv.json`, while session logs and provenance stay private.
- Run `npm run data:import:health` after the `health` mode output and the matching legal item/recipe catalog exist. To use a non-default private source, invoke `node scripts/import-health-data.mjs "<health extraction directory>"`. The importer requires the accepted health manifest mode, locale count, mapping hash, worker-event/sickness row counts, referenced-class success count, and build-matched item/recipe inputs.
- Run `npm run data:import:expeditions` after the `expedition` mode output and matching item, element, structure, and technology catalogs exist. Set `PAL_EXPEDITION_SOURCE` and `PAL_GAME_BUILD` explicitly.
- Do not publish normalized quest data until a dedicated quest importer and validator exist and the public Pal, item, technology, structure, NPC, and map-location catalogs have been refreshed to the same build. The future importer must accept explicit source/build inputs and reject the refresh unless the quest manifest, PAK fingerprint, mapping hash, locale coverage, quest and block reference counts, and every joined public catalog agree on the same build.

Importers may accept environment variables so refreshes do not require changing checked-in absolute paths. Never commit a local installation or staging path.

## Public disclosure boundary

- Acquisition method and provenance are private operational evidence. They may appear only in ignored private manifests and internal instructions; they must not appear in published UI, accessibility copy, SEO/social/structured metadata, public JSON, exports, URLs, filenames, bundled code, console/error messages, screenshots, or public documentation.
- Public metadata must describe only verification state and scope. Use neutral values such as `verified`, `verified-and-runtime`, `partial`, `unverified`, or `unavailable`. Do not publish values such as `game-files`, `game-file-derived`, `extracted`, an installed-copy reference, tool name, archive/mapping extension, local path, or localized equivalent.
- Every importer that writes public JSON must emit neutral public verification values while writing exact acquisition provenance only to its private manifest. A refresh must update the importer, public payload, runtime guards, schema/types, tests, and build assertions together.
- Run `npm run check:public-disclosure` on the public source boundary after normalization and on `dist/` after bundling. The release fails on any direct statement, encoded status, method-bearing filename, tool/path residue, or supported-language disclosure phrase.

## Reference-chain extraction patterns

- Treat candidate asset and candidate DataTable inventories as discovery output only. A table is authoritative only for the fields it directly owns.
- Follow typed references instead of names: DataTable row → `FSoftObjectPath` or soft class → normalized game asset path → Blueprint/CDO or object row → legal item/Pal/build catalog. Record every hop privately and fail or downgrade the field when a required hop is absent.
- For referenced class defaults, record requested, extracted, and failed counts. A family that publishes values from those defaults requires zero failed references for the claimed set.
- Resolve localized inline tags such as item, map-object, character, and UI-common references through matching build catalogs. Remove decorative image tags only after referenced text resolves; reject unresolved tags, placeholder localization keys, and raw enums.
- Preserve lottery tables as stages, pools, slots, candidates, weights, and quantity ranges. A source weight is not a final probability until selection order, independent rolls, caps, and runtime modifiers are verified.
- Decode images from exact serialized table/CDO references or exact reviewed UI asset paths. Keep shared assignments and generated atlases separate from unique direct sources.
- Reject mixed-build joins. Every imported family must match the raw manifest build and mapping gate plus every normalized catalog it joins.

## Item-image resolution and coverage

`DT_ItemDataTable.IconName` is an `FName` lookup key, not a guaranteed texture basename. Resolve item images in this order:

1. Read an authoritative item-icon mapping table or UI resolver when present.
2. Follow Blueprint/CDO properties, `FSoftObjectPath`, object properties, redirectors, sprites, material texture parameters, and atlas metadata.
3. Match exact normalized texture names only as discovery candidates.
4. Confirm each candidate through a serialized reference or a reviewed representative visual comparison before calling it verified.

Scan relevant packages broadly enough to include `InventoryItemIcon`, UI textures, plugins, DLC/update content, materials, sprites, and atlases. Record candidate paths and decode errors privately. Do not publish PAK paths or assume that the first lexical/normalized filename match is correct.

Use these provenance classes:

| Class | Meaning | May satisfy direct extraction? |
|---|---|---|
| `direct` | Unique texture resolved and decoded from the item's authoritative reference | Yes |
| `shared-official` | Game data authoritatively assigns the same official texture to multiple items | Yes, but report sharing |
| `atlas-official` | Authoritative atlas/sprite region cropped from an official texture | Yes |
| `derived-official` | Deterministic copy/composition of already extracted official assets for presentation coverage | No |
| `missing` | No accepted display image | No |

Never use `image: true`, a valid WebP header, or `1891/1891` file coverage alone as proof of direct extraction. The public image manifest must separately total direct and derived counts, while the private manifest retains per-item source class, source key/path, transform, hash, and review status.

For build `24181527`, the accepted presentation baseline is 1,891 item images: 1,815 directly imported and 76 reviewed `derived-official` images. Treat those 76 as technical debt to replace when authoritative references and a compatible mapping become available. Do not report them as newly extracted source icons. Any count drift requires a new audit rather than silently carrying the baseline forward.

Direct extraction and presentation completion are separate gates:

- Direct extraction gate: build-compatible mapping proven, authoritative references resolved, decode failures zero for the claimed direct set, and provenance classes reviewed.
- Presentation gate: every legal item has a valid, nontransparent WebP; flags, files, and manifest agree; known shared hashes are explained; cards, details, calculators, and blueprint overlays issue no missing requests.

If unique icons cannot be resolved, report the blocked count and reason. Only use `derived-official` assets when complete visual coverage is an explicit product requirement. Keep the mapping deterministic in `scripts/complete-item-images.mjs`, use semantically close official assets, visually inspect representative families, and fail when the reviewed 76-item plan drifts.

## Entity-family publication boundaries

### NPCs

- Build NPC definitions from official NPC, shop, talk, request, reward, and display tables; build encounters separately from verified cooked-world actor chunks. Do not merge a definition with a placement merely because their filenames are similar.
- Require complete official 17-locale names for public definitions. Keep excluded dummy, test, legacy, and unresolved rows in private counts and fail when accepted/excluded baselines drift.
- Treat merchant offers, currencies, bundle quantities, Pal pools, and event rewards as independent relations. Every item and Pal must resolve to the matching normalized catalog.
- Keep actor classes and inferred join keys private. Apply the verified surface and parent-component gates before public placement, and keep no-fixed-location NPCs publishable as definitions without inventing coordinates.

### Dungeons

- Preserve dungeon level, spawn-area, enemy group, floor-item lottery, reward-spawner lottery, field lottery, item lottery, pickup, map-object, class-default, and entrance sources as separate stages.
- Publish reward object kinds only after the reward row's soft class resolves to an extracted CDO. Preserve item pools and slot boundaries, and keep final multi-stage probabilities unverified until runtime selection is independently validated.
- Keep rotating entrance candidates `partial` unless active-state semantics and full coverage are verified. Keep fixed entrances, rotating candidates, and interior exits distinct.
- Do not publish dungeon resources from candidate `ULevel` actors until a reviewed level-to-layout mapping succeeds. An empty unparsed actor dump is `unverified`, not `verified-empty`.

### Technology and structures

- Technology rows own level, point cost, regular/ancient kind, prerequisite, unlock target, and research references. Resolve inline official text through item, Pal, map-object, and UI-common catalogs; never expose the template tags or internal keys.
- Resolve building technology icons through `DT_BuildObjectIconDataTable.SoftIcon` or another direct serialized reference. Shared official item icons and reviewed derived item images must retain their existing provenance classes.
- Publish structures only when a current technology row directly unlocks the build object and the build object is not marked in development. Join construction materials, restrictions, energy fields, stats, and directly keyed production rows without inferring missing relationships.
- Keep farm-crop and assignment rows omitted when they lack a direct build-object foreign key. Do not reinterpret all-zero capacity fields or similarly ambiguous values as verified storage semantics.

### Elements, health, and expeditions

- Treat the installed official element matchup chart as a qualitative, hashed private validation source. Its transcribed directed relationships do not verify numeric multipliers, inverse resistance values, or dual-element rules. A build-matched `GetWeakScale` bytecode lookup may establish source expectations, but the calculation path and combined-element aggregation still require independent controlled runtime cases. Do not copy the chart into public assets; render normalized relationships with project-owned HTML/CSS.
- Build SAN behavior entries from active `DT_PalBaseCampWorkerEvent` rows and official localized event text. Preserve authored row order and label `TriggerSanity` only as a direct SAN source value; do not describe it as an exact inequality, probability, or guaranteed trigger because runtime event selection is not independently verified.
- Build health conditions from `DT_PalBaseCampWorkerSick`, official UI localization, effective item ranks, resolved medicine descriptions, and verified item/recipe joins. Publish `WorkSpeed`, `MoveSpeed`, `SatietyDecrease`, and Palbox recovery fields as direct source values while keeping their final runtime calculation/application and cure mechanics explicitly unverified. Exclude `NoneSick` and rank-4 special conditions from ordinary medicine routes unless a verified treatment relation is added.
- Preserve expedition standard/hard rows, visibility/challenge conditions, base duration, required element/count, strength, Pal cap, reward slots, candidate weights, and quantity ranges. Publish final probabilities only after the complete runtime roll process is verified.
- Treat the nine exact expedition stage textures as direct assets and their use across eighteen missions as shared assignments, not eighteen unique source images. Keep effective-duration curves and research/team modifiers unavailable until verified.

### Quests

- Preserve the chain `DT_PalQuestData` row -> `QuestData` soft class -> quest-definition CDO -> authored `QuestBlockGroupList`/`BlockList` -> quest-block CDO. A missing quest definition or block is a hard failure for that quest, and no discovery path or class name may substitute for a missing typed reference.
- Publish only user-facing main or sub quests with complete official title and description text for every supported locale. Exclude hidden quests, editor/test assets, legacy rows, rows without public text, and blocks marked `bHideFromUI`; record all exclusions and fail when their baselines drift.
- Preserve group and block order exactly. Resolve objective text only from the block's localized text reference. Where a block has no explicit objective text, do not generate prose from its class name or completion fields; expose only separately verified structured requirements or mark the objective text unavailable.
- Resolve item, Pal, technology, structure, boss, unique-NPC, and location references only through matching-build normalized catalogs. Keep unresolved relations private and fail closed for any relation claimed as public. Never expose raw row names, enum values, Blueprint names, asset paths, or internal coordinates in labels, URLs, accessibility text, SEO, or analytics.
- Treat `CommonRewardData` as the direct common-reward source. Publish XP and directly represented fixed rewards only after their semantics and references are verified. Do not infer quest-specific drops, dialogue rewards, probabilities, or repeatability from nearby talk/event assets.
- Treat `AutoOrderQuests` as authored follow-up relations, not automatically as the only prerequisite model. Publish prior/next navigation only after every endpoint resolves and the direction is verified against representative in-game cases.
- Keep quest locations separate from the public map until the build-matched location transform and semantic meaning of each marker are verified. A `LocationSettingData` row establishes a typed relation to a quest location, not by itself a public entrance, giver, turn-in, or objective marker.

## Map-specific checks

- Current overworld World Partition placements are cooked as `/_Generated_/` `.umap` cell packages, not `ExternalActors` packages. Enumerate every generated cell deterministically, load its exported `ULevel`, walk `ULevel.Actors`, load each actor's `RootComponent` as a `USceneComponent`, and read the authoritative world position from `GetComponentTransform().Translation`.
- Scan generated cells in restartable chunks and fail closed if any package cannot be parsed. Keep actor class and serialized properties private, then classify public layers from verified classes plus properties; never publish a placement from filename similarity alone.
- Normalize stable public point IDs only after sorting by world, category, coordinates, and subtype. Validate counts, bounds, duplicates, and representative anchors. Dense resource and collectible layers must be disabled initially and rendered only when selected.
- For current cooked cells, field fishing locations are the parent `BP_FishingSpot*` actors with non-zero root transforms; exclude `BP_FishingSpotPalSpawner` child actors and `Dungeon` variants from the overworld fishing layer.
- Classify surface NPCs from `BP_MonoNPCSpawner*` actors and their serialized `HumanName.Key`. `SalesPerson*`, `PalDealer*`, medal/trader subclasses, and `*BossBase_BOSS*` belong to separate merchant, Pal-merchant, and wanted-target layers. Reject dungeon copies below the verified surface elevation threshold instead of deduplicating them into field NPCs.
- Generic `BP_DungeonExit` and `BP_DungeonPortalV2_Exit` actors in the current build are dungeon-interior exits tens of thousands of Unreal units below the surface. Publish only separately verified fixed-entrance or portal-marker actors as overworld dungeon markers.
- Resource spawner classes are also duplicated inside dungeon layers. For build `24181527`, ore, coal, sulfur, and quartz form two disjoint elevation clusters: verified surface nodes are above `Z=-7694`, while dungeon copies are below `Z=-36030`, with no records between `Z=-20000` and `Z=-10000`. Apply a shared `Z > -20000` surface gate before publishing these four layers, retain the raw package and elevation privately, and fail validation if the gap or accepted counts drift after a patch instead of silently reusing the threshold.
- `BP_LevelObject_ItemPickupTower` is an interactive collectible shrine keyed by `ItemPickupRowName`; it is not a generic decorative statue. Keep it separate from Goddess, Anubis, Frostallion, and Jetragon statue actors.
- Preserve egg biome and grade internally and map each verified egg subtype to an extracted egg item icon. Do not expose cooked actor class names as labels, tooltips, URLs, or accessibility text.
- Preserve separate Palpagos and World Tree bounds and textures.
- Classify each marker into exactly one implemented world and reject out-of-bounds points.
- Palworld world coordinates and displayed player-map coordinates use different axes and scale. Keep the transform in one tested function and validate it with multiple known landmarks before changing published coordinates.
- The extracted 8192×8192 map texture is aligned as `imageLeft = (worldY - minY) / (maxY - minY)` and `imageTop = (maxX - worldX) / (maxX - minX)`. The inverse must restore both coordinates within tolerance. Do not map world X directly to CSS left or world Y directly to CSS top.
- Join alpha-Pal UI rows by immutable `CharacterID`/`SpawnerID`; reject NPC boss rows whose character ID is `None`, and require every published Pal ID to resolve to the normalized Pal catalog before icon assignment.
- Export marker textures through CUE4Parse `UTexture2D.Decode` from exact game paths after discovery. Asset-name inventories establish candidates only; successful texture decode plus an explicit semantic mapping is required before publishing an icon.
- Do not infer dungeon, merchant, collectible, resource, fast-travel, or other placements from asset names alone. World-placement actors or another independently verified source are required.
- Generate web tiles with `scripts/generate-map-tiles.mjs`, then validate tile counts, dimensions, seams, world selection, zoom/pan alignment, and marker alignment in a browser.

## Known refresh blockers

- `scripts/import-npcs.mjs` currently hardcodes build `24181527` and its private NPC/actor directory names and does not consume `npc-manifest.json`. Before accepting another NPC refresh, add explicit `PAL_NPC_SOURCE`, `PAL_ACTOR_SOURCE`, and `PAL_GAME_BUILD` inputs and require manifest schema, mode, locale count, mapping hash, and PAK fingerprint checks.
- Dungeon resource publication remains blocked until dungeon level packages have a reviewed level-to-layout mapping. Do not weaken the importer guard that rejects parsed resource actors merely to fill the UI.
- Element relations remain a reviewed transcription of a hashed official UI chart. If the chart hash changes, stop the importer, compare the new chart visually, update directed relations deliberately, and keep numeric rules unavailable unless separately verified. A build-scoped private report may mark the exact `weakCount` lookup source-verified when its function and chart bytes match reviewed content profiles, but runtime application and the two-defender aggregation rule remain blocked until that same build's complete machine-generated controlled-case evidence passes.

## Patch refresh gates

1. Record the installed game build and fingerprint relevant PAK indexes or extracted inputs.
2. Extract into a new build- or task-specific private directory; do not overwrite the last accepted raw set.
3. Normalize to a comparison output and produce structured count, schema, locale, entity, relationship, image, and coordinate diffs.
4. Review unexpected changes before replacing public data.
5. Run golden cases for affected calculators and representative entity/map records.
6. Keep unsupported or unverified fields unavailable instead of carrying stale values forward silently.
7. Stage only extractor/importer source, verified normalized public data, and approved optimized assets.
