export const DEFAULT_LANGUAGE = 'zh' as const
export const FALLBACK_LANGUAGE = 'en' as const

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const
export const NAMESPACES = [
  'common',
  'editor',
  'library',
  'timeline',
  'project-manager',
  'insights'
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export type Namespace = (typeof NAMESPACES)[number]
