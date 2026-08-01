---
name: palworld-helper
description: Build, modify, review, or plan the Palworld Helper project, including its interactive maps, Pal and item databases, breeding/capture/IV/crafting/production/base/condensing calculators, team builder, guides, dedicated-server tools, official 17-language localization, search, accessibility, SEO, Analytics, Search Console, AdSense, data extraction, patch updates, testing, and static Cloudflare Pages delivery. Use for any task in this repository that affects Palworld facts, data, images, formulas, routes, UI, content, integrations, or releases.
---

# Palworld Helper

Follow the repository `AGENTS.md` and the global `build-game-helper-sites` skill together with this skill.

For any task that inspects, extracts, refreshes, normalizes, or validates installed Palworld game files or derived assets, also use the project `palworld-extract-game-data` skill and the global `extract-game-data` skill.

## Load project context

1. Read `../../../AGENTS.md` completely.
2. Read `../../../PALWORLD_HELPER_PLAN_KO.md` when the task affects product scope, information architecture, page requirements, formulas, data models, localization, design, SEO, integrations, milestones, or release priority.
3. Read [references/release-checklist.md](references/release-checklist.md) before implementing or reviewing a release-facing change.
4. Inspect existing source-of-truth data pipelines, project configuration, routes, design tokens, localization catalogs, tests, and hosting configuration before editing.

## Classify the task

Classify it as one or more of:

- game data or asset acquisition
- calculator or algorithm
- map or discovery
- localization or content
- UI, theme, or accessibility
- SEO
- Analytics, Search Console, or AdSense
- server tooling
- deployment or release

Apply every matching section of `AGENTS.md` and the release checklist. Keep the implementation within the user's requested scope.

## Work from verified sources

1. Prefer reproducible extraction from the user's legally installed game files.
2. Use official Palworld/Pocketpair sources to fill or explain gaps.
3. Use community sources only to discover features or discrepancies, then independently verify publishable facts.
4. Normalize values into versioned generated data with immutable official IDs.
5. Update the generator or mapping rather than patching generated files.
6. Mark unknown or unverified values explicitly; never infer missing facts.

For patch updates, create a structured diff, identify affected entities and calculators, rerun golden tests, and show stale-data warnings until verification is complete.

### Verify exact element damage

For any change to element multipliers, same-element behavior, Neutral exceptions, or compound defender rules, read and follow [references/element-damage-verification.md](references/element-damage-verification.md). Use the repository's automated verifier and fail-closed importer; do not replace live damage-route evidence with a UI chart, static data lookup, or manual HP sampling. Keep machine evidence private and publish only normalized values whose readiness gates pass.

## Implement calculator changes

1. Locate the authoritative inputs and build version.
2. Express the calculation as a pure versioned function where practical.
3. Encode exceptions before general rules.
4. Preserve exact rounding order and distinguish ranges from exact values.
5. Add verified golden cases, boundaries, invalid inputs, and old-version rejection tests.
6. Expose assumptions and scoring factors in the UI without presenting them as game facts.

For dependency calculators, merge converging demand before rounding process counts, consume owned inventory once per node, reject cycles and non-positive values, and stop at ambiguous multi-recipe intermediates unless a specific recipe is selected.

Do not publish capture-rate, IV, production-time, or similar inferred formulas as exact until their constants and rounding behavior are verified for the supported build.

## Implement user-facing changes

1. Add all visible strings to all supported locales in the same change.
2. Use official localized game terminology; record non-official translation provenance.
3. Use locale-prefixed routes and the project locale resolution order.
4. Keep search, sorting, filter state, themes, keyboard use, focus, empty/error states, and 44px touch targets correct. Preserve the shared-header theme picker contract: its current-preference trigger uses the monitor/system, sun/light, or moon/dark icon; one activation exposes all three icon-and-localized-label choices; the selected choice is programmatically identified; and a binary or unlabeled cycle control is not an acceptable replacement.
5. Add localized page metadata, canonical, alternates, sitemap behavior, and structured data where the page is indexable.
6. Keep ads distinct from and away from primary controls.
7. Add implemented collection/entity routes to client routing, canonical/hreflang output, sitemap, prerender selection, and internal linking together. Classify each family as static, prerendered, client, or hybrid and reject thin HTML copies.

### Keep acquisition methods private

1. Describe public information only with neutral verification language such as `verified`, `reviewed`, `partial`, `unverified`, or `unavailable`. Never mention or imply game files, installed copies, archives, extraction, unpacking, data mining, reverse engineering, tooling, or transformation methods in any shipped or publishable surface.
2. Treat public JSON and client-side validation strings as public copy. Public `verification`, `provenance`, status, ID, data-attribute, filename, and URL values must not encode acquisition labels such as `game-files`, `game-file-derived`, `extracted`, tool names, local path shapes, or localized equivalents.
3. Keep exact acquisition evidence only in ignored private manifests and internal operational instructions. Do not invent a different public source story; replace the disclosure with a neutral statement about accuracy, scope, freshness, or verification status.
4. When changing a public dataset, update its generator, generated JSON, runtime guards, types, tests, and build checks in the same change so an old acquisition-bearing enum cannot return on refresh.
5. Run `npm run check:public-disclosure` against source-facing public files and the final `dist/` artifact. Inspect any match manually, and do not waive a match merely because it is hidden from the visible page or appears only in a bundle, JSON response, metadata field, console message, accessibility string, or source map.

