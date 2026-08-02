# Consent and privacy decision record

Reviewed: 2026-08-02
Audience: global
Status: regional code baseline implemented; production build configuration and the European CMP message are configured; the US-state message is configured but blocked on the required site logo; post-deployment live verification remains a release gate

## Current integration inventory

| Area | Current build default | Activation gate | Storage or data behavior |
|---|---|---|---|
| Theme | Enabled | None; essential preference | `pw-theme` stores only an explicit light/dark override. Selecting system removes it. |
| Locale | Enabled | None; essential preference | `pw-locale` stores only a supported locale selected by the visitor. |
| Search, map, calculators, server tools | Enabled | None | Free-form searches, coordinates, notes, quantities, server values, passwords, and imported files are not sent to Analytics. |
| Google Analytics 4 | Required in production; off in ordinary development/prelaunch | Production build, `VITE_RELEASE_STAGE=production`, `VITE_ENABLE_ANALYTICS=true`, approved `G-FF7N186M72`, and `VITE_GOOGLE_CMP=google-privacy-messaging` | Uses site stream `G-FF7N186M72`. Advanced Consent Mode queues global granted defaults and EEA/UK/Swiss denied defaults before any measurement command, then loads Analytics without waiting for a CMP callback. Denied traffic is limited to Google's cookieless measurement behavior; other regions retain normal measurement without a European prompt. The GA stream's Enhanced Measurement owns initial and browser-history page views; the app does not send a second manual `page_view`. |
| Google AdSense | Required in production; off in ordinary development/prelaunch | Production build, production release stage, `VITE_ENABLE_ADSENSE=true`, approved publisher, and `VITE_GOOGLE_CMP=google-privacy-messaging` | The approved AdSense code enables account-managed Auto ads and is also the Google Privacy & messaging carrier. When an approved numeric `VITE_ADSENSE_CONTENT_SLOT` is configured, the reserved manual `<ins class="adsbygoogle">` placement is added and its request waits for an eligible `ad_storage` result. Publisher declarations remain present independently. |
| Google Privacy & messaging CMP | Disabled by default | Activated with an enabled production Analytics or AdSense integration, or explicit non-production consent test mode | Must be published and region-targeted in the AdSense account. The site does not render a substitute custom consent banner. |
| Search Console | Static verification only | Existing site-specific token | No browser storage or consent UI. |

The obsolete `pw-consent` all-or-nothing local-storage gate is removed. Theme and locale storage do not activate optional Google services and do not cause a consent prompt.

## Console configuration status (2026-08-02)

- Cloudflare connected-Git builds now use `npm run build:production`. The production build environment explicitly retains `VITE_RELEASE_STAGE=production`, Analytics `G-FF7N186M72`, AdSense `ca-pub-1986785092914105`, both enable flags, Google Privacy & messaging, and disabled consent-test mode.
- AdSense Auto ads remains enabled for `woofy.blog`; the implementation does not require a manual slot merely to load the account-managed Auto ads code.
- The European regulations message `Palworld Helper - European privacy` is published for `woofy.blog`. It shows Consent, Do not consent, and Manage options on the first layer; the rejection option is enabled for every EEA/UK/Swiss target country; message optimization is disabled; English plus the ten additional languages supported by that Google editor are configured. The site name and privacy URL are set, and the optional CMP logo is hidden.
- Both advertising-purpose and Analytics-purpose Consent Mode settings are enabled and saved in European regulations settings.
- Google publisher and Analytics loaders use only their documented loader attributes. Application deduplication compares their approved URLs and does not add custom `data-*` attributes to vendor tags.
- Cloudflare Web Analytics automatic script injection is disabled for `woofy.blog`, removing the unrelated `static.cloudflareinsights.com/beacon.min.js` tag while leaving Google Analytics enabled. A fresh production-origin page load confirmed that the Cloudflare beacon was no longer injected.
- The US-state message `Palworld Helper - US privacy` is configured for `woofy.blog`, all current and future supported states, the opt-out link, English, Spanish, and Latin-American Spanish. Google currently blocks publication because the AdSense site record has no logo. Keep AdSense and Analytics enabled. In **AdSense > Privacy & messaging > US state regulations**, add a PNG/JPG logo under 150 KB to the `woofy.blog` site record, reopen the configured message, publish it, and confirm the overview reports one active US-state message. Google notes that propagation may take up to one hour.
- Releases use the repository's connected Git deployment. Re-run the production-origin checks below after the pushed revision becomes live.

## Regional decision

- EEA, United Kingdom, Switzerland: use the European regulations message in Google Privacy & messaging, which is a Google-certified TCF CMP. TCF v2.3 is mandatory for consent strings created on or after 2026-03-01; Google CMP handles that version. Publish the message only for this region group, present accept and reject with equal prominence, expose vendor/purpose controls, enable both advertising and Analytics consent-mode purposes, and keep the revocation control available. Analytics Consent Mode v2 defaults `ad_storage`, `analytics_storage`, `ad_user_data`, and `ad_personalization` to denied for the same region list before any measurement command. The GA tag remains available for cookieless limited measurement while Google applies the denied state; app-managed ad-unit requests remain gated until the corresponding ad-storage value permits them.
- Applicable US states: use the Google Privacy & messaging US state regulations message and its GPP opt-out flow. Select all current and future supported states unless owner legal review narrows the scope. Do not show an EEA-style consent modal globally.
- All other regions: do not show the European or US-state message merely because a Google integration is configured. Google returns consent-mode values as not applicable, so production Analytics and AdSense continue without a site-made banner. Provide the privacy notice and Google privacy-policy link. This is a product/vendor-policy baseline, not a substitute for jurisdiction-specific legal advice.
- Development and prelaunch: load no Analytics, AdSense, or CMP scripts. An explicit non-production `VITE_CONSENT_TEST_MODE=true` may load the configured Google CMP for local message testing; it does not enable analytics or ad placements.

