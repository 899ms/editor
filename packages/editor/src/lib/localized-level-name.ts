import type { LevelNode } from '@pascal-app/core'

type TranslateLevelName = (
  key: 'levels.basement' | 'levels.floor' | 'levels.ground',
  options?: { number: number },
) => string

export function getLocalizedDefaultLevelName(level: number, t: TranslateLevelName): string {
  if (level === 0) return t('levels.ground')
  if (level > 0) return t('levels.floor', { number: level })
  return t('levels.basement', { number: -level })
}

export function getLocalizedLevelDisplayName(
  level: Pick<LevelNode, 'name' | 'level'>,
  t: TranslateLevelName,
): string {
  return level.name || getLocalizedDefaultLevelName(level.level, t)
}
