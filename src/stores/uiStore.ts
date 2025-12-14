/**
 * UI Store - Application UI and Layout State Management
 * 
 * Manages all UI-related state including theme, dialog visibility, and sidebar layout.
 * This store handles the presentation layer state that was previously scattered across
 * App.tsx as individual useState hooks.
 * 
 * State separation:
 * - uiStore: Theme, dialogs, sidebar dimensions (this file)
 * - projectStore: Business data (projects, chapters)
 * - editorStore: Editing operations (draft, autosave, timeline)
 */
import { create } from 'zustand'
import type { ThemeMode } from '../shared/types'

export type AppLanguage = 'en' | 'zh'
export type PaneKey = 'explorer' | 'outline' | 'timeline'

/**
 * Get initial theme from localStorage or system preference
 * @returns {ThemeMode} 'light' or 'dark' theme mode
 */
const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  const stored = window.localStorage.getItem('gg-theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  // Fall back to system preference
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/**
 * Determine the initial language preference.
 * Defaults to Chinese for zh locales, English otherwise.
 */
const getInitialLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') {
    return 'en'
  }
  const stored = window.localStorage.getItem('gg-language')
  if (stored === 'en' || stored === 'zh') {
    return stored
  }
  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

// Sidebar dimension constants - exported for use across components
export const SIDEBAR_MIN_WIDTH = 220        // Minimum draggable width
export const SIDEBAR_COLLAPSE_WIDTH = 160   // Threshold below which sidebar collapses
export const SIDEBAR_DEFAULT_WIDTH = 280    // Initial width on first load
export const SIDEBAR_MAX_WIDTH = 420        // Maximum draggable width

interface UiState {
  // ===== Theme State =====
  /** Current theme mode ('dark' | 'light') */
  theme: ThemeMode
  
  // ===== Dialog State =====
  /** Whether the project manager dialog is open */
  isManagerOpen: boolean
  
  // ===== Sidebar Layout State =====
  /** Current width of the sidebar in pixels (between MIN_WIDTH and MAX_WIDTH) */
  sidebarWidth: number
  /** Whether the sidebar is collapsed (hidden on desktop, shows expand button) */
  sidebarCollapsed: boolean
  /** Whether the user is currently dragging the sidebar resizer */
  resizingSidebar: boolean
  /** Whether the sidebar overlay is open (mobile/compact layout only) */
  sidebarOverlayOpen: boolean
  /** Current UI language */
  language: AppLanguage
  /** Persisted open/closed state for each sidebar pane */
  paneOpen: Record<PaneKey, boolean>

  // ===== Theme Actions =====
  /** Set theme to specific mode and persist to localStorage */
  setTheme: (mode: ThemeMode) => void
  /** Toggle between dark and light themes */
  toggleTheme: () => void
  
  // ===== Dialog Actions =====
  /** Open or close the project manager dialog */
  setManagerOpen: (open: boolean) => void
  
  // ===== Sidebar Actions =====
  /** Update sidebar width (clamped to MIN_WIDTH - MAX_WIDTH range by caller) */
  setSidebarWidth: (width: number) => void
  /** Collapse or expand the sidebar */
  setSidebarCollapsed: (collapsed: boolean) => void
  /** Set whether the sidebar is being resized (for drag operation tracking) */
  setResizingSidebar: (resizing: boolean) => void
  /** Open or close the sidebar overlay (mobile/compact layout) */
  setSidebarOverlayOpen: (open: boolean) => void
  /** Set the UI language and persist preference */
  setLanguage: (language: AppLanguage) => void
  /** Toggle between English and Chinese */
  toggleLanguage: () => void
  /** Persist pane open/closed flag */
  setPaneOpen: (pane: PaneKey, open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  theme: getInitialTheme(),
  isManagerOpen: false,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarCollapsed: false,
  resizingSidebar: false,
  sidebarOverlayOpen: false,
  language: getInitialLanguage(),
  paneOpen: {
    explorer: true,
    outline: true,
    timeline: true
  },

  setTheme: (mode) => set({ theme: mode }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setManagerOpen: (open) => set({ isManagerOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setResizingSidebar: (resizing) => set({ resizingSidebar: resizing }),
  setSidebarOverlayOpen: (open) => set({ sidebarOverlayOpen: open }),
  setLanguage: (language) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gg-language', language)
    }
    set({ language })
  },
  toggleLanguage: () =>
    set((state) => {
      const next = state.language === 'zh' ? 'en' : 'zh'
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('gg-language', next)
      }
      return { language: next }
    }),
  setPaneOpen: (pane, open) =>
    set((state) => ({
      paneOpen: {
        ...state.paneOpen,
        [pane]: open
      }
    }))
}))
