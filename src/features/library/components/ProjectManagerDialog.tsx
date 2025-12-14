import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Project } from '../../../shared/types'
import { ModalPortal } from '../../../shared/components/ModalPortal'
import { resolveLocale } from '../../../shared/i18n/utils'

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
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('manual')
  const gridRef = useRef<HTMLDivElement>(null)
  const { t, i18n } = useTranslation(['project-manager', 'common'])
  const locale = resolveLocale(i18n.language)
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const formatNumber = (value: number) => numberFormatter.format(value)
  const formatDate = (timestamp: number | undefined) =>
    new Date(timestamp ?? Date.now()).toLocaleDateString(locale)
  const formatDateTime = (timestamp: number | undefined) =>
    new Date(timestamp ?? Date.now()).toLocaleString(locale)

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

  const handleDescriptionChange = (projectId: string, value: string) => {
    setDescriptionDrafts((current) => ({
      ...current,
      [projectId]: value
    }))
  }

  const handleDescriptionBlur = async (project: Project) => {
    const currentValue = descriptionDrafts[project.id] ?? project.description ?? ''
    const trimmed = currentValue.trim()
    const existing = project.description?.trim() ?? ''
    if (trimmed === existing) return
    await onUpdateDescription(project.id, trimmed)
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
            <p className="muted">{t('project-manager:title')}</p>
          </div>
          <button className="ghost" onClick={onClose}>
            {t('project-manager:close')}
          </button>
        </header>

        <section className="project-toolbar">
          <input
            type="search"
            placeholder={t('project-manager:search.placeholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <label className="sort-control">
            <span>{t('project-manager:sort.label')}</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="manual">{t('project-manager:sort.manual')}</option>
              <option value="updated">{t('project-manager:sort.updated')}</option>
              <option value="created">{t('project-manager:sort.created')}</option>
              <option value="title">{t('project-manager:sort.title')}</option>
            </select>
          </label>
        </section>

        <section className="create-project">
          <form onSubmit={handleCreate}>
            <div className="create-project__fields">
              <input
                type="text"
                placeholder={t('project-manager:create.titlePlaceholder')}
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
              />
              <textarea
                placeholder={t('project-manager:create.descriptionPlaceholder')}
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                rows={2}
                style={{ resize: 'none' }}
              />
            </div>
            <div className="create-project__actions">
              <button className="primary" type="submit">
                {t('project-manager:create.submit')}
              </button>
            </div>
          </form>
          <p className="muted">
            {t('project-manager:create.hint')}
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
            <p className="muted">
              {projects.length === 0 ? t('project-manager:empty.noProjects') : t('project-manager:empty.noMatches')}
            </p>
          )}
          {displayProjects.map((project) => {
            const isActive = project.id === activeProjectId
            const createdAt = formatDate(project.createdAt)
            const latestChapter = project.chapters.reduce(
              (latest, chapter) => {
                if (!latest) return chapter
                const latestTime = latest.updatedAt ?? 0
                const chapterTime = chapter.updatedAt ?? 0
                return chapterTime > latestTime ? chapter : latest
              },
              undefined as Project['chapters'][number] | undefined
            )
            const lastUpdatedLabel = latestChapter ? latestChapter.title : t('project-manager:label.noChapters')
            const lastUpdatedTime = latestChapter ? formatDateTime(latestChapter.updatedAt) : t('project-manager:label.noUpdates')
            const statItems = [
              { label: t('project-manager:stats.words'), value: formatNumber(project.stats.words) },
              { label: t('project-manager:stats.characters'), value: formatNumber(project.stats.characters) },
              { label: t('project-manager:stats.chapters'), value: project.chapters.length.toString() },
              { label: t('project-manager:stats.progress'), value: `${Math.round(project.progress.overall)}%` }
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
                        {t('project-manager:save.title')}
                      </button>
                      <button
                        className="mini ghost"
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditTitle('')
                        }}
                      >
                        {t('common:action.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="project-row__content">
                    <div className="project-row__header">
                      <div className="project-row__title">
                        <h3>{project.title}</h3>
                        {isActive && <span className="project-badge">{t('project-manager:badge.active')}</span>}
                      </div>
                      <p className="muted small project-row__meta">
                        {t('project-manager:label.created')} {createdAt} · {t('project-manager:label.updated')} {lastUpdatedLabel} · {lastUpdatedTime}
                      </p>
                    </div>
                    <div className="project-row__actions">
                      <button className="mini ghost" type="button" onClick={() => onSelect(project.id)}>
                        {isActive ? t('project-manager:badge.active') : t('project-manager:action.setActive')}
                      </button>
                      <button className="mini ghost" type="button" onClick={() => startRename(project)}>
                        {t('project-manager:action.rename')}
                      </button>
                      <button className="mini ghost danger" type="button" onClick={() => setPendingDeleteId(project.id)}>
                        {t('project-manager:action.delete')}
                      </button>
                    </div>
                    <div className="project-row__description-edit inline">
                      <textarea
                        value={descriptionDrafts[project.id] ?? project.description ?? ''}
                        rows={3}
                        className="description-textarea"
                        placeholder={t('project-manager:description.placeholder')}
                        onChange={(event) => handleDescriptionChange(project.id, event.target.value)}
                        onBlur={() => handleDescriptionBlur(project)}
                        style={{ resize: 'none' }}
                      />
                      {!((descriptionDrafts[project.id] ?? project.description)?.trim()) && (
                        <p className="project-row__description-hint muted small">{t('project-manager:description.empty')}</p>
                      )}
                      <p className="project-row__description-hint muted small">{t('project-manager:description.autoSaveHint')}</p>
                    </div>
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
                <p className="muted">{t('project-manager:delete.title')}</p>
                <h3>{pendingDeleteProject.title}</h3>
              </header>
              <p className="muted">
                {pendingDeleteProject.id === activeProjectId
                  ? t('project-manager:delete.activeWarning')
                  : t('project-manager:delete.warning')}
              </p>
              <div className="confirm-modal__actions">
                <button className="ghost" type="button" onClick={() => setPendingDeleteId(null)}>
                  {t('common:action.cancel')}
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={async () => {
                    await onDelete(pendingDeleteProject.id)
                    setPendingDeleteId(null)
                  }}
                >
                  {t('common:action.delete')}
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
