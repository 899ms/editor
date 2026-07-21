import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createPascalI18n, PascalI18nProvider, usePascalTranslation } from './index.js'

function SaveLabel() {
  const { t } = usePascalTranslation('common')
  return <span>{t('actions.save')}</span>
}

describe('PascalI18nProvider', () => {
  test('uses the English fallback instance without a provider', () => {
    expect(renderToStaticMarkup(<SaveLabel />)).toBe('<span>Save</span>')
  })

  test('uses the host-owned instance supplied by a provider', () => {
    const instance = createPascalI18n({
      initialLocale: 'zh-CN',
      reportMissingKeys: false,
    })

    expect(
      renderToStaticMarkup(
        <PascalI18nProvider instance={instance}>
          <SaveLabel />
        </PascalI18nProvider>,
      ),
    ).toBe('<span>保存</span>')
  })
})
