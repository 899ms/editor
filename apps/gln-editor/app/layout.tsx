import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { getRequestLocale } from '@/lib/server-locale'
import { ClientBootstrap } from './client-bootstrap'
import './globals.css'

const geistSans = localFont({
  src: '../../editor/app/fonts/GeistVF.woff',
  variable: '--font-geist-sans',
})
const geistMono = localFont({
  src: '../../editor/app/fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'GLN 光冷暖编辑器',
  description: '光冷暖住宅系统编辑器',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const initialLocale = await getRequestLocale()

  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang={initialLocale}>
      <body className="font-sans">
        <ClientBootstrap initialLocale={initialLocale}>{children}</ClientBootstrap>
      </body>
    </html>
  )
}
