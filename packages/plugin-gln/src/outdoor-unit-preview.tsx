'use client'

import { EDITOR_LAYER } from '@pascal-app/editor'
import { useEffect, useMemo } from 'react'
import type { Material, Mesh, MeshStandardMaterial } from 'three'
import { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

export default function GlnOutdoorUnitPreview({
  node,
  valid = true,
}: {
  node: GlnOutdoorUnitNode
  valid?: boolean
}) {
  const built = useMemo(() => {
    const object = buildGlnOutdoorUnitGeometry(node)
    object.traverse((child) => {
      child.layers.set(EDITOR_LAYER)
      child.raycast = () => {}
      const mesh = child as Mesh
      if (!mesh.material) return
      const makeGhost = (source: Material) => {
        const ghost = source.clone()
        ghost.transparent = true
        ghost.opacity = 0.55
        ghost.depthWrite = false
        if (!valid && 'color' in ghost) {
          const coloredGhost = ghost as MeshStandardMaterial
          coloredGhost.color.set('#dc3f3f')
        }
        return ghost
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(makeGhost)
        : makeGhost(mesh.material)
    })
    return object
  }, [node, valid])

  useEffect(
    () => () => {
      built.traverse((child) => {
        const mesh = child as Mesh
        mesh.geometry?.dispose()
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) material.dispose()
        } else {
          mesh.material?.dispose()
        }
      })
    },
    [built],
  )

  return <primitive object={built} />
}
