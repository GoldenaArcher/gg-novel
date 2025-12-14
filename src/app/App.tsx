/**
 * App.tsx - Main Application Layout Coordinator
 * 
 * This is the top-level layout component that orchestrates the 3-panel interface:
 * - LibrarySidebar (left): Project and chapter navigation
 * - EditorPanel (center): Main drafting workspace
 * - InsightsPanel (right): Notes and progress tracking
 * 
 * Architecture after Stages 1-4 refactoring:
 * - State management: Zustand stores (projectStore, editorStore, uiStore)
 * - Business logic: Custom hooks (useTimeline, useProjectOperations, useSidebarControls)
 * - This component: Layout coordination, lifecycle management, and responsive behavior
 * 
 * Responsibilities:
 * 1. Initialize and load projects on mount
 * 2. Validate active project/chapter selection (handle deletions, fallbacks)
 * 3. Manage draft text sync between editor and store
 * 4. Debounce autosave operations
 * 5. Persist theme preferences to localStorage
 * 6. Handle responsive layout (compact vs desktop)
 * 7. Render 3-panel layout with proper data flow
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/app.scss'
import { EditorPanel } from '../features/editor/components/EditorPanel'
import { LibrarySidebar } from '../features/library/components/LibrarySidebar'
import { InsightsPanel } from '../features/notes/components/InsightsPanel'
import { ProjectManagerDialog } from '../features/library/components/ProjectManagerDialog'
import { Chapter } from '../shared/types'
import { projectBridge } from '../services/ipcClient'
import { MdClose, MdSettings } from 'react-icons/md'
import { 
  useProjectStore, 
  selectActiveProject, 
  selectActiveChapter,
  getProjectsWithLiveDraft
} from '../stores/projectStore'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { useTimeline } from '../features/editor/hooks/useTimeline'
import { useProjectOperations } from '../features/library/hooks/useProjectOperations'
import { useSidebarControls } from '../features/library/hooks/useSidebarControls'
import { useShallow } from 'zustand/shallow'

/**
 * Recursively check if a chapter/group node exists in the hierarchical structure
 * Used for validating active chapter selection after deletions
 */
const structureContainsNode = (nodes: Chapter[] | undefined, targetId: string): boolean => {
  if (!nodes) return false
  for (const node of nodes) {
    if (node.id === targetId) {
      return true
    }
    if (structureContainsNode(node.children, targetId)) {
      return true
    }
  }
  return false
}

