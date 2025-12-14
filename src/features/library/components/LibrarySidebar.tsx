import { useEffect, useRef, useState } from 'react'
import { MdDelete } from 'react-icons/md'
import { Project } from '../../../shared/types'

interface LibrarySidebarProps {
  projects: Project[]
  activeProjectId: string
  activeChapterId: string
  onProjectSelect: (projectId: string) => void
  onChapterSelect: (chapterId: string) => void
  onCreateProject: (title: string, description?: string) => void | Promise<void>
  onCreateChapter: (title?: string) => void | Promise<void>
  onOpenProjectManager: () => void
  onReorderProjects: (order: string[]) => void
  onDeleteProject: (projectId: string) => void | Promise<void>
  onDeleteChapter: (projectId: string, chapterId: string) => void | Promise<void>
  onReorderChapters: (projectId: string, order: string[]) => void | Promise<void>
}

const statusLabel: Record<Project['chapters'][number]['status'], string> = {
  outline: '大纲',
  draft: '草稿',
  final: '定稿'
}

export const LibrarySidebar = ({
  projects,
  activeProjectId,
  activeChapterId,
  onProjectSelect,
  onChapterSelect,
  onCreateProject,
  onCreateChapter,
  onOpenProjectManager,
  onReorderProjects,
  onDeleteProject,
  onDeleteChapter,
  onReorderChapters
}: LibrarySidebarProps) => {
  const activeProject = projects.find((project) => project.id === activeProjectId)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const newProjectInputRef = useRef<HTMLInputElement>(null)
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null)
  const projectListRef = useRef<HTMLDivElement>(null)
  const [creatingChapter, setCreatingChapter] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const newChapterInputRef = useRef<HTMLInputElement>(null)
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null)
  const chapterListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (creatingProject) {
      setNewProjectTitle('')
      newProjectInputRef.current?.focus()
    }
  }, [creatingProject])

  useEffect(() => {
    if (creatingChapter) {
      setNewChapterTitle('')
      newChapterInputRef.current?.focus()
    }
  }, [creatingChapter])

  useEffect(() => {
    setCreatingChapter(false)
    setNewChapterTitle('')
  }, [activeProjectId])

  const cancelCreateProject = () => {
    setCreatingProject(false)
    setNewProjectTitle('')
  }

  const submitCreateProject = async () => {
    const trimmed = newProjectTitle.trim()
    if (!trimmed) {
      cancelCreateProject()
      return
    }
    await onCreateProject(trimmed)
    cancelCreateProject()
  }

  const cancelCreateChapter = () => {
    setCreatingChapter(false)
    setNewChapterTitle('')
  }

  const submitCreateChapter = async () => {
    const trimmed = newChapterTitle.trim()
    if (!trimmed) {
      cancelCreateChapter()
      return
    }
    await onCreateChapter(trimmed)
    cancelCreateChapter()
  }

  const handleReorder = async (targetId: string | null, position: 'before' | 'after') => {
    if (!draggingProjectId || draggingProjectId === targetId) {
      setDraggingProjectId(null)
      return
    }
    const currentOrder = projects.map((project) => project.id)
    const fromIndex = currentOrder.indexOf(draggingProjectId)
    const targetIndex = targetId ? currentOrder.indexOf(targetId) : currentOrder.length
    if (fromIndex === -1 || targetIndex === -1) {
      setDraggingProjectId(null)
      return
    }
    const nextOrder = [...currentOrder]
    const [moved] = nextOrder.splice(fromIndex, 1)
    const insertIndex = targetId
      ? position === 'before'
        ? fromIndex < targetIndex
          ? targetIndex - 1
          : targetIndex
        : fromIndex < targetIndex
        ? targetIndex
        : targetIndex + 1
      : nextOrder.length
    nextOrder.splice(insertIndex, 0, moved)
    await onReorderProjects(nextOrder)
    setDraggingProjectId(null)
  }

  const resolveDropTarget = (clientY: number) => {
    const container = projectListRef.current
    if (!container) return { targetId: null, position: 'after' as const }
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-project-id]'))
    if (items.length === 0) return { targetId: null, position: 'after' as const }
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        return { targetId: item.dataset.projectId ?? null, position: 'before' as const }
      }
    }
    return { targetId: items[items.length - 1].dataset.projectId ?? null, position: 'after' as const }
  }

  const resolveChapterDropTarget = (clientY: number) => {
    const container = chapterListRef.current
    if (!container) return { targetId: null, position: 'after' as const }
    const items = Array.from(container.querySelectorAll<HTMLDivElement>('[data-chapter-id]'))
    if (items.length === 0) return { targetId: null, position: 'after' as const }
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        return { targetId: item.dataset.chapterId ?? null, position: 'before' as const }
      }
    }
    return { targetId: items[items.length - 1].dataset.chapterId ?? null, position: 'after' as const }
  }

  const handleChapterReorder = async (targetId: string | null, position: 'before' | 'after') => {
    if (!activeProject || !draggingChapterId || draggingChapterId === targetId) {
      setDraggingChapterId(null)
      return
    }
    const order = activeProject.chapters.map((chapter) => chapter.id)
    const fromIndex = order.indexOf(draggingChapterId)
    const targetIndex = targetId ? order.indexOf(targetId) : order.length
    if (fromIndex === -1 || targetIndex === -1) {
      setDraggingChapterId(null)
      return
    }
    const next = [...order]
    const [moved] = next.splice(fromIndex, 1)
    const insertIndex = targetId
      ? position === 'before'
        ? fromIndex < targetIndex
          ? targetIndex - 1
          : targetIndex
        : fromIndex < targetIndex
        ? targetIndex
        : targetIndex + 1
      : next.length
    next.splice(insertIndex, 0, moved)
    await onReorderChapters(activeProject.id, next)
    setDraggingChapterId(null)
  }

  const requestProjectDelete = async (projectId: string, title: string) => {
    const confirmed = window.confirm(`确认删除作品「${title}」？该操作不可撤销。`)
    if (confirmed) {
      await onDeleteProject(projectId)
    }
  }

  const requestChapterDelete = async (chapterId: string, title: string) => {
    if (!activeProject) return
    const confirmed = window.confirm(`确认删除章节「${title}」？删除后无法恢复。`)
    if (confirmed) {
      await onDeleteChapter(activeProject.id, chapterId)
    }
  }

  return (
    <aside className="panel sidebar">
      <div className="brand">
        <span className="accent-dot" />
        GG Novel
      </div>

      <div className="sidebar-content">
        <div className="section-header">
          <p>作品库</p>
          <div className="section-actions">
            <button className="mini ghost" type="button" onClick={onOpenProjectManager}>
              管理
            </button>
            <button className="mini ghost" type="button" onClick={() => setCreatingProject(true)} disabled={creatingProject}>
              新建作品
            </button>
          </div>
        </div>

        <div
          ref={projectListRef}
          className="project-switcher"
          onDragOver={(event) => {
            event.preventDefault()
            const container = projectListRef.current
            if (container) {
              const rect = container.getBoundingClientRect()
              const threshold = 48
              if (event.clientY - rect.top < threshold) {
                container.scrollTop -= 16
              } else if (rect.bottom - event.clientY < threshold) {
                container.scrollTop += 16
              }
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            const target = resolveDropTarget(event.clientY)
            handleReorder(target.targetId, target.position)
          }}
        >
          {creatingProject && (
            <div className="project-pill creating">
              <input
                ref={newProjectInputRef}
                value={newProjectTitle}
                placeholder="输入作品名称"
                onChange={(event) => setNewProjectTitle(event.target.value)}
                onBlur={() => {
                  if (!newProjectTitle.trim()) {
                    cancelCreateProject()
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitCreateProject()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelCreateProject()
                  }
                }}
              />
            </div>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              className={`project-pill${project.id === activeProjectId ? ' active' : ''}${
                draggingProjectId === project.id ? ' dragging' : ''
              }`}
              data-project-id={project.id}
              draggable
              onDragStart={(event) => {
                setDraggingProjectId(project.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const rect = event.currentTarget.getBoundingClientRect()
                const isBefore = event.clientY < rect.top + rect.height / 2
                handleReorder(project.id, isBefore ? 'before' : 'after')
              }}
              onDragEnd={() => setDraggingProjectId(null)}
            >
              <button className="project-pill__main" type="button" onClick={() => onProjectSelect(project.id)}>
                <p className="project-pill__title">{project.title}</p>
                <span className="project-pill__meta">{project.stats.words.toLocaleString()} 字</span>
              </button>
              <button
                className="pill-action danger"
                type="button"
                aria-label={`删除作品 ${project.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  requestProjectDelete(project.id, project.title)
                }}
              >
                <MdDelete aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="empty-state">
            <p>暂无作品</p>
            <p className="muted">点击“新建作品”后即可创建并开始管理您的小说项目。</p>
          </div>
        )}

        {activeProject && (
          <>
              <div className="project-card">
                <div>
                  <p className="muted">当前项目</p>
                  <h2>{activeProject.title}</h2>
                </div>
              <p className={`project-card__description${activeProject.description ? '' : ' empty'}`}>
                {activeProject.description?.trim() || '暂无简介，使用项目管理为作品添加描述。'}
              </p>
              <div className="project-meta">
                <div>
                  <p className="muted">总字数</p>
                  <strong>{activeProject.stats.words.toLocaleString()}</strong>
                </div>
                <div>
                  <p className="muted">角色卡</p>
                  <strong>{activeProject.stats.characters}</strong>
                </div>
              </div>
            </div>

            <div className="chapter-section">
              <div className="section-header">
                <p>章节</p>
                <div className="section-actions">
                  <button className="mini ghost" type="button">
                    筛选
                  </button>
                  <button className="mini ghost" type="button" onClick={() => setCreatingChapter(true)} disabled={creatingChapter}>
                    新建章节
                  </button>
                </div>
              </div>
              <div
                className="chapter-list"
                ref={chapterListRef}
                onDragOver={(event) => {
                  event.preventDefault()
                  const container = chapterListRef.current
                  if (container) {
                    const rect = container.getBoundingClientRect()
                    const threshold = 48
                    if (event.clientY - rect.top < threshold) {
                      container.scrollTop -= 12
                    } else if (rect.bottom - event.clientY < threshold) {
                      container.scrollTop += 12
                    }
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const target = resolveChapterDropTarget(event.clientY)
                  handleChapterReorder(target.targetId, target.position)
                }}
              >
                {creatingChapter && (
                  <div className="chapter-item creating">
                    <input
                      ref={newChapterInputRef}
                      value={newChapterTitle}
                      placeholder="输入章节标题"
                      onChange={(event) => setNewChapterTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          submitCreateChapter()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelCreateChapter()
                        }
                      }}
                    />
                    <div className="chapter-create-actions">
                      <button className="mini primary" type="button" onClick={submitCreateChapter}>
                        保存
                      </button>
                      <button className="mini ghost" type="button" onClick={cancelCreateChapter}>
                        取消
                      </button>
                    </div>
                  </div>
                )}
                {activeProject.chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className={`chapter-item${chapter.id === activeChapterId ? ' active' : ''}${
                      draggingChapterId === chapter.id ? ' dragging' : ''
                    }`}
                    data-chapter-id={chapter.id}
                    draggable
                    onDragStart={(event) => {
                      setDraggingChapterId(chapter.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => setDraggingChapterId(null)}
                  >
                    <button
                      type="button"
                      className="chapter-item__main"
                      onClick={() => onChapterSelect(chapter.id)}
                    >
                      <p className="chapter-title">{chapter.title}</p>
                      <span className={`status-badge status-${chapter.status}`}>{statusLabel[chapter.status]}</span>
                    </button>
                    <div className="pill-actions">
                      <button
                        className="pill-action danger"
                        type="button"
                        aria-label={`删除章节 ${chapter.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          requestChapterDelete(chapter.id, chapter.title)
                        }}
                      >
                        <MdDelete aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

export default LibrarySidebar
