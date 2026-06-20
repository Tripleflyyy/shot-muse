# Shot Muse

Shot Muse is a local-first desktop workspace for photographers to collect inspiration, organize technique notes, build projects, and prepare shooting plans.

## Product Philosophy

Shot Muse intentionally avoids a generic dashboard page. The app opens directly into Card Library because the real workflow starts from collecting and organizing visual inspiration and shooting techniques.

Core workflow:

1. Collect inspiration and technique cards.
2. Organize work into Projects.
3. Build Shooting Plans with reference cards.
4. Manage tags and local assets.

## Current Features

### Card Library

- Inspiration cards and technique cards in one unified Card Library
- Local image import
- Multi-image cards
- Cover image selection
- Image ordering and hover preview
- Inline tag search, selection, and quick tag creation
- Search and filtering

Implementation note: the product layer says Card Library / Card / Reference Card. The data layer still keeps historical table names such as `inspiration_cards` and `shooting_plan_inspirations` to avoid high-risk migrations. `card_type = inspiration | technique` identifies the card kind.

### Projects

- Project-based workspace
- Expandable project sections
- Plans grouped by project
- Quick Plan creation inside project context
- Lightweight Project controls
- Plan cards aligned with the Shooting Plans experience

Cards are global reusable assets. A card is not forced to belong to one Project; Projects use cards indirectly through Plans.

### Shooting Plans

- Global Plan management
- Plan cover images
- Reference cards from Card Library
- Plan status editing
- Plan ordering within project context
- Shared Plan detail experience across Projects and Shooting Plans

### Tags / Settings

- Tags are managed from Settings as an advanced management entry
- Tag category and color metadata
- Tags are used by cards and the planning workflow

### Local-First Storage

- SQLite database
- Local media assets copied into the app data directory
- Card images use `target_type = inspiration`
- Shooting Plan images use `target_type = shooting_plan`
- Removing a media record deletes the database row only, not the real file
- No platform API integration
- No crawler
- No cloud dependency

The conservative media deletion policy avoids accidentally deleting user material. Orphan-file checks and safe cleanup tools are planned for a later maintenance phase.

## What Shot Muse Does Not Do Yet

- No Dashboard page
- No backup / restore / open data folder tools yet
- No media integrity checker yet
- No AI recommendation
- No browser extension
- No Douyin / Xiaohongshu API integration
- No crawler or automatic downloading
- No Markdown export yet
- No cloud sync or account system

If a clear practical use case appears later, a Dashboard-like entry point can be reconsidered. It is intentionally not part of the current workflow.

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

Current migrations use incremental schema repair such as table creation, `PRAGMA user_version`, and idempotent column creation. That is sufficient for the current MVP, but a versioned SQL migration system or `schema_migrations` table is planned for a later maintenance phase.

## Repository Hygiene

Generated and dependency directories are intentionally ignored:

- `node_modules/`
- `node_modules/.vite/`
- `dist/`
- `src-tauri/target/`

Do not commit build artifacts or dependency caches.
