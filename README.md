# ION RUSH — source code

## 📱 Live on App Store & Google Play

**ION RUSH is a published mobile game, available now on iOS and Android.**

### [Download on the App Store](https://apps.apple.com/us/app/ion-rush/id6818494716) · [Get it on Google Play](https://play.google.com/store/apps/details?id=com.nullshiftlab.nullshift)

The store versions are the complete game. This repository is the separate, code-only GPLv3 source release described below.

Source code from ION RUSH, a space motorcycle action/endless runner built with TypeScript, Three.js, Vite and Capacitor. This repository shares gameplay, rendering, UI, localization, audio-system, purchase-delivery and native bridge implementations for study and reuse under GPL-3.0-only.

**This is a source-only release, not a complete playable game or a ready-to-submit mobile app.** Images, textures, badges, fonts stored in the original public folder, music/sound recordings, geographic datasets, store artwork and brand graphics are not included. No replacement media is provided. References to these files remain in the code; media-dependent functionality will be incomplete. A successful TypeScript check or Vite bundle does not prove playable behavior.

## What is included

- `src/`: gameplay, procedural Three.js geometry and shaders, UI/CSS, six interface languages (`en`, `tr`, `de`, `fr`, `es`, `pt-BR`), audio synthesis/lifecycle and Capacitor bridge interfaces.
- `tests/`: TypeScript regression tests and selected Swift test sources.
- `ios/App/App/*.swift`: authored iOS bridge, StoreKit delivery/refund ledger, audio, reminders, thermal and telemetry/advertising integrations, as source references.
- `android/app/src/main/java/com/example/ionrush/`: authored Android native integrations from the available Mac working copy. This is not a verified export of the separate Windows Android checkout.
- Node dependency lockfile and TypeScript/Vite configuration.

Procedural artwork and musical/sound synthesis already expressed in source code remain included. Omitting recorded media does not remove those algorithms or note definitions.

## Inspect and test

Use Node.js 22 or newer and npm:

```sh
npm ci
npm run typecheck
npm test
```

`npm test` runs the source-only suite. Test files that read omitted media/datasets are retained but excluded from that command; their explicit list is in `docs/asset-dependent-tests.json`. `npm run test:all` attempts all original TypeScript test files and is expected to fail on absent assets. Do not treat the source-only suite as verification of the complete store game.

`npm run build` checks TypeScript and attempts a web bundle. `npm run dev` can be used to inspect the incomplete web shell locally. Both require dependencies; neither supplies the omitted media or native configuration. No playable demo is promised.

## Purchases, ads and telemetry

Purchase catalogs use example identifiers (`example_nova_5`, `example_nova_15`, `example_nova_40`). The example app identifier is `com.example.ionrush`. Store-delivery, acknowledgment and refund handling are shared as code; real transactions require the integrator's own configured products, signed app and store accounts. Existing local-preview behavior in the code is not real billing or production verification.

Production Firebase configuration, Meta client token, signing identities, provisioning profiles, account credentials, AdMob account identifiers and store project metadata are not included. Native SDKs and compiled frameworks are not vendored. The source references Capacitor, StoreKit, Google Play Billing, Google Mobile Ads/UMP, Firebase and Meta APIs; integrating those requires their own dependencies, configuration and applicable terms. This release makes no claim that a binary combining all optional SDKs is GPL-compatible or approved for any app store. Xcode/Gradle app projects and native build scripts are deliberately omitted; native files are integration references, not standalone build targets.

Privacy/support links in the exported web source point to `example.invalid`; replace them with your own policies before deploying anything. Do not reuse the original app's service connections or branding.

## License and branding

The authored code, included tests, configuration and documentation in this repository are offered under **GNU GPL version 3 only**, see `LICENSE`. You may use and modify the code commercially. When distributing covered works, comply with GPLv3, including providing the corresponding source under its terms to recipients. Private modifications do not by themselves require a public GitHub upload.

The ION RUSH name identifies the origin of this code. This code license grants no right to use the original logos or other omitted brand/media files. External dependencies retain their own licenses; see `THIRD-PARTY-NOTICES.md`. The separately distributed commercial game and its private media are not included here.

See `CONTRIBUTING.md` for contributions. This initial source release does not claim an established open-source user base or guarantee eligibility for any developer grant.
