import { useCallback, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { useUiStore, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_COLLAPSE_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '../../../stores/uiStore'
import { useProjectStore } from '../../../stores/projectStore'

export const useSidebarControls = (isCompactLayout: boolean) => {
  const {
    sidebarWidth,
    sidebarCollapsed,
    resizingSidebar,
    sidebarOverlayOpen
  } = useUiStore(
    useShallow((state) => ({
      sidebarWidth: state.sidebarWidth,
      sidebarCollapsed: state.sidebarCollapsed,
      resizingSidebar: state.resizingSidebar,
      sidebarOverlayOpen: state.sidebarOverlayOpen
    }))
  )
  const {
    setSidebarWidth,
    setSidebarCollapsed,
    setResizingSidebar,
    setSidebarOverlayOpen,
    setManagerOpen
  } = useUiStore(
    useShallow((state) => ({
      setSidebarWidth: state.setSidebarWidth,
      setSidebarCollapsed: state.setSidebarCollapsed,
      setResizingSidebar: state.setResizingSidebar,
      setSidebarOverlayOpen: state.setSidebarOverlayOpen,
      setManagerOpen: state.setManagerOpen
    }))
  )
  const { setActiveProject, setActiveChapter, setAllowChapterless } = useProjectStore(
    useShallow((state) => ({
      setActiveProject: state.setActiveProject,
      setActiveChapter: state.setActiveChapter,
      setAllowChapterless: state.setAllowChapterless
    }))
  )
  const sidebarDragRef = useRef<{ startX: number; width: number } | null>(null)

  useEffect(() => {
    if (!isCompactLayout) {
      setSidebarOverlayOpen(false)
    }
  }, [isCompactLayout, setSidebarOverlayOpen])

  const startSidebarResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isCompactLayout) return
      event.preventDefault()
      const initialWidth = sidebarCollapsed ? SIDEBAR_DEFAULT_WIDTH : sidebarWidth
      sidebarDragRef.current = { startX: event.clientX, width: initialWidth }
      if (sidebarCollapsed) {
        setSidebarCollapsed(false)
        setSidebarWidth(initialWidth)
      }
      setResizingSidebar(true)
    },
    [isCompactLayout, sidebarCollapsed, sidebarWidth, setSidebarCollapsed, setSidebarWidth, setResizingSidebar]
  )

  useEffect(() => {
    if (!resizingSidebar || !sidebarDragRef.current) return
    const handleMove = (event: MouseEvent) => {
      const delta = event.clientX - sidebarDragRef.current!.startX
      let nextWidth = sidebarDragRef.current!.width + delta
      if (nextWidth <= SIDEBAR_COLLAPSE_WIDTH) {
        setSidebarCollapsed(true)
        setResizingSidebar(false)
        return
      }
      nextWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, nextWidth))
      setSidebarCollapsed(false)
      setSidebarWidth(nextWidth)
    }
    const handleUp = () => {
      setResizingSidebar(false)
      sidebarDragRef.current = null
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [
    resizingSidebar,
    setSidebarCollapsed,
    setResizingSidebar,
    setSidebarWidth
  ])

  const reopenSidebar = useCallback(() => {
    setSidebarCollapsed(false)
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
  }, [setSidebarCollapsed, setSidebarWidth])

  const handleFloatingButtonClick = useCallback(() => {
    if (isCompactLayout) {
      setSidebarOverlayOpen(true)
    } else {
      reopenSidebar()
    }
  }, [isCompactLayout, reopenSidebar, setSidebarOverlayOpen])

  const closeSidebarOverlay = useCallback(() => setSidebarOverlayOpen(false), [setSidebarOverlayOpen])

  const handleSidebarProjectSelect = useCallback(
    (projectId: string) => {
      setActiveProject(projectId)
      if (isCompactLayout) {
        setSidebarOverlayOpen(false)
      }
    },
    [isCompactLayout, setActiveProject, setSidebarOverlayOpen]
  )

  const handleSidebarChapterSelect = useCallback(
    (chapterId: string) => {
      setAllowChapterless(chapterId === '')
      setActiveChapter(chapterId)
      if (isCompactLayout) {
        setSidebarOverlayOpen(false)
      }
    },
    [isCompactLayout, setActiveChapter, setAllowChapterless, setSidebarOverlayOpen]
  )

  const handleOpenProjectManager = useCallback(() => {
    setManagerOpen(true)
    if (isCompactLayout) {
      setSidebarOverlayOpen(false)
    }
  }, [isCompactLayout, setManagerOpen, setSidebarOverlayOpen])

  const computedSidebarCollapsed = isCompactLayout ? true : sidebarCollapsed
  const shouldShowFloatingToggle = isCompactLayout || computedSidebarCollapsed

  return {
    sidebarWidth,
    sidebarCollapsed: computedSidebarCollapsed,
    sidebarOverlayOpen,
    shouldShowFloatingToggle,
    startSidebarResize,
    reopenSidebar,
    handleFloatingButtonClick,
    closeSidebarOverlay,
    handleSidebarProjectSelect,
    handleSidebarChapterSelect,
    handleOpenProjectManager
  }
}
