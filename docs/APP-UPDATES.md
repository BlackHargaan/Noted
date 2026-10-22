# In-app updates

Noted 0.2.1 introduces Settings → App updates. Install this version manually once to enable updates on an older installation. Checking is manual; no network request is made at startup. The desktop app displays new versions and release notes, downloads with progress, verifies the update signature, saves pending workspace edits, and installs/restarts. A failed save blocks installation. Downloads can be retried without replacing workspace data.

The updater uses Tauri's mandatory signature verification and HTTPS. Its key is separate from Apple Developer and Windows Authenticode credentials. OS signing and notarization remain release gates.

## Signing key custody

The public key is committed in `src-tauri/tauri.conf.json`. Its matching private key was generated locally at `.tools/update-signing/noted.key`, which is ignored by Git. Never commit, publish, or attach it to a release. Back it up securely: losing it prevents these installations from trusting future updates. Do not regenerate it for each release.

Configure the repository Actions secret `TAURI_SIGNING_PRIVATE_KEY` with this existing private key's contents. The generated key has an empty password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` can remain unset. Uploading the private key is an explicit owner setup step; until configured, the release workflow deliberately fails rather than producing unverified updates.

## Preparing an update

1. Update the version consistently in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`; regenerate `Cargo.lock` through Cargo. Every update must have a higher version.
2. Merge/review the changes. Run **Prepare verified app update** manually from the intended commit, or push its matching `vX.Y.Z` tag.
3. The workflow tests and builds Windows x64, Linux x64, and both Mac architectures. It uploads signed updater artifacts and `latest.json` to a **draft** release. Platform builds are serialized so updates to the manifest do not race.
4. Verify all four entries in `latest.json` (`windows-x86_64`, `linux-x86_64`, `darwin-aarch64`, `darwin-x86_64`), download URLs, signatures, and install/restart behavior on each OS. Test the upgrade with existing notes and pending edits. On Linux, self-updates use the AppImage; Debian installations should use package management.
5. Publish the reviewed release as a normal latest release when approved. Drafts and prereleases are not offered by the configured `releases/latest/download/latest.json` endpoint. Until a public update manifest exists, checks show a retryable error, never a false “up to date” result.

The ordinary PR build workflow uses `tauri.ci.conf.json` to disable signature artifact generation without secrets. This changes packaging only; those binaries still include the updater and pinned public key. Signed release builds use the main configuration.

Local signed Windows build (PowerShell):

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Join-Path $PWD '.tools/update-signing/noted.key'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
npm run desktop:build -- --bundles nsis
```

Do not embed a GitHub token in the application. Release assets must be publicly downloadable by installed apps.

## Verification limits

Automated UI tests cover duplicate checks, up-to-date responses, browser previews, offline/retry behavior, download failure, save ordering, failed saves, and restart retries. Native storage tests and the local Windows build validate integration. A real signed upgrade through the published endpoint still requires a published release and manual OS verification; mocked UI tests do not prove that end-to-end delivery works.
