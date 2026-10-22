# Desktop beta release gates

The 0.2.0 builds are internal beta artifacts. Signing and cross-platform manual checks are separate gates, not implied by a passing web build.

## Automated

- [ ] Frontend tests pass.
- [ ] Production frontend build passes.
- [ ] Rust database tests pass.
- [ ] Windows x64 installer builds.
- [ ] macOS Apple Silicon DMG builds.
- [ ] macOS Intel DMG builds.
- [ ] Linux x64 AppImage and Debian package build.
- [ ] Every downloadable package has a SHA-256 checksum.

## Manual, on each supported operating system

- [ ] Install on a clean user account.
- [ ] Create and format a note; nest and reorder pages.
- [ ] Add an inline task; edit and complete it from My Tasks.
- [ ] Quit immediately after typing; reopen and verify the final edit.
- [ ] Disconnect the network and repeat core workflows.
- [ ] Export a backup, change the workspace, import the backup, and verify content and relationships.
- [ ] Restore a saved revision; verify the replaced version remains recoverable.
- [ ] Move notes/tasks/projects to Trash and restore them.
- [ ] Launch the app twice; verify a single workspace window.
- [ ] Verify keyboard navigation, dialog focus and Escape, contrast, and screen reader labels.
- [ ] Upgrade an existing installation and verify the data remains.
- [ ] Uninstall and reinstall; document the behavior of retained user data.

## Public release

- [ ] Choose the final app identifier before shipping; changing it changes the data directory.
- [ ] Obtain and configure Windows signing credentials.
- [ ] Obtain Apple Developer signing credentials and notarization access.
- [ ] Verify signed installers and notarized macOS packages on clean systems.
- [ ] Define supported OS versions from successful tests.
- [ ] Publish a privacy statement explaining local storage and unencrypted backup files.
- [ ] Add signed update delivery only after upgrade and recovery testing.

## Deferred beyond this beta

Cloud sync, collaboration, recurring tasks, calendar integrations, app stores, Linux ARM64, and Windows ARM64.
