# F-10 — Native report photo persists unencrypted after logout

**Status: FAIL, unresolved.** Task T-063 reopened to In Progress; T-046 remains In Progress. Validation VAL-112. Observed 13 October 2026, approximately 23:57 PKT, on Samsung SM-G965F Android 10/API29. Synthetic data only. This is a storage/cleanup finding, not a demonstrated cross-account UI disclosure or remote authorization bypass.

## Exact checkpoint

Application code: `0f9ae81aa309c2f3b2c38289ed5c4fb8a3a1c570`, PR #5 (based on frozen PR #4 at `9953501`). All three PR #5 CI jobs were observed passing before this audit: backend 42s, mobile 1m46s, tracker 21s, run 38445161730. Automated checks did not cover this native cache behavior. Main remotely verified unchanged at `d3165978e19ec59a020b7049d39cced1b13760c7`.

## Reproduction and evidence

1. Open the synthetic owned report and render its generated photo using the F-9 header fix.
2. Inspect only PARAKH's app-private cache with authorized ADB `run-as`; do not clear or delete anything.
3. Compare SHA-256 of the image cache file with the original generated JPEG.
4. Use the app's Sign out button. Backend records at 18:57:50 UTC: logout 401, refresh 200, logout 204. UI returns to the language gateway (`24-after-logout.xml`).
5. Hash the same cache file again. It remains byte-identical to the original after logout.

```
Original generated JPEG SHA-256:
708479933111b9a81bf93903761e055884ce620f7dd6466174382649e5fd6190

App-private cached file before AND after successful logout:
cache/image_cache/v2.ols100.1/66/1xLu9ZSfDvdaSN8yf-vgNYiu09Y.cnt
708479933111b9a81bf93903761e055884ce620f7dd6466174382649e5fd6190
```

This exact match establishes a plaintext copy. Only filenames and hashes were inspected; no tokens, databases or personal content were extracted. There was no manual cleanup, app-data reset, reinstall, permission change or old-phone operation. The synthetic fixture remains preserved for a repair retest. Phone is now signed out; use the approved simulated OTP flow for future tests.

## Source analysis

Installed RN 0.86.3 `ReactAndroid/src/main/java/com/facebook/react/views/image/ReactImageView.kt` uses Fresco's image pipeline. The default builder does not disable disk caching; the reload path evicts an existing URI before loading but does not establish a persistent no-disk policy. `ReactOkHttpNetworkFetcher.kt` supplies HTTP no-store, which did not stop the independently observed Fresco disk file. `mobile/src/auth/session.ts` runs registered teardowns and clears tokens; no native image-cache teardown is registered.

Therefore do not fix this by merely setting `cache: reload`, adding a URI nonce, or repeating server no-store headers. Those do not prove encryption, account binding, 30-day expiry, or cleanup. Do not weaken the server's ownership checks or put credentials in URLs. The existing comment that media are no-store must be read as server transport intent, not validated native-storage compliance.

## Required repair and acceptance

- Implement the approved account-bound encrypted report-media cache (maximum 30 days), with independently testable expiry and account transitions.
- Prevent additional unencrypted native cache copies and clear only the application's report-media cache when required by the approved account policy. Preserve drafts and unrelated content. Plan migration of existing native evidence cache explicitly.
- Evaluate native pipeline controls or a bounded authenticated in-memory image path; verify the actual pipeline on the installed native build. Existing expo-crypto includes AES sources, but API/native availability and key lifecycle have not been validated here. No new dependency is approved or installed by this audit.
- Add regression coverage for cache policy, logout/account switching, failed cleanup, expired/revoked sessions and stale asynchronous responses. Test physical disk behavior; mocked Image props are insufficient.
- Repeat hash inspection after load, logout and restart; verify expected cache contents, encryption and expiry. Then run second-account access tests without claiming a breach in advance.

No remediation is claimed in this checkpoint. Independent review remains scheduled for 16 October at/after 13:00 PKT. The 18 October target remains a target, not proof of completed delivery.
