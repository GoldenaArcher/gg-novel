import { Note, Project } from '../../../shared/types'

interface InsightsPanelProps {
  notes?: Note[]
  progress?: Project['progress']
}

export const InsightsPanel = ({ notes = [], progress }: InsightsPanelProps) => (
  <section className="panel details-panel">
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
