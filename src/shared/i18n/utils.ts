const DEFAULT_LOCALE = 'en-US'
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  zh: 'zh-CN'
}

/**
 * Resolve a browser locale string (e.g., en-US, zh-CN) from an i18n language code.
 * Keeps locale mapping centralized so components don't duplicate logic.
 */
export const resolveLocale = (language?: string) => {
  if (!language) return DEFAULT_LOCALE
  const normalized = language.toLowerCase()
  const exact = LANGUAGE_LOCALE_MAP[normalized]
  if (exact) return exact
  const root = normalized.split('-')[0]
  return LANGUAGE_LOCALE_MAP[root] ?? DEFAULT_LOCALE
}
