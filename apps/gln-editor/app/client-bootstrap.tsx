'use client'

import '../lib/bootstrap'
import {
  createPascalI18n,
  defaultPascalI18n,
  normalizePascalLocale,
  PascalI18nProvider,
  type PascalLocale,
} from '@pascal-app/i18n'
import { type ReactNode, useEffect, useState } from 'react'

const LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function persistLocale(language: string) {
  const locale = normalizePascalLocale(language)
  document.documentElement.lang = locale
  document.cookie = `pascal.locale=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_MAX_AGE_SECONDS}; SameSite=Lax`
  try {
    localStorage.setItem('pascal.locale', locale)
  } catch {
    // Storage can be unavailable in privacy-restricted embedding contexts.
  }
}

export function ClientBootstrap({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale: PascalLocale
}) {
  const [i18n] = useState(() => {
    const instance = createPascalI18n({ initialLocale })
    void defaultPascalI18n.changeLanguage(initialLocale)
    return instance
  })

  useEffect(() => {
    persistLocale(i18n.resolvedLanguage ?? i18n.language)
    document.documentElement.dataset.pascalHydrated = 'true'
    const handleLanguageChanged = (language: string) => {
      persistLocale(language)
      void defaultPascalI18n.changeLanguage(normalizePascalLocale(language))
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
      delete document.documentElement.dataset.pascalHydrated
    }
  }, [i18n])

  return <PascalI18nProvider instance={i18n}>{children}</PascalI18nProvider>
}
