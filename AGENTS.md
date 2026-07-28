# Palworld Helper project instructions

## Required skills and source documents

- For every task that creates, changes, reviews, or plans this site, use both the global `build-game-helper-sites` skill and the project-local `palworld-helper` skill.
- Read `PALWORLD_HELPER_PLAN_KO.md` before making architectural, navigation, data, calculator, localization, SEO, monetization, analytics, or deployment decisions.
- Treat this file as the project contract and the plan as the product specification. If they conflict, follow the user's latest explicit instruction first, then this file, and document the resolution.

## Product scope

- Build a static-first Palworld helper that includes maps, calculators, searchable game information, guides, and dedicated-server tools.
- Keep the first public release focused on the P0 scope in the plan. Do not silently remove map, calculator, database, localization, accessibility, or accuracy requirements to ship faster.
- Keep shared packages game-neutral. Put all Palworld locale lists, game data, terminology, aliases, branding, domains, integrations, and deployment values in Palworld-specific configuration.
- Do not add server rendering, authentication, databases, Cloudflare Functions/Workers, or external persistence unless the user explicitly requests dynamic infrastructure.

## Accuracy and data provenance

- Never invent Palworld facts, statistics, formulas, locations, recipes, breeding combinations, drop rates, compatibility claims, or server defaults.
- Acquire facts and assets in this order when legally and technically usable: the user's installed game files, Pocketpair/Palworld official sources, then community sources.
- Use palworld.gg, paldb.cc, forums, Reddit, wikis, and similar community sources for feature research and discrepancy detection only. Verify factual values against game files or an independent authoritative source before publishing them.
- Preserve immutable official IDs and exact source values in normalized generated data. Fix generators or source mappings instead of hand-editing generated output.
- Attach `gameVersion`, extraction date, and verification status to version-sensitive generated datasets.
- Distinguish `missing`, `unknown`, `notApplicable`, and numeric zero. If a value or formula is unverified, label it unavailable or experimental; do not estimate it.
- Keep acquisition manifests, source URLs, installed-game paths, extraction logs, and rights notes private and outside the static build and sitemap.
- Retain build, game-version, extraction-date, and verification metadata for internal validation, provenance, patch diffs, and tests, but do not expose build numbers, data versions, update versions, or version badges in public UI, public SEO copy, or structured data unless the user explicitly reverses this product requirement.
- Do not bypass DRM, encryption, authentication, paywalls, robots restrictions, or access controls. Do not publish assets whose license conditions cannot be honored.

## Calculator rules

- Implement calculators as pure, versioned functions over generated game data where practical.
- Add golden tests from verified in-game or extracted cases before declaring a formula correct.
- Test boundaries, rounding order, ties, special cases, version changes, invalid inputs, and unknown values.
- Breeding special combinations and restrictions take precedence over the general breeding-power rule.
- Capture and IV formulas must remain experimental or unavailable until the build-specific constants and rounding behavior are verified.
- Production and crafting calculators must detect recipe cycles and clearly separate direct ingredients, recursively expanded materials, owned quantities, and net requirements.
- Aggregate all converging crafting demand before applying `ceil(output demand / recipe output)`, then subtract owned inventory exactly once at each node. If an intermediate product has multiple valid recipes, stop expansion at that boundary unless the user explicitly selects a recipe; never choose by array order.
- Never describe a shortest breeding path as the most practical path. Expose the scoring factors used for practical route ranking.
- Do not publish capture probability as exact until build-specific constants, modifier order, caps, and rounding have game-file or in-game golden-case verification. Until then, expose only clearly labeled unavailable or experimental information.

## Localization

