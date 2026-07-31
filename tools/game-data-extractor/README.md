# Palworld local data extractor

Read-only build utility for selected data tables in the user's installed Palworld PAK. It requires a build-matched `.usmap` and writes raw JSON only to the explicitly supplied output directory. The generated raw files and acquisition manifest must remain under `private/` and must not be published directly.

The utility does not modify game files, saves, accounts, or network services.

Pass `quest` as the optional fourth argument for a scoped quest extraction. This mode follows the quest table's typed references into quest definitions and objective blocks, and writes official 17-locale UI text plus a private manifest. Keep all raw output under `private/`; only a normalized, build-matched, validated result may enter `public/data/`.
