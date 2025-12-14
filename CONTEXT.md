# Feature Reference

This document describes the higher-level goals, responsibilities, and current implementation details for each feature slice in the renderer. It is intended both as onboarding material and as prompt context for AI collaborators.

## Directory Guide

- `electron/`: Main-process source. `main.ts` boots the window and loads either the dev server or built renderer; `preload.ts` exposes safe bridges to the renderer.
- `public/`: Static assets copied as-is into the renderer build (icons, splash graphics, etc.).
- `src/app/`: Top-level React application wiring (global state, theming, layout composition, sidebar resizing).
- `src/stores/`: Zustand state management stores (introduced in refactoring).
  - `src/stores/projectStore.ts`: Core project and chapter state management with actions and selectors.
  - `src/stores/editorStore.ts`: Editor state management including draft content, autosave status, and timeline features.
- `src/features/`: Feature-specific UI slices.
  - `src/features/editor/`: Editor panel modules (composition, drafting textarea, writing actions, timeline viewer).
  - `src/features/library/`: Library sidebar modules (project and chapter navigation with hierarchical tree structure, project manager dashboard).
  - `src/features/notes/`: Notes & Insights modules (inspiration cards, progress tracking).
- `src/data/`: Future data adapters (API clients, migrations, import/export helpers). Currently unused because persistence lives in the Electron main process.
- `src/shared/`: Cross-cutting types and utilities (e.g., `types.ts` for Chapter, Project, ThemeMode, StoryNodeKind definitions) that multiple features consume.
- `src/shared/components/`: Reusable UI components.
  - `ModalPortal.tsx`: React portal wrapper used by every modal (project manager, timeline, future dialogs). Handles scroll locking by toggling `body.modal-open`.
  - `ErrorBoundary.tsx`: React error boundary for graceful error handling with user-friendly UI and recovery options.
- `src/styles/`: Global Sass setup. `_tokens.scss` defines theme variables, `_mixins.scss` contains reusable style patterns, `base.scss` resets the page + theme variables, `app.scss` styles the shell components including CSS custom properties for dynamic sizing, and `error-boundary.scss` styles the error UI.
- `dist/`, `dist-electron/`, `release/`: Generated output after running `npm run build` (renderer bundle, Electron bundle, and packaged apps). These folders are created during builds and can be cleaned if necessary.
- `electron/services/`: Main-process utilities. `projectStore.ts` is the filesystem-backed persistence layer (projects, chapters, autosave cache, snapshot timeline, hierarchical structure management).

## Features

### Editor

- **Surface**: `src/features/editor/components/EditorPanel.tsx`, `TimelinePanel.tsx`
- **Purpose**: Focused drafting space for the currently selected chapter.
- **Key behaviors**:
  - Displays project title, chapter title, and metadata (pace, mood, summary).
  - Owns the main text area. The value is controlled by `App` state so future persistence (autosave, versioning) can plug in easily.
  - Exposes actions: theme toggle, manual save button, timeline/history viewer, and focus mode.
  - **Timeline panel** (`TimelinePanel.tsx`): Mimics VS Code's history view:
    - Clicking "历史版本" fetches snapshot summaries
    - Shows previews with word counts and timestamps in readable format (e.g., "2023-12-14 10:30:15")
    - Supports selecting snapshots to view detailed preview
    - Supports deleting snapshots with confirmation
    - Lets the user restore a snapshot back into the editor buffer
    - Accessible via modal overlay with dedicated preview pane
  - **Autosave status**: Displayed in the footer showing word count and relative time since last autosave (e.g., "刚刚", "5 分钟前", "2 小时前", "3 天前").
  - **Smart save**: Manual save button triggers save operation; the backend compares content and only creates new snapshots if the content has actually changed (after normalizing trailing whitespace).
- **Styling notes**: Pulls shared style tokens via `app.scss`; textarea uses the mono font stack defined in `base.scss`. Supports CSS custom properties for dynamic theming (properly typed using `as CSSProperties` pattern).

