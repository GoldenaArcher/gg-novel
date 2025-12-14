import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  autosaveChapter,
  createChapter,
  createProject,
  deleteChapter,
  deleteProject,
  listProjects,
  readSnapshot,
  renameProject,
  reorderChapters,
  reorderProjects,
  saveChapter,
  updateProjectDescription,
  listSnapshots,
  deleteSnapshot
} from './services/projectStore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const registerIpcHandlers = () => {
  ipcMain.handle('projects:list', async () => {
    const projects = await listProjects()
    return projects
  })

  ipcMain.handle('projects:create', async (_event, payload: { title: string; description?: string }) => {
    const project = await createProject(payload.title, payload.description)
    return project
  })

  ipcMain.handle(
    'chapters:create',
    async (_event, payload: { projectId: string; title: string }) => {
      const project = await createChapter(payload.projectId, payload.title)
      return project
    }
  )

  ipcMain.handle(
    'chapters:save',
    async (_event, payload: { projectId: string; chapterId: string; content: string }) => {
      const project = await saveChapter(payload.projectId, payload.chapterId, payload.content)
      return project
    }
  )

  ipcMain.handle(
    'chapters:autosave',
    async (_event, payload: { projectId: string; chapterId: string; content: string }) => {
      return autosaveChapter(payload.projectId, payload.chapterId, payload.content)
    }
  )

  ipcMain.handle(
    'chapters:delete',
    async (_event, payload: { projectId: string; chapterId: string }) => {
      const project = await deleteChapter(payload.projectId, payload.chapterId)
      return project
    }
  )

  ipcMain.handle(
    'chapters:reorder',
    async (_event, payload: { projectId: string; order: string[] }) => {
      return reorderChapters(payload.projectId, payload.order)
    }
  )

  ipcMain.handle('projects:rename', async (_event, payload: { projectId: string; title: string }) => {
    return renameProject(payload.projectId, payload.title)
  })

  ipcMain.handle(
    'projects:updateDescription',
    async (_event, payload: { projectId: string; description: string }) => {
      return updateProjectDescription(payload.projectId, payload.description)
    }
  )

  ipcMain.handle('projects:delete', async (_event, payload: { projectId: string }) => {
    await deleteProject(payload.projectId)
    return true
  })

  ipcMain.handle('projects:reorder', async (_event, payload: { order: string[] }) => {
    return reorderProjects(payload.order)
  })

  ipcMain.handle(
    'snapshots:list',
    async (_event, payload: { projectId: string; chapterId: string }) => {
      return listSnapshots(payload.projectId, payload.chapterId)
    }
  )

  ipcMain.handle(
    'snapshots:read',
    async (_event, payload: { projectId: string; chapterId: string; timestamp: number }) => {
      return readSnapshot(payload.projectId, payload.chapterId, payload.timestamp)
    }
  )

  ipcMain.handle(
    'snapshots:delete',
    async (_event, payload: { projectId: string; chapterId: string; timestamp: number }) => {
      await deleteSnapshot(payload.projectId, payload.chapterId, payload.timestamp)
      return true
    }
  )
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
