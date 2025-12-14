import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  MdAdd,
  MdChevronRight,
  MdDelete,
  MdExpandMore,
  MdFolder,
  MdHistory,
  MdInsertDriveFile,
  MdOutlineCreateNewFolder,
  MdOutlineNoteAdd,
  MdOutlinePlaylistAdd
} from 'react-icons/md'
import { FaArrowDown, FaArrowRight } from 'react-icons/fa'
import type { Chapter, ChapterSnapshot, Project, StoryNodeKind } from '../../../shared/types'

type NodeCreation = { projectId: string; parentId: string | null; kind: StoryNodeKind }
type PaneKey = 'explorer' | 'outline' | 'timeline'
type PaneDragHandle = 'explorer-outline' | 'outline-timeline'
const MIN_PANE_HEIGHT = 180
const COLLAPSE_THRESHOLD = MIN_PANE_HEIGHT * 0.6
const COLLAPSED_PANE_HEIGHT = 44
const RESIZER_HEIGHT = 8
const PANE_ORDER: PaneKey[] = ['explorer', 'outline', 'timeline']
const PANE_RATIO: Record<PaneKey, number> = {
  explorer: 0.5,
  outline: 0.25,
  timeline: 0.25
}
const RESIZE_BOUNDARY_INDEX: Record<PaneDragHandle, number> = {
  'explorer-outline': 0,
  'outline-timeline': 1
}

interface LibrarySidebarProps {
  projects: Project[]
  activeProjectId: string
  activeChapterId: string
  snapshots: ChapterSnapshot[]
  onProjectSelect: (projectId: string) => void
  onChapterSelect: (chapterId: string) => void
  onCreateProject: (title: string, description?: string) => void | Promise<void>
  onCreateChapter: (
    projectId: string,
    title?: string,
    options?: { parentId?: string; kind?: StoryNodeKind }
  ) => void | Promise<void>
  onOpenProjectManager: () => void
  onReorderProjects: (order: string[]) => void
  onDeleteProject: (projectId: string) => void | Promise<void>
  onDeleteChapter: (projectId: string, chapterId: string) => void | Promise<void>
  onReorderChapters: (projectId: string, parentId: string | null, order: string[]) => void | Promise<void>
  onMoveChapter: (projectId: string, chapterId: string, parentId: string | null) => void | Promise<void>
  onOpenTimeline: () => void
}

type OutlineItem = {
  id: string
  title: string
  kind: 'project' | Chapter['kind']
  depth: number
  summary?: string
}

const flattenOutline = (nodes: Chapter[], depth = 1): OutlineItem[] => {
  const items: OutlineItem[] = []
  nodes.forEach((node) => {
    items.push({
      id: node.id,
      title: node.title,
      kind: node.kind,
      depth,
      summary: node.summary
    })
    items.push(...flattenOutline(node.children ?? [], depth + 1))
  })
  return items
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
}

const distributePaneSpace = (openKeys: PaneKey[], available: number) => {
  if (!openKeys.length || available <= 0) {
    return null
  }
  const ratioSum = openKeys.reduce((sum, key) => sum + PANE_RATIO[key], 0)
  if (ratioSum <= 0) return null
  const base = available / ratioSum
  const next: Record<PaneKey, number> = {} as Record<PaneKey, number>
  openKeys.forEach((key) => {
    next[key] = Math.max(MIN_PANE_HEIGHT, PANE_RATIO[key] * base)
  })
  const total = openKeys.reduce((sum, key) => sum + next[key], 0)
  if (total > available) {
    const scale = available / total
    openKeys.forEach((key) => {
      next[key] = Math.max(0, next[key] * scale)
    })
  }
  return next
}

