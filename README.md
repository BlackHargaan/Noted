# Noted

A private, offline workspace for rich-text notes and tasks. React and Tiptap run inside a Tauri 2 desktop app; the desktop workspace is stored in SQLite.

## Desktop beta 0.2.0

- Rich text, nested and reorderable pages, breadcrumbs, and global note/task search.
- Tasks with priorities, deadlines, independent subtasks, projects, and Today/Overdue filters.
- Insert a new task or an existing task reference into note text. Inline checkboxes and My Tasks edit the same record.
- Recoverable Trash for notes, tasks, and projects.
- Transactional SQLite saves with revision conflict detection, schema version checks, and the previous 30 saved revisions.
- Versioned JSON backup export/import, validation before replacement, and atomic desktop backup-file writes.
- Save status, retry/export after failed saves, and flushing pending edits before a normal desktop close.
- Single-instance desktop window and remembered window position.

This is an internal beta. Automated builds are not a substitute for OS-specific installation, upgrade, accessibility, or signing checks. See [release gates](docs/RELEASE-CHECKLIST.md).

## Development

Install Node.js 22, stable Rust, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

    npm ci
    npm test
    npm run build
    cargo test --locked --manifest-path src-tauri/Cargo.toml
    npm run desktop:dev

The browser preview runs with `npm run dev` at http://127.0.0.1:1420 and uses browser-local storage. It does not access the desktop database.

Build packages with `npm run desktop:build`. To select a format explicitly:

    node node_modules/@tauri-apps/cli/tauri.js build --bundles nsis

Windows builds produce a setup executable, macOS builds produce app/DMG bundles, and Linux builds produce AppImage/Debian packages. The GitHub Actions workflow builds Windows x64, macOS Apple Silicon and Intel, and Linux x64 on their respective OS runners, then uploads packages with checksums. It does not publish a public release.

## Moving existing browser data

Open the browser app at the same origin where your notes were created. The new browser version reads the existing `noted-v1` data without removing that key.

1. Open Settings and export a backup.
2. Open the installed desktop app.
3. Open Settings, import that backup, review the item counts, and confirm replacement.
4. Verify your notes, formatting, projects, and task links before clearing browser data.

If you used a different hostname or port previously, its browser storage is a separate origin. Export from that origin. A desktop install cannot automatically access a browser's storage.

## Data and recovery

Desktop data lives in the OS application data directory for `com.blackhargaan.noted`, in `noted.sqlite3`. The current workspace is a versioned JSON document in a SQLite transaction; recovery revisions are stored in a separate table in the same database. This avoids partial note/task relationship updates. Schema migrations must remain transactional.

On Windows the directory is normally `%APPDATA%/com.blackhargaan.noted`; macOS and Linux use their platform application-data locations. Do not rename the app identifier after distributing the app without adding a migration.

Automatic history retains the previous 30 saves, not 30 days. It shares the database's disk and does not replace exported backups. Use Settings to export backups to another disk and restore an older revision. Restoring a revision preserves the replaced saved workspace in history.

Backup JSON files and the local database are not encrypted by Noted. They contain note and task content. Protect them with your OS account and disk security.

If storage cannot be opened, Noted does not silently create a replacement workspace. If a save fails, keep the app open, retry, or export the unsaved workspace. Abrupt power loss can still lose edits not yet committed during the 250 ms save delay.

Supported workspace limits: 25 MB JSON, 50,000 total items, and 64 page/subtask levels. Editing and recovery remain fully offline. No account, telemetry, or network service is required for core use.

## Daily behavior

- Deleting a note moves its page subtree to Trash and keeps linked tasks.
- Deleting a task moves its subtree to Trash. Parent completion leaves subtask completion unchanged.
- Deleting a project keeps tasks and their original project association, so restoring the project reconnects them.
- Restoring an item restores its deletion batch and required ancestors.
- Removing a task reference from note text leaves its task in My Tasks. Existing references may appear in multiple notes; the task's linked note is its source.
- Filters show matching tasks and necessary parents for context, excluding unrelated children.
- Ctrl/Command K searches; N creates a note; J opens tasks; S saves immediately.

## Remaining public-release work

- Validate installation, upgrade, native dialogs, offline behavior, keyboard/screen-reader access, and recovery on clean Windows, macOS, and Linux machines.
- Configure Windows signing and Apple signing/notarization using the publisher's accounts.
- Establish supported OS versions from those tests and publish installation/privacy documentation.
- Add signed update delivery after upgrade and recovery validation.

Cloud sync, collaboration, recurring tasks, and calendar integrations remain outside this beta's scope.

## App updates

Version 0.2.1 adds Settings → App updates for checking, downloading, and installing verified desktop updates. Pending workspace changes are saved before installation. Older installations need this version installed manually once. See [update signing and draft release setup](docs/APP-UPDATES.md).
