import { app } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Chapter, ChapterSnapshot, Project, StoryNodeKind } from '../../src/shared/types'

type ChapterMeta = Omit<Chapter, 'draft' | 'autosaveTimestamp' | 'children'> & {
  children?: ChapterMeta[]
}
type ProjectMeta = Omit<Project, 'structure' | 'chapters'> & { chapters: ChapterMeta[] }

const DATA_ROOT = path.join(app.getPath('userData'), 'workspace')
const PROJECTS_ROOT = path.join(DATA_ROOT, 'projects')
const ORDER_FILE = path.join(DATA_ROOT, 'projects.json')
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
const SNAPSHOT_PREVIEW_LIMIT = 200
const DEFAULT_CHAPTER_KIND: StoryNodeKind = 'chapter'

const normalizeChapterTree = (chapters: ChapterMeta[], fallbackTime: number): ChapterMeta[] => {
  chapters.forEach((chapter) => {
    chapter.kind = chapter.kind ?? DEFAULT_CHAPTER_KIND
    chapter.children = normalizeChapterTree(chapter.children ?? [], fallbackTime)
    chapter.updatedAt = chapter.updatedAt ?? fallbackTime
    chapter.words = chapter.words ?? 0
    chapter.summary = chapter.summary ?? ''
    chapter.pace = chapter.pace ?? 'balanced'
    chapter.mood = chapter.mood ?? '未设定'
    chapter.status = chapter.status ?? 'outline'
    if (chapter.kind === 'group') {
      chapter.words = chapter.children.reduce((sum, child) => sum + child.words, 0)
    }
  })
  return chapters
}

const flattenChapterTree = (chapters: Chapter[]): Chapter[] => {
  const leaves: Chapter[] = []
  const walk = (node: Chapter) => {
    if (node.kind === 'chapter') {
      leaves.push(node)
    }
    node.children?.forEach(walk)
  }
  chapters.forEach(walk)
  return leaves
}

const findChapterMeta = (nodes: ChapterMeta[], chapterId: string): ChapterMeta | null => {
  for (const node of nodes) {
    if (node.id === chapterId) return node
    const childMatch = findChapterMeta(node.children ?? [], chapterId)
    if (childMatch) return childMatch
  }
  return null
}

const findChapterMetaWithParent = (
  nodes: ChapterMeta[],
  chapterId: string,
  parent: ChapterMeta | null = null
): { node: ChapterMeta; parent: ChapterMeta | null } | null => {
  for (const node of nodes) {
    if (node.id === chapterId) {
      return { node, parent }
    }
    const match = findChapterMetaWithParent(node.children ?? [], chapterId, node)
    if (match) return match
  }
  return null
}

const removeChapterMeta = (nodes: ChapterMeta[], chapterId: string): ChapterMeta | null => {
  const index = nodes.findIndex((chapter) => chapter.id === chapterId)
  if (index >= 0) {
    const [removed] = nodes.splice(index, 1)
    return removed
  }
  for (const node of nodes) {
    const removed = removeChapterMeta(node.children ?? [], chapterId)
    if (removed) return removed
  }
  return null
}

const insertChapterMeta = (nodes: ChapterMeta[], parentId: string | undefined, node: ChapterMeta): boolean => {
  if (!parentId) {
    nodes.push(node)
    return true
  }
  for (const current of nodes) {
    if (current.id === parentId) {
      current.children = current.children ?? []
      current.children.push(node)
      return true
    }
    if (insertChapterMeta(current.children ?? [], parentId, node)) {
      return true
    }
  }
  return false
}

const reorderChapterChildren = (nodes: ChapterMeta[], parentId: string | null, order: string[]): boolean => {
  const targetCollection = parentId
    ? findChapterMeta(nodes, parentId)?.children
    : nodes
  if (!targetCollection) return false
  const map = new Map(targetCollection.map((child) => [child.id, child]))
  const reordered: ChapterMeta[] = []
  order.forEach((id) => {
    const item = map.get(id)
    if (item) {
      reordered.push(item)
      map.delete(id)
    }
  })
  map.forEach((value) => reordered.push(value))
  if (parentId) {
    const parent = findChapterMeta(nodes, parentId)
    if (parent) {
      parent.children = reordered
      return true
    }
  } else {
    nodes.splice(0, nodes.length, ...reordered)
    return true
  }
  return false
}

