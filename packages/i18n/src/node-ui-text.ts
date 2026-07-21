import type { Namespace, TFunction } from 'i18next'

/** Resolve built-in node panel copy while leaving user-authored names untouched. */
export function resolveBuiltInNodeUiText<Ns extends Namespace>(
  value: string,
  t: TFunction<Ns>,
): string {
  const resourceOptions = {
    defaultValue: {},
    keySeparator: false,
    nsSeparator: false,
    returnObjects: true,
  } as const
  const exact = t('uiText' as never, resourceOptions) as unknown
  const terms = t('uiTerms' as never, resourceOptions) as unknown
  const exactMap = isStringMap(exact) ? exact : {}
  const termMap = isStringMap(terms) ? terms : {}

  const direct = lookupCaseInsensitive(exactMap, value)
  if (direct) return direct

  const words = value.match(/[A-Za-z][A-Za-z0-9]*/g)
  if (!words?.length) return value

  let unresolved = false
  const translated = value.replace(/[A-Za-z][A-Za-z0-9]*/g, (word) => {
    const replacement = termMap[word.toLowerCase()]
    if (replacement) return replacement
    if (TECHNICAL_TOKENS.has(word.toLowerCase())) return word
    unresolved = true
    return word
  })

  if (unresolved) return value
  return translated
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
    .replace(/\s*\/\s*/g, ' / ')
    .trim()
}

function isStringMap(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function lookupCaseInsensitive(map: Record<string, string>, value: string) {
  if (map[value]) return map[value]
  const normalized = value.toLowerCase()
  for (const [key, translated] of Object.entries(map)) {
    if (key.toLowerCase() === normalized) return translated
  }
  return undefined
}

const TECHNICAL_TOKENS = new Set([
  'a',
  'c',
  'cm',
  'dwv',
  'ft',
  'hvac',
  'h',
  'k',
  'm',
  'q',
  'v',
  'w',
  'x',
  'y',
  'z',
  'xyz',
])
