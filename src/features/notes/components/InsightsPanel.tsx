import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Note, Project } from '../../../shared/types'
import { resolveLocale } from '../../../shared/i18n/utils'

interface InsightsPanelProps {
  project?: Project
  notes?: Note[]
  progress?: Project['progress']
}

export const InsightsPanel = ({ project, notes = [], progress }: InsightsPanelProps) => {
  const { t, i18n } = useTranslation('insights')
  const locale = resolveLocale(i18n.language)
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])

  const formatNumber = (value: number) => numberFormatter.format(value)

  return (
    <section className="panel details-panel">
      {project && (
        <article className="project-card">
          <div>
            <p className="muted">{t('currentProject')}</p>
            <h2>{project.title}</h2>
          </div>
          <p className={`project-card__description${project.description ? '' : ' empty'}`}>
            {project.description?.trim() || t('noDescription')}
          </p>
          <div className="project-meta">
            <div>
              <p className="muted">{t('stats.totalWords')}</p>
              <strong>{formatNumber(project.stats.words)}</strong>
            </div>
            <div>
              <p className="muted">{t('stats.characters')}</p>
              <strong>{formatNumber(project.stats.characters)}</strong>
            </div>
          </div>
        </article>
      )}

      <div className="section-header">
        <p>{t('ideas.title')}</p>
        <button className="mini ghost">{t('ideas.all')}</button>
      </div>

      <div className="notes-grid">
        {notes.map((note) => (
          <article key={note.id} className="note-card">
            <div className="note-badge" />
            <h3>{note.title}</h3>
            <p>{note.content}</p>
          </article>
        ))}
        {notes.length === 0 && <p className="muted">{t('ideas.empty')}</p>}
      </div>

      {progress && (
        <div className="outline-card">
          <div className="section-header">
            <p>{t('progress.title')}</p>
            <span>
              {t('progress.overall')} {progress.overall}%
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