const collectChapterIds = (node: ChapterMeta): string[] => {
  if (node.kind === 'chapter') {
    return [node.id]
  }
  return (node.children ?? []).flatMap(collectChapterIds)
}

const refreshAggregateWords = (node: ChapterMeta): number => {
  if (node.kind === 'chapter') {
    node.words = node.words ?? 0
    return node.words
  }
  const total = (node.children ?? []).reduce((sum, child) => sum + refreshAggregateWords(child), 0)
  node.words = total
  return total
}

const refreshProjectAggregates = (meta: ProjectMeta) => {
  meta.chapters.forEach(refreshAggregateWords)
  updateProjectStats(meta)
}

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
    const meta = JSON.parse(raw) as ProjectMeta
    let dirty = false
    if (!meta.createdAt) {
      meta.createdAt = Date.now()
      dirty = true
    }
    if (!meta.updatedAt) {
      meta.updatedAt = meta.createdAt ?? Date.now()
      dirty = true
    }
    if (typeof meta.description !== 'string') {
      meta.description = ''
      dirty = true
    }
    if (!Array.isArray(meta.chapters)) {
      meta.chapters = []
      dirty = true
    }
    const fallbackTime = meta.updatedAt ?? meta.createdAt ?? Date.now()
    meta.chapters = normalizeChapterTree(meta.chapters, fallbackTime)
    refreshProjectAggregates(meta)
    if (dirty) {
      await writeProjectMeta(projectId, meta)
    }
    return meta
  } catch {
    return null
  }
}

const writeProjectMeta = async (projectId: string, meta: ProjectMeta) => {
  await ensureDir(getProjectDir(projectId))
  await fs.writeFile(getProjectMetaPath(projectId), JSON.stringify(meta, null, 2), 'utf-8')
}

const loadProjectOrder = async (): Promise<string[]> => {
  try {
    const raw = await fs.readFile(ORDER_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as { order: string[] }
    return Array.isArray(parsed.order) ? parsed.order : []
  } catch {
    return []
  }
}

const saveProjectOrder = async (order: string[]) => {
  await ensureDir(DATA_ROOT)
  await fs.writeFile(ORDER_FILE, JSON.stringify({ order }, null, 2), 'utf-8')
}

const loadChapterWithAutosave = async (projectId: string, chapterMeta: ChapterMeta): Promise<Chapter> => {
  const children = await Promise.all((chapterMeta.children ?? []).map((child) => loadChapterWithAutosave(projectId, child)))
  if (chapterMeta.kind === 'group') {
    return {
      ...chapterMeta,
      draft: '',
      autosaveTimestamp: undefined,
      children
    }
  }
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
    autosaveTimestamp,
    updatedAt: chapterMeta.updatedAt ?? Math.max(canonicalStat.mtimeMs, autosaveStat.mtimeMs, Date.now()),
    children
  }
}

const sumLeafWords = (chapters: ChapterMeta[]): number => {
  return chapters.reduce((sum, chapter) => {
    if (chapter.kind === 'chapter') {
      return sum + (chapter.words ?? 0)
    }
    return sum + sumLeafWords(chapter.children ?? [])
  }, 0)
}

const updateProjectStats = (meta: ProjectMeta) => {
  meta.stats.words = sumLeafWords(meta.chapters)
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
  const projectsMap = new Map<string, Project>()

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = await loadProjectMeta(entry.name)
    if (!meta) continue
    const structure: Chapter[] = []
    for (const chapterMeta of meta.chapters) {
      const chapter = await loadChapterWithAutosave(entry.name, chapterMeta)
      structure.push(chapter)
    }
    const flatChapters = flattenChapterTree(structure)
    const { chapters: _ignored, ...restMeta } = meta
    projectsMap.set(entry.name, {
      ...restMeta,
      structure,
      chapters: flatChapters
    })
  }

  const order = await loadProjectOrder()
  const orderedIds: string[] = []
  const missing: Project[] = []

  for (const id of order) {
    if (projectsMap.has(id)) {
      orderedIds.push(id)
    }
  }

  for (const project of projectsMap.values()) {
    if (!orderedIds.includes(project.id)) {
      missing.push(project)
    }
  }

  missing.sort((a, b) => a.createdAt - b.createdAt)
  const normalizedOrder = [...orderedIds, ...missing.map((project) => project.id)]

  if (normalizedOrder.length !== order.length || normalizedOrder.some((id, index) => id !== order[index])) {
    await saveProjectOrder(normalizedOrder)
  }

  return normalizedOrder.map((id) => projectsMap.get(id)!).filter(Boolean)
}

