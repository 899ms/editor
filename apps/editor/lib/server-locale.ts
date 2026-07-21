import {
  createPascalServerI18n,
  resolveInitialLocale,
  type PascalLocale,
} from '@pascal-app/i18n/server'
import { cookies, headers } from 'next/headers'

export async function getRequestLocale(): Promise<PascalLocale> {
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const savedLocale = cookieStore.get('pascal.locale')?.value

  return resolveInitialLocale({
    acceptLanguage: requestHeaders.get('accept-language'),
    savedLocale,
  })
}

export async function getRequestI18n() {
  const locale = await getRequestLocale()
  return {
    i18n: createPascalServerI18n({
      initialLocale: locale,
      reportMissingKeys: false,
    }),
    locale,
  }
}
