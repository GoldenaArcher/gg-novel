import type { Project } from '../shared/types'

export const projectBridge = {
  listProjects: () => window.ipcRenderer.invoke('projects:list') as Promise<Project[]>,
  createProject: (title: string) => window.ipcRenderer.invoke('projects:create', { title }) as Promise<Project>,
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
  deleteProject: (projectId: string) => window.ipcRenderer.invoke('projects:delete', { projectId }) as Promise<boolean>
}
