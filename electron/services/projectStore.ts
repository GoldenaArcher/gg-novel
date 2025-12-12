import { app } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Chapter, Project } from '../../src/shared/types'

type ChapterMeta = Omit<Chapter, 'draft' | 'autosaveTimestamp'>
type ProjectMeta = Omit<Project, 'chapters'> & { chapters: ChapterMeta[] }

const DATA_ROOT = path.join(app.getPath('userData'), 'workspace')
const PROJECTS_ROOT = path.join(DATA_ROOT, 'projects')
const MAX_SNAPSHOTS = 20

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true })
}

const getProjectDir = (projectId: string) => path.join(PROJECTS_ROOT, projectId)
const getProjectMetaPath = (projectId: string) => path.join(getProjectDir(projectId), 'project.json')
const getChapterFilePath = (projectId: string, chapterId: string) =>
  path.join(getProjectDir(projectId), 'chapters', `${chapterId}.md`)
const getAutosavePath = (projectId: string, chapterId: string) =>
  path.join(getProjectDir(projectId), 'autosave', `${chapterId}.draft`)
const getSnapshotDir = (projectId: string, chapterId: string) =>
  path.join(getProjectDir(projectId), 'timeline', chapterId)
const getSnapshotPath = (projectId: string, chapterId: string, timestamp: number) =>
  path.join(getSnapshotDir(projectId, chapterId), `${timestamp}.snapshot`)

const readFileIfExists = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

const removeFileIfExists = async (filePath: string) => {
  try {
    await fs.rm(filePath, { force: true })
  } catch {
    // ignore
  }
}

const loadProjectMeta = async (projectId: string): Promise<ProjectMeta | null> => {
  try {
    const raw = await fs.readFile(getProjectMetaPath(projectId), 'utf-8')
    return JSON.parse(raw) as ProjectMeta
  } catch {
    return null
  }
}

const writeProjectMeta = async (projectId: string, meta: ProjectMeta) => {
  await ensureDir(getProjectDir(projectId))
  await fs.writeFile(getProjectMetaPath(projectId), JSON.stringify(meta, null, 2), 'utf-8')
}

const loadChapterWithAutosave = async (projectId: string, chapterMeta: ChapterMeta): Promise<Chapter> => {
  const canonicalPath = getChapterFilePath(projectId, chapterMeta.id)
  const autosavePath = getAutosavePath(projectId, chapterMeta.id)
  const canonicalStat = await fs
    .stat(canonicalPath)
    .catch(() => ({ mtimeMs: 0 }))
  const autosaveStat = await fs
    .stat(autosavePath)
    .catch(() => ({ mtimeMs: 0 }))

  let draft = await readFileIfExists(canonicalPath)
  let autosaveTimestamp: number | undefined

  if (autosaveStat.mtimeMs > canonicalStat.mtimeMs) {
    draft = await readFileIfExists(autosavePath)
    autosaveTimestamp = autosaveStat.mtimeMs
  }

  return {
    ...chapterMeta,
    draft,
    autosaveTimestamp
  }
}

const updateProjectStats = (meta: ProjectMeta) => {
  meta.stats.words = meta.chapters.reduce((sum, chapter) => sum + (chapter.words ?? 0), 0)
}

const recordSnapshot = async (projectId: string, chapterId: string, content: string) => {
  const dir = getSnapshotDir(projectId, chapterId)
  await ensureDir(dir)
  const timestamp = Date.now()
  await fs.writeFile(getSnapshotPath(projectId, chapterId, timestamp), content, 'utf-8')

  const files = await fs.readdir(dir)
  const sorted = files.sort()
  while (sorted.length > MAX_SNAPSHOTS) {
    const oldest = sorted.shift()
    if (oldest) {
      await fs.rm(path.join(dir, oldest), { force: true })
    }
  }
}

export const listProjects = async (): Promise<Project[]> => {
  await ensureDir(PROJECTS_ROOT)
  const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true })
  const projects: Project[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = await loadProjectMeta(entry.name)
    if (!meta) continue
    const chapters: Chapter[] = []
    for (const chapterMeta of meta.chapters) {
      const chapter = await loadChapterWithAutosave(entry.name, chapterMeta)
      chapters.push(chapter)
    }
    projects.push({
      ...meta,
      chapters
    })
  }

  return projects
}

const readProject = async (projectId: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null

  const chapters: Chapter[] = []
  for (const chapterMeta of meta.chapters) {
    const chapter = await loadChapterWithAutosave(projectId, chapterMeta)
    chapters.push(chapter)
  }

  return {
    ...meta,
    chapters
  }
}

export const createProject = async (title: string): Promise<Project> => {
  await ensureDir(PROJECTS_ROOT)
  const id = crypto.randomUUID()
  const projectDir = getProjectDir(id)
  await ensureDir(projectDir)
  await ensureDir(path.join(projectDir, 'chapters'))
  await ensureDir(path.join(projectDir, 'autosave'))
  await ensureDir(path.join(projectDir, 'timeline'))

  const initialMeta: ProjectMeta = {
    id,
    title,
    stats: {
      words: 0,
      characters: 0
    },
    chapters: [],
    notes: [],
    progress: {
      overall: 0,
      checkpoints: []
    }
  }

  await writeProjectMeta(id, initialMeta)

  return {
    ...initialMeta,
    chapters: []
  }
}

export const createChapter = async (projectId: string, title: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null

  const chapterId = crypto.randomUUID()
  const newChapter: Chapter = {
    id: chapterId,
    title,
    words: 0,
    status: 'outline',
    pace: 'balanced',
    mood: '未设定',
    summary: '',
    draft: ''
  }

  meta.chapters.push({
    id: chapterId,
    title,
    words: 0,
    status: newChapter.status,
    pace: newChapter.pace,
    mood: newChapter.mood,
    summary: newChapter.summary
  })

  updateProjectStats(meta)

  await writeProjectMeta(projectId, meta)
  await ensureDir(path.join(getProjectDir(projectId), 'chapters'))
  await fs.writeFile(getChapterFilePath(projectId, chapterId), '', 'utf-8')

  const project = await readProject(projectId)
  return project
}

export const autosaveChapter = async (projectId: string, chapterId: string, content: string) => {
  await ensureDir(path.join(getProjectDir(projectId), 'autosave'))
  await fs.writeFile(getAutosavePath(projectId, chapterId), content, 'utf-8')
  return { autosaveTimestamp: Date.now() }
}

export const saveChapter = async (projectId: string, chapterId: string, content: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null

  const chapterMeta = meta.chapters.find((chapter) => chapter.id === chapterId)
  if (!chapterMeta) return null

  chapterMeta.words = [...content].length
  updateProjectStats(meta)

  await writeProjectMeta(projectId, meta)
  await ensureDir(path.join(getProjectDir(projectId), 'chapters'))
  await fs.writeFile(getChapterFilePath(projectId, chapterId), content, 'utf-8')
  await recordSnapshot(projectId, chapterId, content)
  await removeFileIfExists(getAutosavePath(projectId, chapterId))

  const project = await readProject(projectId)
  return project
}

export const renameProject = async (projectId: string, title: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null
  meta.title = title
  await writeProjectMeta(projectId, meta)
  const project = await readProject(projectId)
  return project
}

export const deleteProject = async (projectId: string) => {
  await fs.rm(getProjectDir(projectId), { recursive: true, force: true })
}
