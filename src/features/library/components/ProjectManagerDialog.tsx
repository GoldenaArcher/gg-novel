import { useState } from 'react'
import { Project } from '../../../shared/types'

interface ProjectManagerDialogProps {
  open: boolean
  projects: Project[]
  activeProjectId?: string
  onCreate: (title: string) => Promise<void> | void
  onRename: (projectId: string, title: string) => Promise<void> | void
  onDelete: (projectId: string) => Promise<void> | void
  onClose: () => void
}

export const ProjectManagerDialog = ({
  open,
  projects,
  activeProjectId,
  onCreate,
  onRename,
  onDelete,
  onClose
}: ProjectManagerDialogProps) => {
  const [createTitle, setCreateTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const pendingDeleteProject = pendingDeleteId ? projects.find((project) => project.id === pendingDeleteId) : null

  if (!open) return null

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = createTitle.trim()
    if (!trimmed) return
    await onCreate(trimmed)
    setCreateTitle('')
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

  return (
    <div className="modal-overlay">
      <div className="modal-content project-manager">
        <header className="modal-header">
          <div>
            <p className="muted">项目管理</p>
            <h2>作品列表</h2>
          </div>
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
        </header>

        <section className="create-project">
          <form onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="新作品标题"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
            />
            <button className="primary" type="submit">
              创建
            </button>
          </form>
        </section>

        <section className="project-grid">
          {projects.length === 0 && <p className="muted">还没有作品，填写上方表单开始新故事吧。</p>}
          {projects.map((project) => (
            <article key={project.id} className="project-row">
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
                <>
                  <div>
                    <h3>{project.title}</h3>
                    <p className="muted">
                      {project.stats.words.toLocaleString()} 字 · {project.chapters.length} 章节
                    </p>
                  </div>
                  <div className="project-row__actions">
                    <button className="mini ghost" type="button" onClick={() => startRename(project)}>
                      重命名
                    </button>
                    <button className="mini ghost danger" type="button" onClick={() => setPendingDeleteId(project.id)}>
                      删除
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
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
                  ? '这是当前激活的作品，删除后系统会自动切换至其他作品。该操作不可恢复，请确保您已备份。'
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
  )
}

export default ProjectManagerDialog
