'use client'

import {
  type AnyNode,
  type AnyNodeId,
  collectAlignmentAnchors,
  emitter,
  type GridEvent,
  getFloorStackedPosition,
  type LevelNode,
  useScene,
  useSpatialQuery,
} from '@pascal-app/core'
import {
  EDITOR_LAYER,
  type FloorPlacementClickTriggerEvent,
  getLevelLocalSnappedPosition,
  isAlignmentGuideActive,
  isGridSnapActive,
  isMagneticSnapActive,
  movementSfxStepKey,
  resolveAlignedFloorPlacement,
  stopPlacementCommitPropagation,
  subscribeFloorPlacementClicks,
  triggerSFX,
  useAlignmentGuides,
  useEditor,
  useInteractionScope,
  usePlacementPreview,
  useViewer,
} from '@pascal-app/editor'
import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { useGlnEquipmentStore } from './equipment-store'

type Position3 = [number, number, number]
type Rotation3 = [number, number, number]

type GlnFloorEquipmentNode = {
  id: string
  parentId: string | null
  position: Position3
  rotation: Rotation3
  systemId: string
  type: string
}

export type GlnFloorEquipmentSpec<Node extends GlnFloorEquipmentNode> = {
  create(input: {
    parentId: string | null
    position?: Position3
    rotation?: Rotation3
    systemId: string
  }): Node
  dimensions(node: Node): [number, number, number]
  Preview: ComponentType<{ node: Node; valid?: boolean }>
}

type Placement = {
  isValid: boolean
  position: Position3
  rawX: number
  rawZ: number
  rotation: Rotation3
  stackedPosition: Position3
}

