import type { Namespace, TFunction } from 'i18next'

/** Legacy compatibility bridge for built-in editor copy awaiting semantic keys. */
export function resolveBuiltInEditorUiText<Ns extends Namespace>(
  value: string,
  t: TFunction<Ns>,
): string {
  const resource = t('legacyUiText' as never, {
    defaultValue: {},
    keySeparator: false,
    nsSeparator: false,
    returnObjects: true,
  }) as unknown
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return value

  const map = resource as Record<string, string>
  if (map[value]) return map[value]
  const normalized = value.toLowerCase()
  for (const [key, translated] of Object.entries(map)) {
    if (key.toLowerCase() === normalized) return translated
  }
  return value
}
