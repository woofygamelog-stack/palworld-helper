# Palworld Helper

Static-first, multilingual Palworld companion built around versioned, verified game information.

## Current scope

- 17 officially supported interface languages, with English as the deterministic default
- 299 Pal records and 44,851 breeding combinations
- 1,891 legal item records and 1,286 verified crafting recipes
- Official 8192 × 8192 world-map texture with local-only personal pins
- Pal and item search, forward/reverse breeding, recursive crafting, and a server-settings generator
- Hybrid localized SEO output with route-manifest-driven sitemaps, canonical URLs, and language alternates

The current data target is Palworld build `24467282`. Breeding outcomes remain subject to independent verification before release, while each published dataset keeps its own verification boundary.

## Commands

- `npm run dev` — start local development
- `npm run check` — run type, locale, data, test, and production-build checks
- `npm run build` — generate and validate the static Cloudflare Workers Assets artifact in `dist/`
- `npm run release:check` — run every release gate and a non-mutating Wrangler dry run
- `npm run deploy:production` — repeat the release gate, then deploy the verified `dist/` artifact; production authorization is required
- `npm run data:import:pals` — rebuild published Pal data from prepared source artifacts
- `npm run data:import:items` — rebuild item, recipe, localization, and map metadata

## Operating boundaries

Game facts and assets must pass reproducible verification and publication checks. The production origin, Analytics and Search Console values, and the owner-approved shared AdSense publisher, account metadata, and `ads.txt` are configured. Optional Google scripts require an explicit production release stage and per-integration enable flag. AdSense additionally requires a site-specific placement slot and the declared Google Privacy & messaging CMP; publisher metadata alone never activates ads or consent UI.

A public support destination, owner-reviewed privacy policy, AdSense placement slot, Google product status, CMP publication and regional configuration, and every production deployment remain explicit operator gates. The current consent and privacy decision record is in `docs/CONSENT_AND_PRIVACY_PLAN.md`. Capture/IV calculators and other unverified mechanics are not presented as exact features.