const buildSnapshotPreview = (content: string) => {
  const collapsed = content.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= SNAPSHOT_PREVIEW_LIMIT) {
    return collapsed
  }
  return `${collapsed.slice(0, SNAPSHOT_PREVIEW_LIMIT)}...`
}

const readProject = async (projectId: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null

  const structure: Chapter[] = []
  for (const chapterMeta of meta.chapters) {
    const chapter = await loadChapterWithAutosave(projectId, chapterMeta)
    structure.push(chapter)
  }
  const flatChapters = flattenChapterTree(structure)
  const { chapters: _ignored, ...restMeta } = meta

  return {
    ...restMeta,
    structure,
    chapters: flatChapters
  }
}

export const createProject = async (title: string, description = ''): Promise<Project> => {
  await ensureDir(PROJECTS_ROOT)
  const id = crypto.randomUUID()
  const projectDir = getProjectDir(id)
  await ensureDir(projectDir)
  await ensureDir(path.join(projectDir, 'chapters'))
  await ensureDir(path.join(projectDir, 'autosave'))
  await ensureDir(path.join(projectDir, 'timeline'))

  const now = Date.now()

  const initialMeta: ProjectMeta = {
    id,
    title,
    description,
    createdAt: now,
    updatedAt: now,
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
  const order = await loadProjectOrder()
  order.push(id)
  await saveProjectOrder(order)

  return {
    ...initialMeta,
    structure: [],
    chapters: []
  }
}

const touchProject = (meta: ProjectMeta) => {
  meta.updatedAt = Date.now()
}

export const createChapter = async (
  projectId: string,
  title: string,
  options?: { parentId?: string; kind?: StoryNodeKind; variant?: string }
): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null

  const chapterId = crypto.randomUUID()
  const kind = options?.kind ?? DEFAULT_CHAPTER_KIND
  const nodeMeta: ChapterMeta = {
    id: chapterId,
    title,
    kind,
    variant: options?.variant,
    words: 0,
    status: 'outline',
    pace: 'balanced',
    mood: '未设定',
    summary: '',
    updatedAt: Date.now()
  }

  nodeMeta.children = []
  insertChapterMeta(meta.chapters, options?.parentId, nodeMeta)

  if (kind === 'chapter') {
    await ensureDir(path.join(getProjectDir(projectId), 'chapters'))
    await fs.writeFile(getChapterFilePath(projectId, chapterId), '', 'utf-8')
  }

  refreshProjectAggregates(meta)
  touchProject(meta)

  await writeProjectMeta(projectId, meta)

  const project = await readProject(projectId)
  return project
}

export const autosaveChapter = async (projectId: string, chapterId: string, content: string) => {
  await ensureDir(path.join(getProjectDir(projectId), 'autosave'))
  await fs.writeFile(getAutosavePath(projectId, chapterId), content, 'utf-8')
  const meta = await loadProjectMeta(projectId)
  if (meta) {
    const chapterMeta = findChapterMeta(meta.chapters, chapterId)
    if (chapterMeta) {
      chapterMeta.updatedAt = Date.now()
      chapterMeta.words = [...content].length
      refreshAggregateWords(chapterMeta)
    }
    touchProject(meta)
    await writeProjectMeta(projectId, meta)
  }
  return { autosaveTimestamp: Date.now() }
}

