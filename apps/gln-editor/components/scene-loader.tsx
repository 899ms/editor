'use client'

import { useScene } from '@pascal-app/core'
import type { ComponentProps } from 'react'
import {
  SceneLoader as EditorSceneLoader,
  type SceneMeta,
} from '../../editor/components/scene-loader'
import { GlnBuildTab } from './build-tab'

export type { SceneMeta }

type SceneLoaderProps = Omit<ComponentProps<typeof EditorSceneLoader>, 'buildTabComponent'>

function ClientSceneStateMarker() {
  const nodeTypes = useScene((state) =>
    Object.values(state.nodes)
      .map((node) => node.type)
      .sort()
      .join(','),
  )

  return <span data-gln-client-node-types={nodeTypes} hidden />
}

export function SceneLoader(props: SceneLoaderProps) {
  return (
    <>
      <ClientSceneStateMarker />
      <EditorSceneLoader {...props} buildTabComponent={GlnBuildTab} />
    </>
  )
}
