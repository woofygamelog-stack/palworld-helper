# Consent and privacy decision record

Reviewed: 2026-08-02
Audience: global
Status: implementation baseline; production account configuration and legal review remain release gates

## Current integration inventory

| Area | Current build default | Activation gate | Storage or data behavior |
|---|---|---|---|
| Theme | Enabled | None; essential preference | `pw-theme` stores only an explicit light/dark override. Selecting system removes it. |
| Locale | Enabled | None; essential preference | `pw-locale` stores only a supported locale selected by the visitor. |
| Search, map, calculators, server tools | Enabled | None | Free-form searches, coordinates, notes, quantities, server values, passwords, and imported files are not sent to Analytics. |
| Google Analytics 4 | Disabled by default | Production build, `VITE_RELEASE_STAGE=production`, `VITE_ENABLE_ANALYTICS=true`, and `VITE_GOOGLE_CMP=google-privacy-messaging` | Uses site stream `G-FF7N186M72`. Consent Mode v2 sets all four consent signals to denied for the EEA, UK, and Switzerland before `config`; the regional Google message can update them from the visitor's choice. Other regions receive granted defaults and no European prompt. SPA page views remain manually deduplicated. |
| Google AdSense | Disabled | Production build, production release stage, explicit enable flag, numeric placement slot, and `VITE_GOOGLE_CMP=google-privacy-messaging` | Publisher declarations alone do not load ads. When all gates pass, the loader is inserted once. |
| Google Privacy & messaging CMP | Disabled by default | Activated with an enabled production Analytics or AdSense integration, or explicit non-production consent test mode | Must be published and region-targeted in the AdSense account. The site does not render a substitute custom consent banner. |
| Search Console | Static verification only | Existing site-specific token | No browser storage or consent UI. |

The obsolete `pw-consent` all-or-nothing local-storage gate is removed. Theme and locale storage do not activate optional Google services and do not cause a consent prompt.

## Regional decision

- EEA, United Kingdom, Switzerland: if AdSense is activated, use the European regulations message in Google Privacy & messaging, which is a Google-certified TCF CMP. Publish it only for this region group, enable TCF v2.3 support, present accept and reject with equal prominence, expose vendor/purpose controls, and keep the revocation control available. Analytics Consent Mode v2 defaults `ad_storage`, `analytics_storage`, `ad_user_data`, and `ad_personalization` to denied for the same region list before the Google tag is configured.
- Applicable US states: use the Google Privacy & messaging US state regulations message and its GPP opt-out flow. Select all current and future supported states unless owner legal review narrows the scope. Do not show an EEA-style consent modal globally.
- All other regions: do not show the European or US-state message merely because a Google integration is configured. Provide the privacy notice and Google privacy-policy link. This is a product/vendor-policy baseline, not a substitute for jurisdiction-specific legal advice.
- Development and prelaunch: load no Analytics, AdSense, or CMP scripts. An explicit non-production `VITE_CONSENT_TEST_MODE=true` may load the configured Google CMP for local message testing; it does not enable analytics or ad placements.

## Required Google account configuration before AdSense activation

1. Add and verify `https://palworld-helper.woofy.blog` in the owner-approved AdSense account.
2. Publish a European regulations message for the EEA, UK, and Switzerland in Privacy & messaging. Keep “Do not consent” as easy and prominent as acceptance, enable purpose/vendor choices, and confirm the message uses a currently Google-certified TCF implementation with TCF v2.3.
3. Publish a US state regulations message for all current and future supported states, with the regional opt-out link enabled.
4. Confirm the privacy/revocation control appears on the site when the Google message applies. The application also exposes a privacy-settings action when the CMP runtime is active.
5. Set a site-specific numeric AdSense placement slot, then set `VITE_ENABLE_ADSENSE=true`, `VITE_GOOGLE_CMP=google-privacy-messaging`, and `VITE_RELEASE_STAGE=production` only in the production environment.
6. Enable Analytics separately with `VITE_ENABLE_ANALYTICS=true` and the same CMP declaration only after the GA property, data stream, data retention, Google Signals, Ads linking, and regional legal basis have been reviewed.

## Verification matrix

- Automated: development and prelaunch gates; disabled integrations; missing AdSense slot; missing certified-CMP declaration; production Analytics; production AdSense; consent test mode; Consent Mode command order and region list; TCF support; no `pw-consent` storage; 17-locale privacy copy; non-indexed privacy route; one loader per integration; SPA page-view delivery and retry semantics.
- Local browser: no banner or Google requests in ordinary development; localized privacy page at mobile and desktop widths; keyboard access and focus; light/dark themes; footer privacy link.
- Production-only: use `?fc=alwaysshow&fctype=gdpr` and the corresponding US message test modes from Google Privacy & messaging. Verify equal accept/reject presentation, granular choices, allow, reject, reload persistence, revocation/reset, mobile, keyboard, supported message languages, TCF/GPP strings, no pre-choice gated storage/ad request, Consent Mode updates, and actual GA/AdSense network requests. Also check that visitors outside the configured regions receive no message.

## Official sources reviewed

- Google AdSense, consent management requirements for the EEA, UK, and Switzerland: https://support.google.com/adsense/answer/13554020
- Google AdSense, certified CMP list and Google Privacy & messaging certification: https://support.google.com/adsense/answer/13554116
- Google AdSense, available user-message regional scopes: https://support.google.com/adsense/answer/10923959
- Google AdSense, US state regulations messages and GPP behavior: https://support.google.com/adsense/answer/10961479
- Google AdSense, privacy-message testing parameters: https://support.google.com/adsense/answer/10924669
- Google Tag Platform, Consent Mode v2 and region-specific defaults: https://developers.google.com/tag-platform/security/guides/consent
- Google Tag Platform, TCF integration for Google tags: https://developers.google.com/tag-platform/security/guides/implement-TCF-strings
- Google AdSense, consent revocation API: https://support.google.com/adsense/answer/10959060

These sources were accessed on 2026-08-02. Requirements must be rechecked before activation and at each release involving consent, analytics, or advertising.
