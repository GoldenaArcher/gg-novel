import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import '../styles/app.scss'
import { EditorPanel } from '../features/editor/components/EditorPanel'
import { LibrarySidebar } from '../features/library/components/LibrarySidebar'
import { InsightsPanel } from '../features/notes/components/InsightsPanel'
import { ProjectManagerDialog } from '../features/library/components/ProjectManagerDialog'
import { ThemeMode, Project, ChapterSnapshot, Chapter, StoryNodeKind } from '../shared/types'
import { projectBridge } from '../services/ipcClient'

const patchStructureNode = (
  node: Chapter,
  chapterId: string,
  updater: (node: Chapter) => Chapter
): { node: Chapter; changed: boolean } => {
  if (node.id === chapterId) {
    return { node: updater(node), changed: true }
  }
  if (!node.children?.length) {
    return { node, changed: false }
  }
  let childChanged = false
  const updatedChildren = node.children.map((child) => {
    const result = patchStructureNode(child, chapterId, updater)
    if (result.changed) childChanged = true
    return result.node
  })
  if (childChanged) {
    const updatedNode: Chapter = {
      ...node,
      children: updatedChildren,
      words: node.kind === 'group' ? updatedChildren.reduce((sum, child) => sum + child.words, 0) : node.words
    }
    return { node: updatedNode, changed: true }
  }
  return { node, changed: false }
}

