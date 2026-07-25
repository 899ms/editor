'use client'

import { type AnyNode, type AnyNodeId, emitter, type GridEvent, useScene } from '@pascal-app/core'
import {
  triggerSFX,
  useEditor,
  useInteractionScope,
  usePlacementPreview,
  useViewer,
} from '@pascal-app/editor'
import { useEffect, useMemo, useRef } from 'react'
import { useGlnEquipmentStore } from './equipment-store'
import { resolveWallPanelPlanTarget } from './wall-panel-floorplan-move'
import { buildWallPanelHostPatch, type WallPanelTarget } from './wall-panel-installation'
import { GlnWallPanelNode, type GlnWallPanelSide } from './wall-panel-schema'

function oppositeSide(side: GlnWallPanelSide): GlnWallPanelSide {
  return side === 'front' ? 'back' : 'front'
}

/**
 * The 3D canvas is intentionally absent in the dedicated 2D view, so a
 * registry tool needs this DOM-side bridge to consume the floor-plan grid
 * events. It shares the exact placement resolver with the 2D move session.
 */
export default function GlnWallPanelFloorplanTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const systemId = useGlnEquipmentStore((state) => state.systemId)
  const setReadyKind = useGlnEquipmentStore((state) => state.setReadyKind)
  const sideFlippedRef = useRef(false)
  const lastEventRef = useRef<GridEvent | null>(null)

  const panel = useMemo(
    () =>
      GlnWallPanelNode.parse({
        parentId: null,
        systemId: systemId ?? 'gln-system_unassigned',
        wallId: 'wall_unassigned',
      }),
    [systemId],
  )

  useEffect(() => {
    if (!(levelId && systemId)) return
    setReadyKind(panel.type)
    useInteractionScope.getState().begin({
      kind: 'placing',
      node: panel as unknown as AnyNode,
      nodeId: panel.id as AnyNodeId,
      nodeType: panel.type,
      view: '2d',
      pressDrag: false,
      driver: 'kind-tool',
    })

    const resolveTarget = (event: GridEvent) =>
      resolveWallPanelPlanTarget({
        node: panel,
        nodes: useScene.getState().nodes,
        planPoint: [event.localPosition[0], event.localPosition[2]],
        levelId: levelId as AnyNodeId,
        flipped: sideFlippedRef.current,
      })

    const showTarget = (event: GridEvent): WallPanelTarget | null => {
      lastEventRef.current = event
      const target = resolveTarget(event)
      if (!target) {
        usePlacementPreview.getState().clear()
        return null
      }
      const preview = GlnWallPanelNode.parse({
        ...panel,
        ...buildWallPanelHostPatch(target, useScene.getState().nodes),
        visible: true,
      })
      usePlacementPreview.getState().set(preview as unknown as AnyNode, target.wall)
      return target
    }

    const commit = (event: GridEvent) => {
      const target = showTarget(event)
      if (!target?.valid) return
      const created = GlnWallPanelNode.parse({
        ...panel,
        ...buildWallPanelHostPatch(target, useScene.getState().nodes),
        id: undefined,
        systemId,
        metadata: {},
      })
      useScene.getState().createNode(created as unknown as AnyNode, target.wall.id as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [created.id as AnyNodeId] })
      usePlacementPreview.getState().clear()
      triggerSFX('sfx:item-place')
      useEditor.getState().setTool(null)
      event.nativeEvent.stopPropagation()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return
      if (event.key === 'Escape') {
        useEditor.getState().setTool(null)
        return
      }
      if (event.key.toLowerCase() !== 'r') return
      event.preventDefault()
      sideFlippedRef.current = !sideFlippedRef.current
      if (lastEventRef.current) showTarget(lastEventRef.current)
      triggerSFX('sfx:item-rotate')
    }

    emitter.on('grid:move', showTarget)
    emitter.on('grid:click', commit)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      emitter.off('grid:move', showTarget)
      emitter.off('grid:click', commit)
      window.removeEventListener('keydown', onKeyDown, true)
      usePlacementPreview.getState().clear()
      useInteractionScope
        .getState()
        .endIf((scope) => scope.kind === 'placing' && scope.nodeId === panel.id)
      setReadyKind(null)
    }
  }, [levelId, panel, setReadyKind, systemId])

  return null
}
