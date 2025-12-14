import { Chapter, ChapterSnapshot, ThemeMode } from '../../../shared/types'
import { TimelinePanel } from './TimelinePanel'
import { ModalPortal } from '../../../shared/components/ModalPortal'
import type { AppLanguage } from '../../../stores/uiStore'
import { t, formatWordLabel } from '../../../shared/i18n'

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
  language: AppLanguage
  onToggleLanguage: () => void
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
  language,
  onToggleLanguage,
  onSaveChapter
}: EditorPanelProps) => {
  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return language === 'zh' ? '尚未保存' : 'Not saved yet'
    const diffMs = currentTime - timestamp
    const diffSeconds = Math.floor(diffMs / 1000)
    if (diffSeconds < 5) return language === 'zh' ? '刚刚' : 'just now'
    if (diffSeconds < 60) return language === 'zh' ? `${diffSeconds} 秒前` : `${diffSeconds} seconds ago`
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return language === 'zh' ? `${diffMinutes} 分钟前` : `${diffMinutes} minutes ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return language === 'zh' ? `${diffHours} 小时前` : `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return language === 'zh' ? `${diffDays} 天前` : `${diffDays} days ago`
  }

  const autosaveLabel = () => {
    if (!chapter) return t(language, 'editorAutosaveReady')
    const wordsLabel = formatWordLabel(language, chapter.words)
    if (isAutosaving) return `${wordsLabel} · ${t(language, 'editorAutosaveSaving')}`
    return `${wordsLabel} · ${t(language, 'editorAutosaveActive')} · ${formatRelativeTime(autosaveTimestamp)}`
  }
  const themeToggleLabel =
    theme === 'dark' ? t(language, 'buttonToggleLight') : t(language, 'buttonToggleDark')

  return (
    <main className="panel editor-panel">
      <header className="editor-header">
        <div>
          <p className="muted">{projectTitle ?? t(language, 'editorProjectPlaceholder')}</p>
          <h1>{chapter?.title ?? t(language, 'editorChapterPlaceholder')}</h1>
        </div>
      <div className="editor-actions">
        <button className="ghost" onClick={onToggleTheme}>
          {themeToggleLabel}
        </button>
        <button className="ghost" onClick={onToggleLanguage}>
          {language === 'zh' ? t(language, 'toggleToEnglish') : t(language, 'toggleToChinese')}
        </button>
        <button className="ghost" onClick={onSaveChapter} disabled={!chapter}>
          {t(language, 'buttonSaveChapter')}
        </button>
        <button className="ghost" onClick={onOpenTimeline} disabled={!chapter || disableTimeline}>
          {t(language, 'actionOpenHistory')}
        </button>
        <button className="primary">{t(language, 'actionFocusMode')}</button>
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
        <p className="muted">{t(language, 'labelPace')}</p>
        <strong>{chapter?.pace ?? '--'}</strong>
      </div>
      <div>
        <p className="muted">{t(language, 'labelMood')}</p>
        <strong>{chapter?.mood ?? '--'}</strong>
      </div>
      <div>
        <p className="muted">{t(language, 'labelSummary')}</p>
        <p className="summary">{chapter?.summary ?? t(language, 'editorNoSummary')}</p>
      </div>
    </section>

    <section className="editor-body">
      <textarea
        value={chapter ? draftText : ''}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={chapter ? t(language, 'editorTextareaPlaceholder') : t(language, 'editorChapterPlaceholder')}
        disabled={!chapter}
      />
    </section>

    <footer className="editor-footer">
      <p className="muted">{autosaveLabel()}</p>
      <div className="footer-actions">
        <button className="mini ghost">{t(language, 'actionMarkTodo')}</button>
        <button className="mini primary">{t(language, 'actionExportSnippet')}</button>
      </div>
    </footer>
    </main>
  )
}

export default EditorPanel
