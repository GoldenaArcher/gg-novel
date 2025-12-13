import type { Project, ChapterSnapshot } from '../shared/types'

export const projectBridge = {
  listProjects: () => window.ipcRenderer.invoke('projects:list') as Promise<Project[]>,
  createProject: (title: string, description?: string) =>
    window.ipcRenderer.invoke('projects:create', { title, description }) as Promise<Project>,
  createChapter: (projectId: string, title: string) =>
    window.ipcRenderer.invoke('chapters:create', { projectId, title }) as Promise<Project | null>,
  saveChapter: (projectId: string, chapterId: string, content: string) =>
    window.ipcRenderer.invoke('chapters:save', { projectId, chapterId, content }) as Promise<Project | null>,
  autosaveChapter: (projectId: string, chapterId: string, content: string) =>
    window.ipcRenderer.invoke('chapters:autosave', { projectId, chapterId, content }) as Promise<{
      autosaveTimestamp: number
    }>,
  renameProject: (projectId: string, title: string) =>
    window.ipcRenderer.invoke('projects:rename', { projectId, title }) as Promise<Project | null>,
  updateProjectDescription: (projectId: string, description: string) =>
    window.ipcRenderer.invoke('projects:updateDescription', { projectId, description }) as Promise<Project | null>,
  deleteProject: (projectId: string) => window.ipcRenderer.invoke('projects:delete', { projectId }) as Promise<boolean>,
  reorderProjects: (order: string[]) =>
    window.ipcRenderer.invoke('projects:reorder', { order }) as Promise<Project[]>,
  listSnapshots: (projectId: string, chapterId: string) =>
    window.ipcRenderer.invoke('snapshots:list', { projectId, chapterId }) as Promise<ChapterSnapshot[]>,
  readSnapshot: (projectId: string, chapterId: string, timestamp: number) =>
    window.ipcRenderer.invoke('snapshots:read', { projectId, chapterId, timestamp }) as Promise<string | null>
}
