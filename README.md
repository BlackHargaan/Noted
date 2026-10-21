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

## Development roadmap

1. Foundation: app shell, dark tokens, sidebar, notes and tasks data models, local persistence.
2. MVP: rich-text note editing, task capture, completion, priorities, projects, search.
3. Desktop integration: Tauri, SQLite, backups and Windows/macOS/Linux packaging.
4. Connected workspace: link tasks to notes, subtasks, due dates, recurring tasks, command palette.
5. Calendar and optional integrations, sync and import/export.

## Initial app design

Sidebar: Home / Inbox / My Tasks / Notes / Projects / Upcoming / Settings.

Home dashboard: quick capture, today's tasks, recent notes, upcoming deadlines.

Theme: dark charcoal panels, muted typography, warm gold accents, restrained borders.

## Release gate

Do not treat localStorage prototypes as safe storage for important notes. Before public release, implement SQLite persistence, export/import and basic recovery tests.
