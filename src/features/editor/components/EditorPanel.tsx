import { Chapter } from '../../../shared/types'

interface EditorPanelProps {
  projectTitle?: string
  chapter?: Chapter
  draftText: string
  onDraftChange: (value: string) => void
}

export const EditorPanel = ({ projectTitle, chapter, draftText, onDraftChange }: EditorPanelProps) => (
  <main className="panel editor-panel">
    <header className="editor-header">
      <div>
        <p className="muted">{projectTitle ?? '未选择项目'}</p>
        <h1>{chapter?.title ?? '选择一个章节开始写作'}</h1>
      </div>
      <div className="editor-actions">
        <button className="ghost">历史版本</button>
        <button className="primary">专注模式</button>
      </div>
    </header>

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
      <p className="muted">自动保存 · 1 分钟前</p>
      <div className="footer-actions">
        <button className="mini ghost">标记 TODO</button>
        <button className="mini primary">导出片段</button>
      </div>
    </footer>
  </main>
)

export default EditorPanel