export default function GlnFloorEquipmentTool<Node extends GlnFloorEquipmentNode>({
  spec,
}: {
  spec: GlnFloorEquipmentSpec<Node>
}) {
  const levelId = useViewer((state) => state.selection.levelId)
  const systemId = useGlnEquipmentStore((state) => state.systemId)
  const viewMode = useEditor((state) => state.viewMode)
  const cursorRef = useRef<Group>(null)
  const yawRef = useRef(0)
  const altHeldRef = useRef(false)
  const previousSnapRef = useRef<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [valid, setValid] = useState(true)
  const { canPlaceOnFloor } = useSpatialQuery()
  const setReadyKind = useGlnEquipmentStore((state) => state.setReadyKind)

  const previewNode = useMemo(
    () =>
      spec.create({
        parentId: levelId,
        systemId: systemId ?? 'gln-system_preview',
      }),
    [levelId, spec, systemId],
  )

  useEffect(() => {
    if (!(levelId && systemId)) return

    setVisible(false)
    previousSnapRef.current = null
    const lastPlacementRef: { current: Placement | null } = { current: null }
    const alignmentCandidates = collectAlignmentAnchors(
      useScene.getState().nodes,
      previewNode.id,
      levelId,
    )

    useInteractionScope.getState().begin({
      kind: 'placing',
      node: previewNode as unknown as AnyNode,
      nodeId: previewNode.id as AnyNodeId,
      nodeType: previewNode.type,
      view: viewMode === '2d' ? '2d' : '3d',
      pressDrag: false,
      driver: 'kind-tool',
    })

    const resolvePlacement = (rawX: number, rawZ: number): Placement => {
      const forcePlace = altHeldRef.current
      const { position, guides } = resolveAlignedFloorPlacement({
        node: previewNode as unknown as AnyNode,
        rawX,
        rawZ,
        gridStep: useEditor.getState().gridSnapStep,
        candidates: alignmentCandidates,
        showAlignment: !forcePlace && isAlignmentGuideActive(),
        applyAlignmentSnap: !forcePlace && isMagneticSnapActive(),
        bypassGrid: forcePlace || !isGridSnapActive(),
        rotationY: yawRef.current,
      })
      useAlignmentGuides.getState().set(forcePlace ? [] : guides)

      const rotation: Rotation3 = [0, yawRef.current, 0]
      const isValid = canPlaceOnFloor(
        levelId as LevelNode['id'],
        position,
        spec.dimensions(previewNode),
        rotation,
      ).valid
      const stackedPosition = getFloorStackedPosition({
        node: previewNode as unknown as AnyNode,
        nodes: useScene.getState().nodes,
        position,
        rotation,
        levelId,
      })
      return { isValid, position, rawX, rawZ, rotation, stackedPosition }
    }

    const showPlacement = (placement: Placement) => {
      lastPlacementRef.current = placement
      cursorRef.current?.position.set(...placement.stackedPosition)
      cursorRef.current?.rotation.set(...placement.rotation)
      usePlacementPreview.getState().set({
        ...(previewNode as unknown as AnyNode),
        position: placement.position,
        rotation: placement.rotation,
      } as AnyNode)
      setValid(placement.isValid)
      setVisible(true)

      const nextSnapKey = movementSfxStepKey({
        coords: [placement.position[0], placement.position[2]],
        gridSnapActive: isGridSnapActive() && !altHeldRef.current,
        gridStep: useEditor.getState().gridSnapStep,
      })
      if (previousSnapRef.current !== nextSnapKey) {
        triggerSFX('sfx:grid-snap')
        previousSnapRef.current = nextSnapKey
      }
    }

    const refreshAtLastCursor = () => {
      const last = lastPlacementRef.current
      if (last) showPlacement(resolvePlacement(last.rawX, last.rawZ))
    }

    const onMove = (event: GridEvent) => {
      showPlacement(resolvePlacement(event.localPosition[0], event.localPosition[2]))
    }

    const commitAtCursor = (event: FloorPlacementClickTriggerEvent) => {
      const fallback = getLevelLocalSnappedPosition(
        levelId,
        event,
        useEditor.getState().gridSnapStep,
        altHeldRef.current || !isGridSnapActive(),
      )
      const placement = lastPlacementRef.current ?? resolvePlacement(fallback[0], fallback[2])
      if (!placement.isValid && !altHeldRef.current) {
        stopPlacementCommitPropagation(event)
        return
      }

      const node = spec.create({
        parentId: levelId,
        systemId,
        position: placement.position,
        rotation: placement.rotation,
      })
      useScene.getState().createNode(node as unknown as AnyNode, levelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
      triggerSFX('sfx:item-place')
      useAlignmentGuides.getState().clear()
      usePlacementPreview.getState().clear()
      useInteractionScope.getState().endIf((scope) => scope.kind === 'placing')
      useEditor.getState().setTool(null)
      stopPlacementCommitPropagation(event)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altHeldRef.current = true
        refreshAtLastCursor()
        return
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      const key = event.key.toLowerCase()
      if (key !== 'r' && key !== 't') return
      event.preventDefault()
      yawRef.current += key === 'r' ? Math.PI / 4 : -Math.PI / 4
      refreshAtLastCursor()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return
      altHeldRef.current = false
      refreshAtLastCursor()
    }

    const onBlur = () => {
      if (!altHeldRef.current) return
      altHeldRef.current = false
      refreshAtLastCursor()
    }

    emitter.on('grid:move', onMove)
    const unsubscribePlacementClicks = subscribeFloorPlacementClicks(commitAtCursor)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    setReadyKind(previewNode.type)
    return () => {
      emitter.off('grid:move', onMove)
      unsubscribePlacementClicks()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      altHeldRef.current = false
      useAlignmentGuides.getState().clear()
      usePlacementPreview.getState().clear()
      useInteractionScope
        .getState()
        .endIf((scope) => scope.kind === 'placing' && scope.nodeId === previewNode.id)
      if (useGlnEquipmentStore.getState().readyKind === previewNode.type) {
        setReadyKind(null)
      }
    }
  }, [canPlaceOnFloor, levelId, previewNode, setReadyKind, spec, systemId, viewMode])

  if (!(levelId && systemId)) return null

  const Preview = spec.Preview
  return (
    <group layers={EDITOR_LAYER} ref={cursorRef} visible={visible}>
      <Preview node={previewNode} valid={valid} />
    </group>
  )
}
