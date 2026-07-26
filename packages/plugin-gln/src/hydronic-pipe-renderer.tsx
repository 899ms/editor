'use client'

import { type AnyNodeId, useRegistry, useScene } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useLayoutEffect, useRef } from 'react'
import type { Group } from 'three'
import { useGlnEquipmentStore } from './equipment-store'
import type { GlnHydronicPipeNode } from './hydronic-pipe-schema'

/**
 * Concealed runs are intentionally absent from the normal view. The inspection
 * switch mounts their ordinary registry-backed group again; GeometrySystem then
 * rebuilds the same pure geometry, so no second display-only pipe model exists.
 */
export default function GlnHydronicPipeRenderer({ node }: { node: GlnHydronicPipeNode }) {
  const showConcealedRoutes = useGlnEquipmentStore((state) => state.showConcealedRoutes)
  const displayMode = useGlnEquipmentStore((state) => state.displayMode)
  if (node.concealed && !showConcealedRoutes && displayMode === 'edit') return null
  return <MountedGlnHydronicPipe node={node} />
}

function MountedGlnHydronicPipe({ node }: { node: GlnHydronicPipeNode }) {
  const ref = useRef<Group>(null!)
  const handlers = useNodeEvents(node as never, node.type as never)
  useRegistry(node.id, node.type, ref)

  useLayoutEffect(() => {
    useScene.getState().markDirty(node.id as AnyNodeId)
  }, [node.id])

  return <group ref={ref} visible={node.visible !== false} {...handlers} />
}
