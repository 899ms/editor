import './i18next-types.js'

export { defaultPascalI18n } from './default-instance.js'
export {
  resolveLocalizedDescription,
  resolveLocalizedLabel,
} from './descriptor.js'
export { resolveBuiltInEditorUiText } from './editor-ui-text.js'
export { createPascalI18n } from './instance.js'
export {
  detectBrowserLocale,
  normalizePascalLocale,
  parseAcceptLanguage,
  resolveInitialLocale,
} from './locale.js'
export { resolveBuiltInNodeUiText } from './node-ui-text.js'
export {
  PascalI18nProvider,
  usePascalI18n,
  usePascalLocale,
  usePascalTranslation,
} from './provider.js'
export {
  registerPascalTranslations,
  unregisterPascalTranslations,
} from './registry.js'
export { BUILTIN_RESOURCES } from './resources.js'
export type {
  LocalizedDescriptor,
  PascalI18nInstance,
  PascalLocale,
  PascalNamespace,
  PascalResource,
  PascalTranslationBundle,
  PascalTranslationTree,
} from './types.js'
export {
  BUILTIN_NAMESPACES,
  SUPPORTED_LOCALES,
} from './types.js'
