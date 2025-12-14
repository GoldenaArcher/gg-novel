import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import '../styles/app.scss'
import { EditorPanel } from '../features/editor/components/EditorPanel'
import { LibrarySidebar } from '../features/library/components/LibrarySidebar'
import { InsightsPanel } from '../features/notes/components/InsightsPanel'
import { ProjectManagerDialog } from '../features/library/components/ProjectManagerDialog'
import { Project, StoryNodeKind, Chapter } from '../shared/types'
import { projectBridge } from '../services/ipcClient'
import { MdClose, MdSettings } from 'react-icons/md'
import { 
  useProjectStore, 
  selectActiveProject, 
  selectActiveChapter,
  getProjectsWithLiveDraft
} from '../stores/projectStore'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_COLLAPSE_WIDTH, SIDEBAR_MAX_WIDTH } from '../stores/uiStore'
import { useShallow } from 'zustand/shallow'

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
  // ===== Zustand Store - Project State =====
  const projects = useProjectStore((state) => state.projects)
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const activeChapterId = useProjectStore((state) => state.activeChapterId)
  const allowChapterless = useProjectStore((state) => state.allowChapterless)
  const setActiveProjectId = useProjectStore((state) => state.setActiveProject)
  const setActiveChapterId = useProjectStore((state) => state.setActiveChapter)
  const setAllowChapterless = useProjectStore((state) => state.setAllowChapterless)
  const syncProjectToStore = useProjectStore((state) => state.syncProject)
  const loadProjects = useProjectStore((state) => state.loadProjects)
  
  // Use selectors to get current project and chapter
  const activeProjectSource = useProjectStore(selectActiveProject)
  const activeChapterSource = useProjectStore(selectActiveChapter)

  // ===== UI Store State =====
  const {
    theme,
    isManagerOpen,
    sidebarWidth,
    sidebarCollapsed,
    resizingSidebar,
    sidebarOverlayOpen
  } = useUiStore(
    useShallow((state) => ({
      theme: state.theme,
      isManagerOpen: state.isManagerOpen,
      sidebarWidth: state.sidebarWidth,
      sidebarCollapsed: state.sidebarCollapsed,
      resizingSidebar: state.resizingSidebar,
      sidebarOverlayOpen: state.sidebarOverlayOpen
    }))
  )
  const {
    toggleTheme,
    setManagerOpen,
    setSidebarWidth,
    setSidebarCollapsed,
    setResizingSidebar,
    setSidebarOverlayOpen
  } = useUiStore(
    useShallow((state) => ({
      toggleTheme: state.toggleTheme,
      setManagerOpen: state.setManagerOpen,
      setSidebarWidth: state.setSidebarWidth,
      setSidebarCollapsed: state.setSidebarCollapsed,
      setResizingSidebar: state.setResizingSidebar,
      setSidebarOverlayOpen: state.setSidebarOverlayOpen
    }))
  )

  // ===== Editor Store State =====
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
    openTimeline: openTimelinePanel,
    closeTimeline: closeTimelinePanel,
    setTimelineEntries,
    setTimelineLoading,
    setSelectedSnapshot,
    setSnapshotPreview,
    setSnapshotPreviewLoading,
    setDeletingSnapshot,
    resetTimelineData
  } = useEditorStore(
    useShallow((state) => ({
      setDraftText: state.setDraftText,
      setAutosaving: state.setAutosaving,
      setLastAutosaveAt: state.setLastAutosaveAt,
      setNowTick: state.setNowTick,
      openTimeline: state.openTimeline,
      closeTimeline: state.closeTimeline,
      setTimelineEntries: state.setTimelineEntries,
      setTimelineLoading: state.setTimelineLoading,
      setSelectedSnapshot: state.setSelectedSnapshot,
      setSnapshotPreview: state.setSnapshotPreview,
      setSnapshotPreviewLoading: state.setSnapshotPreviewLoading,
      setDeletingSnapshot: state.setDeletingSnapshot,
      resetTimelineData: state.resetTimelineData
    }))
  )
  const autosaveProjectId = activeProjectSource?.id
  const autosaveChapterId = activeChapterSource?.id
  const sidebarDragRef = useRef<{ startX: number; width: number } | null>(null)
  const isCompactLayout = useMediaQuery('(max-width: 1200px)')
  const isSidebarCollapsed = isCompactLayout ? true : sidebarCollapsed

  // ===== Initialize and load projects =====
  useEffect(() => {
    loadProjects().catch((error) => console.error('Failed to load projects', error))
  }, [loadProjects])

  useEffect(() => {
    if (!isCompactLayout) {
      setSidebarOverlayOpen(false)
    }
  }, [isCompactLayout, setSidebarOverlayOpen])

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

  useEffect(() => {
    if (activeChapterId) {
      setAllowChapterless(false)
    }
  }, [activeChapterId])

  useEffect(() => {
    setDraftText(activeChapterSource?.draft ?? '')
  }, [activeChapterSource?.id, activeChapterSource?.draft, setDraftText])

  useEffect(() => {
    setLastAutosaveAt(activeChapterSource?.autosaveTimestamp)
    setIsAutosaving(false)
  }, [activeChapterSource?.id, activeChapterSource?.autosaveTimestamp, setLastAutosaveAt, setIsAutosaving])

  // Use useMemo to calculate projects with live draft data (prevents infinite loops)
  const projectsView = useMemo(
    () => getProjectsWithLiveDraft(projects, draftText, autosaveProjectId ?? '', autosaveChapterId ?? ''),
    [projects, draftText, autosaveProjectId, autosaveChapterId]
  )
  
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [setNowTick])

  useEffect(() => {
    closeTimelinePanel()
    resetTimelineData()
  }, [activeChapterSource?.id, closeTimelinePanel, resetTimelineData])

  useEffect(() => {
    if (isManagerOpen) {
      closeTimelinePanel()
    }
  }, [isManagerOpen, closeTimelinePanel])

  const handleSelectSnapshot = useCallback(
    async (timestamp: number) => {
      if (!autosaveProjectId || !autosaveChapterId) return
      setSelectedSnapshot(timestamp)
      setSnapshotPreviewLoading(true)
      try {
        const content = await projectBridge.readSnapshot(autosaveProjectId, autosaveChapterId, timestamp)
        setSnapshotPreview(content ?? null)
      } catch (error) {
        console.error('Failed to read snapshot', error)
        setSnapshotPreview(null)
      } finally {
        setSnapshotPreviewLoading(false)
      }
    },
    [
      autosaveProjectId,
      autosaveChapterId,
      setSelectedSnapshot,
      setSnapshotPreviewLoading,
      setSnapshotPreview
    ]
  )

  const loadSnapshots = useCallback(
    async (options?: { selectFirst?: boolean }) => {
      if (!autosaveProjectId || !autosaveChapterId) {
        setTimelineEntries([])
        setSelectedSnapshot(null)
        setSnapshotPreview(null)
        return []
      }
      setTimelineLoading(true)
      try {
        const entries = await projectBridge.listSnapshots(autosaveProjectId, autosaveChapterId)
        setTimelineEntries(entries)
        if (entries.length === 0) {
          setSelectedSnapshot(null)
          setSnapshotPreview(null)
        } else if (options?.selectFirst) {
          await handleSelectSnapshot(entries[0].timestamp)
        }
        return entries
      } catch (error) {
        console.error('Failed to load snapshots', error)
        setTimelineEntries([])
        setSelectedSnapshot(null)
        setSnapshotPreview(null)
        return []
      } finally {
        setTimelineLoading(false)
      }
    },
    [
      autosaveProjectId,
      autosaveChapterId,
      handleSelectSnapshot,
      setTimelineEntries,
      setSelectedSnapshot,
      setSnapshotPreview,
      setTimelineLoading
    ]
  )

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const openTimeline = useCallback(async () => {
    if (!autosaveProjectId || !autosaveChapterId) return
    openTimelinePanel()
    if (timelineEntries.length === 0) {
      await loadSnapshots({ selectFirst: true })
    } else if (!selectedSnapshot && timelineEntries.length > 0) {
      await handleSelectSnapshot(timelineEntries[0].timestamp)
    }
  }, [
    autosaveProjectId,
    autosaveChapterId,
    timelineEntries,
    loadSnapshots,
    selectedSnapshot,
    handleSelectSnapshot,
    openTimelinePanel
  ])

  const handleRestoreSnapshot = useCallback(() => {
    if (!snapshotPreview) return
    setDraftText(snapshotPreview)
    closeTimelinePanel()
  }, [snapshotPreview, closeTimelinePanel, setDraftText])

  const handleDeleteSnapshot = useCallback(
    async (timestamp: number) => {
      if (!autosaveProjectId || !autosaveChapterId) return
      setDeletingSnapshot(timestamp)
      try {
        await projectBridge.deleteSnapshot(autosaveProjectId, autosaveChapterId, timestamp)
        await loadSnapshots({ selectFirst: true })
      } catch (error) {
        console.error('Failed to delete snapshot', error)
      } finally {
        setDeletingSnapshot(null)
      }
    },
    [autosaveProjectId, autosaveChapterId, handleSelectSnapshot, loadSnapshots, setDeletingSnapshot]
  )

  const activeProjectView = useMemo(
    () => projectsView.find((project) => project.id === activeProjectId),
    [projectsView, activeProjectId]
  )

  const activeChapterView = useMemo(
    () => activeProjectView?.chapters.find((chapter) => chapter.id === activeChapterId),
    [activeProjectView, activeChapterId]
  )

  // Wrapper for syncProject to maintain compatibility with existing code
  const syncProject = useCallback((nextProject: Project | null) => {
    if (!nextProject) return
    syncProjectToStore(nextProject)
  }, [syncProjectToStore])

  const handleSidebarProjectSelect = useCallback(
    (projectId: string) => {
      setActiveProjectId(projectId)
      if (isCompactLayout) {
        setSidebarOverlayOpen(false)
      }
    },
    [isCompactLayout, setSidebarOverlayOpen]
  )

  const handleSidebarChapterSelect = useCallback(
    (chapterId: string) => {
      setAllowChapterless(chapterId === '')
      setActiveChapterId(chapterId)
      if (isCompactLayout) {
        setSidebarOverlayOpen(false)
      }
    },
    [isCompactLayout, setSidebarOverlayOpen]
  )

  const handleCreateProject = useCallback(
    async (title: string, description?: string) => {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return
      const project = await projectBridge.createProject(trimmedTitle, description?.trim() || undefined)
      syncProject(project)
      setActiveProjectId(project.id)
      setActiveChapterId(project.chapters[0]?.id ?? '')
      setAllowChapterless(false)
    },
    [syncProject]
  )

  const handleCreateChapter = useCallback(
    async (projectId: string, title?: string, options?: { parentId?: string; kind?: StoryNodeKind }) => {
      let nextTitle = title?.trim()
      if (!nextTitle) {
        const input = window.prompt(options?.kind === 'group' ? '输入结构名称' : '输入新章节标题')
        if (!input) return
        nextTitle = input.trim()
        if (!nextTitle) return
      }
      const updated = await projectBridge.createChapter(projectId, nextTitle, options)
      if (updated) {
        syncProject(updated)
        const latest = updated.chapters[updated.chapters.length - 1]
        if (latest && latest.kind === 'chapter' && projectId === activeProjectId) {
          setActiveChapterId(latest.id)
          setAllowChapterless(false)
        }
      }
    },
    [activeProjectId, syncProject]
  )

  const handleDeleteChapter = useCallback(
    async (projectId: string, chapterId: string) => {
      const updated = await projectBridge.deleteChapter(projectId, chapterId)
      if (updated) {
        syncProject(updated)
        if (chapterId === activeChapterId) {
          setActiveChapterId(updated.chapters[0]?.id ?? '')
          setAllowChapterless(false)
        }
      }
    },
    [activeChapterId, syncProject]
  )

  const handleMoveChapter = useCallback(
    async (projectId: string, chapterId: string, targetParentId: string | null) => {
      const updated = await projectBridge.moveChapter(projectId, chapterId, targetParentId)
      if (updated) {
        syncProject(updated)
      }
    },
    [syncProject]
  )
  const handleReorderChapters = useCallback(
    async (projectId: string, parentId: string | null, order: string[]) => {
      const updated = await projectBridge.reorderChapters(projectId, parentId, order)
      if (updated) {
        syncProject(updated)
      }
    },
    [syncProject]
  )

  const handleChapterSave = useCallback(async () => {
    if (!activeProjectSource || !activeChapterSource) return
    const updated = await projectBridge.saveChapter(activeProjectSource.id, activeChapterSource.id, draftText)
    if (updated) {
      syncProject(updated)
    }
  }, [activeProjectSource, activeChapterSource, draftText, syncProject])

  const handleRenameProject = useCallback(
    async (projectId: string, title: string) => {
      const updated = await projectBridge.renameProject(projectId, title)
      if (updated) {
        syncProject(updated)
      }
    },
    [syncProject]
  )

  const handleUpdateDescription = useCallback(
    async (projectId: string, description: string) => {
      const updated = await projectBridge.updateProjectDescription(projectId, description)
      if (updated) {
        syncProject(updated)
      }
    },
    [syncProject]
  )

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await projectBridge.deleteProject(projectId)
      // Reload projects list
      await loadProjects()
      if (activeProjectId === projectId) {
        setActiveProjectId('')
        setActiveChapterId('')
        setAllowChapterless(false)
      }
    },
    [activeProjectId, loadProjects, setActiveProjectId, setActiveChapterId, setAllowChapterless]
  )

  const handleReorderProjects = useCallback(async (order: string[]) => {
    const updated = await projectBridge.reorderProjects(order)
    // Directly use store's setProjects
    useProjectStore.getState().setProjects(updated)
  }, [])

  const handleOpenProjectManager = useCallback(() => {
    setManagerOpen(true)
    if (isCompactLayout) {
      setSidebarOverlayOpen(false)
    }
  }, [isCompactLayout, setManagerOpen, setSidebarOverlayOpen])

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

  const handleThemeToggle = () => {
    toggleTheme()
  }

  const startSidebarResize = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCompactLayout) return
    event.preventDefault()
    const initialWidth = sidebarCollapsed ? SIDEBAR_DEFAULT_WIDTH : sidebarWidth
    sidebarDragRef.current = { startX: event.clientX, width: initialWidth }
    if (sidebarCollapsed) {
      setSidebarCollapsed(false)
      setSidebarWidth(initialWidth)
    }
    setResizingSidebar(true)
  }

  useEffect(() => {
    if (!resizingSidebar || !sidebarDragRef.current) return
    const handleMove = (event: MouseEvent) => {
      const delta = event.clientX - sidebarDragRef.current!.startX
      let nextWidth = sidebarDragRef.current!.width + delta
      if (nextWidth <= SIDEBAR_COLLAPSE_WIDTH) {
        setSidebarCollapsed(true)
        setResizingSidebar(false)
        return
      }
      nextWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, nextWidth))
      setSidebarCollapsed(false)
      setSidebarWidth(nextWidth)
    }
    const handleUp = () => {
      setResizingSidebar(false)
      sidebarDragRef.current = null
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [
    resizingSidebar,
    SIDEBAR_COLLAPSE_WIDTH,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH,
    setSidebarCollapsed,
    setResizingSidebar,
    setSidebarWidth
  ])

  const reopenSidebar = () => {
    setSidebarCollapsed(false)
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
  }

  const sidebarColumnWidth = isSidebarCollapsed ? 0 : sidebarWidth
  const shellStyle = {
    '--sidebar-width': `${sidebarColumnWidth}px`
  } as CSSProperties
  const shouldShowFloatingToggle = isCompactLayout || isSidebarCollapsed

  const handleFloatingButtonClick = () => {
    if (isCompactLayout) {
      setSidebarOverlayOpen(true)
    } else {
      reopenSidebar()
    }
  }

  const closeSidebarOverlay = () => setSidebarOverlayOpen(false)

  return (
    <>
      {shouldShowFloatingToggle && (
        <button className="floating-sidebar-button" type="button" onClick={handleFloatingButtonClick} aria-label="打开侧边栏">
          <MdSettings size={20} aria-hidden="true" />
        </button>
      )}
      <div className={`app-shell${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`} style={shellStyle}>
        <div className={`sidebar-container${isSidebarCollapsed ? ' collapsed' : ''}${isCompactLayout ? ' hidden' : ''}`}>
          {!isCompactLayout && !sidebarCollapsed ? (
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
                展开侧栏
              </button>
            )
          )}
        </div>

        {!isCompactLayout && (
          <div className={`sidebar-resizer${isSidebarCollapsed ? ' hidden' : ''}`} onMouseDown={startSidebarResize} />
        )}

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
            onSaveChapter={handleChapterSave}
          />
        </div>

        <div className="details-container">
          <InsightsPanel project={activeProjectView ?? undefined} notes={activeProjectView?.notes} progress={activeProjectView?.progress} />
        </div>

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
      {isCompactLayout && sidebarOverlayOpen && (
        <div className="sidebar-overlay" role="dialog" aria-modal="true">
          <div className="sidebar-overlay__backdrop" onClick={closeSidebarOverlay} />
          <div className="sidebar-overlay__panel">
            <button className="sidebar-overlay__close icon-button subtle" type="button" onClick={closeSidebarOverlay} aria-label="关闭侧边栏">
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
