'use client'

import { useEffect, useMemo } from 'react'
import { type Material, MeshBasicMaterial, type Object3D } from 'three'
import type { GlnGlbImportNode } from './glb-import-schema'
import { useGlnGlbReferenceStore } from './glb-reference-store'

function buildReferenceObject(source: Object3D) {
  const clone = source.clone(true)
  clone.name = 'gln-glb-reference-layer'
  clone.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean
      material?: Material | Material[]
    }
    if (!mesh.isMesh) return
    mesh.material = new MeshBasicMaterial({
      color: '#38bdf8',
      depthWrite: false,
      opacity: 0.2,
      transparent: true,
      wireframe: true,
    })
  })
  return clone
}

function disposeReferenceObject(object: Object3D) {
  object.traverse((child) => {
    const mesh = child as {
      isMesh?: boolean
      material?: Material | Material[]
    }
    if (!mesh.isMesh || !mesh.material) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) material.dispose()
  })
}

export default function GlnGlbReferenceRenderer({ node }: { node: GlnGlbImportNode }) {
  const source = useGlnGlbReferenceStore((state) => state.references[node.id])
  const object = useMemo(() => (source ? buildReferenceObject(source) : null), [source])
  useEffect(
    () => () => {
      if (object) disposeReferenceObject(object)
    },
    [object],
  )

  if (!object) return null
  return <primitive object={object} visible={node.referenceVisible && node.visible !== false} />
}
