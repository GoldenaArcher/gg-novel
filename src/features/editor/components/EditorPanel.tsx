import { Chapter, ChapterSnapshot, ThemeMode } from '../../../shared/types'
import { TimelinePanel } from './TimelinePanel'
import { ModalPortal } from '../../../shared/components/ModalPortal'

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
  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return '尚未保存'
    const diffMs = currentTime - timestamp
    const diffSeconds = Math.floor(diffMs / 1000)
    if (diffSeconds < 5) return '刚刚'
    if (diffSeconds < 60) return `${diffSeconds} 秒前`
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} 分钟前`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} 小时前`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} 天前`
  }

  const autosaveLabel = () => {
    if (!chapter) return '自动保存 · 选择章节后开始'
    const wordsLabel = `${chapter.words.toLocaleString()} 字`
    if (isAutosaving) return `${wordsLabel} · 自动保存中...`
    return `${wordsLabel} · 自动保存 · ${formatRelativeTime(autosaveTimestamp)}`
  }

  return (
    <main className="panel editor-panel">
      <header className="editor-header">
        <div>
          <p className="muted">{projectTitle ?? '未选择项目'}</p>
          <h1>{chapter?.title ?? '选择一个章节开始写作'}</h1>
        </div>
      <div className="editor-actions">
        <button className="ghost" onClick={onToggleTheme}>
          {theme === 'dark' ? '切换到亮色' : '切换到暗色'}
        </button>
        <button className="ghost" onClick={onSaveChapter} disabled={!chapter}>
          保存章节
        </button>
        <button className="ghost" onClick={onOpenTimeline} disabled={!chapter || disableTimeline}>
          历史版本
        </button>
        <button className="primary">专注模式</button>
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
            />
          </div>
        </div>
      </ModalPortal>
    )}

    <section className="editor-meta">
      <div>
        <p className="muted">节奏</p>
        <strong>{chapter?.pace ?? '--'}</strong>
      </div>
      <div>
        <p className="muted">氛围</p>
        <strong>{chapter?.mood ?? '--'}</strong>
      </div>
      <div>
        <p className="muted">摘要</p>
        <p className="summary">{chapter?.summary ?? '选择章节后显示摘要与关键帧。'}</p>
      </div>
    </section>

    <section className="editor-body">
      <textarea
        value={chapter ? draftText : ''}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={chapter ? '开始写下一个场景...' : '先选择左侧章节'}
        disabled={!chapter}
      />
    </section>

    <footer className="editor-footer">
      <p className="muted">{autosaveLabel()}</p>
      <div className="footer-actions">
        <button className="mini ghost">标记 TODO</button>
        <button className="mini primary">导出片段</button>
      </div>
    </footer>
    </main>
  )
}

export default EditorPanel
