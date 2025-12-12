import { Project } from '../../../shared/types'

interface LibrarySidebarProps {
  projects: Project[]
  activeProjectId: string
  activeChapterId: string
  onProjectSelect: (projectId: string) => void
  onChapterSelect: (chapterId: string) => void
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
  onChapterSelect
}: LibrarySidebarProps) => {
  const activeProject = projects.find((project) => project.id === activeProjectId)

  return (
    <aside className="panel sidebar">
      <div className="brand">
        <span className="accent-dot" />
        GG Novel
      </div>

      <div className="section-header">
        <p>作品库</p>
        <button className="mini ghost">管理</button>
      </div>
      <div className="project-switcher">
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
            <button className="ghost">新建章节</button>
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
