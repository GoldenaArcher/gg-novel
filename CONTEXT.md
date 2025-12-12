# Feature Reference

This document describes the higher-level goals, responsibilities, and current implementation details for each feature slice in the renderer. It is intended both as onboarding material and as prompt context for AI collaborators.

## Directory Guide

- `electron/`: Main-process source. `main.ts` boots the window and loads either the dev server or built renderer; `preload.ts` exposes safe bridges to the renderer.
- `public/`: Static assets copied as-is into the renderer build (icons, splash graphics, etc.).
- `src/app/`: Top-level React application wiring (global state, theming, layout composition).
- `src/features/`: Feature-specific UI slices.
  - `src/features/editor/`: Editor panel modules (composition, drafting textarea, writing actions).
  - `src/features/library/`: Library sidebar modules (project and chapter navigation).
  - `src/features/notes/`: Notes & Insights modules (inspiration cards, progress tracking).
- `src/data/`: Future data adapters (API clients, migrations, import/export helpers). Currently unused because persistence lives in the Electron main process.
- `src/shared/`: Cross-cutting types and utilities (e.g., `types.ts` for Chapter, Project, ThemeMode definitions) that multiple features consume.
- `src/styles/`: Global Sass setup. `_tokens.scss` defines theme variables, `_mixins.scss` contains reusable style patterns, `base.scss` resets the page + theme variables, and `app.scss` styles the shell components.
- `dist/`, `dist-electron/`, `release/`: Generated output after running `npm run build` (renderer bundle, Electron bundle, and packaged apps). These folders are created during builds and can be cleaned if necessary.
- `electron/services/`: Main-process utilities. `projectStore.ts` is the filesystem-backed persistence layer (projects, chapters, autosave cache, snapshot timeline).

## Features

### Editor

- **Surface**: `src/features/editor/components/EditorPanel.tsx`
- **Purpose**: Focused drafting space for the currently selected chapter.
- **Key behaviors**:
  - Displays project title, chapter title, and metadata (pace, mood, summary).
  - Owns the main text area. The value is controlled by `App` state so future persistence (autosave, versioning) can plug in easily.
  - Exposes actions: theme toggle, history, focus mode, and footer actions (`TODO` flag, fragment export) ready for wiring.
- **Styling notes**: Pulls shared style tokens via `app.scss`; textarea uses the mono font stack defined in `base.scss`.

### Library

- **Surface**: `src/features/library/components/LibrarySidebar.tsx`
- **Purpose**: Manage multiple projects and their chapter lists.
- **Key behaviors**:
  - Project switcher (pill buttons) to jump between novel universes; stats (word count, character cards) provide quick context.
  - Chapter list shows status badges (outline/draft/final) and word counts. Clicking a chapter updates the global editor state.
  - Project manager dialog (`ProjectManagerDialog`) handles creating, renaming, and deleting works via Electron IPC.
- **Data flow**: Receives the canonical projects array + active IDs from `App`, keeping the sidebar purely presentational.

### Notes & Insights

- **Surface**: `src/features/notes/components/InsightsPanel.tsx`
- **Purpose**: Secondary workspace for inspiration, tasks, and overall progress.
- **Key behaviors**:
  - Renders note cards (inspiration snippets, tasks) using the active project's `notes` collection.
  - Progress section visualizes aggregate completion and a list of checkpoints.
  - Shows an empty-state hint when no notes exist, guiding writers to add context.
- **Extension points**: Can evolve into Kanban-like task management or AI-assistant integration without touching editor/library modules.

## Shared Concepts

- `src/shared/types.ts`: Source of truth for `Project`, `Chapter`, `Note`, and `ThemeMode`.
- `src/data/`: Reserved for data migrations/importers if we need to move beyond the built-in filesystem store.
- `src/styles/`: Token-driven styling system; components are expected to lean on the CSS variables to stay in sync across themes.

### Storage & Persistence

- Location: Electron’s `app.getPath('userData')/workspace/`. Each project receives its own folder with `project.json` metadata, `chapters/` markdown files, `autosave/` cache files, and `timeline/<chapterId>/` snapshot history.
- Autosave: Renderer sends debounced updates via IPC; the main process writes to `autosave/<chapterId>.draft`. On launch the fresher autosave replaces the canonical draft automatically.
- Official saves: `chapters/<chapterId>.md` stores the canonical text, metadata updates word counts, and a snapshot (`timeline/<chapterId>/<timestamp>.snapshot`) is recorded with a rolling retention limit (20 files). Autosave files are cleared after successful saves.
- IPC endpoints: `projects:list`, `projects:create`, `chapters:create`, `chapters:save`, `chapters:autosave` (see `electron/services/projectStore.ts` + handlers in `electron/main.ts`).

Keep this document updated as new feature slices are added or responsibilities shift. It pairs with the root `README.md` for a complete view of the project.***
