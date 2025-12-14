import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChapterSnapshot } from '../../../shared/types'
import { resolveLocale } from '../../../shared/i18n/utils'

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
}

const formatTimestamp = (timestamp: number, locale: string) => {
  const date = new Date(timestamp)
  return date.toLocaleString(locale)
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
  onClose
}: TimelinePanelProps) => {
  const { t, i18n } = useTranslation(['timeline', 'common'])
  const locale = resolveLocale(i18n.language)
  const formatWords = (value: number) => t('timeline:words', { count: value })
  const emptyContent = t('timeline:preview.emptyContent')

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
          <p className="muted small">{t('timeline:subtitle')}</p>
          <h3>{t('timeline:title')}</h3>
        </div>
        <div className="timeline-actions">
          <button className="mini ghost" type="button" onClick={onClose}>
            {t('common:action.close')}
          </button>
          <button className="mini primary" type="button" onClick={onRestore} disabled={!preview}>
            {t('timeline:action.restore')}
          </button>
          <button
            className="mini ghost danger"
            type="button"
            disabled={!selectedTimestamp || Boolean(deletingTimestamp)}
            onClick={requestDelete}
          >
            {t('timeline:action.delete')}
          </button>
        </div>
      </header>
      <div className="timeline-body">
        <div className="timeline-list">
          {loading ? (
            <p className="muted">{t('timeline:loading')}</p>
          ) : entries.length === 0 ? (
            <p className="muted">{t('timeline:empty')}</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.timestamp}
                className={`timeline-entry${entry.timestamp === selectedTimestamp ? ' active' : ''}`}
                onClick={() => onSelect(entry.timestamp)}
              >
                <div>
                  <p className="timeline-entry__time">{formatTimestamp(entry.timestamp, locale)}</p>
                  <p className="muted small">{formatWords(entry.words)}</p>
                </div>
                <p className="timeline-entry__preview">{entry.preview || emptyContent}</p>
              </button>
            ))
          )}
        </div>
        <div className="timeline-preview">
          {previewLoading ? (
            <p className="muted">{t('timeline:preview.loading')}</p>
          ) : preview ? (
            <pre>{preview}</pre>
          ) : (
            <p className="muted">{t('timeline:preview.placeholder')}</p>
          )}
        </div>
      </div>
      {pendingDelete && (
        <div className="timeline-confirm">
          <div className="timeline-confirm__card">
            <div>
              <p className="muted small">{t('timeline:confirm.delete')}</p>
              <h4>{formatTimestamp(pendingDelete, locale)}</h4>
              <p className="muted small">
                {formatWords(activeEntry?.words ?? 0)} · {activeEntry?.preview || emptyContent}
              </p>
              <p className="timeline-confirm__note">{t('timeline:confirm.deleteNote')}</p>
            </div>
            <div className="timeline-confirm__actions">
              <button className="ghost" type="button" onClick={cancelDelete} disabled={isDeleting}>
                {t('common:action.cancel')}
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('timeline:deleting') : t('timeline:action.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default TimelinePanel
