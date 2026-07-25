'use client'

import { usePascalTranslation } from '@pascal-app/i18n'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { createResidentialGraph } from '@/lib/create-residential-graph'

export { SaveButton } from '../../editor/components/save-button'

export function CreateSceneButton({ label }: { label?: string } = {}) {
  const { t } = usePascalTranslation('editor')
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleCreate = useCallback(async () => {
    setIsCreating(true)
    setHasError(false)
    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: t('scenes.defaultName'),
          graph: createResidentialGraph(),
        }),
      })
      if (!response.ok) {
        setHasError(true)
        return
      }
      const meta = (await response.json()) as { id: string }
      router.push(`/scene/${meta.id}`)
    } catch {
      setHasError(true)
    } finally {
      setIsCreating(false)
    }
  }, [router, t])

  return (
    <div className="flex items-center gap-3">
      {hasError && <span className="text-destructive text-xs">{t('save.createFailed')}</span>}
      <button
        className="rounded-md border border-border bg-accent px-3 py-1.5 font-medium text-sm hover:bg-accent/80 disabled:opacity-50"
        disabled={isCreating}
        onClick={handleCreate}
        type="button"
      >
        {isCreating ? t('save.creating') : (label ?? t('scenes.create'))}
      </button>
    </div>
  )
}
