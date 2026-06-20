# Shot Muse

Shot Muse is a local-first desktop workspace for photography inspiration, technique cards, projects, and shooting plans.

It is designed around a simple creative flow:

1. Collect inspiration and technique cards in the Card Library.
2. Organize shooting work by Projects.
3. Build executable Shooting Plans with reference cards, images, status, and ordering.
4. Keep tags and local media inside the app for fast reuse.

## Current Features

- Card Library for inspiration cards and technique cards
- Inline tag search, selection, and quick tag creation while creating or editing cards
- Local image import for cards and plans
- Card covers, multiple images, image ordering, and hover image preview
- Projects workspace with expandable project sections and plan cards
- Shooting Plans with project ownership, status, cover images, reference cards, and detail modals
- Tags management entry from Settings
- Local SQLite persistence and local media storage

## Not Included Yet

- Markdown export
- AI generation or analysis
- Platform integrations, crawlers, or browser extensions
- Cloud sync or account system

## Tech Stack

- Tauri 2
- React 19
- TypeScript
- Rust
- SQLite via `rusqlite`
- Vite

## Development

Install dependencies:

```bash
npm install
```

Run the web dev server:

```bash
npm run dev
```

Run the Tauri desktop app in development:

```bash
npm run tauri:dev
```

Build the frontend:

```bash
npm run build
```

Check and test the Rust backend:

```bash
cd src-tauri
cargo check
cargo test
```

## Data

Shot Muse stores app data locally. The database is SQLite, and imported media is copied into the app data media directory instead of referencing the original user file path.

Removing a media record from the app currently removes the database record only; real file cleanup is intentionally left for a later storage policy.

## Repository Hygiene

Generated and dependency directories are intentionally ignored:

- `node_modules/`
- `node_modules/.vite/`
- `dist/`
- `src-tauri/target/`

Do not commit build artifacts or dependency caches.