For maps, provide both the visual map and an equivalent marker result list. For large datasets, split static payloads and avoid blocking initial rendering.

For this project:

- Keep build/version metadata internal for validation and provenance; remove it from public UI, SEO copy, and structured data.
- Default the Pal collection to official Paldeck-number order with deterministic variant placement.
- Treat official elements, rarity, progression, item categories, and subtypes as source data. Do not invent performance tiers without an explicit versioned rubric.
- Build implemented Pal/item detail pages as first-class localized routes and link them from collections, calculators, recipes, search results, and map markers.
- Prerender substantial Pal and skill details whose official facts answer independent search intent. Use a deterministic relationship-and-content rubric for a priority item subset and retain the client router plus Cloudflare SPA fallback for valid non-prerendered details and interaction-heavy tools.
- Treat sitemap URL count, physical HTML count, and meaningful initial-HTML SEO coverage as separate invariants. Validate every implemented ID appears once per locale in the sitemap and fail the build if deployed files exceed 80% of the active Cloudflare limit.
- Reuse optimized entity and element images in lists, details, calculators, and map details with explicit fallbacks.
- Keep breeding and crafting calculators on a shared responsive width/layout system.
- Support verified boss, habitat, fast-travel, and local-pin map layers with filters, reset, URL-restorable state, bounded rendering, and an equivalent list.

## Implement integrations safely

- Read identifiers from Palworld-specific configuration.
- Treat Analytics, Search Console, and AdSense as separate integrations.
- Use the owner-approved shared AdSense publisher account only when the repository instructions explicitly name it. Apply the complete declared account bundle: publisher loader, account meta tag, and exact authorized `ads.txt` row; keep placement slots project-specific.
- For each new interaction, consider whether a stable, useful event can be emitted without user-entered values. Track sanitized SPA page views and deduplicate repeated render-driven events.
- Never send search text, server configuration, save content, IPs, secrets, or free-form user data.
- Do not add dynamic Cloudflare services or deploy production without explicit authorization.
- Keep Search Console and AdSense meta declarations in the root redirect as well as localized HTML. Verify the common-account `ads.txt` contents exactly in the production artifact.
- Emit SPA page views only when the pathname changes, except for the one current-page event allowed immediately after consent; data-load rerenders must remain silent.
- Treat Analytics tracking state as successful queue handoff state. Never set the last-page or one-shot-event marker before the sender exists and accepts the event. Regression-test the actual consent-to-initialization sequence, including first delivery, same-path rerender deduplication, and the next pathname navigation; static source matching alone is insufficient.
- Use `https://palworld-helper.woofy.blog` as the production origin. Fail built-output validation when `.example` or another unintended origin appears in canonical, hreflang, Open Graph, sitemap, robots, or structured data.

## Implement server and capture tooling

- Recheck the live official Palworld Server Guide before adding or retaining any server key. Support categorized basic/advanced editing, local INI import, validation, default diff, conflicts, security/performance warnings, and platform instructions without storing or transmitting user content.
- Publish capture probability as exact only after verifying the current build's constants, modifier order, caps, and rounding with authoritative inputs and golden cases. Otherwise keep it unavailable or explicitly experimental.

## Prepare commits and releases

- Confirm repository initialization and remote state rather than assuming Git already exists.
- Before staging, ensure `.gitignore` excludes `private/`, `.env`, dependencies, `dist/`, logs, and extractor/compiler `bin` and `obj` directories.
- Inspect the complete staged name list before committing. Published normalized datasets and approved web assets may be committed; local game exports, provenance manifests, installed-game paths, and build artifacts may not.
- Preserve Cloudflare's connected Git deployment model. Do not add or restore `.github/workflows` deployment automation unless the user explicitly requests it; diagnose the Cloudflare repository/branch connection when pushes are not detected.

## Verify and report

Run checks proportionate to every affected category. Always include localization and production-build checks for release-facing changes. Inspect the built artifact for private provenance, acquisition-method wording, source URLs, local paths, secrets, and unintended runtime services. The public-disclosure audit is mandatory for every release-facing content or data change.

Derive expected sitemap URL counts, physical HTML counts, and initial-HTML coverage from the shared route/entity manifest. Verify direct localized prerendered and SPA-fallback deep links after a fresh load, deployed-file growth headroom, and the absence of public build/version text, placeholder domains, broken images, missing links, or stale sitemap URLs.

Report:

- the supported game/data version
- implemented behavior
- authoritative verification used
- automated and browser checks passed
- checks not run
- remaining experimental or unverified behavior
