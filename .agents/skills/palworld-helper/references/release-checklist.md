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

## Localization and search

- [ ] All 17 configured locales build without missing keys or accidental fallback.
- [ ] Official game terminology takes precedence.
- [ ] Translation provenance and placeholder/markup parity pass.
- [ ] Locale URL, stored choice, then `en-US` resolution is tested.
- [ ] `Intl.Collator` sorting is deterministic with official-ID tie-breaking.
- [ ] Search covers localized names, official names, safe aliases, IDs, categories, and relevant keywords.
- [ ] Search result count, active filters, reset, keyboard behavior, and empty state work.
- [ ] Raw searches and free-form values are excluded from analytics.

## UI and accessibility

- [ ] Mobile, tablet, and desktop layouts have no horizontal overflow.
- [ ] Light, dark, and system themes work without first-paint flashing.
- [ ] Text, focus, status, charts, maps, tables, errors, and ads meet contrast requirements.
- [ ] Semantic labels, headings, controls, visible focus, and 44px touch targets are present.
- [ ] Maps have keyboard access and an equivalent marker list.

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

## Build and delivery

- [ ] Format, lint, types, unit, integration, localization, and production build pass as applicable.
- [ ] Representative `en-US` and non-Latin routes are browser-checked on mobile and desktop in light and dark modes.
- [ ] Broken links, missing images, secrets, incorrect domains, and private files are absent.
- [ ] The deployment artifact is deterministic and static-only.
- [ ] Production deployment was explicitly authorized.
- [ ] Staged files exclude private/raw extraction data, `.env`, dependencies, `dist`, logs, and tool `bin`/`obj` output.
