# Palworld Helper

Static-first, multilingual Palworld companion built around versioned game data and explicit provenance.

## Current scope

- 17 officially supported interface languages, with English as the deterministic default
- 299 Pal records and 44,851 breeding combinations
- 1,891 legal item records and 1,286 crafting recipes extracted from the installed game
- Official 8192 × 8192 world-map texture with local-only personal pins
- Pal and item search, forward/reverse breeding, recursive crafting, and a basic server-settings generator
- Localized static SEO pages, sitemap, canonical and alternate-language metadata

The current data target is installed Palworld build `24181527`. Community-derived breeding outcomes are kept separately from game-file-derived items, recipes, names, and map assets, and remain subject to independent verification before release.

## Commands

- `npm run dev` — local development
- `npm run check` — type, locale, test, and production-build checks
- `npm run build` — generate the static Cloudflare Pages artifact in `dist/`
- `npm run data:import:pals` — rebuild the published Pal data from prepared source artifacts
- `npm run data:import:items` — rebuild item, recipe, localization, and map metadata

Game facts and assets must enter through a reproducible extraction or official-source pipeline. Palworld-specific Analytics and Search Console values and the owner-approved shared AdSense publisher, account metadata, and `ads.txt` are configured; optional scripts still require user consent, and AdSense loads only in production. The production origin, support address, placement slots, and deployment approval remain pending. Capture/IV calculators, public guides, advanced map layers, and a publishable privacy policy are not presented as completed features.
