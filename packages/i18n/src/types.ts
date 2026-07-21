import type { i18n, Resource, ResourceLanguage } from 'i18next'

export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const
export type PascalLocale = (typeof SUPPORTED_LOCALES)[number]

export const BUILTIN_NAMESPACES = ['common', 'editor', 'nodes', 'viewer'] as const
export type PascalNamespace = (typeof BUILTIN_NAMESPACES)[number]

export type PascalI18nInstance = i18n
export type PascalResource = Resource
export type PascalTranslationTree = ResourceLanguage

export type PascalTranslationBundle = {
  pluginId: string
  namespace: `plugin-${string}`
  resources: Partial<Record<PascalLocale, PascalTranslationTree>>
}

export type LocalizedDescriptor = {
  label?: string
  labelKey?: string
  description?: string
  descriptionKey?: string
  kind?: string
}
