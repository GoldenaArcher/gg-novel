import { useEffect, useRef, useState } from 'react'
import { Project } from '../../../shared/types'

interface LibrarySidebarProps {
  projects: Project[]
  activeProjectId: string
  activeChapterId: string
  onProjectSelect: (projectId: string) => void
  onChapterSelect: (chapterId: string) => void
  onCreateProject: (title: string) => void | Promise<void>
  onCreateChapter: () => void
  onOpenProjectManager: () => void
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
  onOpenProjectManager
}: LibrarySidebarProps) => {
  const activeProject = projects.find((project) => project.id === activeProjectId)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const newProjectInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creatingProject) {
      setNewProjectTitle('')
      newProjectInputRef.current?.focus()
    }
  }, [creatingProject])

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

  return (
    <aside className="panel sidebar">
      <div className="brand">
        <span className="accent-dot" />
        GG Novel
      </div>

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
      <div className="project-switcher">
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
          <button
            key={project.id}
            className={`project-pill${project.id === activeProjectId ? ' active' : ''}`}
            onClick={() => onProjectSelect(project.id)}
          >
            <p className="project-pill__title">{project.title}</p>
            <span className="project-pill__meta">{project.stats.words.toLocaleString()} 字</span>
          </button>
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
            <button className="ghost" type="button" onClick={onCreateChapter} disabled={!activeProject}>
              新建章节
            </button>
          </div>

          <div className="section-header">
            <p>章节</p>
            <button className="mini ghost">筛选</button>
          </div>
          <div className="chapter-list">
            {activeProject.chapters.map((chapter) => (
              <button
                key={chapter.id}
                className={`chapter-item${chapter.id === activeChapterId ? ' active' : ''}`}
                onClick={() => onChapterSelect(chapter.id)}
              >
                <div>
                  <p className="chapter-title">{chapter.title}</p>
                  <p className="muted">{chapter.words.toLocaleString()} 字</p>
                </div>
                <span className={`status-badge status-${chapter.status}`}>{statusLabel[chapter.status]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

export default LibrarySidebar
