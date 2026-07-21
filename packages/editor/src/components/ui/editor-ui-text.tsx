'use client'

import { resolveBuiltInEditorUiText, usePascalTranslation } from '@pascal-app/i18n'
import { useCallback } from 'react'

export function EditorUiText({ children }: { children: string }) {
  const { t } = usePascalTranslation('editor')
  return <>{resolveBuiltInEditorUiText(children, t)}</>
}

export function useEditorUiText() {
  const { t } = usePascalTranslation('editor')
  return useCallback((value: string) => resolveBuiltInEditorUiText(value, t), [t])
}
