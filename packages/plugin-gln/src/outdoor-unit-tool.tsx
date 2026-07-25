'use client'

import {
  type AnyNode,
  type AnyNodeId,
  emitter,
  type GridEvent,
  getFloorStackedPosition,
  type LevelNode,
  useScene,
  useSpatialQuery,
} from '@pascal-app/core'
import {
  EDITOR_LAYER,
  isGridSnapActive,
  triggerSFX,
  useEditor,
  useInteractionScope,
  useViewer,
} from '@pascal-app/editor'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { useGlnEquipmentStore } from './equipment-store'
import GlnOutdoorUnitPreview from './outdoor-unit-preview'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'

function snapXZ(x: number, z: number): [number, number] {
  if (!isGridSnapActive()) return [x, z]
  const step = useEditor.getState().gridSnapStep
  return [Math.round(x / step) * step, Math.round(z / step) * step]
}

export default function GlnOutdoorUnitTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const systemId = useGlnEquipmentStore((state) => state.systemId)
  const cursorRef = useRef<Group>(null)
  const yawRef = useRef(0)
  const [visible, setVisible] = useState(false)
  const [valid, setValid] = useState(true)
  const { canPlaceOnFloor } = useSpatialQuery()

  const previewNode = useMemo(
    () =>
      GlnOutdoorUnitNode.parse({
        parentId: levelId,
        systemId: systemId ?? 'gln-system_preview',
      }),
    [levelId, systemId],
  )

  useEffect(() => {
    if (!(levelId && systemId)) return

    useInteractionScope.getState().begin({
      kind: 'placing',
      node: previewNode as unknown as AnyNode,
      nodeId: previewNode.id,
      nodeType: previewNode.type,
      view: '3d',
      pressDrag: false,
      driver: 'kind-tool',
    })

    const resolvePlacement = (event: GridEvent) => {
      const [x, z] = snapXZ(event.localPosition[0], event.localPosition[2])
      const position: [number, number, number] = [x, 0, z]
      const rotation: [number, number, number] = [0, yawRef.current, 0]
      const isValid = canPlaceOnFloor(
        levelId as LevelNode['id'],
        position,
        [previewNode.width, previewNode.height, previewNode.depth],
        rotation,
      ).valid
      const stackedPosition = getFloorStackedPosition({
        node: previewNode as unknown as AnyNode,
        nodes: useScene.getState().nodes,
        position,
        rotation,
        levelId,
      })
      return { isValid, position, rotation, stackedPosition }
    }

    const onMove = (event: GridEvent) => {
      const placement = resolvePlacement(event)
      cursorRef.current?.position.set(...placement.stackedPosition)
      cursorRef.current?.rotation.set(...placement.rotation)
      setValid(placement.isValid)
      setVisible(true)
    }

    const onClick = (event: GridEvent) => {
      const placement = resolvePlacement(event)
      if (!placement.isValid) return
      const unit = GlnOutdoorUnitNode.parse({
        parentId: levelId,
        systemId,
        position: placement.position,
        rotation: placement.rotation,
      })
      useScene.getState().createNode(unit as unknown as AnyNode, levelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [unit.id as AnyNodeId] })
      triggerSFX('sfx:item-place')
      useInteractionScope.getState().endIf((scope) => scope.kind === 'placing')
      useEditor.getState().setTool(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      const key = event.key.toLowerCase()
      if (key !== 'r' && key !== 't') return
      event.preventDefault()
      yawRef.current += key === 'r' ? Math.PI / 4 : -Math.PI / 4
      if (cursorRef.current) cursorRef.current.rotation.y = yawRef.current
    }

    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      window.removeEventListener('keydown', onKeyDown)
      useInteractionScope
        .getState()
        .endIf((scope) => scope.kind === 'placing' && scope.nodeId === previewNode.id)
    }
  }, [canPlaceOnFloor, levelId, previewNode, systemId])

  if (!(levelId && systemId)) return null

  return (
    <group layers={EDITOR_LAYER} ref={cursorRef} visible={visible}>
      <GlnOutdoorUnitPreview node={previewNode} valid={valid} />
    </group>
  )
}
