'use client'

import { EDITOR_LAYER } from '@pascal-app/editor'
import { useEffect, useMemo } from 'react'
import type { Group, Material, Mesh, MeshStandardMaterial } from 'three'

export default function GlnEquipmentPreview<Node>({
  buildGeometry,
  node,
  valid = true,
}: {
  buildGeometry: (node: Node) => Group
  node: Node
  valid?: boolean
}) {
  const built = useMemo(() => {
    const object = buildGeometry(node)
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
          ;(ghost as MeshStandardMaterial).color.set('#dc3f3f')
        }
        return ghost
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(makeGhost)
        : makeGhost(mesh.material)
    })
    return object
  }, [buildGeometry, node, valid])

  useEffect(
    () => () => {
      built.traverse((child) => {
        const mesh = child as Mesh
        mesh.geometry?.dispose()
        if (Array.isArray(mesh.material)) {
          for (const item of mesh.material) item.dispose()
        } else {
          mesh.material?.dispose()
        }
      })
    },
    [built],
  )

  return <primitive object={built} />
}