const resolveResizeTargets = (handle: PaneDragHandle, openState: Record<PaneKey, boolean>) => {
  const boundaryIndex = RESIZE_BOUNDARY_INDEX[handle]
  let upper: PaneKey | null = null
  for (let i = boundaryIndex; i >= 0; i -= 1) {
    const key = PANE_ORDER[i]
    if (openState[key]) {
      upper = key
      break
    }
  }
  let lower: PaneKey | null = null
  for (let i = boundaryIndex + 1; i < PANE_ORDER.length; i += 1) {
    const key = PANE_ORDER[i]
    if (openState[key]) {
      lower = key
      break
    }
  }
  if (!upper || !lower) return null
  return { upper, lower }
}

export const LibrarySidebar = ({
  projects,
  activeProjectId,
  activeChapterId,
  snapshots,
  onProjectSelect,
  onChapterSelect,
  onCreateProject,
  onCreateChapter,
  onOpenProjectManager,
  onReorderProjects,
  onDeleteProject,
  onDeleteChapter,
  onReorderChapters,
  onMoveChapter,
  onOpenTimeline
}: LibrarySidebarProps) => {
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const newProjectInputRef = useRef<HTMLInputElement>(null)
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null)
  const projectListRef = useRef<HTMLDivElement>(null)
  const [paneOpen, setPaneOpen] = useState({ explorer: true, outline: true, timeline: true })
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [nodeCreation, setNodeCreation] = useState<NodeCreation | null>(null)
  const [newNodeTitle, setNewNodeTitle] = useState('')
  const nodeInputRef = useRef<HTMLInputElement>(null)
  const [draggingNode, setDraggingNode] = useState<{ id: string; projectId: string; parentId: string | null } | null>(null)
  const [paneHeights, setPaneHeights] = useState<Record<PaneKey, number>>({
    explorer: MIN_PANE_HEIGHT * 1.4,
    outline: MIN_PANE_HEIGHT,
    timeline: MIN_PANE_HEIGHT
  })
  const [paneInitialized, setPaneInitialized] = useState(false)
  const [paneDrag, setPaneDrag] = useState<{
    handle: PaneDragHandle
    startY: number
    initial: Record<PaneKey, number>
    targets: { upper: PaneKey; lower: PaneKey }
    pairTotal: number
  } | null>(null)
  const panelGroupRef = useRef<HTMLDivElement>(null)
  const prevPaneOpen = useRef(paneOpen)

  useEffect(() => {
    if (creatingProject) {
      setNewProjectTitle('')
      newProjectInputRef.current?.focus()
    }
  }, [creatingProject])

  useEffect(() => {
    if (nodeCreation) {
      setNewNodeTitle('')
      nodeInputRef.current?.focus()
    }
  }, [nodeCreation])

  useEffect(() => {
    setNodeCreation(null)
    setNewNodeTitle('')
  }, [activeProjectId])

  useEffect(() => {
    const maybeCollapse = (key: PaneKey) => {
      if (paneOpen[key] && paneHeights[key] < COLLAPSE_THRESHOLD) {
        setPaneOpen((prev) => ({ ...prev, [key]: false }))
      }
    }
    maybeCollapse('explorer')
    maybeCollapse('outline')
    maybeCollapse('timeline')
  }, [paneHeights, paneOpen])
  useLayoutEffect(() => {
    if (paneInitialized) return
    const el = panelGroupRef.current
    if (!el) return
    const total = el.clientHeight - RESIZER_HEIGHT * 2
    const ratioHeights = distributePaneSpace(PANE_ORDER, total)
    if (!ratioHeights) return
    setPaneHeights((prev) => ({ ...prev, ...ratioHeights }))
    setPaneInitialized(true)
  }, [paneInitialized])

  useEffect(() => {
    if (!paneInitialized) {
      prevPaneOpen.current = paneOpen
      return
    }
    const container = panelGroupRef.current
    if (!container) {
      prevPaneOpen.current = paneOpen
      return
    }
    const prevState = prevPaneOpen.current
    const openKeys = PANE_ORDER.filter((key) => paneOpen[key])
    if (!openKeys.length) {
      prevPaneOpen.current = paneOpen
      return
    }
    const resizerSpace =
      (paneOpen.explorer || paneOpen.outline ? RESIZER_HEIGHT : 0) +
      (paneOpen.outline || paneOpen.timeline ? RESIZER_HEIGHT : 0)
    const collapsedSpace = PANE_ORDER.reduce(
      (sum, key) => (!paneOpen[key] ? sum + COLLAPSED_PANE_HEIGHT : sum),
      0
    )
    const available = container.clientHeight - collapsedSpace - resizerSpace
    if (available <= 0) {
      prevPaneOpen.current = paneOpen
      return
    }
    const newlyOpened = openKeys.filter((key) => paneOpen[key] && !prevState[key])
    if (newlyOpened.length) {
      const distributed = distributePaneSpace(openKeys, available)
      if (distributed) {
        setPaneHeights((current) => {
          const next = { ...current }
          openKeys.forEach((key) => {
            next[key] = distributed[key]
          })
          return next
        })
      }
    }
    prevPaneOpen.current = paneOpen
  }, [paneOpen, paneInitialized])

  useEffect(() => {
    if (!paneInitialized || paneDrag) return
    const container = panelGroupRef.current
    if (!container) return
    const openKeys = PANE_ORDER.filter((key) => paneOpen[key])
    if (!openKeys.length) return
    const resizerSpace =
      (paneOpen.explorer || paneOpen.outline ? RESIZER_HEIGHT : 0) +
      (paneOpen.outline || paneOpen.timeline ? RESIZER_HEIGHT : 0)
    const collapsedSpace = PANE_ORDER.reduce(
      (sum, key) => (!paneOpen[key] ? sum + COLLAPSED_PANE_HEIGHT : sum),
      0
    )
    const available = container.clientHeight - collapsedSpace - resizerSpace
    if (available <= 0) return
    const totalOpen = openKeys.reduce((sum, key) => sum + paneHeights[key], 0)
    if (Math.abs(totalOpen - available) <= 1) return
    setPaneHeights((current) => {
      const next = { ...current }
      const scale = available / totalOpen
      openKeys.forEach((key) => {
        next[key] = Math.max(0, current[key] * scale)
      })
      return next
    })
  }, [paneHeights, paneOpen, paneInitialized, paneDrag])

  useEffect(() => {
    if (!paneDrag) return
    const handleMove = (event: MouseEvent) => {
      const delta = event.clientY - paneDrag.startY
      const { upper, lower } = paneDrag.targets
      const pairTotal = paneDrag.pairTotal
      if (pairTotal <= 0) return
      setPaneHeights((current) => {
        let upperHeight = paneDrag.initial[upper] + delta
        upperHeight = Math.max(0, Math.min(pairTotal, upperHeight))
        const lowerHeight = Math.max(0, pairTotal - upperHeight)
        if (Math.abs(current[upper] - upperHeight) < 0.5 && Math.abs(current[lower] - lowerHeight) < 0.5) {
          return current
        }
        return { ...current, [upper]: upperHeight, [lower]: lowerHeight }
      })
    }
    const handleUp = () => setPaneDrag(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [paneDrag])

  useEffect(() => {
    if (!paneDrag) return
    const { upper, lower } = paneDrag.targets
    if (!paneOpen[upper] || !paneOpen[lower]) {
      setPaneDrag(null)
    }
  }, [paneOpen, paneDrag])

  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId), [projects, activeProjectId])
  const outlineItems = useMemo(() => {
    if (!activeProject) return []
    const items: OutlineItem[] = [
      {
        id: activeProject.id,
        title: activeProject.title,
        kind: 'project',
        depth: 0,
        summary: activeProject.description?.trim()
      }
    ]
    items.push(...flattenOutline(activeProject.structure ?? [], 1))
    return items
  }, [activeProject])
  const selectedOutline = useMemo(() => {
    if (outlineItems.length === 0) return null
    if (activeChapterId) {
      return outlineItems.find((item) => item.id === activeChapterId) ?? outlineItems[0]
    }
    return outlineItems.find((item) => item.kind === 'project') ?? outlineItems[0]
  }, [outlineItems, activeChapterId])

  const togglePane = (pane: PaneKey) => {
    setPaneOpen((prev) => {
      const nextState = !prev[pane]
      if (nextState) {
        setPaneHeights((sizes) => ({ ...sizes, [pane]: Math.max(MIN_PANE_HEIGHT, sizes[pane]) }))
      }
      return { ...prev, [pane]: nextState }
    })
  }

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !(prev[projectId] ?? true) }))
  }

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !(prev[nodeId] ?? true) }))
  }

  const cancelCreateProject = () => {
    setCreatingProject(false)
    setNewProjectTitle('')
  }

  const submitCreateProject = async () => {
    const trimmed = newProjectTitle.trim()
    if (!trimmed) {
      cancelCreateProject()
      return
    }
    await onCreateProject(trimmed)
    cancelCreateProject()
  }

  const startCreateNode = (projectId: string, parentId: string | null, kind: StoryNodeKind) => {
    setNodeCreation({ projectId, parentId, kind })
    setNewNodeTitle('')
  }

  const cancelCreateNode = () => {
    setNodeCreation(null)
    setNewNodeTitle('')
  }

  const submitCreateNode = async () => {
    if (!nodeCreation) return
    const trimmed = newNodeTitle.trim()
    if (!trimmed) {
      cancelCreateNode()
      return
    }
    await onCreateChapter(nodeCreation.projectId, trimmed, {
      parentId: nodeCreation.parentId ?? undefined,
      kind: nodeCreation.kind
    })
    cancelCreateNode()
    if (nodeCreation.parentId) {
      setExpandedNodes((prev) => ({ ...prev, [nodeCreation.parentId!]: true }))
    } else {
      setExpandedProjects((prev) => ({ ...prev, [nodeCreation.projectId]: true }))
    }
  }

  const focusProject = (projectId: string) => {
    onProjectSelect(projectId)
    onChapterSelect('')
  }

  const selectChapter = (projectId: string, chapterId: string) => {
    if (projectId !== activeProjectId) {
      onProjectSelect(projectId)
    }
    onChapterSelect(chapterId)
  }

  const getPaneHeight = (key: PaneKey) =>
    paneOpen[key] ? Math.max(0, paneHeights[key]) : COLLAPSED_PANE_HEIGHT
  const resizer1 = paneOpen.explorer || paneOpen.outline ? RESIZER_HEIGHT : 0
  const resizer2 = paneOpen.outline || paneOpen.timeline ? RESIZER_HEIGHT : 0
  const paneTemplate = `${getPaneHeight('explorer')}px ${resizer1}px ${getPaneHeight('outline')}px ${resizer2}px ${getPaneHeight('timeline')}px`

  const requestProjectDelete = async (projectId: string, title: string) => {
    const confirmed = window.confirm(`确认删除作品「${title}」？该操作不可撤销。`)
    if (confirmed) {
      await onDeleteProject(projectId)
    }
  }

  const requestChapterDelete = async (projectId: string, chapterId: string, title: string) => {
    const confirmed = window.confirm(`确认删除「${title}」及其子节点？该操作不可撤销。`)
    if (confirmed) {
      await onDeleteChapter(projectId, chapterId)
    }
  }

  const resolveProjectDropTarget = (clientY: number) => {
    const container = projectListRef.current
    if (!container) return { targetId: null, position: 'after' as const }
    const items = Array.from(container.querySelectorAll<HTMLDivElement>('[data-project-id]'))
    if (items.length === 0) return { targetId: null, position: 'after' as const }
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        return { targetId: item.dataset.projectId ?? null, position: 'before' as const }
      }
    }
    return { targetId: items[items.length - 1].dataset.projectId ?? null, position: 'after' as const }
  }

  const handleProjectDrop = async (clientY: number) => {
    if (!draggingProjectId || !projectListRef.current) return
    const target = resolveProjectDropTarget(clientY)
    handleProjectReorder(target.targetId, target.position)
  }

  const handleProjectDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const container = projectListRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const threshold = 48
    if (event.clientY - rect.top < threshold) {
      container.scrollTop = Math.max(0, container.scrollTop - 12)
    } else if (rect.bottom - event.clientY < threshold) {
      container.scrollTop += 12
    }
  }

  const handleProjectReorder = async (targetId: string | null, position: 'before' | 'after') => {
    if (!draggingProjectId || draggingProjectId === targetId) {
      setDraggingProjectId(null)
      return
    }
    const order = projects.map((project) => project.id)
    const fromIndex = order.indexOf(draggingProjectId)
    const targetIndex = targetId ? order.indexOf(targetId) : order.length
    if (fromIndex === -1 || targetIndex === -1) {
      setDraggingProjectId(null)
      return
    }
    order.splice(fromIndex, 1)
    const insertIndex =
      targetId === null
        ? order.length
        : position === 'before'
        ? targetIndex > fromIndex
          ? targetIndex - 1
          : targetIndex
        : targetIndex >= order.length
        ? order.length
        : targetIndex + (fromIndex < targetIndex ? 0 : 1)
    order.splice(insertIndex, 0, draggingProjectId)
    await onReorderProjects(order)
    setDraggingProjectId(null)
  }

  const moveNodeToParent = async (projectId: string, targetParentId: string | null) => {
    if (!draggingNode || draggingNode.projectId !== projectId) return
    const currentParent = draggingNode.parentId ?? null
    if (currentParent === targetParentId) return
    await onMoveChapter(projectId, draggingNode.id, targetParentId)
    setDraggingNode(null)
    if (targetParentId) {
      setExpandedNodes((prev) => ({ ...prev, [targetParentId]: true }))
    } else {
      setExpandedProjects((prev) => ({ ...prev, [projectId]: true }))
    }
  }

  const handleContainerDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    projectId: string,
    parentId: string | null,
    siblings: Chapter[]
  ) => {
    event.preventDefault()
    if (!draggingNode || draggingNode.projectId !== projectId) return
    const currentParent = draggingNode.parentId ?? null
    if (currentParent !== parentId) {
      await moveNodeToParent(projectId, parentId)
      return
    }
    await reorderWithinParent(projectId, parentId, siblings, null, 'after')
  }

  const handleNodeDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    projectId: string,
    parentId: string | null,
    targetId: string,
    siblings: Chapter[],
    targetNode: Chapter
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (!draggingNode || draggingNode.projectId !== projectId) return
    const currentParent = draggingNode.parentId ?? null
    if (targetNode.kind === 'group') {
      const rect = event.currentTarget.getBoundingClientRect()
      const innerTop = rect.top + rect.height * 0.25
      const innerBottom = rect.bottom - rect.height * 0.25
      if (event.clientY >= innerTop && event.clientY <= innerBottom) {
        await moveNodeToParent(projectId, targetId)
        return
      }
    }
    if (currentParent !== parentId) {
      await moveNodeToParent(projectId, parentId)
      return
    }
    if (draggingNode.id === targetId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    await reorderWithinParent(projectId, parentId, siblings, targetId, position)
  }

  const reorderWithinParent = async (
    projectId: string,
    parentId: string | null,
    siblings: Chapter[],
    targetId: string | null,
    position: 'before' | 'after'
  ) => {
    if (!draggingNode) return
    const order = siblings.map((node) => node.id).filter((id) => id !== draggingNode.id)
    let insertIndex = order.length
    if (targetId) {
      const idx = order.indexOf(targetId)
      if (idx === -1) return
      insertIndex = position === 'before' ? idx : idx + 1
    }
    order.splice(insertIndex, 0, draggingNode.id)
    await onReorderChapters(projectId, parentId, order)
    setDraggingNode(null)
  }

  const renderNodeCreation = (projectId: string, parentId: string | null, depth: number) => {
    if (!nodeCreation || nodeCreation.projectId !== projectId || nodeCreation.parentId !== parentId) return null
    return (
      <div className="chapter-item creating" style={{ marginLeft: depth * 12 }}>
        <input
          ref={nodeInputRef}
          value={newNodeTitle}
          placeholder={nodeCreation.kind === 'group' ? '输入结构名称' : '输入章节标题'}
          onChange={(event) => setNewNodeTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submitCreateNode()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              cancelCreateNode()
            }
          }}
        />
        <div className="chapter-create-actions">
          <button className="mini primary" type="button" onClick={submitCreateNode}>
            保存
          </button>
          <button className="mini ghost" type="button" onClick={cancelCreateNode}>
            取消
          </button>
        </div>
      </div>
    )
  }

  const startPaneResize = (handle: PaneDragHandle, event: React.MouseEvent<HTMLDivElement>) => {
    const container = panelGroupRef.current
    if (!container) return
    const targets = resolveResizeTargets(handle, paneOpen)
    if (!targets) return
    const openKeys = PANE_ORDER.filter((key) => paneOpen[key])
    const resizerSpace =
      (paneOpen.explorer || paneOpen.outline ? RESIZER_HEIGHT : 0) +
      (paneOpen.outline || paneOpen.timeline ? RESIZER_HEIGHT : 0)
    const collapsedSpace = PANE_ORDER.reduce(
      (sum, key) => (!paneOpen[key] ? sum + COLLAPSED_PANE_HEIGHT : sum),
      0
    )
    const available = container.clientHeight - collapsedSpace - resizerSpace
    if (available <= 0) return
    const otherKeys = openKeys.filter((key) => key !== targets.upper && key !== targets.lower)
    const otherHeight = otherKeys.reduce((sum, key) => sum + paneHeights[key], 0)
    const pairTotal = Math.max(0, available - otherHeight)
    if (pairTotal <= 0) return
    event.preventDefault()
    setPaneDrag({
      handle,
      startY: event.clientY,
      initial: { ...paneHeights },
      targets,
      pairTotal
    })
  }

  const renderNodeList = (projectId: string, nodes: Chapter[], parentId: string | null, depth = 0) => (
    <div
      className="tree-children"
      data-parent-id={parentId ?? 'root'}
      onDragOver={(event) => {
        event.preventDefault()
        const container = event.currentTarget
        const rect = container.getBoundingClientRect()
        const threshold = 48
        if (event.clientY - rect.top < threshold) {
          container.scrollTop -= 12
        } else if (rect.bottom - event.clientY < threshold) {
          container.scrollTop += 12
        }
      }}
      onDrop={(event) => handleContainerDrop(event, projectId, parentId, nodes)}
    >
      {renderNodeCreation(projectId, parentId, depth)}
      {nodes.map((node) => renderNode(projectId, node, parentId, nodes, depth))}
    </div>
  )

  const renderNode = (projectId: string, node: Chapter, parentId: string | null, siblings: Chapter[], depth: number) => {
    const isExpanded = expandedNodes[node.id] ?? true
    const isActive = node.kind === 'chapter' && node.id === activeChapterId && projectId === activeProjectId
    const wordsLabel =
      node.kind === 'chapter'
        ? `${node.words.toLocaleString()} 字`
        : `${flattenOutline(node.children ?? []).filter((item) => item.kind === 'chapter').length} 章节`
    const indent = depth * 22 + 8

    return (
      <div
        key={node.id}
        className={`tree-node${node.kind === 'group' ? ' tree-node--group' : ' tree-node--leaf'}${isActive ? ' active' : ''}`}
        data-node-id={node.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          setDraggingNode({ id: node.id, projectId, parentId: parentId ?? null })
        }}
        onDragEnd={() => setDraggingNode(null)}
        onDrop={(event) => handleNodeDrop(event, projectId, parentId ?? null, node.id, siblings, node)}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
      >
        <div className="tree-node__main" style={{ paddingLeft: indent }}>
          {node.kind === 'group' ? (
            <button className="tree-toggle" type="button" onClick={() => toggleNode(node.id)}>
              {isExpanded ? <FaArrowDown size={10} /> : <FaArrowRight size={10} />}
            </button>
          ) : (
            <span className="tree-toggle placeholder" />
          )}
          <span className="tree-node__icon">
            {node.kind === 'group' ? <MdFolder size={16} /> : <MdInsertDriveFile size={16} />}
          </span>
          <button
            type="button"
            className="tree-node__label"
            onClick={() => (node.kind === 'chapter' ? selectChapter(projectId, node.id) : toggleNode(node.id))}
          >
            <span>{node.title}</span>
            <span className="tree-node__meta">{wordsLabel}</span>
          </button>
          <button
            className="icon-button danger subtle node-delete"
            type="button"
            title="删除节点"
            aria-label={`删除 ${node.title}`}
            onClick={() => requestChapterDelete(projectId, node.id, node.title)}
          >
            <MdDelete size={16} aria-hidden="true" />
          </button>
        </div>
        {node.kind === 'group' && isExpanded && renderNodeList(projectId, node.children ?? [], node.id, depth + 1)}
      </div>
    )
  }

  const renderProjectNode = (project: Project) => {
    const isExpanded = expandedProjects[project.id] ?? project.id === activeProjectId
    return (
      <div
        key={project.id}
        className={`tree-node tree-node--project${project.id === activeProjectId ? ' active' : ''}${
          draggingProjectId === project.id ? ' dragging' : ''
        }`}
        data-project-id={project.id}
        draggable
        onDragStart={(event) => {
          setDraggingProjectId(project.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => setDraggingProjectId(null)}
      >
        <div className="tree-node__main">
          <button className="tree-toggle" type="button" onClick={() => toggleProject(project.id)}>
            {isExpanded ? <FaArrowDown size={10} /> : <FaArrowRight size={10} />}
          </button>
          <button className="tree-node__label" type="button" onClick={() => focusProject(project.id)}>
            <span>{project.title}</span>
            <span className="tree-node__meta">{project.stats.words.toLocaleString()} 字</span>
          </button>
        </div>
        {isExpanded && renderNodeList(project.id, project.structure ?? [], null)}
      </div>
    )
  }

  return (
    <aside className="panel sidebar">
      <div className="panel-group" ref={panelGroupRef} style={{ gridTemplateRows: paneTemplate }}>
        <div className={`pane${paneOpen.explorer ? ' expanded' : ' collapsed'}`}>
          <div className="pane-header">
            <button type="button" onClick={() => togglePane('explorer')}>
              {paneOpen.explorer ? <MdExpandMore size={18} /> : <MdChevronRight size={18} />} Explorer
            </button>
            <div className="pane-toolbar">
              <button className="icon-button" type="button" title="管理作品" onClick={onOpenProjectManager}>
                <MdOutlinePlaylistAdd size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                title="新建作品"
                onClick={() => setCreatingProject(true)}
                disabled={creatingProject}
              >
                <MdAdd size={18} />
              </button>
            </div>
          </div>
          {paneOpen.explorer && (
            <div className="pane-body explorer-pane">
              {activeProject && (
                <div className="explorer-actions">
                  <button
                    type="button"
                    title="新建结构"
                    onClick={() => startCreateNode(activeProject.id, null, 'group')}
                  >
                    <MdOutlineCreateNewFolder size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="新建章节"
                    onClick={() => startCreateNode(activeProject.id, null, 'chapter')}
                  >
                    <MdOutlineNoteAdd size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="danger"
                    title="删除当前作品"
                    onClick={() => requestProjectDelete(activeProject.id, activeProject.title)}
                  >
                    <MdDelete size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
              <div
                className="explorer-scroll"
                ref={projectListRef}
                onDragOver={handleProjectDragOver}
                onDrop={(event) => {
                  event.preventDefault()
                  handleProjectDrop(event.clientY)
                }}
              >
                {creatingProject && (
                  <div className="project-pill creating">
                    <input
                      ref={newProjectInputRef}
                      value={newProjectTitle}
                      placeholder="输入作品名称"
                      onChange={(event) => setNewProjectTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          submitCreateProject()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelCreateProject()
                        }
                      }}
                    />
                  </div>
                )}
                {projects.map((project) => renderProjectNode(project))}
                {projects.length === 0 && <p className="muted">暂无作品，点击“新建作品”开始创作。</p>}
              </div>
            </div>
          )}
        </div>

        <div
          className={`pane-resizer${resizer1 ? '' : ' disabled'}`}
          style={{ height: resizer1 }}
          onMouseDown={(event) => startPaneResize('explorer-outline', event)}
        />

        <div className={`pane${paneOpen.outline ? ' expanded' : ' collapsed'}`}>
          <div className="pane-header">
            <button type="button" onClick={() => togglePane('outline')}>
              {paneOpen.outline ? <MdExpandMore size={18} /> : <MdChevronRight size={18} />} Outline
            </button>
          </div>
          {paneOpen.outline && (
            <div className="pane-body outline-pane">
              {!selectedOutline ? (
                <p className="muted">暂无可用的大纲内容。</p>
              ) : (
                <article className="outline-detail">
                  <p className="outline-detail__label">
                    {selectedOutline.kind === 'project'
                      ? '作品简介'
                      : selectedOutline.kind === 'group'
                      ? '结构摘要'
                      : '章节大纲'}
                  </p>
                  <h4>{selectedOutline.title}</h4>
                  <p className="outline-summary">
                    {selectedOutline.summary?.trim() ||
                      (selectedOutline.kind === 'project'
                        ? '暂无简介，使用项目管理为作品添加描述。'
                        : '暂无大纲，点击章节后在编辑区添加摘要。')}
                  </p>
                </article>
              )}
            </div>
          )}
        </div>

        <div
          className={`pane-resizer${resizer2 ? '' : ' disabled'}`}
          style={{ height: resizer2 }}
          onMouseDown={(event) => startPaneResize('outline-timeline', event)}
        />

        <div className={`pane${paneOpen.timeline ? ' expanded' : ' collapsed'}`}>
          <div className="pane-header">
            <button type="button" onClick={() => togglePane('timeline')}>
              {paneOpen.timeline ? <MdExpandMore size={18} /> : <MdChevronRight size={18} />} Timeline
            </button>
            <div className="pane-toolbar">
              <button className="icon-button" type="button" title="历史版本" onClick={onOpenTimeline}>
                <MdHistory size={18} />
              </button>
            </div>
          </div>
          {paneOpen.timeline && (
            <div className="pane-body timeline-pane">
              {snapshots.length === 0 ? (
                <p className="muted">暂无历史版本，保存章节后将生成快照。</p>
              ) : (
                <div className="timeline-list">
                  {snapshots.slice(0, 6).map((entry) => (
                    <button
                      key={entry.timestamp}
                      className="timeline-row"
                      type="button"
                      title={entry.preview || '（空内容）'}
                      onClick={onOpenTimeline}
                    >
                      <span>{formatTimestamp(entry.timestamp)}</span>
                      <span className="timeline-meta">{entry.words.toLocaleString()} 字</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="mini ghost" type="button" onClick={onOpenTimeline}>
                打开全部历史版本
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default LibrarySidebar
