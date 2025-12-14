import { useEffect, useMemo, useState } from 'react'
import { ChapterSnapshot } from '../../../shared/types'

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
  onClose
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
          <button
            className="mini ghost danger"
            type="button"
            disabled={!selectedTimestamp || Boolean(deletingTimestamp)}
            onClick={requestDelete}
          >
            删除版本
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
      {pendingDelete && (
        <div className="timeline-confirm">
          <div className="timeline-confirm__card">
            <div>
              <p className="muted small">确认删除</p>
              <h4>{formatTimestamp(pendingDelete)}</h4>
              <p className="muted small">
                {activeEntry?.words?.toLocaleString() ?? 0} 字 · {activeEntry?.preview || '（空内容）'}
              </p>
              <p className="timeline-confirm__note">此操作不可撤销，将彻底移除该历史版本。</p>
            </div>
            <div className="timeline-confirm__actions">
              <button className="ghost" type="button" onClick={cancelDelete} disabled={isDeleting}>
                取消
              </button>
              <button
                className="danger"
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '删除版本'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default TimelinePanel
