import { useEffect, useMemo, useState } from 'react'
import { ChapterSnapshot } from '../../../shared/types'
import { AppLanguage } from '../../../stores/uiStore'
import { t, formatWordLabel, formatEmptyContent } from '../../../shared/i18n'

interface TimelinePanelProps {
  entries: ChapterSnapshot[]
  loading: boolean
  selectedTimestamp?: number
  preview?: string
  previewLoading: boolean
  onSelect: (timestamp: number) => void
  onRestore: () => void
  onDelete: (timestamp: number) => Promise<void> | void
  deletingTimestamp?: number | null
  onClose: () => void
  language: AppLanguage
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export const TimelinePanel = ({
  entries,
  loading,
  selectedTimestamp,
  preview,
  previewLoading,
  onSelect,
  onRestore,
  onDelete,
  deletingTimestamp,
  onClose,
  language
}: TimelinePanelProps) => {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const activeEntry = useMemo(() => entries.find((entry) => entry.timestamp === pendingDelete), [entries, pendingDelete])

  useEffect(() => {
    if (pendingDelete && pendingDelete !== selectedTimestamp) {
      setPendingDelete(null)
    }
  }, [pendingDelete, selectedTimestamp])

  const requestDelete = () => {
    if (!selectedTimestamp || deletingTimestamp) return
    setPendingDelete(selectedTimestamp)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await onDelete(pendingDelete)
    setPendingDelete(null)
  }

  const cancelDelete = () => {
    if (deletingTimestamp) return
    setPendingDelete(null)
  }

  const isDeleting = pendingDelete !== null && deletingTimestamp === pendingDelete

  return (
    <section className="timeline-panel">
      <header>
        <div>
          <p className="muted small">{t(language, 'timelineSubtitle')}</p>
          <h3>{t(language, 'timelineTitle')}</h3>
        </div>
        <div className="timeline-actions">
          <button className="mini ghost" type="button" onClick={onClose}>
            {t(language, 'actionClose')}
          </button>
          <button className="mini primary" type="button" onClick={onRestore} disabled={!preview}>
            {t(language, 'actionRestoreEditor')}
          </button>
          <button
            className="mini ghost danger"
            type="button"
            disabled={!selectedTimestamp || Boolean(deletingTimestamp)}
            onClick={requestDelete}
          >
            {t(language, 'actionDeleteVersion')}
          </button>
        </div>
      </header>
      <div className="timeline-body">
        <div className="timeline-list">
          {loading ? (
            <p className="muted">{t(language, 'timelineLoading')}</p>
          ) : entries.length === 0 ? (
            <p className="muted">{t(language, 'timelineEmpty')}</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.timestamp}
                className={`timeline-entry${entry.timestamp === selectedTimestamp ? ' active' : ''}`}
                onClick={() => onSelect(entry.timestamp)}
              >
                <div>
                  <p className="timeline-entry__time">{formatTimestamp(entry.timestamp)}</p>
                  <p className="muted small">{formatWordLabel(language, entry.words)}</p>
                </div>
                <p className="timeline-entry__preview">{entry.preview || formatEmptyContent(language)}</p>
              </button>
            ))
          )}
        </div>
        <div className="timeline-preview">
          {previewLoading ? (
            <p className="muted">{t(language, 'timelinePreviewLoading')}</p>
          ) : preview ? (
            <pre>{preview}</pre>
          ) : (
            <p className="muted">{t(language, 'timelinePreviewPlaceholder')}</p>
          )}
        </div>
      </div>
      {pendingDelete && (
        <div className="timeline-confirm">
          <div className="timeline-confirm__card">
            <div>
              <p className="muted small">{t(language, 'timelineConfirmDelete')}</p>
              <h4>{formatTimestamp(pendingDelete)}</h4>
              <p className="muted small">
                {formatWordLabel(language, activeEntry?.words ?? 0)} · {activeEntry?.preview || formatEmptyContent(language)}
              </p>
              <p className="timeline-confirm__note">{t(language, 'timelineConfirmDeleteNote')}</p>
            </div>
            <div className="timeline-confirm__actions">
              <button className="ghost" type="button" onClick={cancelDelete} disabled={isDeleting}>
                {t(language, 'actionCancel')}
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t(language, 'timelineDeleting') : t(language, 'actionDeleteVersion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default TimelinePanel
