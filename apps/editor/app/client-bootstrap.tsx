'use client'

// Loads `@pascal-app/nodes`' built-in plugin into the node registry on the
// client. Mounted from `layout.tsx` so every page in the standalone
// editor gets the registry populated before its first `<Viewer>` /
// `<Editor>` mounts.
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
  enableDevDiagnostics,
  initialLocale,
}: {
  children: ReactNode
  enableDevDiagnostics: boolean
  initialLocale: PascalLocale
}) {
  const [i18n] = useState(() => {
    const instance = createPascalI18n({
      initialLocale,
    })

    // React Three Fiber renders some DOM overlays in a separate reconciler
    // root, where the app provider is not always available. Keep the shared
    // fallback instance aligned so those overlays use the active locale too.
    void defaultPascalI18n.changeLanguage(initialLocale)
    return instance
  })

  useEffect(() => {
    persistLocale(i18n.resolvedLanguage ?? i18n.language)
    const handleLanguageChanged = (language: string) => {
      persistLocale(language)
      void defaultPascalI18n.changeLanguage(normalizePascalLocale(language))
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  useEffect(() => {
    if (!enableDevDiagnostics) return
    import('react-scan').then(({ scan }) => scan({ enabled: true }))
  }, [enableDevDiagnostics])

  return <PascalI18nProvider instance={i18n}>{children}</PascalI18nProvider>
}
