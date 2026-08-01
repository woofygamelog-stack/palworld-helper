# Release checklist

Use the sections matching the current change. For a production release, use every section.

## Data and rights

- [ ] Supported game build and extraction date are recorded.
- [ ] Immutable IDs and source values are preserved.
- [ ] Community-derived facts have independent verification.
- [ ] Missing, unknown, not-applicable, and zero values remain distinct.
- [ ] Schema, references, ranges, duplicates, and version diffs pass.
- [ ] Assets have usable rights and required notices are preserved.
- [ ] Private provenance, source URLs, local paths, and logs are absent from output.
- [ ] Exact element multipliers and compound rules have build-matched source evidence plus two clean live-runtime sessions covering all attacker elements and all valid one-/two-element defenders.
- [ ] Element evidence verifies lookup values, component-score aggregation, and the live damage-calculation route; public import fails closed unless both numeric and compound-rule readiness gates pass.

## Calculators and server tools

- [ ] Formula inputs and build-specific constants are verified.
- [ ] Special rules run before general rules.
- [ ] Rounding order, ties, limits, invalid input, and unknown states are tested.
- [ ] Representative verified golden cases pass.
- [ ] Old or mixed-version inputs cannot silently produce current results.
- [ ] Server files are processed locally and secrets never enter URLs, storage, logs, or analytics.
- [ ] Converging material demand is aggregated before rounding and owned inventory is consumed once.
- [ ] Ambiguous multi-recipe intermediates require a selection or remain an explicit expansion boundary.
- [ ] Every emitted server key exists in the current official server guide and deprecated/reserved keys are absent.
- [ ] Capture probability is exact only when build-specific constants, modifier order, caps, rounding, and representative golden cases are verified; otherwise it is unavailable or explicitly experimental.
- [ ] Breeding and crafting calculators share a bounded responsive layout and show available Pal/item/element imagery without broken requests.
- [ ] Server tooling supports categorized basic/advanced settings, local INI import, official-default diff, validation, conflicts, security/performance warnings, and platform guidance without persisting user content.

## Localization and search

- [ ] All 17 configured locales build without missing keys or accidental fallback.
- [ ] Official game terminology takes precedence.
- [ ] Translation provenance and placeholder/markup parity pass.
- [ ] Locale URL, stored choice, normalized browser-language match, then `en-US` resolution is tested.
- [ ] `Intl.Collator` sorting is deterministic with official-ID tie-breaking.
- [ ] Search covers localized names, official names, safe aliases, IDs, categories, and relevant keywords.
- [ ] Search result count, active filters, reset, keyboard behavior, and empty state work.
- [ ] Raw searches and free-form values are excluded from analytics.
- [ ] Pal collections default to Paldeck-number order with deterministic variant placement.
- [ ] Pal filters cover official element and game-derived rarity/progression; item filters cover game-derived category, subtype, and rarity.
- [ ] Search covers official English names, Paldeck numbers, elements, work suitability, skills, item categories, ingredients, and recipe outputs where applicable.
- [ ] No invented performance tier is presented without an explicit versioned scoring rubric.

## UI and accessibility

- [ ] Mobile, tablet, and desktop layouts have no horizontal overflow.
- [ ] Light, dark, and system themes work without first-paint flashing.
- [ ] Text, focus, status, charts, maps, tables, errors, and ads meet contrast requirements.
- [ ] Semantic labels, headings, controls, visible focus, and 44px touch targets are present.
- [ ] Maps have keyboard access and an equivalent marker list.
- [ ] Implemented Pal/item cards, search results, calculators, recipes, and map marker details link to localized entity detail pages.
- [ ] Entity and element images have useful alt text where informative, explicit decorative treatment where not, and non-requesting fallbacks when unavailable.
- [ ] Boss, habitat, fast-travel, and local-pin map layers have type filters, reset, result count, bounded rendering, and URL-restorable non-canonical state.

## SEO and integrations

- [ ] Localized title, description, canonical, Open Graph, and one `h1` are correct.
- [ ] All locale alternates and `x-default` to `en-US` are correct.
- [ ] Sitemap, robots, structured data, social images, and domain agree.
- [ ] Transient state, searches, and private pages are excluded from canonical and sitemap.
- [ ] Analytics initializes once, honors consent, and uses only approved stable event fields.
- [ ] Search Console and AdSense values belong to this site.
- [ ] Ads load only in production/test mode, reserve space, and avoid primary controls.
- [ ] Static HTML and sitemap use one implemented-route allowlist; placeholders and generic 404s are absent.
- [ ] Built page count equals implemented routes × 17 locales.
- [ ] Root redirect and localized documents contain required ownership/account meta declarations.
- [ ] Built `/ads.txt` exactly matches the authorized common-account line.
- [ ] SPA data rerenders do not duplicate page views, and consent can trigger the current page once.
- [ ] Analytics deduplication markers change only after a successful queue handoff; missing or failed senders leave the page/event eligible for retry.
- [ ] An execution-order test covers clean storage → consent grant → sender initialization → one current-page event → same-path rerender silence → one event after pathname change; source-pattern assertions are not the only coverage.
- [ ] Every absolute production URL uses `https://palworld-helper.woofy.blog`; placeholder `.example` domains fail the build.
- [ ] Static generation, canonical/hreflang metadata, internal links, sitemap, and built-output checks consume one shared collection/detail route manifest.
- [ ] Route families are explicitly classified as static, prerendered, client, or hybrid; sitemap URLs, physical HTML documents, and meaningful initial-HTML coverage are reported separately.
- [ ] Total deployed files remain below 80% of the active Cloudflare asset limit, preserving at least 20% growth headroom.
- [ ] Expected page count is derived from the route manifest, entity counts, and 17 locales rather than a permanently fixed number.
- [ ] Public UI, SEO copy, and structured data contain no build number, data version, update version, or version badge.
- [ ] Favicon, Apple touch icon, and web-manifest icons resolve in the built artifact.

## Build and delivery

- [ ] Format, lint, types, unit, integration, localization, and production build pass as applicable.
- [ ] Representative `en-US` and non-Latin routes are browser-checked on mobile and desktop in light and dark modes.
- [ ] Broken links, missing images, secrets, incorrect domains, and private files are absent.
- [ ] The deployment artifact is deterministic and static-only.
- [ ] Production deployment was explicitly authorized.
- [ ] No GitHub Actions deployment workflow was added or restored unless explicitly requested; Cloudflare's connected repository and production branch remain the deployment trigger.
- [ ] Staged files exclude private/raw extraction data, `.env`, dependencies, `dist`, logs, and tool `bin`/`obj` output.
