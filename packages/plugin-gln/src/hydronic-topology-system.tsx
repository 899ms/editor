'use client'

import { sceneRegistry, useScene } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { useGlnEquipmentStore } from './equipment-store'
import type { GlnHydronicPipeNode } from './hydronic-pipe-schema'
import { getGlnHydronicTopologyIssues } from './hydronic-topology'
import { deriveGlnRunPreview } from './run-preview'

function setPipeColor(object: Object3D, color: string) {
  object.traverse((child) => {
    const mesh = child as Mesh
    const material = mesh.material as MeshStandardMaterial | undefined
    if (material?.isMeshStandardMaterial) material.color.set(color)
  })
}

function setEditingAidVisibility(object: Object3D, visible: boolean) {
  object.traverse((child) => {
    if (
      child.name === 'gln-equipment-clearance' ||
      child.name.includes('-port-') ||
      child.name === 'gln-wall-panel-supply' ||
      child.name === 'gln-wall-panel-return'
    ) {
      child.visible = visible
    }
  })
}

function pointOnPath(path: GlnHydronicPipeNode['path'], progress: number) {
  const points = path.map((point) => new Vector3(...point))
  const lengths = points.slice(0, -1).map((point, index) => point.distanceTo(points[index + 1]!))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (total <= 1e-5) return points[0] ?? new Vector3()
  let distance = progress * total
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!
    if (distance <= length) {
      return points[index]!.clone().lerp(points[index + 1]!, distance / length)
    }
    distance -= length
  }
  return points.at(-1)!.clone()
}

function disposeMesh(mesh: Mesh) {
  mesh.removeFromParent()
  mesh.geometry.dispose()
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials) material.dispose()
}

/** Applies only a derived display state. Persisted endpoints remain the source of truth. */
export default function GlnHydronicTopologySystem() {
  const nodes = useScene((state) => state.nodes)
  const displayMode = useGlnEquipmentStore((state) => state.displayMode)
  const flowParticles = useRef(new Map<string, Mesh>())
  const energyWaves = useRef(new Map<string, Mesh>())
  const preview = useMemo(() => deriveGlnRunPreview(nodes as never), [nodes])
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

  useEffect(
    () => () => {
      for (const particle of flowParticles.current.values()) disposeMesh(particle)
      for (const wave of energyWaves.current.values()) disposeMesh(wave)
      flowParticles.current.clear()
      energyWaves.current.clear()
    },
    [],
  )

  useFrame(({ clock }) => {
    const runPreview = displayMode === 'run-preview'
    for (const node of Object.values(nodes)) {
      const typed = node as unknown as { circuit?: 'supply' | 'return'; id: string; type: string }
      const group = sceneRegistry.nodes.get(typed.id)
      if (!group) continue
      setEditingAidVisibility(group, !runPreview)
      if (typed.type === 'gln:hydronic-pipe' && typed.circuit) {
        setPipeColor(
          group,
          !runPreview && repairPipeIds.has(typed.id)
            ? '#dc2626'
            : typed.circuit === 'supply'
              ? '#e66a4e'
              : '#2c9dc0',
        )
      }
    }

    const activeParticles = new Set<string>()
    if (runPreview) {
      for (const flow of preview.pipes) {
        const pipe = nodes[flow.pipeId as never] as unknown as GlnHydronicPipeNode | undefined
        const group = sceneRegistry.nodes.get(flow.pipeId)
        if (!(pipe && group)) continue
        let particle = flowParticles.current.get(flow.pipeId)
        if (!particle) {
          particle = new Mesh(
            new SphereGeometry(Math.max(0.035, pipe.diameterIn * 0.0254), 16, 12),
            new MeshBasicMaterial({
              color: pipe.circuit === 'supply' ? '#ff8a65' : '#38bdf8',
              blending: AdditiveBlending,
              depthWrite: false,
            }),
          )
          particle.name = 'gln-run-preview-flow'
          group.add(particle)
          flowParticles.current.set(flow.pipeId, particle)
        }
        activeParticles.add(flow.pipeId)
        const phase = (clock.elapsedTime * 0.28) % 1
        particle.position.copy(
          pointOnPath(pipe.path, flow.pathDirection === 'forward' ? phase : 1 - phase),
        )
      }
    }
    for (const [id, particle] of flowParticles.current) {
      if (activeParticles.has(id)) continue
      disposeMesh(particle)
      flowParticles.current.delete(id)
    }

    const activeWaves = new Set<string>()
    if (runPreview) {
      for (const panelPreview of preview.panels) {
        const panel = nodes[panelPreview.panelId as never] as unknown as
          | { depth: number; height: number; id: string; width: number }
          | undefined
        const group = sceneRegistry.nodes.get(panelPreview.panelId)
        if (!(panel && group)) continue
        for (let index = 0; index < 3; index++) {
          const key = `${panel.id}:${index}`
          let wave = energyWaves.current.get(key)
          if (!wave) {
            wave = new Mesh(
              new TorusGeometry(0.32, 0.012, 8, 48),
              new MeshBasicMaterial({
                color: panelPreview.energyDirection === 'space-to-panel' ? '#38bdf8' : '#fb923c',
                depthWrite: false,
                opacity: 0.42,
                transparent: true,
              }),
            )
            wave.name = 'gln-run-preview-energy-wave'
            group.add(wave)
            energyWaves.current.set(key, wave)
          }
          activeWaves.add(key)
          const rawPhase = (clock.elapsedTime * 0.32 + index / 3) % 1
          const phase = panelPreview.energyDirection === 'space-to-panel' ? 1 - rawPhase : rawPhase
          const scale = 0.5 + phase * 1.5
          wave.scale.setScalar(scale * Math.min(panel.width, panel.height))
          wave.position.set(0, 0, panel.depth / 2 + 0.08 + phase * 0.45)
          ;(wave.material as MeshBasicMaterial).opacity = 0.42 * (1 - rawPhase)
        }
      }
    }
    for (const [id, wave] of energyWaves.current) {
      if (activeWaves.has(id)) continue
      disposeMesh(wave)
      energyWaves.current.delete(id)
    }
  })

  return null
}
