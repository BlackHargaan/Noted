# Noted

Noted is a dark-focused, desktop-first personal workspace combining Notion-style notes with Todoist-style task management.

## Product principles

- Notes and tasks have equal importance.
- Capture quickly; organize flexibly; plan realistically.
- Work offline with local-first storage.
- Ship for Windows, macOS, and Linux.
- Keep sync optional and private by design.

## Proposed stack

- Tauri 2 desktop shell
- React, TypeScript and Vite user interface
- SQLite for local storage
- Tiptap rich text editing

## Notes and tasks

- Rich-text notes: bold, italic, headings, lists, quotes, code blocks, links, undo and redo.
- Nested pages: create child pages or move a page with the parent selector. Descendants cannot become their own ancestors.
- Task planning: editable titles, low/medium/high priority, deadlines, nested subtasks, and projects.
- Project and priority filters, completion views, and deadline-first ordering. Subtasks stay visible beneath matching parents for context.
- Connected notes: add a task inside a note or select its linked note from My Tasks. Both views edit the same task, including completion and planning fields.
- Deleting a note keeps its tasks and moves its child pages up. Deleting a task removes its subtasks after confirmation. Deleting a project keeps its tasks.
- Existing plain-text notes and task checkboxes load from the same local storage key. Storage failures are shown in the app.

Run `npm install`, `npm run dev`, `npm run build`, and `node --test tests/*.test.mjs`.

## Development roadmap

1. Foundation: app shell, dark tokens, sidebar, notes and tasks data models, local persistence.
2. MVP: rich-text notes, nested pages, task planning, projects, search, and tasks linked to notes.
3. Desktop integration: Tauri, SQLite, backups and Windows/macOS/Linux packaging.
4. Connected workspace extensions: recurring tasks and command palette.
5. Calendar and optional integrations, sync and import/export.

## Initial app design

Sidebar: Home / Inbox / My Tasks / Notes / Projects / Upcoming / Settings.

Home dashboard: quick capture, today's tasks, recent notes, upcoming deadlines.

Theme: dark charcoal panels, muted typography, warm gold accents, restrained borders.

## Release gate

Do not treat localStorage prototypes as safe storage for important notes. Before public release, implement SQLite persistence, export/import and basic recovery tests.

