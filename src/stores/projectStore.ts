import { create } from 'zustand'
import type { Project, Chapter } from '../shared/types'
import { projectBridge } from '../services/ipcClient'

// ===== Utility Functions =====
// These are exported for use in components and other stores

/**
 * Recursively update a chapter node in the hierarchical tree structure.
 * Returns both the updated node and a flag indicating whether any changes were made.
 * 
 * @param node - The chapter node to update
 * @param chapterId - The ID of the chapter to find and update
 * @param updater - Function that receives the target chapter and returns the updated version
 * @returns Object containing the updated node and a boolean indicating if changes were made
 */
export const patchStructureNode = (
  node: Chapter,
  chapterId: string,
  updater: (node: Chapter) => Chapter
): { node: Chapter; changed: boolean } => {
  // Found the target node
  if (node.id === chapterId) {
    return { node: updater(node), changed: true }
  }
  
  // Leaf node (no children), nothing to update
  if (!node.children?.length) {
    return { node, changed: false }
  }
  
  // Recursively search and update children
  let childChanged = false
  const updatedChildren = node.children.map((child) => {
    const result = patchStructureNode(child, chapterId, updater)
    if (result.changed) childChanged = true
    return result.node
  })
  
  // If any child changed, update this node with new children
  // For groups, recalculate total word count from all children
  if (childChanged) {
    const updatedNode: Chapter = {
      ...node,
      children: updatedChildren,
      words: node.kind === 'group' ? updatedChildren.reduce((sum, child) => sum + child.words, 0) : node.words
    }
    return { node: updatedNode, changed: true }
  }
  
  return { node, changed: false }
}

/**
 * Find and update a chapter in the tree structure array.
 * Returns a new array only if changes were made, otherwise returns the original array.
 * 
 * @param structure - Array of root-level chapter nodes
 * @param chapterId - The ID of the chapter to find and update
 * @param updater - Function that receives the target chapter and returns the updated version
 * @returns Updated structure array or original if no changes
 */
export const patchStructureById = (structure: Chapter[], chapterId: string, updater: (node: Chapter) => Chapter) => {
  let changed = false
  const nodes = structure.map((node) => {
    const result = patchStructureNode(node, chapterId, updater)
    if (result.changed) changed = true
    return result.node
  })
  return changed ? nodes : structure
}

// ===== Store Interface =====

interface ProjectState {
  // ===== Core State =====
  /** Array of all loaded projects */
  projects: Project[]
  
  /** ID of the currently active project */
  activeProjectId: string
  
  /** ID of the currently active chapter (can be empty if chapterless mode) */
  activeChapterId: string
  
  /** Internal flag to allow no chapter state (used for project-level editing) */
  allowChapterless: boolean

  // ===== Actions =====
  
  /**
   * Replace the entire projects list (used after loading from server)
   */
  setProjects: (projects: Project[]) => void

  /**
   * Set the active project ID
   */
  setActiveProject: (projectId: string) => void

  /**
   * Set the active chapter ID (can be empty string for chapterless mode)
   */
  setActiveChapter: (chapterId: string) => void

  /**
   * Set whether to allow chapterless state
   */
  setAllowChapterless: (allow: boolean) => void

  /**
   * Sync a single project update to the store.
   * If the project doesn't exist, it will be added to the list.
   * If it already exists, it will be updated in place.
   * Used after create/update/delete operations from the server.
   */
  syncProject: (project: Project) => void

  /**
   * Load all projects from the server via IPC bridge
   */
  loadProjects: () => Promise<void>

  /**
   * Get the currently active project object (convenience getter)
   */
  getActiveProject: () => Project | undefined

  /**
   * Get the currently active chapter object from the active project (convenience getter)
   */
  getActiveChapter: () => Chapter | undefined

  /**
   * Update chapter metadata in a project (used after autosave or manual edits).
   * Updates both the flat chapters array and the hierarchical structure tree.
   * Also recalculates project-level word count.
   */
  updateChapterInProject: (projectId: string, chapterId: string, updater: (chapter: Chapter) => Chapter) => void
}

// ===== Store Implementation =====