- Support exactly the current official interface-language set, verified from an authoritative source at release time. The current baseline is:
  `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `fr-FR`, `it-IT`, `de-DE`, `es-ES`, `pt-BR`, `ru-RU`, `ko-KR`, `id-ID`, `es-419`, `th-TH`, `tr-TR`, `vi-VN`, `pl-PL`.
- Use `en-US` as the default. Resolve locale in this order only: explicit URL locale, stored user selection, then `en-US`. Do not automatically choose the initial locale from browser or operating-system preferences.
- Use locale-prefixed public routes. Do not use language query parameters in canonical URLs, hreflang, sitemap URLs, sharing URLs, or new internal links.
- Prefer shipped official localized terminology, then official publisher/documentation terminology, then approved glossary terms. Use GPT only for missing UI and explanatory prose, never for missing facts.
- Record translation provenance as `official`, `gpt`, or `reviewed`. Never overwrite an official translation with GPT output.
- Every user-visible string must exist in all supported locales in the same change, including metadata, accessibility labels, errors, empty states, chart labels, consent, and monetization text.
- Validate placeholder and markup parity. Do not allow accidental runtime fallback to hide missing translations.
- Sort localized entity names with `Intl.Collator(activeLocale)`, retaining authored tier/progression/group order and using immutable official IDs as the final tie-breaker.

## Search, UI, and accessibility

- Put localized search prominently near primary collections. Search localized names, useful official names, safe aliases, IDs, categories, recipes, and guide keywords.
- Do not send raw search text or other free-form input to analytics.
- Preserve useful filter/calculator state in shareable URLs when appropriate, but exclude transient state from canonical URLs and sitemaps.
- Support `light`, `dark`, and `system`, defaulting to `system` until the user explicitly chooses. Apply the effective theme before first paint and persist only explicit choices.
- Keep every internal page header, including collection, entity-detail, skill, calculator, map, server-tool, and placeholder routes, limited to the verified-dataset eyebrow and one `h1`. Do not render descriptive paragraphs, lore, category labels, or usage instructions inside the page-header region. The home page's marketing hero is the only exception unless the user explicitly changes this product rule.
- Keep visible descriptions where they are useful, but place entity lore and facts inside the detail content and place calculator, map, and server instructions beside the controls they explain. Do not duplicate that copy in the page header. Preserve localized SEO descriptions through metadata even when the corresponding text is intentionally absent from the visible header.
- Treat the internal-header structure as a shared component contract and cover it with a regression test so a route cannot reintroduce a header description by passing additional copy.
- Use semantic controls, headings, labels, tables, visible focus, non-color state cues, and minimum 44×44 CSS pixel touch targets.
- Make maps keyboard operable and provide an equivalent searchable/list representation of markers.
- Sort the Pal collection by official Paldeck number by default, placing variants deterministically with their base number. This project-specific product rule overrides the general localized-name sorting default for the Pal collection; localized collation still applies to explicitly name-sorted views and equal-name tie-breaking.
- Group and filter Pals by official element and game-derived rarity/progression fields. Do not invent S/A/B performance tiers without an explicit, versioned scoring rubric visible to users.
- Group and filter items by game-derived category, subtype, and rarity. Search Pals and items across localized name, official English name, immutable ID, Paldeck number where applicable, safe aliases, elements, work suitability, skills, categories, recipes, ingredients, and outputs.
- Provide crawlable localized detail pages for implemented Pal and item entities. Link collection cards, calculator selections/results, recipes, and map markers to the corresponding detail pages.
- Show entity and element images wherever they materially improve recognition, including collections, detail pages, calculator selections/results, and map marker details. Use explicit fallbacks and never trigger large numbers of missing-image requests.
- Keep calculator content widths consistent across breeding and crafting, prevent over-wide result panels, and verify responsive layouts at 360, 768, 1024, and 1440 CSS pixels.
- Map layers must support verified boss Pals, Pal habitats, fast-travel points, and local pins when those datasets are implemented. Provide layer/type filters, Pal search, reset, result counts, URL-restorable non-canonical state, keyboard controls, and an equivalent marker list. Default layers must not render an unbounded marker set.
- Verify representative mobile, tablet, and desktop widths and prevent horizontal overflow.

## SEO, measurement, monetization, and deployment

- Give every indexable page a unique localized title, description, canonical URL, Open Graph metadata, one meaningful `h1`, all locale alternates, and a sitemap entry.
- Set `x-default` to the `en-US` URL. Keep robots, sitemap, canonical, structured data, social images, and production domain consistent.
- Keep Analytics and Search Console identifiers site-specific and configurable. The site owner has explicitly designated AdSense publisher `ca-pub-1986785092914105` as a shared account for their helper sites. For sites using this common account, configure the loader with `client=ca-pub-1986785092914105` and `crossorigin="anonymous"`, emit `<meta name="google-adsense-account" content="ca-pub-1986785092914105">`, and publish the exact `ads.txt` row `google.com, pub-1986785092914105, DIRECT, f08c47fec0942fa0`. Placement slot IDs remain site-specific and configurable. Never infer or reuse any other integration identifier or expose secrets.
- Add useful Analytics events when implementing measurable interactions. Use a small stable taxonomy such as page views, tool/calculator use, theme/language changes, map-layer or local-pin actions, and copy/download actions. Event parameters may contain stable tool, action, filter, or layer identifiers only. Never transmit search text, server names, coordinates, IP addresses, passwords, INI content, save data, item quantities, user notes, or other personal/free-form values. Disable automatic page views when SPA navigation is tracked manually and prevent duplicate events.
- Load AdSense only in production unless documented test mode is active. Reserve ad space and keep ads away from navigation, map controls, calculator inputs, and primary actions.
- Target Cloudflare Pages and publish only deterministic static build output unless the user expands the infrastructure scope.
- Do not deploy or change live external services unless the user explicitly asks for publishing or configuration.
- Use hybrid rendering for the localized entity catalogs. Prerender substantial collection landings and search-worthy detail families, retain a shared SPA fallback for interaction-heavy and non-priority routes, and select any partial detail subset with a deterministic documented rubric. Never emit thin HTML merely to multiply pages.
- On Cloudflare static Assets, use `not_found_handling: "single-page-application"` only for this explicit shared-document architecture. The client router must render a real not-found view for unknown IDs/routes and must never add those unknown URLs to canonical, hreflang, structured data, or the sitemap.
- The production origin is `https://palworld-helper.woofy.blog`. Canonical, hreflang, `x-default`, Open Graph, structured data, sitemap, robots, manifests, and generated absolute URLs must use this origin and must fail validation if placeholder domains such as `.example` remain.
- Generate collection routes and implemented entity detail routes from one typed route manifest shared by client routing, metadata, internal linking, sitemap generation, and built-output verification. Verify sitemap URL count from route/entity counts separately from physical HTML file count.
- Keep Search Console and AdSense account meta tags in the shared SPA document. Verify `/ads.txt` exactly, not just its existence.
- SPA page views are navigation events, not render events. Lazy Pal/item data loads and rerenders on the same pathname must not emit another page view; a page viewed before consent may be emitted once immediately after consent.
- Treat Analytics deduplication state as proof of successful queue handoff. Do not mark a page or one-shot event as tracked before the sender exists and accepts it. Require an execution-order regression test for clean storage, consent grant, sender initialization, first page delivery, same-path rerender silence, and the next pathname delivery; source-pattern assertions alone are insufficient.

