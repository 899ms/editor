import { headers } from 'next/headers'
import Link from 'next/link'
import { CreateSceneButton } from '@/components/save-button'
import { SceneCard } from '@/components/scene-card'
import type { SceneMeta } from '@/components/scene-loader'
import { getRequestI18n } from '@/lib/server-locale'

export const dynamic = 'force-dynamic'

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  return host ? `${protocol}://${host}` : 'http://localhost:3003'
}

async function fetchScenes(): Promise<SceneMeta[]> {
  const response = await fetch(`${await resolveBaseUrl()}/api/scenes?limit=50`, {
    cache: 'no-store',
  })
  if (!response.ok) return []

  const payload = (await response.json()) as { scenes?: SceneMeta[] } | SceneMeta[]
  return Array.isArray(payload) ? payload : (payload.scenes ?? [])
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale)
  } catch {
    return iso
  }
}

export default async function ScenesPage() {
  const [scenes, { i18n, locale }] = await Promise.all([fetchScenes(), getRequestI18n()])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/"
            >
              {i18n.t('editor:navigation.home')}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">
              {i18n.t('editor:navigation.scenes')}
            </span>
          </nav>
          <CreateSceneButton />
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-2 font-bold text-3xl">{i18n.t('editor:scenes.heading')}</h1>
        <p className="mb-8 text-muted-foreground text-sm">
          {scenes.length === 0
            ? i18n.t('editor:scenes.emptyHint')
            : i18n.t('editor:scenes.count', { count: scenes.length })}
        </p>

        {scenes.length === 0 ? (
          <div className="rounded-xl border border-border/60 border-dashed bg-background p-12 text-center">
            <p className="text-muted-foreground text-sm">{i18n.t('editor:scenes.empty')}</p>
            <div className="mt-4 flex justify-center">
              <CreateSceneButton />
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((scene) => (
              <li key={scene.id}>
                <SceneCard scene={scene} updatedLabel={formatDate(scene.updatedAt, locale)} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