## Required Google account configuration and release gates

1. Add and verify `https://palworld-helper.woofy.blog` in the owner-approved AdSense account.
2. Publish a European regulations message for the EEA, UK, and Switzerland in Privacy & messaging. Keep “Do not consent” on the first page and as easy and prominent as acceptance, disable consent-message optimization if it would remove that equality, enable purpose/vendor choices, and confirm the Google CMP emits TCF v2.3 strings.
3. Publish a US state regulations message for all current and future supported states, with the regional opt-out link enabled.
4. Confirm the privacy/revocation control appears on the site when the Google message applies. The application also exposes a privacy-settings action when the CMP runtime is active.
5. In European regulations settings, enable Consent Mode for advertising purposes and then enable Consent Mode for Analytics purposes. The local code applies regional defaults before loading Analytics and lets Google update storage and request behavior; app-managed ad requests still wait for eligible advertising-purpose values.
6. Keep Auto ads enabled for the site in AdSense, and keep `VITE_ENABLE_ADSENSE=true`, `VITE_ADSENSE_CLIENT=ca-pub-1986785092914105`, `VITE_GOOGLE_CMP=google-privacy-messaging`, and `VITE_RELEASE_STAGE=production` in the production environment. If a reviewed manual placement exists, set its numeric value in `VITE_ADSENSE_CONTENT_SLOT`; an absent manual slot must not disable the account-managed Auto ads code.
7. Keep Analytics enabled separately with `VITE_ENABLE_ANALYTICS=true` and `VITE_GA_ID=G-FF7N186M72`. Review the GA property, production data stream, data retention, Google Signals, Ads linking, and regional legal basis without disabling collection as a substitute for that review.
8. Run `npm run build:production` with the real production environment. The build fails if either integration is disabled or if the approved Analytics ID, publisher, loader, account meta, `ads.txt`, or regional CMP gate is missing. A configured manual slot is also validated as numeric and present in the bundle.

## Verification matrix

- Automated: development and prelaunch gates; Auto ads without a manual slot; invalid configured manual slot; missing certified-CMP declaration; mandatory production Analytics and AdSense; consent test mode; Advanced Consent Mode command order and region list; Analytics startup without a CMP callback; `CONSENT_MODE_DATA_READY` ad-purpose gating; allow, deny, reload, revoke/reset, and retry transitions; TCF support; no `pw-consent` storage; 17-locale privacy copy; non-indexed privacy route; one loader per integration; no app-managed SPA `page_view` sender while Enhanced Measurement history tracking is active.
- Local browser: no banner or Google requests in ordinary development; localized privacy page at mobile and desktop widths; keyboard access and focus; light/dark themes; footer privacy link.
- Production-only: use `?fc=alwaysshow&fctype=gdpr` and the corresponding US message test modes from Google Privacy & messaging. Verify equal accept/reject presentation, granular choices, allow, reject, reload persistence, revocation/reset, mobile, keyboard, supported message languages, TCF/GPP strings, no pre-choice gated storage/ad request, Consent Mode updates, and actual GA/AdSense network requests. Also check that visitors outside the configured regions receive no message.

## Official sources reviewed

- Google AdSense, consent management requirements for the EEA, UK, and Switzerland: https://support.google.com/adsense/answer/13554020
- Google AdSense, TCF v2.3 publisher integration and the 2026-03-01 deadline: https://support.google.com/adsense/answer/9804260
- Google AdSense, certified CMP list and Google Privacy & messaging certification: https://support.google.com/adsense/answer/13554116
- Google AdSense, available user-message regional scopes: https://support.google.com/adsense/answer/10923959
- Google AdSense, US state regulations messages and GPP behavior: https://support.google.com/adsense/answer/10961479
- Google AdSense, privacy-message testing parameters: https://support.google.com/adsense/answer/10924669
- Google Tag Platform, Consent Mode v2 and region-specific defaults: https://developers.google.com/tag-platform/security/guides/consent
- Google Tag Platform, TCF integration for Google tags: https://developers.google.com/tag-platform/security/guides/implement-TCF-strings
- Google Privacy & messaging JavaScript API and basic Consent Mode gating: https://developers.google.com/funding-choices/fc-api-docs
- Google AdSense, Consent Mode settings in Privacy & messaging: https://support.google.com/adsense/answer/16053245
- Google AdSense, consent revocation API: https://support.google.com/adsense/answer/10959060

These sources were accessed on 2026-08-02. Requirements must be rechecked before activation and at each release involving consent, analytics, or advertising.
