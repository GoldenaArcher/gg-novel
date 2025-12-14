export type ThemeMode = 'dark' | 'light'

export type ChapterStatus = 'outline' | 'draft' | 'final'
export type StoryNodeKind = 'group' | 'chapter'

export interface Chapter {
  id: string
  title: string
  kind: StoryNodeKind
  variant?: string
  words: number
  status: ChapterStatus
  pace: 'slow burn' | 'balanced' | 'fast'
  mood: string
  draft: string
  summary: string
  updatedAt: number
  autosaveTimestamp?: number
  children?: Chapter[]
}

export interface ChapterSnapshot {
  timestamp: number
  words: number
  preview: string
}

export interface Note {
  id: string
  title: string
  content: string
}

export interface ProgressItem {
  id: string
  label: string
  value: string
}

export interface Project {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  description?: string
  stats: {
    words: number
    characters: number
  }
  structure: Chapter[]
  chapters: Chapter[]
  notes: Note[]
  progress: {
    overall: number
    checkpoints: ProgressItem[]
  }
}
