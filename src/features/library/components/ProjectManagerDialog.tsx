import { useMemo, useRef, useState } from 'react'
import { Project } from '../../../shared/types'
import { ModalPortal } from '../../../shared/components/ModalPortal'

type SortMode = 'manual' | 'updated' | 'created' | 'title'

interface ProjectManagerDialogProps {
  open: boolean
  projects: Project[]
  activeProjectId?: string
  onCreate: (title: string, description?: string) => Promise<void> | void
  onRename: (projectId: string, title: string) => Promise<void> | void
  onDelete: (projectId: string) => Promise<void> | void
  onReorder: (order: string[]) => Promise<void> | void
  onSelect: (projectId: string) => void
  onUpdateDescription: (projectId: string, description: string) => Promise<void> | void
  onClose: () => void
}

export const ProjectManagerDialog = ({
  open,
  projects,
  activeProjectId,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onSelect,
  onUpdateDescription,
  onClose
}: ProjectManagerDialogProps) => {
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('manual')
  const gridRef = useRef<HTMLDivElement>(null)

  const pendingDeleteProject = useMemo(
    () => projects.find((project) => project.id === pendingDeleteId),
    [projects, pendingDeleteId]
  )

  const canDrag = sortMode === 'manual' && searchQuery.trim().length === 0

  const displayProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const ordered: Project[] =
      sortMode === 'manual'
        ? projects
        : [...projects].sort((a, b) => {
            if (sortMode === 'updated') {
              return b.updatedAt - a.updatedAt
            }
            if (sortMode === 'created') {
              return b.createdAt - a.createdAt
            }
            return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
          })

    if (!normalizedQuery) {
      return ordered
    }

    return ordered.filter((project) => {
      const haystack = `${project.title} ${project.description ?? ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [projects, searchQuery, sortMode])

  if (!open) return null

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = createTitle.trim()
    if (!trimmed) return
    await onCreate(trimmed, createDescription.trim())
    setCreateTitle('')
    setCreateDescription('')
  }

  const startRename = (project: Project) => {
    setEditingId(project.id)
    setEditTitle(project.title)
  }

  const submitRename = async () => {
    if (!editingId) return
    const trimmed = editTitle.trim()
    if (!trimmed) return
    await onRename(editingId, trimmed)
    setEditingId(null)
    setEditTitle('')
  }

  const startDescriptionEdit = (project: Project) => {
    setEditingDescriptionId(project.id)
    setDescriptionDraft(project.description ?? '')
  }

  const submitDescription = async () => {
    if (!editingDescriptionId) return
    await onUpdateDescription(editingDescriptionId, descriptionDraft.trim())
    setEditingDescriptionId(null)
    setDescriptionDraft('')
  }

  const resolveGridTarget = (clientY: number) => {
    const container = gridRef.current
    if (!container) return { targetId: null, position: 'after' as const }
    const cards = Array.from(container.querySelectorAll<HTMLDivElement>('[data-project-id]'))
    if (cards.length === 0) return { targetId: null, position: 'after' as const }
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        return { targetId: card.dataset.projectId ?? null, position: 'before' as const }
      }
    }
    return { targetId: cards[cards.length - 1].dataset.projectId ?? null, position: 'after' as const }
  }

  const handleReorder = async (targetId: string | null, position: 'before' | 'after') => {
    if (!canDrag || !draggingId || draggingId === targetId) {
      setDraggingId(null)
      return
    }
    const order = projects.map((project) => project.id)
    const fromIndex = order.indexOf(draggingId)
    const targetIndex = targetId ? order.indexOf(targetId) : order.length
    if (fromIndex === -1 || targetIndex === -1) {
      setDraggingId(null)
      return
    }
    const nextOrder = [...order]
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
    nextOrder.splice(Math.max(0, Math.min(insertIndex, nextOrder.length)), 0, moved)
    await onReorder(nextOrder)
    setDraggingId(null)
  }

  return (
    <ModalPortal>
      <div className="modal-overlay">
        <div className="modal-content project-manager">
        <header className="modal-header">
          <div>
            <p className="muted">项目管理</p>
            <h2>作品仪表盘</h2>
          </div>
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
        </header>

        <section className="project-toolbar">
          <input
            type="search"
            placeholder="搜索标题或简介"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <label className="sort-control">
            <span>排序</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="manual">自定义顺序</option>
              <option value="updated">最近更新</option>
              <option value="created">创建时间</option>
              <option value="title">标题</option>
            </select>
          </label>
        </section>

        <section className="create-project">
          <form onSubmit={handleCreate}>
            <div className="create-project__fields">
              <input
                type="text"
                placeholder="新作品标题"
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
              />
              <textarea
                placeholder="可选：添加简介，用于检索、提示创作方向"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                rows={2}
              />
            </div>
            <div className="create-project__actions">
              <button className="primary" type="submit">
                创建
              </button>
            </div>
          </form>
          <p className="muted">
            基础排序遵循创建时间。拖拽仅在“自定义顺序”且无搜索时可用，其他排序仅改变当前视图，方便快速筛查。
          </p>
        </section>

        <section
          ref={gridRef}
          className="project-grid"
          onDragOver={(event) => {
            if (!canDrag) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            const container = gridRef.current
            if (container) {
              const rect = container.getBoundingClientRect()
              const threshold = 60
              if (event.clientY - rect.top < threshold) {
                container.scrollTop -= 18
              } else if (rect.bottom - event.clientY < threshold) {
                container.scrollTop += 18
              }
            }
          }}
          onDrop={(event) => {
            if (!canDrag) return
            event.preventDefault()
            const target = resolveGridTarget(event.clientY)
            handleReorder(target.targetId, target.position)
          }}
        >
          {displayProjects.length === 0 && (
            <p className="muted">{projects.length === 0 ? '还没有作品，填写上方表单开始新故事吧。' : '未找到符合搜索条件的作品。'}</p>
          )}
          {displayProjects.map((project) => {
            const isActive = project.id === activeProjectId
            const createdAt = new Date(project.createdAt ?? Date.now()).toLocaleDateString()
            const latestChapter = project.chapters.reduce(
              (latest, chapter) => {
                if (!latest) return chapter
                const latestTime = latest.updatedAt ?? 0
                const chapterTime = chapter.updatedAt ?? 0
                return chapterTime > latestTime ? chapter : latest
              },
              undefined as Project['chapters'][number] | undefined
            )
            const lastUpdatedLabel = latestChapter ? latestChapter.title : '暂无章节'
            const lastUpdatedTime = latestChapter
              ? new Date(latestChapter.updatedAt ?? Date.now()).toLocaleString()
              : '--'
            const statItems = [
              { label: '字数', value: project.stats.words.toLocaleString() },
              { label: '角色卡', value: project.stats.characters.toLocaleString() },
              { label: '章节', value: project.chapters.length.toString() },
              { label: '进度', value: `${Math.round(project.progress.overall)}%` }
            ]
            return (
              <article
                key={project.id}
                className={`project-row${draggingId === project.id ? ' dragging' : ''}${
                  isActive ? ' active' : ''
                }${!canDrag ? ' no-drag' : ''}`}
                draggable={canDrag}
                data-project-id={project.id}
                onDragStart={(event) => {
                  if (!canDrag) return
                  setDraggingId(project.id)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  if (!canDrag) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  if (!canDrag) return
                  event.preventDefault()
                  event.stopPropagation()
                  const rect = event.currentTarget.getBoundingClientRect()
                  const isBefore = event.clientY < rect.top + rect.height / 2
                  handleReorder(project.id, isBefore ? 'before' : 'after')
                }}
                onDragEnd={() => setDraggingId(null)}
                onDoubleClick={() => onSelect(project.id)}
              >
                {editingId === project.id ? (
                  <div className="project-row__edit">
                    <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} autoFocus />
                    <div className="project-row__edit-actions">
                      <button className="mini primary" type="button" onClick={submitRename}>
                        保存
                      </button>
                      <button
                        className="mini ghost"
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditTitle('')
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="project-row__content">
                    <div className="project-row__header">
                      <div className="project-row__title">
                        <h3>{project.title}</h3>
                        {isActive && <span className="project-badge">当前作品</span>}
                      </div>
                      <p className="muted small project-row__meta">
                        创建 {createdAt} · 最近更新 {lastUpdatedLabel} · 更新时间 {lastUpdatedTime}
                      </p>
                    </div>
                    <div className="project-row__actions">
                      <button className="mini ghost" type="button" onClick={() => onSelect(project.id)}>
                        {isActive ? '当前作品' : '设为当前'}
                      </button>
                      <button className="mini ghost" type="button" onClick={() => startDescriptionEdit(project)}>
                        编辑简介
                      </button>
                      <button className="mini ghost" type="button" onClick={() => startRename(project)}>
                        重命名
                      </button>
                      <button className="mini ghost danger" type="button" onClick={() => setPendingDeleteId(project.id)}>
                        删除
                      </button>
                    </div>
                    {editingDescriptionId === project.id ? (
                      <div className="project-row__description-edit">
                        <textarea
                          value={descriptionDraft}
                          rows={3}
                          onChange={(event) => setDescriptionDraft(event.target.value)}
                        />
                        <div className="project-row__edit-actions">
                          <button className="mini primary" type="button" onClick={submitDescription}>
                            保存简介
                          </button>
                          <button
                            className="mini ghost"
                            type="button"
                            onClick={() => {
                              setEditingDescriptionId(null)
                              setDescriptionDraft('')
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`project-row__description${project.description ? '' : ' empty'}`}>
                        <span>{project.description || '暂无简介，点击“编辑简介”来添加内容。'}</span>
                      </p>
                    )}
                    <ul className="project-row__stats">
                      {statItems.map((item) => (
                        <li key={item.label}>
                          <span className="label">{item.label}</span>
                          <span className="value">{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            )
          })}
        </section>

        {pendingDeleteProject && (
          <div className="modal-overlay inline">
            <div className="modal-content confirm-modal">
              <header>
                <p className="muted">确认删除</p>
                <h3>{pendingDeleteProject.title}</h3>
              </header>
              <p className="muted">
                {pendingDeleteProject.id === activeProjectId
                  ? '这是当前激活的作品，删除后系统会自动切换至其他作品。该操作不可恢复，请确保已备份。'
                  : '该操作不可恢复，请确保您已备份所需内容。'}
              </p>
              <div className="confirm-modal__actions">
                <button className="ghost" type="button" onClick={() => setPendingDeleteId(null)}>
                  取消
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={async () => {
                    await onDelete(pendingDeleteProject.id)
                    setPendingDeleteId(null)
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </ModalPortal>
  )
}

export default ProjectManagerDialog