export const saveChapter = async (projectId: string, chapterId: string, content: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null

  const chapterMeta = findChapterMeta(meta.chapters, chapterId)
  if (!chapterMeta) return null

  const canonicalPath = getChapterFilePath(projectId, chapterId)
  const existing = await readFileIfExists(canonicalPath)
  const normalize = (value?: string | null) => (value ?? '').replace(/\s+$/g, '')
  if (normalize(existing) === normalize(content)) {
    return readProject(projectId)
  }

  chapterMeta.words = [...content].length
  chapterMeta.updatedAt = Date.now()
  refreshProjectAggregates(meta)
  touchProject(meta)

  await writeProjectMeta(projectId, meta)
  await ensureDir(path.join(getProjectDir(projectId), 'chapters'))
  await fs.writeFile(getChapterFilePath(projectId, chapterId), content, 'utf-8')
  await recordSnapshot(projectId, chapterId, content)
  await removeFileIfExists(getAutosavePath(projectId, chapterId))

  const project = await readProject(projectId)
  return project
}

export const deleteChapter = async (projectId: string, chapterId: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null
  const removed = removeChapterMeta(meta.chapters, chapterId)
  if (!removed) return null
  const leafChapterIds = collectChapterIds(removed)
  refreshProjectAggregates(meta)
  touchProject(meta)
  await writeProjectMeta(projectId, meta)
  for (const leafId of leafChapterIds) {
    await removeFileIfExists(getChapterFilePath(projectId, leafId))
    await removeFileIfExists(getAutosavePath(projectId, leafId))
    try {
      await fs.rm(getSnapshotDir(projectId, leafId), { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
  return readProject(projectId)
}

export const moveChapter = async (
  projectId: string,
  chapterId: string,
  targetParentId: string | null
): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null
  const removed = removeChapterMeta(meta.chapters, chapterId)
  if (!removed) return null
  insertChapterMeta(meta.chapters, targetParentId ?? undefined, removed)
  refreshProjectAggregates(meta)
  touchProject(meta)
  await writeProjectMeta(projectId, meta)
  return readProject(projectId)
}

export const reorderChapters = async (
  projectId: string,
  parentId: string | null,
  order: string[]
): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null
  reorderChapterChildren(meta.chapters, parentId, order)
  refreshProjectAggregates(meta)
  touchProject(meta)
  await writeProjectMeta(projectId, meta)
  return readProject(projectId)
}

export const reorderProjects = async (nextOrder: string[]): Promise<Project[]> => {
  const existing = await listProjects()
  const existingIds = existing.map((project) => project.id)
  const filtered = nextOrder.filter((id) => existingIds.includes(id))
  const remaining = existingIds.filter((id) => !filtered.includes(id))
  const finalOrder = [...filtered, ...remaining]
  await saveProjectOrder(finalOrder)
  return listProjects()
}

export const renameProject = async (projectId: string, title: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null
  meta.title = title
  touchProject(meta)
  await writeProjectMeta(projectId, meta)
  const project = await readProject(projectId)
  return project
}

export const updateProjectDescription = async (projectId: string, description: string): Promise<Project | null> => {
  const meta = await loadProjectMeta(projectId)
  if (!meta) return null
  meta.description = description
  touchProject(meta)
  await writeProjectMeta(projectId, meta)
  const project = await readProject(projectId)
  return project
}

export const deleteProject = async (projectId: string) => {
  await fs.rm(getProjectDir(projectId), { recursive: true, force: true })
}

export const listSnapshots = async (projectId: string, chapterId: string): Promise<ChapterSnapshot[]> => {
  const dir = getSnapshotDir(projectId, chapterId)
  try {
    const files = await fs.readdir(dir)
    const snapshots: ChapterSnapshot[] = []
    for (const file of files) {
      if (!file.endsWith('.snapshot')) continue
      const timestamp = Number(file.replace('.snapshot', ''))
      if (Number.isNaN(timestamp)) continue
      const content = await fs.readFile(path.join(dir, file), 'utf-8')
      snapshots.push({
        timestamp,
        words: [...content].length,
        preview: buildSnapshotPreview(content)
      })
    }
    return snapshots.sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return []
  }
}

export const readSnapshot = async (projectId: string, chapterId: string, timestamp: number): Promise<string | null> => {
  try {
    const content = await fs.readFile(getSnapshotPath(projectId, chapterId, timestamp), 'utf-8')
    return content
  } catch {
    return null
  }
}

export const deleteSnapshot = async (projectId: string, chapterId: string, timestamp: number) => {
  const target = getSnapshotPath(projectId, chapterId, timestamp)
  await fs.rm(target, { force: true })
}
