import { describe, expect, test } from 'bun:test'
import {
  createPascalI18n,
  detectBrowserLocale,
  normalizePascalLocale,
  parseAcceptLanguage,
  registerPascalTranslations,
  resolveInitialLocale,
  resolveLocalizedLabel,
  unregisterPascalTranslations,
} from './index.js'

describe('Pascal i18n instances', () => {
  test('normalizes supported Chinese locales', () => {
    expect(normalizePascalLocale('zh')).toBe('zh-CN')
    expect(normalizePascalLocale('zh_SG')).toBe('zh-CN')
    expect(normalizePascalLocale('en-US')).toBe('en')
  })

  test('respects browser and Accept-Language priority', () => {
    expect(detectBrowserLocale(['en-US', 'zh-CN'])).toBe('en')
    expect(detectBrowserLocale(['fr-FR', 'zh-CN'])).toBe('zh-CN')
    expect(parseAcceptLanguage('en-US, zh-CN;q=0.2')).toBe('en')
    expect(parseAcceptLanguage('fr-FR, zh-CN;q=0.8, en;q=0.4')).toBe('zh-CN')
    expect(parseAcceptLanguage('zh-CN;q=0, en;q=0.5')).toBe('en')
  })

  test('prefers a saved locale over the request language', () => {
    expect(resolveInitialLocale({ savedLocale: 'zh-CN', acceptLanguage: 'en-US' })).toBe('zh-CN')
    expect(resolveInitialLocale({ acceptLanguage: 'zh-SG, en;q=0.5' })).toBe('zh-CN')
    expect(resolveInitialLocale({ savedLocale: 'fr-FR', acceptLanguage: 'zh-CN' })).toBe('en')
  })

  test('loads bundled resources synchronously', () => {
    const instance = createPascalI18n({ initialLocale: 'zh-CN', reportMissingKeys: false })
    expect(instance.t('common:actions.save')).toBe('保存')
    expect(instance.t('editor:tabs.scene')).toBe('场景')
  })

  test('keeps host instances isolated', async () => {
    const first = createPascalI18n({ initialLocale: 'en', reportMissingKeys: false })
    const second = createPascalI18n({ initialLocale: 'en', reportMissingKeys: false })

    await first.changeLanguage('zh-CN')

    expect(first.t('common:actions.cancel')).toBe('取消')
    expect(second.t('common:actions.cancel')).toBe('Cancel')
  })
})

describe('plugin translation resources', () => {
  test('registers, falls back, and unregisters per instance', async () => {
    const instance = createPascalI18n({ initialLocale: 'zh-CN', reportMissingKeys: false })
    registerPascalTranslations(instance, {
      pluginId: 'beam-tools',
      namespace: 'plugin-beam-tools',
      resources: {
        en: { beam: 'Beam' },
      },
    })

    expect(instance.t('plugin-beam-tools:beam')).toBe('Beam')
    expect(() =>
      registerPascalTranslations(instance, {
        pluginId: 'beam-tools',
        namespace: 'plugin-beam-tools',
        resources: { en: { beam: 'Different beam' } },
      }),
    ).toThrow()

    unregisterPascalTranslations(instance, 'beam-tools')
    expect(instance.hasResourceBundle('en', 'plugin-beam-tools')).toBe(false)
  })

  test('resolves descriptor keys with an English label fallback', () => {
    const instance = createPascalI18n({ initialLocale: 'zh-CN', reportMissingKeys: false })
    expect(
      resolveLocalizedLabel(
        { kind: 'wall', label: 'Wall', labelKey: 'nodes:kinds.wall' },
        instance.t,
      ),
    ).toBe('墙体')
    expect(
      resolveLocalizedLabel(
        { kind: 'custom', label: 'Custom object', labelKey: 'plugin-custom:missing' },
        instance.t,
      ),
    ).toBe('Custom object')
  })
})
