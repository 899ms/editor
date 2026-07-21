import { createInstance, type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { normalizePascalLocale } from './locale.js'
import { BUILTIN_RESOURCES } from './resources.js'
import type { PascalI18nInstance, PascalLocale } from './types.js'

type CreatePascalI18nOptions = {
  initialLocale?: PascalLocale | string
  resources?: Resource
  reportMissingKeys?: boolean
}

function mergeResources(resources?: Resource): Resource {
  return {
    en: { ...BUILTIN_RESOURCES.en, ...(resources?.en ?? {}) },
    'zh-CN': { ...BUILTIN_RESOURCES['zh-CN'], ...(resources?.['zh-CN'] ?? {}) },
  }
}

function isDevelopment() {
  const processLike = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process
  return processLike?.env?.NODE_ENV !== 'production'
}

export function createPascalI18n(options: CreatePascalI18nOptions = {}): PascalI18nInstance {
  const instance = createInstance()
  const reportMissingKeys = options.reportMissingKeys ?? isDevelopment()

  instance.use(initReactI18next)
  void instance.init({
    defaultNS: 'common',
    fallbackLng: 'en',
    initImmediate: false,
    interpolation: { escapeValue: false },
    lng: normalizePascalLocale(options.initialLocale),
    load: 'currentOnly',
    ns: ['common', 'editor', 'nodes', 'viewer'],
    react: { useSuspense: false },
    resources: mergeResources(options.resources),
    returnEmptyString: false,
    returnNull: false,
    saveMissing: reportMissingKeys,
    showSupportNotice: false,
    supportedLngs: ['en', 'zh-CN'],
  })

  if (reportMissingKeys) {
    instance.on('missingKey', (_languages, namespace, key) => {
      console.warn(`[pascal-i18n] Missing translation: ${namespace}:${key}`)
    })
  }

  return instance
}
