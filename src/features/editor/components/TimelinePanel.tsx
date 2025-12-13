import { ChapterSnapshot } from '../../../shared/types'

interface TimelinePanelProps {
  open: boolean
  entries: ChapterSnapshot[]
  loading: boolean
  selectedTimestamp?: number
  preview?: string
  previewLoading: boolean
  onSelect: (timestamp: number) => void
  onRestore: () => void
  onClose: () => void
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export const TimelinePanel = ({
  open,
  entries,
  loading,
  selectedTimestamp,
  preview,
  previewLoading,
  onSelect,
  onRestore,
  onClose
}: TimelinePanelProps) => {
  if (!open) return null

  return (
    <section className="timeline-panel">
      <header>
        <div>
          <p className="muted small">历史版本</p>
          <h3>Timeline</h3>
        </div>
        <div className="timeline-actions">
          <button className="mini ghost" type="button" onClick={onClose}>
            关闭
          </button>
          <button className="mini primary" type="button" onClick={onRestore} disabled={!preview}>
            恢复到编辑器
          </button>
        </div>
      </header>
      <div className="timeline-body">
        <div className="timeline-list">
          {loading ? (
            <p className="muted">加载历史版本中...</p>
          ) : entries.length === 0 ? (
            <p className="muted">暂无历史版本，保存章节后将自动生成快照。</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.timestamp}
                className={`timeline-entry${entry.timestamp === selectedTimestamp ? ' active' : ''}`}
                onClick={() => onSelect(entry.timestamp)}
              >
                <div>
                  <p className="timeline-entry__time">{formatTimestamp(entry.timestamp)}</p>
                  <p className="muted small">{entry.words.toLocaleString()} 字</p>
                </div>
                <p className="timeline-entry__preview">{entry.preview || '（空内容）'}</p>
              </button>
            ))
          )}
        </div>
        <div className="timeline-preview">
          {previewLoading ? (
            <p className="muted">读取版本中...</p>
          ) : preview ? (
            <pre>{preview}</pre>
          ) : (
            <p className="muted">选择左侧版本查看内容，或恢复至编辑器。</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default TimelinePanel
