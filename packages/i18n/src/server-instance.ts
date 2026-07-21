import { createInstance, type Resource } from 'i18next'
import { normalizePascalLocale } from './locale.js'
import { BUILTIN_RESOURCES } from './resources.js'
import type { PascalI18nInstance, PascalLocale } from './types.js'

type CreatePascalServerI18nOptions = {
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

export function createPascalServerI18n(
  options: CreatePascalServerI18nOptions = {},
): PascalI18nInstance {
  const instance = createInstance()

  void instance.init({
    defaultNS: 'common',
    fallbackLng: 'en',
    initImmediate: false,
    interpolation: { escapeValue: false },
    lng: normalizePascalLocale(options.initialLocale),
    load: 'currentOnly',
    ns: ['common', 'editor', 'nodes', 'viewer'],
    resources: mergeResources(options.resources),
    returnEmptyString: false,
    returnNull: false,
    saveMissing: options.reportMissingKeys ?? false,
    showSupportNotice: false,
    supportedLngs: ['en', 'zh-CN'],
  })

  return instance
}