### Library

- **Surface**: `src/features/library/components/LibrarySidebar.tsx`, `ProjectManagerDialog.tsx`
- **Purpose**: Manage multiple projects and their hierarchical chapter structure.
- **Key behaviors**:
  - **Project switcher**: Pill buttons at the top to jump between novel projects; displays stats (word count, character cards) for quick context.
  - **Hierarchical chapter tree**: Supports nested structure with groups and chapters. Chapters can be organized into groups (folders) and nested arbitrarily deep:
    - **Groups** (`kind: 'group'`): Collapsible folders that contain other groups or chapters. Display aggregate word counts from all descendant chapters. Can have optional `variant` field for sub-categorization (e.g., "arc", "volume", "part"). **Can be selected and edited** - groups have their own draft content just like chapters.
    - **Chapters** (`kind: 'chapter'`): Leaf nodes containing actual content. Show status badges (outline/draft/final) and word counts.
  - **Tree navigation**: Click to select any node (groups or chapters) for editing. Groups also toggle expand/collapse on click. Visual indentation shows nesting depth (via CSS depth multiplier). Selected nodes show blue highlight border and light purple background.
  - **CRUD operations**: 
    - Create new chapters or groups at any level (root or nested under a parent) via "+" buttons
    - Delete nodes (removes all descendants if it's a group, including all nested content files)
    - Move nodes via drag-and-drop to reparent them (changes parent relationship)
    - Reorder siblings via drag-and-drop (maintains same parent, changes order)
  - **Three-pane layout**: Sidebar is split into three independently resizable panes:
    - **Explorer**: Project list and chapter tree with hierarchical navigation
    - **Outline**: Flattened view of the entire story structure for quick overview (depth-based indentation)
    - **Timeline**: Recent snapshot history for the active chapter with timestamps and word counts
  - Each pane can be collapsed independently; resizer handles (8px height) allow dynamic height adjustment with minimum/collapse thresholds (MIN_PANE_HEIGHT: 180px, COLLAPSE_THRESHOLD: 108px, COLLAPSED_PANE_HEIGHT: 44px).
  - **Project manager dialog** (`ProjectManagerDialog.tsx`): Acts as a comprehensive dashboard:
    - Creation accepts title and optional description
    - Project cards expose stats, metadata, and timestamps (createdAt, updatedAt)
    - Search filters by title or description
    - Sort modes: manual (drag reorder), updated date (most recent first), created date, or title (alphabetical)
    - Drag reorder available only when manual sort mode is active
    - Descriptions can be edited inline
    - Direct project activation from the manager
    - Destructive actions (delete) require confirmation
  - **Sidebar resizing**: The entire sidebar can be resized horizontally:
    - Width range: 220-420px (SIDEBAR_MIN_WIDTH to SIDEBAR_MAX_WIDTH)
    - Collapsible to ~0px to save screen space (SIDEBAR_COLLAPSE_WIDTH: 160px threshold)
    - Uses CSS custom properties (`--sidebar-width`) for dynamic sizing
    - Drag handle on right edge with visual feedback during resize
- **Data flow**: Consumes project state from `projectStore` (Zustand). All mutations (create, delete, move, reorder) call back to `App`, which uses projectStore actions to update state and forwards to main process via IPC. The hierarchical structure is persisted as nested `children` arrays in the project metadata. Both `structure` (hierarchical tree) and `chapters` (flat list) are maintained for different use cases.

### Notes & Insights

- **Surface**: `src/features/notes/components/InsightsPanel.tsx`
- **Purpose**: Secondary workspace for inspiration, tasks, and overall progress.
- **Key behaviors**:
  - Renders note cards (inspiration snippets, tasks) using the active project's `notes` collection.
  - Progress section visualizes aggregate completion and a list of checkpoints.
  - Shows an empty-state hint when no notes exist, guiding writers to add context.
- **Extension points**: Can evolve into Kanban-like task management or AI-assistant integration without touching editor/library modules.

## Shared Concepts

- **`src/shared/types.ts`**: Source of truth for core data structures:
  - `Project`: Contains `id`, `title`, `description`, `createdAt`, `updatedAt`, `stats`, `structure` (hierarchical tree), `chapters` (flat list for iteration), `notes`, and `progress`.
  - `Chapter`: Contains `id`, `title`, `kind` ('group' | 'chapter'), optional `variant`, `words`, `status`, `pace`, `mood`, `draft`, `summary`, `updatedAt`, optional `autosaveTimestamp`, and optional `children` array for hierarchy.
  - `ChapterSnapshot`: Contains `timestamp`, `words`, `preview` (truncated text excerpt).
  - `StoryNodeKind`: Type alias for `'group' | 'chapter'` to distinguish between containers and content.
  - `ThemeMode`: Type alias for `'dark' | 'light'`.
- **`src/stores/projectStore.ts`**: Zustand store for project and chapter state management:
  - **State**: `projects`, `activeProjectId`, `activeChapterId`, `allowChapterless`
  - **Actions**: `setProjects`, `setActiveProject`, `setActiveChapter`, `setAllowChapterless`, `syncProject`, `loadProjects`, `getActiveProject`, `getActiveChapter`, `updateChapterInProject`
  - **Selectors**: `selectActiveProject`, `selectActiveChapter`
  - **Utilities**: `getProjectsWithLiveDraft` (pure function for computing projects with real-time draft updates), `patchStructureNode`, `patchStructureById` (exported for tree manipulation)
- **`src/stores/editorStore.ts`**: Zustand store for editor state management:
  - **State**: `draftText`, `isAutosaving`, `lastAutosaveAt`, `nowTick`, `isTimelineOpen`, `timelineEntries`, `timelineLoading`, `selectedSnapshot`, `snapshotPreview`, `snapshotPreviewLoading`, `deletingSnapshot`
  - **Actions**: `setDraftText`, `setAutosaving`, `setLastAutosaveAt`, `setNowTick`, `openTimeline`, `closeTimeline`, `setTimelineEntries`, `setTimelineLoading`, `setSelectedSnapshot`, `setSnapshotPreview`, `setSnapshotPreviewLoading`, `setDeletingSnapshot`
- **`src/shared/components/ErrorBoundary.tsx`**: React error boundary component that catches component errors and displays user-friendly error UI with recovery options ("Try Again" and "Reload Page"). Integrated at app root level.
- **`src/data/`**: Reserved for data migrations/importers if we need to move beyond the built-in filesystem store.
- **`src/styles/`**: Token-driven styling system; components are expected to lean on the CSS variables to stay in sync across themes. Global base styles also manage modal scroll locking so the root layout stays fixed while dialogs scroll internally.

## Storage & Persistence

- **Location**: Electron's `app.getPath('userData')/workspace/`. Each project receives its own folder with:
  - `project.json`: Metadata including title, description, timestamps, stats, and hierarchical chapter structure
  - `chapters/<chapterId>.md`: Canonical markdown files (only for `kind: 'chapter'` nodes)
  - `autosave/<chapterId>.draft`: Temporary autosave cache
  - `timeline/<chapterId>/<timestamp>.snapshot`: Snapshot history files
- **Project ordering**: `workspace/projects.json` stores an array of project IDs representing the preferred order. New projects append by default; drag/drop reorder updates this file.
- **Hierarchical structure**: Chapters are stored as nested objects with optional `children` arrays. The `projectStore` service maintains both:
  - `structure`: Hierarchical tree (as stored in `project.json`)
  - `chapters`: Flattened list (computed via `flattenChapterTree` for backward compatibility)
- **Autosave**: 
  - Renderer sends debounced updates via IPC (`chapters:autosave`)
  - Main process writes to `autosave/<chapterId>.draft`
  - On launch, `loadChapterWithAutosave` compares mtime of autosave vs canonical file; fresher autosave replaces the canonical draft automatically
  - Autosave updates chapter `updatedAt` and `words` metadata
- **Official saves** (via `chapters:save`):
  - Compares incoming content with existing canonical file using normalized comparison (trailing whitespace stripped)
  - If content unchanged, returns early without writing or creating snapshot (**smart save** behavior)
  - If changed:
    - Updates `chapters/<chapterId>.md` with new content
    - Updates chapter metadata (words, updatedAt)
    - Records snapshot: `timeline/<chapterId>/<timestamp>.snapshot`
    - Clears corresponding autosave file
    - Updates project-level stats and timestamps
  - Snapshot retention: Maximum 20 files per chapter (oldest deleted when limit exceeded)
- **Timeline API**: 
  - `snapshots:list`: Returns array of snapshot metadata (timestamp, words, preview excerpt)
  - `snapshots:read`: Fetches full content of specific snapshot
  - `snapshots:delete`: Removes snapshot file
- **IPC endpoints** (`electron/main.ts`):
  - Projects: `projects:list`, `projects:create`, `projects:rename`, `projects:updateDescription`, `projects:delete`, `projects:reorder`
  - Chapters: `chapters:create`, `chapters:save`, `chapters:autosave`, `chapters:delete`, `chapters:reorder`, `chapters:move`
  - Snapshots: `snapshots:list`, `snapshots:read`, `snapshots:delete`
- **Metadata refresh**: 
  - `updatedAt` is bumped whenever chapters are added/saved, drafts autosave, or metadata (title/description) changes so recency-based sorts stay meaningful
  - `refreshProjectAggregates`: Recursively sums word counts from leaf chapters up through groups to project level
  - `refreshAggregateWords`: Updates parent group word counts after child changes
- **Utility functions** in `projectStore.ts`:
  - `flattenChapterTree`: Converts hierarchical structure to flat array
  - `findChapterMeta`: Recursively searches tree for chapter by ID
  - `insertChapterMeta`: Inserts new node at specified parent
  - `removeChapterMeta`: Removes node and returns it (for move operations)
  - `reorderChapterChildren`: Reorders siblings under specific parent
  - `collectChapterIds`: Recursively collects all leaf chapter IDs (for bulk deletion)
  - `sumLeafWords`: Recursively sums word counts from all leaf chapters

## App Shell & Layout

- **`src/app/App.tsx`**: Central state management and layout orchestration
  - **State management architecture** (Refactoring complete: Stage 1 & 2):
    - **Zustand stores** (migrated):
      - Project state: Managed by `projectStore` (projects list, active project/chapter IDs, allowChapterless flag)
      - Editor state: Managed by `editorStore` (draft text, autosave status, timeline state)
    - **Local state** (remaining in App.tsx):
      - Theme state (1 useState) - Simple UI toggle
      - Manager state (1 useState) - Dialog open/close
      - Sidebar state (4 useState + 1 ref) - Complex DOM interactions: width, collapsed, resizing, overlay
      - Responsive layout (1 custom hook with internal useState) - Media query listener
  - **Live draft computation**: Uses `useMemo` with `getProjectsWithLiveDraft` to compute projects with real-time draft updates without causing infinite re-renders
  - **Editor state integration**: Uses `useEditorStore` with `useShallow` for optimized subscriptions to editor state (draft, autosave, timeline)
  - **Sidebar resizing logic**: 
    - Mouse down on resizer starts resize mode
    - Mouse move updates width with min/max constraints
    - Mouse up ends resize
    - Auto-collapse when width drops below SIDEBAR_COLLAPSE_WIDTH
    - CSS custom property `--sidebar-width` controls actual width
  - **Chapter selection flow**: Validates active IDs against loaded projects, handles fallbacks when chapters/projects are deleted
  - **Autosave debouncing**: Uses ref-based timeout to debounce IPC calls
  - **State synchronization**: After save/autosave, patches local project state with returned data from backend to keep UI in sync
- **Theme persistence**: Theme preference stored in `localStorage` as `gg-theme`, falls back to system preference via `matchMedia`
- **Error handling**: Entire app wrapped in ErrorBoundary component for graceful error recovery

## Known Issues & Future Enhancements

- **Focus mode**: Button exists but not yet implemented
- **Notes panel**: Basic structure exists but CRUD operations not yet wired up
- **Character cards**: Mentioned in stats but not yet implemented
- **Variant system**: `variant` field exists on chapters but no UI for setting/displaying yet
- **Search within chapters**: No full-text search yet
- **Export/import**: No data export/import functionality yet
- **Collaborative editing**: Single-user only, no real-time collaboration

## Refactoring Roadmap

### Stage 1: Project State Migration ✅ **COMPLETED**
- **Status**: Complete
- **Branch**: `refactor-to-zustand`
- **Changes**:
  - Introduced Zustand for state management
  - Migrated 4 project-related states from App.tsx to projectStore
  - Reduced App.tsx from 731 to 674 lines (-7.8%)
  - Fixed infinite loop bug with useMemo pattern
  - Added ErrorBoundary for production error handling
  - Updated all code comments to English
  - Fixed group node selection (both groups and chapters can now be selected)
- **Documentation**: See `STAGE1_DOCUMENTATION.md` for detailed implementation notes

### Stage 2: Editor State Migration ✅ **COMPLETED**
- **Status**: Complete
- **Branch**: `refactor-to-zustand`
- **Changes**:
  - Created editorStore with 11 editor-related states
  - Migrated draft text, autosave status, and timeline features
  - Integrated with App.tsx using `useShallow` for optimized subscriptions
  - Separated editor concerns from layout concerns
- **Result**: App.tsx now has only 7 useState (down from 22, -68% reduction!)
- **States migrated**: `draftText`, `isAutosaving`, `lastAutosaveAt`, `nowTick`, `isTimelineOpen`, `timelineEntries`, `timelineLoading`, `selectedSnapshot`, `snapshotPreview`, `snapshotPreviewLoading`, `deletingSnapshot`

### Stage 3: UI State Migration ⏸️ **OPTIONAL/DEFERRED**
- **Status**: Deferred (may not be necessary)
- **Rationale**: 
  - Remaining states are primarily UI/layout related (theme, sidebar dimensions)
  - Sidebar state involves complex DOM operations best kept in the component
  - Current architecture is clean with business logic in stores, UI logic in components
- **Remaining states in App.tsx**: 
  - `theme`, `isManagerOpen` (simple UI toggles)
  - Sidebar: `sidebarWidth`, `sidebarCollapsed`, `resizingSidebar`, `sidebarOverlayOpen`, `sidebarDragRef`
- **Potential approach if needed**: Only migrate `theme` and `isManagerOpen` to a simple uiStore; keep sidebar state in App.tsx as it's tightly coupled to layout

## Development Notes

- **TypeScript**: Strict mode enabled; CSS custom properties should be typed with `as CSSProperties` pattern
- **Icon library**: Uses `react-icons` (Material Design icons)
- **Styling approach**: SCSS with token-based design system, component-specific styles co-located
- **Build tooling**: Vite for renderer, electron-builder for packaging
- **Testing**: No test framework configured yet
- **State management**: Zustand-based architecture (Stage 1 & 2 complete)
  - `projectStore`: Project and chapter management
  - `editorStore`: Draft, autosave, and timeline features
  - App.tsx: Layout coordination and UI state
- **Performance patterns**: 
  - Use `useMemo` for expensive computations (e.g., `getProjectsWithLiveDraft`)
  - Use `useShallow` from zustand/shallow for optimized multi-property subscriptions
  - Avoid creating new object references in Zustand selectors
  - Export pure utility functions from stores for component use
- **Code organization**:
  - Business logic → Zustand stores
  - UI/Layout logic → Components
  - Shared utilities → Exported pure functions

Keep this document updated as new feature slices are added or responsibilities shift. It pairs with the root `README.md` for a complete view of the project.