const patchStructureById = (structure: Chapter[], chapterId: string, updater: (node: Chapter) => Chapter) => {
  let changed = false
  const nodes = structure.map((node) => {
    const result = patchStructureNode(node, chapterId, updater)
    if (result.changed) changed = true
    return result.node
  })
  return changed ? nodes : structure
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem('gg-theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? '')
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const [isManagerOpen, setIsManagerOpen] = useState(false)

  const activeProjectSource = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId]
  )

  const [activeChapterId, setActiveChapterId] = useState(activeProjectSource?.chapters[0]?.id ?? '')
  const [allowChapterless, setAllowChapterless] = useState(false)
  const activeChapterSource = useMemo(
    () => activeProjectSource?.chapters.find((chapter) => chapter.id === activeChapterId),
    [activeProjectSource, activeChapterId]
  )

  const [draftText, setDraftText] = useState(activeChapterSource?.draft ?? '')
  const [isAutosaving, setIsAutosaving] = useState(false)
  const [lastAutosaveAt, setLastAutosaveAt] = useState<number | undefined>(activeChapterSource?.autosaveTimestamp)
  const [nowTick, setNowTick] = useState(Date.now())
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
  const [timelineEntries, setTimelineEntries] = useState<ChapterSnapshot[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null)
  const [snapshotPreview, setSnapshotPreview] = useState<string | null>(null)
  const [snapshotPreviewLoading, setSnapshotPreviewLoading] = useState(false)
  const [deletingSnapshot, setDeletingSnapshot] = useState<number | null>(null)
  const autosaveProjectId = activeProjectSource?.id
  const autosaveChapterId = activeChapterSource?.id
  const SIDEBAR_MIN_WIDTH = 220
  const SIDEBAR_COLLAPSE_WIDTH = 160
  const SIDEBAR_MAX_WIDTH = 420
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const sidebarDragRef = useRef<{ startX: number; width: number } | null>(null)

  useEffect(() => {
    projectBridge
      .listProjects()
      .then(setProjects)
      .catch((error) => console.error('Failed to load projects', error))
  }, [])

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
      const chapterExists = project.chapters.some((chapter) => chapter.id === activeChapterId)
      if (!chapterExists) {
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
  }, [activeChapterSource?.id, activeChapterSource?.draft])

  useEffect(() => {
    setLastAutosaveAt(activeChapterSource?.autosaveTimestamp)
    setIsAutosaving(false)
  }, [activeChapterSource?.id, activeChapterSource?.autosaveTimestamp])

  const projectsView = useMemo(() => {
    if (!autosaveProjectId || !autosaveChapterId) {
      return projects
    }
    const targetProject = projects.find((project) => project.id === autosaveProjectId)
    const targetChapter = targetProject?.chapters.find((chapter) => chapter.id === autosaveChapterId)
    if (!targetProject || !targetChapter) {
      return projects
    }
    const nextWords = [...draftText].length
    const wordsChanged = targetChapter.words !== nextWords
    const draftChanged = targetChapter.draft !== draftText
    if (!wordsChanged && !draftChanged) {
      return projects
    }
    const now = Date.now()
    return projects.map((project) => {
      if (project.id !== targetProject.id) return project
      const updatedChapters = project.chapters.map((chapter) =>
        chapter.id === autosaveChapterId
          ? { ...chapter, draft: draftText, words: nextWords, updatedAt: now }
          : chapter
      )
      const updatedStructure = patchStructureById(
        project.structure ?? [],
        autosaveChapterId,
        (node) => ({ ...node, draft: draftText, words: nextWords, updatedAt: now })
      )
      const updatedStats = wordsChanged
        ? { ...project.stats, words: project.stats.words - targetChapter.words + nextWords }
        : project.stats
      return {
        ...project,
        structure: updatedStructure,
        chapters: updatedChapters,
        stats: updatedStats
      }
    })
  }, [projects, autosaveProjectId, autosaveChapterId, draftText])
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  const closeTimeline = useCallback(() => {
    setIsTimelineOpen(false)
    setTimelineEntries([])
    setSelectedSnapshot(null)
    setSnapshotPreview(null)
    setSnapshotPreviewLoading(false)
    setDeletingSnapshot(null)
  }, [])

  useEffect(() => {
    closeTimeline()
  }, [activeChapterSource?.id, closeTimeline])

  useEffect(() => {
    if (isManagerOpen) {
      closeTimeline()
    }
  }, [isManagerOpen, closeTimeline])

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
    [autosaveProjectId, autosaveChapterId]
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
    [autosaveProjectId, autosaveChapterId, handleSelectSnapshot]
  )

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const openTimeline = useCallback(async () => {
    if (!autosaveProjectId || !autosaveChapterId) return
    setIsTimelineOpen(true)
    if (timelineEntries.length === 0) {
      await loadSnapshots({ selectFirst: true })
    } else if (!selectedSnapshot && timelineEntries.length > 0) {
      await handleSelectSnapshot(timelineEntries[0].timestamp)
    }
  }, [autosaveProjectId, autosaveChapterId, timelineEntries, loadSnapshots, selectedSnapshot, handleSelectSnapshot])

  const handleRestoreSnapshot = useCallback(() => {
    if (!snapshotPreview) return
    setDraftText(snapshotPreview)
    closeTimeline()
  }, [snapshotPreview, closeTimeline])

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
    [autosaveProjectId, autosaveChapterId, handleSelectSnapshot, loadSnapshots]
  )

  const activeProjectView = useMemo(
    () => projectsView.find((project) => project.id === activeProjectId),
    [projectsView, activeProjectId]
  )

  const activeChapterView = useMemo(
    () => activeProjectView?.chapters.find((chapter) => chapter.id === activeChapterId),
    [activeProjectView, activeChapterId]
  )

  const syncProject = useCallback((nextProject: Project | null) => {
    if (!nextProject) return
    setProjects((prev) => {
      const exists = prev.some((project) => project.id === nextProject.id)
      if (!exists) {
        return [...prev, nextProject]
      }
      return prev.map((project) => (project.id === nextProject.id ? nextProject : project))
    })
  }, [])

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
      const refreshed = await projectBridge.listProjects()
      setProjects(refreshed)
      if (activeProjectId === projectId) {
        setActiveProjectId('')
      setActiveChapterId('')
      setAllowChapterless(false)
      }
    },
    [activeProjectId]
  )

  const handleReorderProjects = useCallback(async (order: string[]) => {
    const updated = await projectBridge.reorderProjects(order)
    setProjects(updated)
  }, [])

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
  }, [autosaveProjectId, autosaveChapterId, draftText])

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
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const startSidebarResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const initialWidth = sidebarCollapsed ? SIDEBAR_MIN_WIDTH : sidebarWidth
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
  }, [resizingSidebar, SIDEBAR_COLLAPSE_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, sidebarCollapsed, sidebarWidth])

  const reopenSidebar = () => {
    setSidebarCollapsed(false)
    setSidebarWidth(Math.max(sidebarWidth || SIDEBAR_MIN_WIDTH, SIDEBAR_MIN_WIDTH))
  }

  const sidebarColumnWidth = sidebarCollapsed ? 0 : sidebarWidth
  const shellStyle = {
    '--sidebar-width': `${sidebarColumnWidth}px`
  } as CSSProperties

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} style={shellStyle}>
      <div className={`sidebar-container${sidebarCollapsed ? ' collapsed' : ''}`}>
        {!sidebarCollapsed ? (
          <LibrarySidebar
            projects={projectsView}
            activeProjectId={activeProjectId}
            activeChapterId={activeChapterId}
            snapshots={timelineEntries}
            onProjectSelect={setActiveProjectId}
            onChapterSelect={(chapterId) => {
              setAllowChapterless(chapterId === '')
              setActiveChapterId(chapterId)
            }}
            onCreateProject={handleCreateProject}
            onCreateChapter={handleCreateChapter}
            onOpenProjectManager={() => setIsManagerOpen(true)}
            onReorderProjects={handleReorderProjects}
            onDeleteProject={handleDeleteProject}
            onDeleteChapter={handleDeleteChapter}
            onReorderChapters={handleReorderChapters}
            onMoveChapter={handleMoveChapter}
            onOpenTimeline={openTimeline}
          />
        ) : (
          <button className="sidebar-expand-button" type="button" onClick={reopenSidebar}>
            展开侧栏
          </button>
        )}
      </div>

      <div className={`sidebar-resizer${sidebarCollapsed ? ' hidden' : ''}`} onMouseDown={startSidebarResize} />

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
          onCloseTimeline={closeTimeline}
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
        onClose={() => setIsManagerOpen(false)}
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
  )
}

export default App
