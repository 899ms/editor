'use client'

import { sceneRegistry, useScene } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { getGlnHydronicTopologyIssues } from './hydronic-topology'

function setPipeColor(object: Object3D, color: string) {
  object.traverse((child) => {
    const mesh = child as Mesh
    const material = mesh.material as MeshStandardMaterial | undefined
    if (material?.isMeshStandardMaterial) material.color.set(color)
  })
}

/** Applies only a derived display state. Persisted endpoints remain the source of truth. */
export default function GlnHydronicTopologySystem() {
  const nodes = useScene((state) => state.nodes)
  const repairPipeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const system of Object.values(nodes)) {
      if ((system as { type?: string }).type !== 'gln:system') continue
      for (const issue of getGlnHydronicTopologyIssues(nodes as never, system.id)) {
        if (issue.pipeId) ids.add(issue.pipeId)
      }
    }
    return ids
  }, [nodes])

  useFrame(() => {
    for (const node of Object.values(nodes)) {
      if ((node as { type?: string }).type !== 'gln:hydronic-pipe') continue
      const pipe = node as unknown as { circuit: 'supply' | 'return'; id: string }
      const group = sceneRegistry.nodes.get(pipe.id)
      if (!group) continue
      setPipeColor(
        group,
        repairPipeIds.has(pipe.id) ? '#dc2626' : pipe.circuit === 'supply' ? '#e66a4e' : '#2c9dc0',
      )
    }
  })

  return null
}
