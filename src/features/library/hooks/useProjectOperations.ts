import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'
import { projectBridge } from '../../../services/ipcClient'
import { useProjectStore, selectActiveProject, selectActiveChapter } from '../../../stores/projectStore'
import type { Project, StoryNodeKind } from '../../../shared/types'

export const useProjectOperations = () => {
  const {
    activeProjectId,
    activeChapterId,
    setActiveProject,
    setActiveChapter,
    setAllowChapterless,
    syncProject,
    loadProjects,
    setProjects
  } = useProjectStore(
    useShallow((state) => ({
      activeProjectId: state.activeProjectId,
      activeChapterId: state.activeChapterId,
      setActiveProject: state.setActiveProject,
      setActiveChapter: state.setActiveChapter,
      setAllowChapterless: state.setAllowChapterless,
      syncProject: state.syncProject,
      loadProjects: state.loadProjects,
      setProjects: state.setProjects
    }))
  )
  const activeProject = useProjectStore(selectActiveProject)
  const activeChapter = useProjectStore(selectActiveChapter)
  const { t } = useTranslation('library')

  const syncProjectWrapper = useCallback(
    (nextProject: Project | null) => {
      if (!nextProject) return
      syncProject(nextProject)
    },
    [syncProject]
  )

  const handleCreateProject = useCallback(
    async (title: string, description?: string) => {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return
      const project = await projectBridge.createProject(trimmedTitle, description?.trim() || undefined)
      syncProjectWrapper(project)
      setActiveProject(project.id)
      setActiveChapter(project.chapters[0]?.id ?? '')
      setAllowChapterless(false)
    },
    [setActiveChapter, setActiveProject, setAllowChapterless, syncProjectWrapper]
  )

  const handleCreateChapter = useCallback(
    async (projectId: string, title?: string, options?: { parentId?: string; kind?: StoryNodeKind }) => {
      let nextTitle = title?.trim()
      if (!nextTitle) {
        const promptKey =
          (options?.kind ?? 'chapter') === 'group'
            ? 'prompt.structureName'
            : 'prompt.chapterTitle'
        const input = window.prompt(t(promptKey))
        if (!input) return
        nextTitle = input.trim()
        if (!nextTitle) return
      }
      const updated = await projectBridge.createChapter(projectId, nextTitle, options)
      if (updated) {
        syncProjectWrapper(updated)
        const latest = updated.chapters[updated.chapters.length - 1]
        if (latest && latest.kind === 'chapter' && projectId === activeProjectId) {
          setActiveChapter(latest.id)
          setAllowChapterless(false)
        }
      }
    },
    [activeProjectId, setActiveChapter, setAllowChapterless, syncProjectWrapper]
  )

  const handleDeleteChapter = useCallback(
    async (projectId: string, chapterId: string) => {
      const updated = await projectBridge.deleteChapter(projectId, chapterId)
      if (updated) {
        syncProjectWrapper(updated)
        if (chapterId === activeChapterId) {
          setActiveChapter(updated.chapters[0]?.id ?? '')
          setAllowChapterless(false)
        }
      }
    },
    [activeChapterId, setActiveChapter, setAllowChapterless, syncProjectWrapper]
  )

  const handleMoveChapter = useCallback(
    async (projectId: string, chapterId: string, targetParentId: string | null) => {
      const updated = await projectBridge.moveChapter(projectId, chapterId, targetParentId)
      if (updated) {
        syncProjectWrapper(updated)
      }
    },
    [syncProjectWrapper]
  )

  const handleReorderChapters = useCallback(
    async (projectId: string, parentId: string | null, order: string[]) => {
      const updated = await projectBridge.reorderChapters(projectId, parentId, order)
      if (updated) {
        syncProjectWrapper(updated)
      }
    },
    [syncProjectWrapper]
  )

  const handleChapterSave = useCallback(async (draft: string) => {
    if (!activeProject || !activeChapter) return
    const updated = await projectBridge.saveChapter(activeProject.id, activeChapter.id, draft)
    if (updated) {
      syncProjectWrapper(updated)
    }
  }, [activeProject, activeChapter, syncProjectWrapper])

  const handleRenameProject = useCallback(
    async (projectId: string, title: string) => {
      const updated = await projectBridge.renameProject(projectId, title)
      if (updated) {
        syncProjectWrapper(updated)
      }
    },
    [syncProjectWrapper]
  )

  const handleUpdateDescription = useCallback(
    async (projectId: string, description: string) => {
      const updated = await projectBridge.updateProjectDescription(projectId, description)
      if (updated) {
        syncProjectWrapper(updated)
      }
    },
    [syncProjectWrapper]
  )

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await projectBridge.deleteProject(projectId)
      await loadProjects()
      if (activeProjectId === projectId) {
        setActiveProject('')
        setActiveChapter('')
        setAllowChapterless(false)
      }
    },
    [activeProjectId, loadProjects, setActiveChapter, setActiveProject, setAllowChapterless]
  )

  const handleReorderProjects = useCallback(
    async (order: string[]) => {
      const updated = await projectBridge.reorderProjects(order)
      setProjects(updated)
    },
    [setProjects]
  )

  return {
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
  }
}
