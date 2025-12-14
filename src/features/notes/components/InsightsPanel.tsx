import { Note, Project } from '../../../shared/types'

interface InsightsPanelProps {
  project?: Project
  notes?: Note[]
  progress?: Project['progress']
}

export const InsightsPanel = ({ project, notes = [], progress }: InsightsPanelProps) => (
  <section className="panel details-panel">
    {project && (
      <article className="project-card">
        <div>
          <p className="muted">当前项目</p>
          <h2>{project.title}</h2>
        </div>
        <p className={`project-card__description${project.description ? '' : ' empty'}`}>
          {project.description?.trim() || '暂无简介，使用项目管理为作品添加描述。'}
        </p>
        <div className="project-meta">
          <div>
            <p className="muted">总字数</p>
            <strong>{project.stats.words.toLocaleString()}</strong>
          </div>
          <div>
            <p className="muted">角色卡</p>
            <strong>{project.stats.characters.toLocaleString()}</strong>
          </div>
        </div>
      </article>
    )}

    <div className="section-header">
      <p>灵感与任务</p>
      <button className="mini ghost">全部</button>
    </div>

    <div className="notes-grid">
      {notes.map((note) => (
        <article key={note.id} className="note-card">
          <div className="note-badge" />
          <h3>{note.title}</h3>
          <p>{note.content}</p>
        </article>
      ))}
      {notes.length === 0 && <p className="muted">暂时没有灵感记录，开始添加一条备忘吧。</p>}
    </div>

    {progress && (
      <div className="outline-card">
        <div className="section-header">
          <p>进度</p>
          <span>总体 {progress.overall}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-value" style={{ width: `${progress.overall}%` }} />
        </div>
        <ul className="outline-list">
          {progress.checkpoints.map((item) => (
            <li key={item.id}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    )}
  </section>
)

export default InsightsPanel
