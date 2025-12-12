import { useEffect, useMemo, useState } from 'react'
import '../styles/app.scss'
import { mockProjects } from '../data/mockProjects'
import { EditorPanel } from '../features/editor/components/EditorPanel'
import { LibrarySidebar } from '../features/library/components/LibrarySidebar'
import { InsightsPanel } from '../features/notes/components/InsightsPanel'

function App() {
  const [projects] = useState(mockProjects)
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? '')

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId]
  )

  const [activeChapterId, setActiveChapterId] = useState(activeProject?.chapters[0]?.id ?? '')
  const activeChapter = useMemo(
    () => activeProject?.chapters.find((chapter) => chapter.id === activeChapterId),
    [activeProject, activeChapterId]
  )

  const [draftText, setDraftText] = useState(activeChapter?.draft ?? '')

  useEffect(() => {
    setActiveChapterId(activeProject?.chapters[0]?.id ?? '')
  }, [activeProject])

  useEffect(() => {
    setDraftText(activeChapter?.draft ?? '')
  }, [activeChapter?.id, activeChapter?.draft])

  return (
    <div className="app-shell">
      <LibrarySidebar
        projects={projects}
        activeProjectId={activeProjectId}
        activeChapterId={activeChapterId}
        onProjectSelect={setActiveProjectId}
        onChapterSelect={setActiveChapterId}
      />

      <EditorPanel
        projectTitle={activeProject?.title}
        chapter={activeChapter}
        draftText={draftText}
        onDraftChange={setDraftText}
      />

      <InsightsPanel notes={activeProject?.notes} progress={activeProject?.progress} />
    </div>
  )
}

export default App
