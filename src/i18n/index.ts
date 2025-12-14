import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, NAMESPACES } from './config'

import commonEn from './locales/en/common.json'
import editorEn from './locales/en/editor.json'
import libraryEn from './locales/en/library.json'
import timelineEn from './locales/en/timeline.json'
import projectManagerEn from './locales/en/project-manager.json'
import insightsEn from './locales/en/insights.json'

import commonZh from './locales/zh/common.json'
import editorZh from './locales/zh/editor.json'
import libraryZh from './locales/zh/library.json'
import timelineZh from './locales/zh/timeline.json'
import projectManagerZh from './locales/zh/project-manager.json'
import insightsZh from './locales/zh/insights.json'

const resources = {
  en: {
    common: commonEn,
    editor: editorEn,
    library: libraryEn,
    timeline: timelineEn,
    'project-manager': projectManagerEn,
    insights: insightsEn
  },
  zh: {
    common: commonZh,
    editor: editorZh,
    library: libraryZh,
    timeline: timelineZh,
    'project-manager': projectManagerZh,
    insights: insightsZh
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  defaultNS: 'common',
  ns: NAMESPACES,
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
})

export default i18n
