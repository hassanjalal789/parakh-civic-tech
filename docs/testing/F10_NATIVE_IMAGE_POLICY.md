# F-10 native image policy implementation — 14 October 2026

Task T-063 remains In Progress. This is an unreviewed Android mitigation, not completion of the approved encrypted 30-day report-media cache. It is based on cache-audit ce53a28 (PR #6); PRs #4–#6 and main remain unchanged.

## Change

`mobile/plugins/withPrivateImagePipeline.js` installs a configured MainReactPackage through Expo's MainApplication mod. It retains React Native's default authenticated network fetcher and disables Fresco disk caching plus reusable encoded/bitmap memory caches. Active visible images still require memory; zero cache budgets are not a secure memory-wiping claim.

At startup, before React loads, the generated Kotlin removes only the app-private `cacheDir/image_cache` directory that contained the reproduced plaintext JPEG. Drafts, recordings, filesDir, databases and unrelated device data are outside this operation. Failed legacy cleanup stops startup rather than silently continuing with the unsafe cache. That fail-closed behavior needs device UX/recovery review. No deletion has been run on the phone in this checkpoint.

The policy is deliberately global to RN images because the shared native image pipeline otherwise bypasses report-level cache rules. It may increase network/decode cost. No library versions changed, no dependencies downloaded, and no permission settings changed. Expo regeneration must retain the plugin; Metro refresh alone cannot apply this native change.

## Validation

- TypeScript, ESLint and Prettier passed.
- Two focused generation tests passed: policy/cleanup placement and idempotence; rejection of unknown, ambiguous and partially modified templates.
- Installed RN 0.86.3 source and cached Fresco 3.6.0 class signatures were inspected for configuration APIs. Tests of generated source do not establish native runtime behavior.
- First offline native compile failed: ReactApplicationContext is abstract in RN 0.86. Corrected the configuration to use OkHttpImagePipelineConfigFactory with RN ReactOkHttpNetworkFetcher and its existing client. Focused tests passed again. Second offline compile is pending; local log `.local/android10-20261013/native-policy-compile.log` (repository root), session 55367. Do not claim a compiled APK.
- Physical installation/retention/account-transition tests: BLOCKED, no device connected at this heartbeat. Existing device data has not been modified.

Native validation uses an isolated copy of the existing generated Android project, excluding build/.gradle/.cxx outputs. The plugin's exact transformation is applied to its MainApplication; generated native files are ignored, while the plugin is tracked. Existing dependency caches are reused with Gradle --offline. A clean Expo generation and physical upgrade must also be verified before acceptance.

## Required next checks

1. Finish native compile/build and inspect the resulting APK; do not label the old APK patched.
2. When SM-G965F reconnects, use a data-preserving upgrade only. Confirm the package signature/version and preserve every draft, including the old phone's Water draft.
3. Verify startup cleanup removes the specific legacy synthetic image cache; render the synthetic photo, check authenticated bytes and inspect native disk cache after load, logout and restart.
4. Verify image rendering, navigation and account changes still work with no reusable image cache. Record failure/recovery behavior rather than claiming cleanup from source alone.
5. Implement the separately approved encrypted account-bound cache, expiry and cleanup. This mitigation neither stores encrypted media nor enables offline report playback. Audio/video caching, expired media credentials, iOS and cross-account races remain independent checks.

Independent review stays deferred until 16 October at/after 13:00 PKT. No merge or release authorization is implied.