## Current verified baselines

- Current normalized game-data target: local Palworld build `24181527`.
- Published counts for this build are 299 Pals, 44,851 breeding rows, 1,891 legal items, and 1,286 valid recipes; tests must fail closed when these drift without an intentional data refresh.
- Breeding outcomes remain community-derived and require game-file-based independent verification before production release. Items, recipes, localized item names, map bounds, and the map texture are game-file-derived.
- Server INI output is limited to keys present in the current official Palworld Server Guide. Recheck that live documentation before adding or retaining any key.
- Server tooling should support a categorized basic/advanced form, local INI import, parsing and validation, official-default diff, type/range/deprecated/conflict checks, security and performance warnings, and Windows/Linux application guidance. Never persist or transmit INI contents, passwords, IPs, or server names.

## Repository and release hygiene

- Before the first commit and every release push, inspect the full staged file list. Keep `private/`, installed-game paths, extraction logs, `.env`, `node_modules/`, `dist/`, and extractor `bin/`/`obj/` output out of Git and the static artifact.
- Commit reproducible extractor/importer source, normalized public data, and intentionally published rights-reviewed assets. Never commit the local extraction workspace merely because it is needed to regenerate output.

## Required verification

- Run the repository's relevant format, lint, type, unit, integration, localization, and production-build checks.
- Inspect built output for missing locales, broken links, incorrect metadata/domains, secrets, local paths, source URLs, provenance files, logs, and unintended dynamic infrastructure.
- Verify sitemap URL count, physical HTML count, and meaningful initial-HTML SEO coverage as separate invariants. The build must stay below the active Cloudflare asset limit with at least 20% documented growth headroom. Pal/item changes must update routing, sitemap, prerender selection, linking, and verification together.
- Verify that public HTML, metadata, structured data, and visible UI contain no build number, data-version label, update-version badge, placeholder production domain, or unintentionally indexable privacy/legal route.
- Verify favicon and web-manifest icon references, entity-image coverage and fallbacks, detail-page links, Paldeck ordering, category/element/tier filters, calculator image rendering, and map-layer filters.
- Browser-check the changed flow at mobile and desktop widths, in light and dark themes, using `en-US` and at least one non-Latin locale relevant to the change.
- For data changes, run schema, referential-integrity, version-diff, and representative golden-case checks.
- Report what passed, what was not run, and any values that remain unverified.
