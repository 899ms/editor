'use client'

import type { LevelNode } from '@pascal-app/core'
import { usePascalTranslation } from '@pascal-app/i18n'
import { useEffect, useState } from 'react'
import type { LevelDuplicatePreset } from '../../lib/level-duplication'
import { getLocalizedLevelDisplayName } from '../../lib/localized-level-name'
import { cn } from '../../lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './primitives/dialog'

const DUPLICATE_PRESETS = [
  {
    id: 'everything',
    labelKey: 'levels.duplicateDialog.presets.everything.label',
    descriptionKey: 'levels.duplicateDialog.presets.everything.description',
  },
  {
    id: 'structure',
    labelKey: 'levels.duplicateDialog.presets.structure.label',
    descriptionKey: 'levels.duplicateDialog.presets.structure.description',
  },
  {
    id: 'structure-materials',
    labelKey: 'levels.duplicateDialog.presets.structureMaterials.label',
    descriptionKey: 'levels.duplicateDialog.presets.structureMaterials.description',
  },
  {
    id: 'structure-furniture',
    labelKey: 'levels.duplicateDialog.presets.structureFurniture.label',
    descriptionKey: 'levels.duplicateDialog.presets.structureFurniture.description',
  },
] as const satisfies ReadonlyArray<{
  id: LevelDuplicatePreset
  labelKey: string
  descriptionKey: string
}>

export function LevelDuplicateDialog({
  open,
  level,
  onConfirm,
  onOpenChange,
}: {
  open: boolean
  level: LevelNode | null
  onConfirm: (preset: LevelDuplicatePreset) => void
  onOpenChange: (open: boolean) => void
}) {
  const { t } = usePascalTranslation('editor')
  const { t: tCommon } = usePascalTranslation('common')
  const [preset, setPreset] = useState<LevelDuplicatePreset>('everything')

  useEffect(() => {
    if (open) {
      setPreset('everything')
    }
  }, [open])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('levels.duplicateDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('levels.duplicateDialog.description', {
              name: level
                ? getLocalizedLevelDisplayName(level, t)
                : t('levels.duplicateDialog.thisLevel'),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {DUPLICATE_PRESETS.map((option) => (
            <button
              className={cn(
                'cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors',
                preset === option.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background hover:bg-accent/40',
              )}
              key={option.id}
              onClick={() => setPreset(option.id)}
              type="button"
            >
              <div className="font-medium text-sm">{t(option.labelKey)}</div>
              <div className="mt-1 text-muted-foreground text-xs">{t(option.descriptionKey)}</div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <button
            className="cursor-pointer rounded-md px-4 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {tCommon('actions.cancel')}
          </button>
          <button
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-opacity hover:opacity-90"
            onClick={() => onConfirm(preset)}
            type="button"
          >
            {t('levels.duplicateDialog.confirm')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