export const useProjectStore = create<ProjectState>((set, get) => ({
  // ===== Initial State =====
  projects: [],
  activeProjectId: '',
  activeChapterId: '',
  allowChapterless: false,

  // ===== Actions Implementation =====

  setProjects: (projects) => {
    set({ projects })
  },

  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId })
  },

  setActiveChapter: (chapterId) => {
    set({ activeChapterId: chapterId })
  },

  setAllowChapterless: (allow) => {
    set({ allowChapterless: allow })
  },

  syncProject: (project) => {
    set((state) => {
      const exists = state.projects.some((p) => p.id === project.id)
      if (!exists) {
        // New project, add to the end of the list
        return { projects: [...state.projects, project] }
      }
      // Existing project, update in place
      return {
        projects: state.projects.map((p) => (p.id === project.id ? project : p))
      }
    })
  },

  loadProjects: async () => {
    try {
      const projects = await projectBridge.listProjects()
      set({ projects })
    } catch (error) {
      console.error('Failed to load projects', error)
    }
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((p) => p.id === activeProjectId)
  },

  getActiveChapter: () => {
    const { projects, activeProjectId, activeChapterId } = get()
    const project = projects.find((p) => p.id === activeProjectId)
    return project?.chapters.find((c) => c.id === activeChapterId)
  },

  updateChapterInProject: (projectId, chapterId, updater) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) return project

        // Update the chapter in the flat chapters array
        const updatedChapters = project.chapters.map((chapter) =>
          chapter.id === chapterId ? updater(chapter) : chapter
        )

        // Update the chapter in the hierarchical structure tree
        const updatedStructure = patchStructureById(project.structure ?? [], chapterId, updater)

        // Recalculate project-level total word count
        const totalWords = updatedChapters.reduce((sum, chapter) => sum + chapter.words, 0)

        return {
          ...project,
          chapters: updatedChapters,
          structure: updatedStructure,
          stats: {
            ...project.stats,
            words: totalWords
          }
        }
      })

      return { projects }
    })
  }
}))

// ===== Selectors =====
// Recommended usage pattern for derived state

/**
 * Selector: Get the currently active project object
 * 
 * Usage: const activeProject = useProjectStore(selectActiveProject)
 */
export const selectActiveProject = (state: ProjectState) => {
  return state.projects.find((p) => p.id === state.activeProjectId)
}

/**
 * Selector: Get the currently active chapter object from the active project
 * 
 * Usage: const activeChapter = useProjectStore(selectActiveChapter)
 */
export const selectActiveChapter = (state: ProjectState) => {
  const project = selectActiveProject(state)
  return project?.chapters.find((c) => c.id === state.activeChapterId)
}

// ===== Pure Utility Functions =====
// Export these for use with useMemo in components to avoid re-render issues

/**
 * Calculate projects with live draft data applied.
 * This creates a new projects array with real-time draft updates for the active chapter.
 * 
 * IMPORTANT: This function creates new object references on every call.
 * DO NOT use directly with useProjectStore() as it will cause infinite re-renders.
 * Instead, use with useMemo() in components:
 * 
 * @example
 * const projectsView = useMemo(
 *   () => getProjectsWithLiveDraft(projects, draftText, projectId, chapterId),
 *   [projects, draftText, projectId, chapterId]
 * )
 * 
 * @param projects - Array of projects from the store
 * @param draftText - Current draft text being edited
 * @param activeProjectId - ID of the active project
 * @param activeChapterId - ID of the active chapter
 * @returns New projects array with live draft updates applied
 */
export const getProjectsWithLiveDraft = (
  projects: Project[],
  draftText: string,
  activeProjectId: string,
  activeChapterId: string
): Project[] => {
  // No active chapter, return projects as-is
  if (!activeProjectId || !activeChapterId) {
    return projects
  }

  const targetProject = projects.find((p) => p.id === activeProjectId)
  const targetChapter = targetProject?.chapters.find((c) => c.id === activeChapterId)

  // Project or chapter not found
  if (!targetProject || !targetChapter) {
    return projects
  }

  // Calculate new word count (character count for CJK languages)
  const nextWords = [...draftText].length
  const wordsChanged = targetChapter.words !== nextWords
  const draftChanged = targetChapter.draft !== draftText

  // No changes, return original array to maintain referential equality
  if (!wordsChanged && !draftChanged) {
    return projects
  }

  // Apply live updates
  const now = Date.now()
  return projects.map((project) => {
    if (project.id !== activeProjectId) return project

    // Update chapter in flat array
    const updatedChapters = project.chapters.map((chapter) =>
      chapter.id === activeChapterId
        ? { ...chapter, draft: draftText, words: nextWords, updatedAt: now }
        : chapter
    )

    // Update chapter in hierarchical structure
    const updatedStructure = patchStructureById(
      project.structure ?? [],
      activeChapterId,
      (node) => ({ ...node, draft: draftText, words: nextWords, updatedAt: now })
    )

    // Recalculate project stats if word count changed
    const updatedStats = wordsChanged
      ? { ...project.stats, words: project.stats.words - targetChapter.words + nextWords }
      : project.stats

    return {
      ...project,
      chapters: updatedChapters,
      structure: updatedStructure,
      stats: updatedStats
    }
  })
}
