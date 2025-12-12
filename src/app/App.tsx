import { useCallback, useEffect, useMemo, useState } from 'react'
import '../styles/app.scss'
import { EditorPanel } from '../features/editor/components/EditorPanel'
import { LibrarySidebar } from '../features/library/components/LibrarySidebar'
import { InsightsPanel } from '../features/notes/components/InsightsPanel'
import { ProjectManagerDialog } from '../features/library/components/ProjectManagerDialog'
import { ThemeMode, Project } from '../shared/types'
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

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId]
  )

  const [activeChapterId, setActiveChapterId] = useState(activeProject?.chapters[0]?.id ?? '')
  const activeChapter = useMemo(
    () => activeProject?.chapters.find((chapter) => chapter.id === activeChapterId),
    [activeProject, activeChapterId]
  )

  const [draftText, setDraftText] = useState(activeChapter?.draft ?? '')

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
    setActiveChapterId(activeProject?.chapters[0]?.id ?? '')
  }, [activeProject?.id])

  useEffect(() => {
    setDraftText(activeChapter?.draft ?? '')
  }, [activeChapter?.id, activeChapter?.draft])

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
    async (title: string) => {
      if (!title.trim()) return
      const project = await projectBridge.createProject(title.trim())
    syncProject(project)
    setActiveProjectId(project.id)
    setActiveChapterId(project.chapters[0]?.id ?? '')
  },
    [syncProject]
  )

  const handleCreateChapter = useCallback(async () => {
    if (!activeProject) return
    const input = window.prompt('输入新章节标题')
    if (!input) return
    const title = input.trim()
    if (!title) return
    const updated = await projectBridge.createChapter(activeProject.id, title)
    if (updated) {
      syncProject(updated)
      const latest = updated.chapters[updated.chapters.length - 1]
      if (latest) {
        setActiveChapterId(latest.id)
      }
    }
  }, [activeProject, syncProject])

  const handleChapterSave = useCallback(async () => {
    if (!activeProject || !activeChapter) return
    const updated = await projectBridge.saveChapter(activeProject.id, activeChapter.id, draftText)
    if (updated) {
      syncProject(updated)
    }
  }, [activeProject, activeChapter, draftText, syncProject])

  const handleRenameProject = useCallback(
    async (projectId: string, title: string) => {
      const updated = await projectBridge.renameProject(projectId, title)
      if (updated) {
        syncProject(updated)
      }
    },
    [syncProject]
  )

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await projectBridge.deleteProject(projectId)
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
      if (activeProjectId === projectId) {
        setActiveProjectId('')
        setActiveChapterId('')
      }
    },
    [activeProjectId]
  )

  useEffect(() => {
    if (!activeProject || !activeChapter) return
    const handler = setTimeout(() => {
      projectBridge.autosaveChapter(activeProject.id, activeChapter.id, draftText).catch((error) => {
        console.error('Autosave failed', error)
      })
    }, 2000)
    return () => clearTimeout(handler)
  }, [activeProject?.id, activeChapter?.id, draftText])

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
        projects={projects}
        activeProjectId={activeProjectId}
        activeChapterId={activeChapterId}
        onProjectSelect={setActiveProjectId}
        onChapterSelect={setActiveChapterId}
        onCreateProject={handleCreateProject}
        onCreateChapter={handleCreateChapter}
        onOpenProjectManager={() => setIsManagerOpen(true)}
      />

      <EditorPanel
        projectTitle={activeProject?.title}
        chapter={activeChapter}
        draftText={draftText}
        onDraftChange={setDraftText}
        theme={theme}
        onToggleTheme={handleThemeToggle}
        onSaveChapter={handleChapterSave}
      />

      <InsightsPanel notes={activeProject?.notes} progress={activeProject?.progress} />

      <ProjectManagerDialog
        open={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onCreate={handleCreateProject}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
      />
    </div>
  )
}

export default App