/**
 * Custom hook for responsive media query matching
 * Returns true when viewport matches the given media query
 */
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const mediaQuery = window.matchMedia(query)
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(mediaQuery.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

function App() {
  const { t } = useTranslation('common')
  // ===== Zustand Store Subscriptions =====
  // Project store: Core project and chapter state
  const projects = useProjectStore((state) => state.projects)
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const activeChapterId = useProjectStore((state) => state.activeChapterId)
  const allowChapterless = useProjectStore((state) => state.allowChapterless)
  const setActiveProjectId = useProjectStore((state) => state.setActiveProject)
  const setActiveChapterId = useProjectStore((state) => state.setActiveChapter)
  const setAllowChapterless = useProjectStore((state) => state.setAllowChapterless)
  const loadProjects = useProjectStore((state) => state.loadProjects)
  
  // Selectors for current active project and chapter
  const activeProjectSource = useProjectStore(selectActiveProject)
  const activeChapterSource = useProjectStore(selectActiveChapter)

  // UI store: Theme and dialog state
  const { theme, isManagerOpen } = useUiStore(
    useShallow((state) => ({
      theme: state.theme,
      isManagerOpen: state.isManagerOpen
    }))
  )
  const { toggleTheme, setManagerOpen } = useUiStore(
    useShallow((state) => ({
      toggleTheme: state.toggleTheme,
      setManagerOpen: state.setManagerOpen
    }))
  )

  // Editor store: Draft text, autosave, and timeline state
  const {
    draftText,
    isAutosaving,
    lastAutosaveAt,
    nowTick,
    isTimelineOpen,
    timelineEntries,
    timelineLoading,
    selectedSnapshot,
    snapshotPreview,
    snapshotPreviewLoading,
    deletingSnapshot
  } = useEditorStore(
    useShallow((state) => ({
      draftText: state.draftText,
      isAutosaving: state.isAutosaving,
      lastAutosaveAt: state.lastAutosaveAt,
      nowTick: state.nowTick,
      isTimelineOpen: state.isTimelineOpen,
      timelineEntries: state.timelineEntries,
      timelineLoading: state.timelineLoading,
      selectedSnapshot: state.selectedSnapshot,
      snapshotPreview: state.snapshotPreview,
      snapshotPreviewLoading: state.snapshotPreviewLoading,
      deletingSnapshot: state.deletingSnapshot
    }))
  )
  const {
    setDraftText,
    setAutosaving: setIsAutosaving,
    setLastAutosaveAt,
    setNowTick,
    closeTimeline: closeTimelinePanel
  } = useEditorStore(
    useShallow((state) => ({
      setDraftText: state.setDraftText,
      setAutosaving: state.setAutosaving,
      setLastAutosaveAt: state.setLastAutosaveAt,
      setNowTick: state.setNowTick,
      closeTimeline: state.closeTimeline
    }))
  )
  
  // Derive IDs for autosave operations
  const autosaveProjectId = activeProjectSource?.id
  const autosaveChapterId = activeChapterSource?.id
  
  // Check if layout should be compact (mobile/tablet)
  const isCompactLayout = useMediaQuery('(max-width: 1200px)')

  // Project CRUD operations (create, delete, rename, reorder)
  const {
    handleCreateProject,
    handleCreateChapter,
    handleDeleteChapter,
    handleMoveChapter,
    handleReorderChapters,
    handleChapterSave,
    handleRenameProject,
    handleUpdateDescription,
    handleDeleteProject,
    handleReorderProjects
  } = useProjectOperations()

  // Sidebar controls (resize, collapse, overlay for mobile)
  const {
    sidebarWidth,
    sidebarCollapsed: isSidebarCollapsed,
    sidebarOverlayOpen,
    shouldShowFloatingToggle,
    startSidebarResize,
    reopenSidebar,
    handleFloatingButtonClick,
    closeSidebarOverlay,
    handleSidebarProjectSelect,
    handleSidebarChapterSelect,
    handleOpenProjectManager
  } = useSidebarControls(isCompactLayout)

  // Timeline operations (snapshot viewer, restore, delete)
  const {
    openTimeline,
    handleSelectSnapshot,
    handleRestoreSnapshot,
    handleDeleteSnapshot
  } = useTimeline({
    projectId: autosaveProjectId,
    chapterId: autosaveChapterId,
    managerOpen: isManagerOpen
  })

  // ===== Lifecycle Effects =====
  
  /**
   * Initialize: Load all projects from filesystem on mount
   */
  useEffect(() => {
    loadProjects().catch((error) => console.error('Failed to load projects', error))
  }, [loadProjects])

  /**
   * Active Selection Validation: Handle project/chapter selection edge cases
   * - Reset selections when no projects exist
   * - Set first project as active if none selected
   * - Fall back to first project if active project deleted
   * - Fall back to first chapter if active chapter deleted
   */
  useEffect(() => {
    if (projects.length === 0) {
      if (activeProjectId) setActiveProjectId('')
      if (activeChapterId) setActiveChapterId('')
      setAllowChapterless(false)
      return
    }

    if (!activeProjectId) {
      const firstProject = projects[0]
      setActiveProjectId(firstProject.id)
      setActiveChapterId(firstProject.chapters[0]?.id ?? '')
      setAllowChapterless(false)
      return
    }

    const projectExists = projects.some((project) => project.id === activeProjectId)
    if (!projectExists) {
      const fallback = projects[0]
      setActiveProjectId(fallback.id)
      setActiveChapterId(fallback.chapters[0]?.id ?? '')
      setAllowChapterless(false)
      return
    }

    const project = projects.find((p) => p.id === activeProjectId)
    if (project && activeChapterId) {
      const nodeExists = structureContainsNode(project.structure, activeChapterId)
      if (!nodeExists) {
        setActiveChapterId(project.chapters[0]?.id ?? '')
        setAllowChapterless(false)
      }
    } else if (project && !activeChapterId) {
      if (!allowChapterless) {
        setActiveChapterId(project.chapters[0]?.id ?? '')
      }
    }
  }, [projects, activeProjectId, activeChapterId, allowChapterless])

  /**
   * Disable chapterless mode when a chapter is selected
   */
  useEffect(() => {
    if (activeChapterId) {
      setAllowChapterless(false)
    }
  }, [activeChapterId])

  /**
   * Sync draft text from active chapter to editor store
   * Resets when switching chapters
   */
  useEffect(() => {
    setDraftText(activeChapterSource?.draft ?? '')
  }, [activeChapterSource?.id, activeChapterSource?.draft, setDraftText])

  /**
   * Sync autosave timestamp from active chapter
   * Resets autosaving flag when switching chapters
   */
  useEffect(() => {
    setLastAutosaveAt(activeChapterSource?.autosaveTimestamp)
    setIsAutosaving(false)
  }, [activeChapterSource?.id, activeChapterSource?.autosaveTimestamp, setLastAutosaveAt, setIsAutosaving])

  /**
   * Compute projects with live draft overlay
   * Merges unsaved draft changes into the word count display
   * Uses useMemo to prevent infinite re-renders (important!)
   */
  const projectsView = useMemo(
    () => getProjectsWithLiveDraft(projects, draftText, autosaveProjectId ?? '', autosaveChapterId ?? ''),
    [projects, draftText, autosaveProjectId, autosaveChapterId]
  )
  
  /**
   * Tick timer: Update current time every 30 seconds
   * Used for "X minutes ago" relative time display
   */
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [setNowTick])

  /**
   * Derive active project from projects view
   */
  const activeProjectView = useMemo(
    () => projectsView.find((project) => project.id === activeProjectId),
    [projectsView, activeProjectId]
  )

  /**
   * Derive active chapter from active project
   */
  const activeChapterView = useMemo(
    () => activeProjectView?.chapters.find((chapter) => chapter.id === activeChapterId),
    [activeProjectView, activeChapterId]
  )

  /**
   * Autosave debouncing: Save draft to filesystem after 5 seconds of inactivity
   * Uses IPC bridge to communicate with Electron main process
   */
  useEffect(() => {
    if (!autosaveProjectId || !autosaveChapterId) {
      setIsAutosaving(false)
      return
    }
    let cancelled = false
    const handler = setTimeout(() => {
      setIsAutosaving(true)
      projectBridge
        .autosaveChapter(autosaveProjectId, autosaveChapterId, draftText)
        .then(({ autosaveTimestamp }) => {
          if (!cancelled) {
            setLastAutosaveAt(autosaveTimestamp)
          }
        })
        .catch((error) => {
          console.error('Autosave failed', error)
        })
        .finally(() => {
          if (!cancelled) {
            setIsAutosaving(false)
          }
        })
    }, 5000)
    return () => {
      cancelled = true
      clearTimeout(handler)
    }
  }, [autosaveProjectId, autosaveChapterId, draftText, setIsAutosaving, setLastAutosaveAt])

  /**
   * Theme persistence: Sync theme to document and localStorage
   * Updates data-theme attribute on <html> for CSS theming
   */
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const root = document.documentElement
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else {
      root.removeAttribute('data-theme')
    }
    window.localStorage.setItem('gg-theme', theme)
  }, [theme])

  // ===== Event Handlers =====
  
  const handleThemeToggle = () => {
    toggleTheme()
  }

  // ===== Layout Calculations =====
  
  const sidebarColumnWidth = isSidebarCollapsed ? 0 : sidebarWidth
  const shellStyle = {
    '--sidebar-width': `${sidebarColumnWidth}px`
  } as CSSProperties

  // ===== Render: 3-Panel Layout =====
  return (
    <>
      {/* Floating button to reopen sidebar (shown when collapsed or on mobile) */}
      {shouldShowFloatingToggle && (
        <button
          className="floating-sidebar-button"
          type="button"
          onClick={handleFloatingButtonClick}
          aria-label={t('sidebar.openButton')}
        >
          <MdSettings size={20} aria-hidden="true" />
        </button>
      )}
      
      {/* Main application shell with 3-panel layout */}
      <div className={`app-shell${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`} style={shellStyle}>
        
        {/* Left panel: Library sidebar (project/chapter navigation) */}
        <div className={`sidebar-container${isSidebarCollapsed ? ' collapsed' : ''}${isCompactLayout ? ' hidden' : ''}`}>
          {!isCompactLayout && !isSidebarCollapsed ? (
            <LibrarySidebar
              projects={projectsView}
              activeProjectId={activeProjectId}
              activeChapterId={activeChapterId}
              snapshots={timelineEntries}
              onProjectSelect={handleSidebarProjectSelect}
              onChapterSelect={handleSidebarChapterSelect}
              onCreateProject={handleCreateProject}
              onCreateChapter={handleCreateChapter}
              onOpenProjectManager={handleOpenProjectManager}
              onReorderProjects={handleReorderProjects}
              onDeleteProject={handleDeleteProject}
              onDeleteChapter={handleDeleteChapter}
              onReorderChapters={handleReorderChapters}
              onMoveChapter={handleMoveChapter}
              onOpenTimeline={openTimeline}
            />
          ) : (
            !isCompactLayout && (
              <button className="sidebar-expand-button" type="button" onClick={reopenSidebar}>
                {t('sidebar.expandButton')}
              </button>
            )
          )}
        </div>

        {/* Sidebar resizer handle (drag to adjust width) */}
        {!isCompactLayout && (
          <div className={`sidebar-resizer${isSidebarCollapsed ? ' hidden' : ''}`} onMouseDown={startSidebarResize} />
        )}

        {/* Center panel: Editor workspace */}
        <div className="editor-container">
          <EditorPanel
            projectTitle={activeProjectView?.title}
            chapter={activeChapterView}
            draftText={draftText}
            onDraftChange={setDraftText}
            isAutosaving={isAutosaving}
            autosaveTimestamp={lastAutosaveAt}
            currentTime={nowTick}
            isTimelineOpen={isTimelineOpen}
            timelineEntries={timelineEntries}
            timelineLoading={timelineLoading}
            selectedSnapshot={selectedSnapshot ?? undefined}
            snapshotPreview={snapshotPreview ?? undefined}
            snapshotPreviewLoading={snapshotPreviewLoading}
            onOpenTimeline={openTimeline}
            onCloseTimeline={closeTimelinePanel}
            onSelectSnapshot={handleSelectSnapshot}
            onRestoreSnapshot={handleRestoreSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            deletingSnapshot={deletingSnapshot}
            disableTimeline={isManagerOpen}
            theme={theme}
            onToggleTheme={handleThemeToggle}
            onSaveChapter={() => handleChapterSave(draftText)}
          />
        </div>

        {/* Right panel: Insights and progress tracking */}
        <div className="details-container">
          <InsightsPanel project={activeProjectView ?? undefined} notes={activeProjectView?.notes} progress={activeProjectView?.progress} />
        </div>

        {/* Project manager dialog (modal) */}
        <ProjectManagerDialog
          open={isManagerOpen}
          onClose={() => setManagerOpen(false)}
          projects={projects}
          activeProjectId={activeProjectId}
          onCreate={handleCreateProject}
          onRename={handleRenameProject}
          onDelete={handleDeleteProject}
          onReorder={handleReorderProjects}
          onSelect={setActiveProjectId}
          onUpdateDescription={handleUpdateDescription}
        />
      </div>
      
      {/* Mobile/compact layout: Sidebar overlay (slides in from left) */}
      {isCompactLayout && sidebarOverlayOpen && (
        <div className="sidebar-overlay" role="dialog" aria-modal="true">
          <div className="sidebar-overlay__backdrop" onClick={closeSidebarOverlay} />
          <div className="sidebar-overlay__panel">
            <button
              className="sidebar-overlay__close icon-button subtle"
              type="button"
              onClick={closeSidebarOverlay}
              aria-label={t('sidebar.closeButton')}
            >
              <MdClose size={18} aria-hidden="true" />
            </button>
            <LibrarySidebar
              projects={projectsView}
              activeProjectId={activeProjectId}
              activeChapterId={activeChapterId}
              snapshots={timelineEntries}
              onProjectSelect={handleSidebarProjectSelect}
              onChapterSelect={handleSidebarChapterSelect}
              onCreateProject={handleCreateProject}
              onCreateChapter={handleCreateChapter}
              onOpenProjectManager={handleOpenProjectManager}
              onReorderProjects={handleReorderProjects}
              onDeleteProject={handleDeleteProject}
              onDeleteChapter={handleDeleteChapter}
              onReorderChapters={handleReorderChapters}
              onMoveChapter={handleMoveChapter}
              onOpenTimeline={openTimeline}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default App
