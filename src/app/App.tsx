import { useCallback, useEffect, useMemo, useState } from 'react'
import '../styles/app.scss'
import { EditorPanel } from '../features/editor/components/EditorPanel'
import { LibrarySidebar } from '../features/library/components/LibrarySidebar'
import { InsightsPanel } from '../features/notes/components/InsightsPanel'
import { ProjectManagerDialog } from '../features/library/components/ProjectManagerDialog'
import { ThemeMode, Project, ChapterSnapshot } from '../shared/types'
import { projectBridge } from '../services/ipcClient'

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
      return
    }

    if (!activeProjectId) {
      const firstProject = projects[0]
      setActiveProjectId(firstProject.id)
      setActiveChapterId(firstProject.chapters[0]?.id ?? '')
      return
    }

    const projectExists = projects.some((project) => project.id === activeProjectId)
    if (!projectExists) {
      const fallback = projects[0]
      setActiveProjectId(fallback.id)
      setActiveChapterId(fallback.chapters[0]?.id ?? '')
      return
    }

    const project = projects.find((p) => p.id === activeProjectId)
    if (project && activeChapterId) {
      const chapterExists = project.chapters.some((chapter) => chapter.id === activeChapterId)
      if (!chapterExists) {
        setActiveChapterId(project.chapters[0]?.id ?? '')
      }
    } else if (project && !activeChapterId) {
      setActiveChapterId(project.chapters[0]?.id ?? '')
    }
  }, [projects, activeProjectId, activeChapterId])

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
      const updatedStats = wordsChanged
        ? { ...project.stats, words: project.stats.words - targetChapter.words + nextWords }
        : project.stats
      return {
        ...project,
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

  const openTimeline = useCallback(async () => {
    if (!autosaveProjectId || !autosaveChapterId) return
    setIsTimelineOpen(true)
    setTimelineLoading(true)
    try {
      const entries = await projectBridge.listSnapshots(autosaveProjectId, autosaveChapterId)
      setTimelineEntries(entries)
      if (entries.length > 0) {
        await handleSelectSnapshot(entries[0].timestamp)
      } else {
        setSelectedSnapshot(null)
        setSnapshotPreview(null)
      }
    } catch (error) {
      console.error('Failed to load snapshots', error)
      setTimelineEntries([])
    } finally {
      setTimelineLoading(false)
    }
  }, [autosaveProjectId, autosaveChapterId, handleSelectSnapshot])

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
        const entries = await projectBridge.listSnapshots(autosaveProjectId, autosaveChapterId)
        setTimelineEntries(entries)
        if (entries.length > 0) {
          await handleSelectSnapshot(entries[0].timestamp)
        } else {
          setSelectedSnapshot(null)
          setSnapshotPreview(null)
        }
      } catch (error) {
        console.error('Failed to delete snapshot', error)
      } finally {
        setDeletingSnapshot(null)
      }
    },
    [autosaveProjectId, autosaveChapterId, handleSelectSnapshot]
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
    },
    [syncProject]
  )

  const handleCreateChapter = useCallback(async (title?: string) => {
    if (!activeProjectSource) return
    let nextTitle = title?.trim()
    if (!nextTitle) {
      const input = window.prompt('输入新章节标题')
      if (!input) return
      nextTitle = input.trim()
      if (!nextTitle) return
    }
    const updated = await projectBridge.createChapter(activeProjectSource.id, nextTitle)
    if (updated) {
      syncProject(updated)
      const latest = updated.chapters[updated.chapters.length - 1]
      if (latest) {
        setActiveChapterId(latest.id)
      }
    }
  }, [activeProjectSource, syncProject])

  const handleDeleteChapter = useCallback(
    async (projectId: string, chapterId: string) => {
      const updated = await projectBridge.deleteChapter(projectId, chapterId)
      if (updated) {
        syncProject(updated)
        if (chapterId === activeChapterId) {
          setActiveChapterId(updated.chapters[0]?.id ?? '')
        }
      }
    },
    [activeChapterId, syncProject]
  )

  const handleReorderChapters = useCallback(
    async (projectId: string, order: string[]) => {
      const updated = await projectBridge.reorderChapters(projectId, order)
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

  return (
    <div className="app-shell">
      <LibrarySidebar
        projects={projectsView}
        activeProjectId={activeProjectId}
        activeChapterId={activeChapterId}
        onProjectSelect={setActiveProjectId}
        onChapterSelect={setActiveChapterId}
        onCreateProject={handleCreateProject}
        onCreateChapter={handleCreateChapter}
        onOpenProjectManager={() => setIsManagerOpen(true)}
        onReorderProjects={handleReorderProjects}
        onDeleteProject={handleDeleteProject}
        onDeleteChapter={handleDeleteChapter}
        onReorderChapters={handleReorderChapters}
      />

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

      <InsightsPanel notes={activeProjectView?.notes} progress={activeProjectView?.progress} />

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
