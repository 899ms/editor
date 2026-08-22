'use client'

import { usePascalTranslation } from '@pascal-app/i18n'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import type { SceneMeta } from '@/components/scene-loader'

type SceneCardProps = {
  scene: SceneMeta
  updatedLabel: string
}

export function SceneCard({ scene, updatedLabel }: SceneCardProps) {
  const { t } = usePascalTranslation('editor')
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasError, setHasError] = useState(false)
  const deleteLabel = isDeleting ? t('scenes.deleting') : t('scenes.delete')

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        t('scenes.deleteConfirm', '确定要删除此场景吗？此操作无法撤销。', {
          sceneName: scene.name,
        }),
      )
    ) {
      return
    }

    setIsDeleting(true)
    setHasError(false)
    try {
      const response = await fetch(`/api/scenes/${encodeURIComponent(scene.id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        setHasError(true)
        return
      }
      router.refresh()
    } catch {
      setHasError(true)
    } finally {
      setIsDeleting(false)
    }
  }, [router, scene.id, scene.name, t])

  return (
    <article
      className="group relative rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-border hover:bg-accent/30"
      data-scene-id={scene.id}
    >
      <Link className="block" href={`/scene/${scene.id}`}>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-accent/30">
          {scene.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={scene.name} className="h-full w-full object-cover" src={scene.thumbnailUrl} />
          ) : (
            <span className="text-muted-foreground text-xs">{t('scenes.noThumbnail')}</span>
          )}
        </div>
        <div className="mt-3 pr-10">
          <h2 className="truncate font-semibold text-sm group-hover:text-foreground">
            {scene.name}
          </h2>
          <div className="mt-1 flex items-center justify-between text-muted-foreground text-xs">
            <span>{t('scenes.nodeCount', { count: scene.nodeCount })}</span>
            <time dateTime={scene.updatedAt}>{updatedLabel}</time>
          </div>
        </div>
      </Link>
      <button
        aria-label={deleteLabel}
        className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isDeleting}
        onClick={handleDelete}
        title={deleteLabel}
        type="button"
      >
        <Trash2 aria-hidden="true" size={16} />
      </button>
      {hasError ? (
        <p className="mt-2 text-destructive text-xs" role="alert">
          {t('scenes.deleteFailed')}
        </p>
      ) : null}
    </article>
  )
}
