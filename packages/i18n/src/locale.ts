import type { PascalLocale } from './types.js'

function matchPascalLocale(value: string | null | undefined): PascalLocale | null {
  if (!value) return null
  const normalized = value.trim().replace('_', '-').toLowerCase()
  if (normalized === 'zh' || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
    return 'zh-CN'
  }
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  return null
}

export function normalizePascalLocale(value: string | null | undefined): PascalLocale {
  return matchPascalLocale(value) ?? 'en'
}

export function detectBrowserLocale(languages?: readonly string[]): PascalLocale {
  const candidates =
    languages ??
    (typeof navigator === 'undefined'
      ? []
      : [...navigator.languages, navigator.language].filter(Boolean))

  for (const language of candidates) {
    const locale = matchPascalLocale(language)
    if (locale) return locale
  }
  return 'en'
}

export function parseAcceptLanguage(header: string | null | undefined): PascalLocale {
  if (!header) return 'en'
  const languages = header
    .split(',')
    .map((entry, index) => {
      const [language = '', ...parameters] = entry.trim().split(';')
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='))
      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1
      return {
        index,
        language,
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
      }
    })
    .filter((entry) => entry.language && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.language)

  return detectBrowserLocale(languages)
}

export function resolveInitialLocale(options: {
  savedLocale?: string | null
  acceptLanguage?: string | null
}): PascalLocale {
  return options.savedLocale
    ? normalizePascalLocale(options.savedLocale)
    : parseAcceptLanguage(options.acceptLanguage)
}
