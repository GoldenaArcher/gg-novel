import { Chapter, ChapterSnapshot, ThemeMode } from '../../../shared/types'
import { TimelinePanel } from './TimelinePanel'
import { ModalPortal } from '../../../shared/components/ModalPortal'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../../../stores/uiStore'

interface EditorPanelProps {
  projectTitle?: string
  chapter?: Chapter
  draftText: string
  onDraftChange: (value: string) => void
  isAutosaving: boolean
  autosaveTimestamp?: number
  currentTime: number
  isTimelineOpen: boolean
  timelineEntries: ChapterSnapshot[]
  timelineLoading: boolean
  selectedSnapshot?: number
  snapshotPreview?: string
  snapshotPreviewLoading: boolean
  onDeleteSnapshot: (timestamp: number) => Promise<void> | void
  deletingSnapshot?: number | null
  onOpenTimeline: () => void
  onCloseTimeline: () => void
  onSelectSnapshot: (timestamp: number) => void
  onRestoreSnapshot: () => void
  disableTimeline?: boolean
  theme: ThemeMode
  onToggleTheme: () => void
  onSaveChapter: () => void
}

export const EditorPanel = ({
  projectTitle,
  chapter,
  draftText,
  onDraftChange,
  isAutosaving,
  autosaveTimestamp,
  currentTime,
  isTimelineOpen,
  timelineEntries,
  timelineLoading,
  selectedSnapshot,
  snapshotPreview,
  snapshotPreviewLoading,
  onDeleteSnapshot,
  deletingSnapshot,
  onOpenTimeline,
  onCloseTimeline,
  onSelectSnapshot,
  onRestoreSnapshot,
  disableTimeline,
  theme,
  onToggleTheme,
  onSaveChapter
}: EditorPanelProps) => {
  const { t } = useTranslation(['editor', 'common'])
  // Subscribe separately so unrelated UI store updates do not retrigger renders.
  const language = useUiStore((state) => state.language)
  const toggleLanguage = useUiStore((state) => state.toggleLanguage)
  const wordsLabel = (value: number) => t('editor:words', { count: value })

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return t('editor:time.notSavedYet')
    const diffMs = currentTime - timestamp
    const diffSeconds = Math.floor(diffMs / 1000)
    if (diffSeconds < 5) return t('editor:time.justNow')
    if (diffSeconds < 60) return t('editor:time.secondsAgo', { count: diffSeconds })
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return t('editor:time.minutesAgo', { count: diffMinutes })
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return t('editor:time.hoursAgo', { count: diffHours })
    const diffDays = Math.floor(diffHours / 24)
    return t('editor:time.daysAgo', { count: diffDays })
  }

  const autosaveLabel = () => {
    if (!chapter) return t('editor:autosave.ready')
    const words = wordsLabel(chapter.words)
    if (isAutosaving) return `${words} · ${t('editor:autosave.saving')}`
    return `${words} · ${t('editor:autosave.active')} · ${formatRelativeTime(autosaveTimestamp)}`
  }
  const themeToggleLabel =
    theme === 'dark' ? t('common:theme.toggleLight') : t('common:theme.toggleDark')

  return (
    <main className="panel editor-panel">
      <header className="editor-header">
        <div>
          <p className="muted">{projectTitle ?? t('editor:header.projectPlaceholder')}</p>
          <h1>{chapter?.title ?? t('editor:header.chapterPlaceholder')}</h1>
        </div>
        <div className="editor-actions">
          <button className="ghost" onClick={onToggleTheme}>
            {themeToggleLabel}
          </button>
          <button className="ghost" onClick={toggleLanguage}>
            {language === 'zh'
              ? t('common:language.toggleToEnglish')
              : t('common:language.toggleToChinese')}
          </button>
          <button className="ghost" onClick={onSaveChapter} disabled={!chapter}>
            {t('editor:action.saveChapter')}
          </button>
          <button className="ghost" onClick={onOpenTimeline} disabled={!chapter || disableTimeline}>
            {t('editor:action.openHistory')}
          </button>
          <button className="primary">{t('editor:action.focusMode')}</button>
        </div>
    </header>

    {isTimelineOpen && (
      <ModalPortal>
        <div className="modal-overlay">
          <div className="modal-content timeline-modal">
            <TimelinePanel
              entries={timelineEntries}
              loading={timelineLoading}
              selectedTimestamp={selectedSnapshot}
              preview={snapshotPreview}
              previewLoading={snapshotPreviewLoading}
              onSelect={onSelectSnapshot}
              onRestore={onRestoreSnapshot}
              onDelete={onDeleteSnapshot}
              deletingTimestamp={deletingSnapshot}
              onClose={onCloseTimeline}
              language={language}
            />
          </div>
        </div>
      </ModalPortal>
    )}

    <section className="editor-meta">
      <div>
        <p className="muted">{t('editor:label.pace')}</p>
        <strong>{chapter?.pace ?? '--'}</strong>
      </div>
      <div>
        <p className="muted">{t('editor:label.mood')}</p>
        <strong>{chapter?.mood ?? '--'}</strong>
      </div>
      <div>
        <p className="muted">{t('editor:label.summary')}</p>
        <p className="summary">{chapter?.summary ?? t('editor:summary.noSummary')}</p>
      </div>
    </section>

    <section className="editor-body">
      <textarea
        value={chapter ? draftText : ''}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={
          chapter ? t('editor:textarea.placeholder') : t('editor:header.chapterPlaceholder')
        }
        disabled={!chapter}
      />
    </section>

    <footer className="editor-footer">
      <p className="muted">{autosaveLabel()}</p>
      <div className="footer-actions">
        <button className="mini ghost">{t('editor:action.markTodo')}</button>
        <button className="mini primary">{t('editor:action.exportSnippet')}</button>
      </div>
    </footer>
    </main>
  )
}

export default EditorPanel
