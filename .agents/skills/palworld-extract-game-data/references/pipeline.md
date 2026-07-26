# Palworld Helper extraction pipeline

## Repository boundaries

- Extractor source: `tools/game-data-extractor/`
- Private raw extraction: `private/extracted/build-<build>/` or a task-specific sibling
- Private provenance: `private/provenance/`
- Public normalized data: `public/data/`
- Public optimized assets: `public/assets/`
- Normalizers: `scripts/import-pal-data.mjs`, `scripts/import-item-data.mjs`, `scripts/import-skill-data.mjs`, `scripts/import-map-data.mjs`, `scripts/import-images.mjs`
- Validators: `tests/run.mjs`, `scripts/validate-map-data.mjs`, `scripts/check-i18n.mjs`, `scripts/check-built.mjs`

The ignore rules must continue to exclude `private/`, raw game exports, `.env`, `node_modules/`, `dist/`, logs, and extractor `bin/` and `obj/` directories.

## Extractor invocation

Build and run the repository extractor with three explicit arguments:

```powershell
dotnet build tools/game-data-extractor/GameDataExtractor.csproj
dotnet run --project tools/game-data-extractor/GameDataExtractor.csproj -- "<Palworld Paks directory>" "<build-matched Mappings.usmap>" "<private output directory>"
```

The current extractor uses CUE4Parse with Unreal Engine 5.1 compatibility and requires a build-compatible `.usmap`. A missing or incompatible mapping is a hard stop; do not reuse an older mapping merely because some assets decode.

The extractor initializes Oodle from its application output. Do not copy or commit game/runtime binaries merely to make a local run reproducible.

## Current raw outputs

| Family | Raw output | Source purpose |
|---|---|---|
| Items | `items.raw.json` | Legal item facts and icon references |
| Recipes | `recipes.raw.json` | Products, ingredients, output counts and work values |
| Item localization | `item-names.raw.json`, `item-descriptions.raw.json` | Official shipped item text |
| Skills and Pal text | `skill-names.raw.json`, `skill-descriptions.raw.json`, `pal-long-descriptions.raw.json`, `pal-short-descriptions.raw.json`, `partner-skill-append.raw.json` | Official shipped localized text |
| Pal parameters | `pal-parameters.raw.json` | Pal parameter joins and partner-skill mapping |
| Bosses | `boss-spawns.raw.json` | Boss Pal, level and Unreal world location |
| Habitats | `pal-spawner-placement.raw.json`, `pal-wild-spawners.raw.json` | Field placement and spawn composition |
| Maps | `map.raw.json`, `map-meta.raw.json`, `map-worlds-meta.raw.json` | Palpagos/World Tree bounds and texture metadata |
| Map images | `world-map.webp`, `tree-map.webp` | Extracted 8192-pixel source maps for web derivatives |
| Item images | `item-icons/*.webp` | Decoded item icon textures |
| Map UI images | `map-icons/*.webp` | Decoded in-game fast-travel, tower, dungeon, bounty, treasure, and oil-rig marker textures |
| Discovery inventories | `text-assets.raw.json`, `skill-text-assets.raw.json`, `map-point-assets.raw.json`, `world-placement-assets.raw.json`, `map-ui-icon-assets.raw.json` | Candidate asset discovery only; paths are not publishable facts |
| Private manifest | `manifest.json` | Extraction time and raw counts; never publish directly |

## Normalization routing

- Run `npm run data:import:items` after item, recipe, item-text, map metadata, or world-map changes. Set `PAL_EXTRACTED_DATA` and `PAL_GAME_BUILD` when not using the default private path.
- Run `npm run data:import:skills` after skill text, Pal descriptions, Pal parameters, or element/skill source changes. Set `PAL_EXTRACTED_SOURCE`, `PAL_DATA_SOURCE`, and `PAL_GAME_BUILD` explicitly for refresh workspaces.
- Run `npm run data:import:map` after boss, spawner, world-bound, or map-texture changes. Verify that the importer selects the intended refresh directory instead of silently falling back.
- Run `npm run data:import:pals` only with the expected local Pal export and the separately tracked community-normalized breeding source. Keep its community provenance explicit; local ID agreement does not independently verify breeding outcomes.
- Run `npm run data:import:images` after normalized Pal/item lists exist. Image coverage flags in public JSON must match files actually copied to `public/assets/`.

Importers may accept environment variables so refreshes do not require changing checked-in absolute paths. Never commit a local installation or staging path.

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

## Patch refresh gates

1. Record the installed game build and fingerprint relevant PAK indexes or extracted inputs.
2. Extract into a new build- or task-specific private directory; do not overwrite the last accepted raw set.
3. Normalize to a comparison output and produce structured count, schema, locale, entity, relationship, image, and coordinate diffs.
4. Review unexpected changes before replacing public data.
5. Run golden cases for affected calculators and representative entity/map records.
6. Keep unsupported or unverified fields unavailable instead of carrying stale values forward silently.
7. Stage only extractor/importer source, verified normalized public data, and approved optimized assets.
