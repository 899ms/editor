'use client'

import { resolveBuiltInNodeUiText, usePascalTranslation } from '@pascal-app/i18n'
import { useCallback } from 'react'

export function NodeUiText({ children }: { children: string }) {
  const { t } = usePascalTranslation('nodes')
  return <>{resolveBuiltInNodeUiText(children, t)}</>
}

export function useNodeUiText() {
  const { t } = usePascalTranslation('nodes')
  return useCallback((value: string) => resolveBuiltInNodeUiText(value, t), [t])
}