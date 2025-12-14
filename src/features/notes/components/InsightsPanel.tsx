import { Note, Project } from '../../../shared/types'
import { useUiStore } from '../../../stores/uiStore'
import { t } from '../../../shared/i18n'

interface InsightsPanelProps {
  project?: Project
  notes?: Note[]
  progress?: Project['progress']
}

export const InsightsPanel = ({ project, notes = [], progress }: InsightsPanelProps) => {
  const language = useUiStore((state) => state.language)
  return (
    <section className="panel details-panel">
      {project && (
        <article className="project-card">
          <div>
            <p className="muted">{t(language, 'insightsCurrentProject')}</p>
            <h2>{project.title}</h2>
          </div>
          <p className={`project-card__description${project.description ? '' : ' empty'}`}>
            {project.description?.trim() || t(language, 'insightsNoDescription')}
          </p>
          <div className="project-meta">
            <div>
              <p className="muted">{t(language, 'insightsTotalWords')}</p>
              <strong>{project.stats.words.toLocaleString()}</strong>
            </div>
            <div>
              <p className="muted">{t(language, 'insightsCharacters')}</p>
              <strong>{project.stats.characters.toLocaleString()}</strong>
            </div>
          </div>
        </article>
      )}

      <div className="section-header">
        <p>{t(language, 'insightsIdeasTitle')}</p>
        <button className="mini ghost">{t(language, 'insightsIdeasAll')}</button>
      </div>

      <div className="notes-grid">
        {notes.map((note) => (
          <article key={note.id} className="note-card">
            <div className="note-badge" />
            <h3>{note.title}</h3>
            <p>{note.content}</p>
          </article>
        ))}
        {notes.length === 0 && <p className="muted">{t(language, 'insightsIdeasEmpty')}</p>}
      </div>

      {progress && (
        <div className="outline-card">
          <div className="section-header">
            <p>{t(language, 'insightsProgressTitle')}</p>
            <span>
              {t(language, 'insightsProgressOverall')} {progress.overall}%
            </span>
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
}

export default InsightsPanel
