import { describe, expect, test } from 'bun:test'
import { createPascalI18n } from '@pascal-app/i18n'
import { builtinPlugin } from './index'

describe('built-in node localization metadata', () => {
  test('every built-in presentation resolves in English and Simplified Chinese', () => {
    const i18n = createPascalI18n({ initialLocale: 'en', reportMissingKeys: false })
    const definitions = builtinPlugin.nodes ?? []

    expect(definitions.length).toBeGreaterThan(0)
    for (const definition of definitions) {
      const presentation = definition.presentation
      expect(presentation, `${definition.kind} is missing presentation metadata`).toBeDefined()
      expect(presentation?.label, `${definition.kind} is missing its English fallback`).toBeTruthy()
      expect(presentation?.labelKey, `${definition.kind} is missing labelKey`).toMatch(
        /^nodes:kinds\./,
      )
      expect(presentation?.descriptionKey, `${definition.kind} is missing descriptionKey`).toMatch(
        /^nodes:descriptions\./,
      )

      for (const locale of ['en', 'zh-CN'] as const) {
        expect(
          i18n.exists(presentation!.labelKey!, { lng: locale }),
          `${definition.kind} label is missing in ${locale}`,
        ).toBe(true)
        expect(
          i18n.exists(presentation!.descriptionKey!, { lng: locale }),
          `${definition.kind} description is missing in ${locale}`,
        ).toBe(true)
      }
    }
  })
})
