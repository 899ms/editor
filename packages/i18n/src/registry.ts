import type { PascalI18nInstance, PascalLocale, PascalTranslationBundle } from './types.js'
import { BUILTIN_NAMESPACES, SUPPORTED_LOCALES } from './types.js'

const registrations = new WeakMap<PascalI18nInstance, Map<string, string>>()

function isDevelopment() {
  const processLike = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process
  return processLike?.env?.NODE_ENV !== 'production'
}

function registrationMap(instance: PascalI18nInstance) {
  const existing = registrations.get(instance)
  if (existing) return existing
  const created = new Map<string, string>()
  registrations.set(instance, created)
  return created
}

export function registerPascalTranslations(
  instance: PascalI18nInstance,
  bundle: PascalTranslationBundle,
) {
  if (!bundle.pluginId.trim()) throw new Error('Pascal translation pluginId cannot be empty')
  if (!bundle.namespace.startsWith('plugin-')) {
    throw new Error('Pascal plugin translation namespaces must start with "plugin-"')
  }
  if ((BUILTIN_NAMESPACES as readonly string[]).includes(bundle.namespace)) {
    throw new Error(`Pascal namespace "${bundle.namespace}" is reserved`)
  }

  const current = registrationMap(instance)
  if (current.has(bundle.pluginId) || [...current.values()].includes(bundle.namespace)) {
    const message = `Pascal translations already registered for ${bundle.pluginId} / ${bundle.namespace}`
    if (isDevelopment()) throw new Error(message)
    console.warn(message)
    return
  }

  for (const locale of SUPPORTED_LOCALES) {
    const resources = bundle.resources[locale]
    if (resources) instance.addResourceBundle(locale, bundle.namespace, resources, true, false)
  }
  current.set(bundle.pluginId, bundle.namespace)
}

export function unregisterPascalTranslations(instance: PascalI18nInstance, pluginId: string) {
  const current = registrations.get(instance)
  const namespace = current?.get(pluginId)
  if (!namespace) return

  for (const locale of SUPPORTED_LOCALES as readonly PascalLocale[]) {
    if (instance.hasResourceBundle(locale, namespace)) {
      instance.removeResourceBundle(locale, namespace)
    }
  }
  current?.delete(pluginId)
}
