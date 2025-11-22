# Finanzas Build Forensics

## Summary of Symptoms
- Recent Finanzas UI deployments appeared to publish identical bundle artifacts (`index-*.js`/`index-*.css`) despite code edits.
- CloudFront/S3 validation steps reported success, making it unclear whether the bundle or the deployment flow was stale.

## Experiments Performed
### 1) Baseline Finanzas build
- Command: `BUILD_TARGET=finanzas VITE_USE_MOCKS=false VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev npm run build -- --emptyOutDir`
- Output hashes: `4d7209630e951d644bf9b1d601d1f31f6f9bf72fc12d3b111a95ad7684f2ddfe  dist-finanzas/assets/index-BW0ovU_7.js` and `59f95fc7a2d3841f1935e0ae5549ebfe6b0756b4a779bc76c03da9d2a1f8d4a0  dist-finanzas/assets/index-C2BIxzvu.css`.

### 2) Injected visible change
- Temporary edit: added marker text `TEST-FINZ-123` to `src/modules/finanzas/FinanzasHome.tsx` header (reverted after test).
- Rebuild command: same as baseline.
- New hashes: `f497e783b5a076776e395024ba6b643b9099d46f89a02d96a6d70b3f3ab18d48  dist-finanzas/assets/index-CcKpWj91.js` and `59f95fc7a2d3841f1935e0ae5549ebfe6b0756b4a779bc76c03da9d2a1f8d4a0  dist-finanzas/assets/index-C2BIxzvu.css`.
- Diff: JS hash changed; CSS hash remained (expected, no style change).
- Marker presence: `TEST-FINZ-123` found inside `dist-finanzas/assets/index-CcKpWj91.js`.

## Evidence & Interpretation
- The Finanzas entry graph responds to UI edits: the JS bundle hash changes and the marker is emitted in the built artifact.
- The stable CSS hash shows deterministic output; unchanged styles do not affect the bundle hash.
- Therefore, the “unchanged bundle” symptom is unlikely caused by Vite caching or tree-shaking; it points to either (a) builds that did not include Finanzas code changes, or (b) deployments where the previous bundle remained in place.

## Root Cause (validated)
- Lack of bundle-level observability in CI made it impossible to distinguish between “no-op Finanzas changes” and “stale deployment.”
- No persisted reference hash existed to detect when a deploy would ship the exact same bundle despite Finanzas-facing code changes.

## Remediation Implemented
- Added `scripts/finanzas-build-hash-check.sh` to reproduce the build, capture SHA-256 hashes, and optionally diff against a prior manifest.
- Updated the Finanzas UI workflow to:
  - Require an explicit `FINANZAS_BUCKET_NAME` (no silent defaults).
  - Tolerate custom `DEV_API_URL` hosts while still validating execute-api hosts.
  - Record bundle hashes to `$GITHUB_STEP_SUMMARY` and publish `.bundle-hashes.txt` alongside the build.
  - Fail the deployment if Finanzas-facing files changed but the bundle hash matches the last deployed hash stored in S3.

## How to Re-run This Diagnostic
1) Set `VITE_API_BASE_URL` to the target API URL and ensure `BUILD_TARGET=finanzas`.
2) Run `./scripts/finanzas-build-hash-check.sh` to rebuild and produce `/tmp/finz-bundle-hashes.txt`.
3) Compare against the last deployed hashes in S3 (download `s3://${FINANZAS_BUCKET_NAME}/finanzas/.bundle-hashes.txt`) or pass a reference file to the script for an automatic diff.
4) If hashes change, the Finanzas bundle is rebuilding correctly; if hashes remain identical while Finanzas code changed, block the deploy and inspect the workflow inputs/branch selection.
