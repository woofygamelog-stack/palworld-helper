# Palworld Helper

Static-first, multilingual Palworld companion built around versioned game data and explicit provenance.

## Current scope

- 17 officially supported interface languages, with English as the deterministic default
- 299 Pal records and 44,851 breeding combinations
- 1,891 legal item records and 1,286 crafting recipes extracted from the installed game
- Official 8192 × 8192 world-map texture with local-only personal pins
- Pal and item search, forward/reverse breeding, recursive crafting, and a server-settings generator
- Hybrid localized SEO output with route-manifest-driven sitemaps, canonical URLs, and language alternates

The current data target is installed Palworld build `24467282`. Community-derived breeding outcomes are kept separately from game-file-derived items, recipes, names, and map assets, and remain subject to independent verification before release.

## Commands

- `npm run dev` — start local development
- `npm run check` — run type, locale, data, test, and production-build checks
- `npm run build` — generate and validate the static Cloudflare Workers Assets artifact in `dist/`
- `npm run release:check` — run every release gate and a non-mutating Wrangler dry run
- `npm run deploy:production` — repeat the release gate, then deploy the verified `dist/` artifact; production authorization is required
- `npm run data:import:pals` — rebuild published Pal data from prepared source artifacts
- `npm run data:import:items` — rebuild item, recipe, localization, and map metadata

## Operating boundaries

Game facts and assets must enter through a reproducible extraction or official-source pipeline. The production origin, Analytics and Search Console values, and the owner-approved shared AdSense publisher, account metadata, and `ads.txt` are configured. Optional scripts still require user consent, and AdSense loads only in production when a site-specific placement slot is configured.

A public support destination, owner-reviewed privacy policy, AdSense placement slot, Google product status, and every production deployment remain explicit operator gates. Capture/IV calculators and other unverified mechanics are not presented as exact features.
