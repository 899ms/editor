'use client'

import { createContext, type ReactNode, useCallback, useContext } from 'react'
import { I18nextProvider, type UseTranslationResponse, useTranslation } from 'react-i18next'
import { defaultPascalI18n } from './default-instance.js'
import { normalizePascalLocale } from './locale.js'
import type { PascalI18nInstance, PascalLocale, PascalNamespace } from './types.js'

const PascalI18nContext = createContext<PascalI18nInstance>(defaultPascalI18n)

export function PascalI18nProvider({
  children,
  instance,
}: {
  children: ReactNode
  instance: PascalI18nInstance
}) {
  return (
    <PascalI18nContext.Provider value={instance}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </PascalI18nContext.Provider>
  )
}

export function usePascalI18n() {
  return useContext(PascalI18nContext)
}

export function usePascalTranslation(): UseTranslationResponse<'common', undefined>
export function usePascalTranslation<Namespace extends PascalNamespace>(
  namespace: Namespace,
): UseTranslationResponse<Namespace, undefined>
export function usePascalTranslation(
  namespace: string,
): UseTranslationResponse<PascalNamespace, undefined>
export function usePascalTranslation(namespace = 'common') {
  const instance = usePascalI18n()
  return useTranslation(namespace as PascalNamespace, { i18n: instance, useSuspense: false })
}

export function usePascalLocale(): {
  locale: PascalLocale
  setLocale: (locale: PascalLocale) => Promise<void>
} {
  const instance = usePascalI18n()
  useTranslation('common', { i18n: instance, useSuspense: false })

  const setLocale = useCallback(
    async (locale: PascalLocale) => {
      await instance.changeLanguage(locale)
    },
    [instance],
  )

  return {
    locale: normalizePascalLocale(instance.resolvedLanguage ?? instance.language),
    setLocale,
  }
}
