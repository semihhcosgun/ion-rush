# Source-only validation

Prepared 2026-10-23 on macOS with Node.js 24.21.0.

- `npm ci --ignore-scripts --no-audit --no-fund`: succeeded with the included lockfile.
- `npm test`: 423 tests passed, zero failed, in 86 source-only test files. Ten retained asset-dependent files are excluded explicitly by `docs/asset-dependent-tests.json`; these exclusions are not reported as passing tests.
- `npm run build`: TypeScript check and Vite bundle passed. Vite warned about deliberately absent media and large chunks. No complete-game runtime check was performed.
- `xcrun swiftc ios/App/App/IonBillingLedger.swift tests/ios-billing-ledger.swift -o /tmp/ion-rush-export-billing-checks` followed by running that executable: passed consumable validation, durable claims, duplicate delivery/crash recovery, refunds, migration and corrupt-storage checks with the example product identifiers.
- Source/configuration text scan: no matched production product/app identifiers, production AdMob IDs, selected provider-token/private-key/JWT patterns or local-machine paths in the exported files. This pattern check is not a guarantee that all sensitive data is absent.
- The original source files were compared with their pre-export hashes and were unchanged.

No images, recordings, signing material, Firebase service configuration or Meta token file is part of the exported file set. Dependencies and generated dist output are not part of the source archive.

Native iOS/Android app builds, device/simulator tests and verification against the separate Windows Android checkout were not performed for this source release. The native app projects and SDK binaries are not included.
