import { create } from 'zustand'
import type { ChapterSnapshot } from '../shared/types'

/**
 * Editor Store
 * 
 * Manages all editor-related state including:
 * - Draft text and autosave status
 * - Timeline/snapshot viewer state
 * 
 * This store is separate from projectStore to maintain clear separation of concerns:
 * - projectStore: Project and chapter data management
 * - editorStore: Editor UI state and editing session data
 */

interface EditorState {
  // ===== Draft & Autosave State =====
  
  /** Current draft text being edited */
  draftText: string
  
  /** Whether autosave is currently in progress */
  isAutosaving: boolean
  
  /** Timestamp of the last successful autosave */
  lastAutosaveAt?: number
  
  /** Current timestamp tick (updated every 30 seconds for relative time display) */
  nowTick: number

  // ===== Timeline/Snapshot Viewer State =====
  
  /** Whether the timeline modal is currently open */
  isTimelineOpen: boolean
  
  /** Array of snapshot entries for the active chapter */
  timelineEntries: ChapterSnapshot[]
  
  /** Whether snapshot entries are being loaded */
  timelineLoading: boolean
  
  /** Timestamp of the currently selected snapshot (null if none selected) */
  selectedSnapshot: number | null
  
  /** Full text content of the selected snapshot (null if not loaded) */
  snapshotPreview: string | null
  
  /** Whether snapshot preview content is being loaded */
  snapshotPreviewLoading: boolean
  
  /** Timestamp of the snapshot currently being deleted (null if none) */
  deletingSnapshot: number | null

  // ===== Actions =====
  
  /**
   * Update the draft text
   */
  setDraftText: (text: string) => void
  
  /**
   * Set autosaving status
   */
  setAutosaving: (value: boolean) => void
  
  /**
   * Set the timestamp of the last autosave
   */
  setLastAutosaveAt: (timestamp: number | undefined) => void
  
  /**
   * Update the current time tick (used for relative time display)
   */
  setNowTick: (timestamp: number) => void

  /**
   * Open the timeline modal
   */
  openTimeline: () => void
  
  /**
   * Close the timeline modal and reset related state
   */
  closeTimeline: () => void
  
  /**
   * Set the list of snapshot entries
   */
  setTimelineEntries: (entries: ChapterSnapshot[]) => void
  
  /**
   * Set timeline loading state
   */
  setTimelineLoading: (loading: boolean) => void
  
  /**
   * Set the currently selected snapshot timestamp
   */
  setSelectedSnapshot: (timestamp: number | null) => void
  
  /**
   * Set the preview content of the selected snapshot
   */
  setSnapshotPreview: (preview: string | null) => void
  
  /**
   * Set snapshot preview loading state
   */
  setSnapshotPreviewLoading: (loading: boolean) => void
  
  /**
   * Set the timestamp of the snapshot being deleted
   */
  setDeletingSnapshot: (timestamp: number | null) => void
  
  /**
   * Reset all timeline-related data (used when switching chapters)
   */
  resetTimelineData: () => void
}

// ===== Store Implementation =====

export const useEditorStore = create<EditorState>((set) => ({
  // ===== Initial State =====
  draftText: '',
  isAutosaving: false,
  lastAutosaveAt: undefined,
  nowTick: Date.now(),

  isTimelineOpen: false,
  timelineEntries: [],
  timelineLoading: false,
  selectedSnapshot: null,
  snapshotPreview: null,
  snapshotPreviewLoading: false,
  deletingSnapshot: null,

  // ===== Actions Implementation =====
  
  setDraftText: (text) => set({ draftText: text }),
  
  setAutosaving: (value) => set({ isAutosaving: value }),
  
  setLastAutosaveAt: (timestamp) => set({ lastAutosaveAt: timestamp }),
  
  setNowTick: (timestamp) => set({ nowTick: timestamp }),

  openTimeline: () => set({ isTimelineOpen: true }),
  
  closeTimeline: () =>
    set({
      isTimelineOpen: false,
      selectedSnapshot: null,
      snapshotPreview: null,
      snapshotPreviewLoading: false,
      deletingSnapshot: null
    }),
  
  setTimelineEntries: (entries) => set({ timelineEntries: entries }),
  
  setTimelineLoading: (loading) => set({ timelineLoading: loading }),
  
  setSelectedSnapshot: (timestamp) => set({ selectedSnapshot: timestamp }),
  
  setSnapshotPreview: (preview) => set({ snapshotPreview: preview }),
  
  setSnapshotPreviewLoading: (loading) => set({ snapshotPreviewLoading: loading }),
  
  setDeletingSnapshot: (timestamp) => set({ deletingSnapshot: timestamp }),
  
  resetTimelineData: () =>
    set({
      timelineEntries: [],
      timelineLoading: false,
      selectedSnapshot: null,
      snapshotPreview: null,
      snapshotPreviewLoading: false,
      deletingSnapshot: null
    })
}))
