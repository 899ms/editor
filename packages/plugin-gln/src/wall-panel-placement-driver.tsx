'use client'

import {
  type AnyNode,
  type AnyNodeId,
  collectLevelWallSegments,
  emitter,
  type GridEvent,
  nearestWallSegment,
  sceneRegistry,
  useLiveNodeOverrides,
  useScene,
  WALL_SNAP_DISTANCE_M,
  type WallEvent,
} from '@pascal-app/core'
import {
  calculateCursorRotation,
  EDITOR_LAYER,
  getSideFromNormal,
  isValidWallSideFace,
  triggerSFX,
  useEditor,
  useInteractionScope,
  usePlacementPreview,
  useViewer,
} from '@pascal-app/editor'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Group, Vector3 } from 'three'
import { useGlnEquipmentStore } from './equipment-store'
import {
  buildWallPanelHostPatch,
  resolveWallPanelTarget,
  type WallPanelTarget,
} from './wall-panel-installation'
import { GlnWallPanelNode, type GlnWallPanelSide } from './wall-panel-schema'

type PreviewPose = {
  position: [number, number, number]
  rotationY: number
  valid: boolean
}

const previewPoint = new Vector3()

function oppositeSide(side: GlnWallPanelSide): GlnWallPanelSide {
  return side === 'front' ? 'back' : 'front'
}

function toBuildingLocal(target: WallPanelTarget): [number, number, number] | null {
  const wallObject = sceneRegistry.nodes.get(target.wall.id as AnyNodeId)
  if (!wallObject) return null
  wallObject.updateWorldMatrix(true, false)
  previewPoint.set(...target.position)
  wallObject.localToWorld(previewPoint)

  const buildingId = useViewer.getState().selection.buildingId
  const buildingObject = buildingId ? sceneRegistry.nodes.get(buildingId as AnyNodeId) : undefined
  if (buildingObject) {
    buildingObject.updateWorldMatrix(true, false)
    buildingObject.worldToLocal(previewPoint)
  }
  return [previewPoint.x, previewPoint.y, previewPoint.z]
}

export default function GlnWallPanelPlacementDriver({
  node: movingNode,
}: {
  node?: GlnWallPanelNode
}) {
  const levelId = useViewer((state) => state.selection.levelId)
  const selectedSystemId = useGlnEquipmentStore((state) => state.systemId)
  const setReadyKind = useGlnEquipmentStore((state) => state.setReadyKind)
  const groupRef = useRef<Group>(null)
  const lastEventRef = useRef<WallEvent | null>(null)
  const lastGridEventRef = useRef<GridEvent | null>(null)
  const sideFlippedRef = useRef(false)
  const [pose, setPose] = useState<PreviewPose | null>(null)

  const panel = useMemo(
    () =>
      movingNode ??
      GlnWallPanelNode.parse({
        parentId: null,
        systemId: selectedSystemId ?? 'gln-system_unassigned',
        wallId: 'wall_unassigned',
      }),
    [movingNode, selectedSystemId],
  )

  useEffect(() => {
    const systemId = movingNode?.systemId ?? selectedSystemId
    if (!(levelId && systemId)) return

    if (!movingNode) {
      useInteractionScope.getState().begin({
        kind: 'placing',
        node: panel as unknown as AnyNode,
        nodeId: panel.id as AnyNodeId,
        nodeType: panel.type,
        view: useEditor.getState().viewMode === '2d' ? '2d' : '3d',
        pressDrag: false,
        driver: 'kind-tool',
      })
      setReadyKind(panel.type)
    } else {
      useLiveNodeOverrides.getState().set(panel.id as AnyNodeId, { visible: false })
    }

    const resolveTarget = (event: WallEvent) => {
      if (
        !isValidWallSideFace(event.normal) ||
        event.node.parentId !== levelId ||
        event.node.type !== 'wall'
      ) {
        return null
      }
      const faceSide = getSideFromNormal(event.normal)
      const side = sideFlippedRef.current ? oppositeSide(faceSide) : faceSide
      return resolveWallPanelTarget({
        wall: event.node,
        nodes: useScene.getState().nodes,
        localX: event.localPosition[0],
        side,
        width: panel.width,
        height: panel.height,
        depth: panel.depth,
        ignoreId: movingNode?.id,
      })
    }

    const resolvePlanTarget = (event: GridEvent) => {
      const nodes = useScene.getState().nodes
      const closest = nearestWallSegment(
        collectLevelWallSegments(nodes, levelId as AnyNodeId),
        event.localPosition[0],
        event.localPosition[2],
        WALL_SNAP_DISTANCE_M,
      )
      if (!closest) return null
      const hitSide: GlnWallPanelSide = closest.perp >= 0 ? 'front' : 'back'
      const side = sideFlippedRef.current ? oppositeSide(hitSide) : hitSide
      return resolveWallPanelTarget({
        wall: closest.segment.wall,
        nodes,
        localX: closest.along,
        side,
        width: panel.width,
        height: panel.height,
        depth: panel.depth,
      })
    }

    const showTarget = (event: WallEvent) => {
      lastEventRef.current = event
      const target = resolveTarget(event)
      if (!target) {
        setPose(null)
        return null
      }
      const position = toBuildingLocal(target)
      if (!position) {
        setPose(null)
        return null
      }
      setPose({
        position,
        rotationY:
          calculateCursorRotation(event.normal, event.node.start, event.node.end) +
          (sideFlippedRef.current ? Math.PI : 0),
        valid: target.valid,
      })
      return target
    }

    const showPlanTarget = (event: GridEvent) => {
      lastGridEventRef.current = event
      setPose(null)
      const target = resolvePlanTarget(event)
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

    const commitResolvedTarget = (target: WallPanelTarget, stopPropagation: () => void) => {
      const data = buildWallPanelHostPatch(target, useScene.getState().nodes)

      if (movingNode) {
        useScene.getState().updateNode(movingNode.id as AnyNodeId, data)
        useEditor.getState().setMovingNode(null)
      } else {
        const created = GlnWallPanelNode.parse({
          ...panel,
          ...data,
          id: undefined,
          systemId,
          metadata: {},
        })
        useScene.getState().createNode(created as unknown as AnyNode, target.wall.id as AnyNodeId)
        useViewer.getState().setSelection({ selectedIds: [created.id as AnyNodeId] })
        useEditor.getState().setTool(null)
      }
      triggerSFX('sfx:item-place')
      usePlacementPreview.getState().clear()
      stopPropagation()
    }

    const commitTarget = (event: WallEvent) => {
      if (useViewer.getState().cameraDragging) return
      const target = showTarget(event)
      if (!target?.valid) return
      commitResolvedTarget(target, event.stopPropagation)
    }

    const commitPlanTarget = (event: GridEvent) => {
      const target = showPlanTarget(event)
      if (!target?.valid) return
      commitResolvedTarget(target, () => event.nativeEvent.stopPropagation())
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'Escape') {
        if (movingNode) useEditor.getState().setMovingNode(null)
        else useEditor.getState().setTool(null)
        return
      }
      if (event.key.toLowerCase() !== 'r') return
      event.preventDefault()
      sideFlippedRef.current = !sideFlippedRef.current
      const last = lastEventRef.current
      if (last) showTarget(last)
      const lastGrid = lastGridEventRef.current
      if (lastGrid) showPlanTarget(lastGrid)
      triggerSFX('sfx:item-rotate')
    }

    emitter.on('wall:move', showTarget)
    emitter.on('wall:click', commitTarget)
    if (!movingNode) {
      emitter.on('grid:move', showPlanTarget)
      emitter.on('grid:click', commitPlanTarget)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      emitter.off('wall:move', showTarget)
      emitter.off('wall:click', commitTarget)
      if (!movingNode) {
        emitter.off('grid:move', showPlanTarget)
        emitter.off('grid:click', commitPlanTarget)
      }
      window.removeEventListener('keydown', onKeyDown, true)
      useLiveNodeOverrides.getState().clear(panel.id as AnyNodeId)
      usePlacementPreview.getState().clear()
      useInteractionScope
        .getState()
        .endIf((scope) => scope.kind === 'placing' && scope.nodeId === panel.id)
      if (useGlnEquipmentStore.getState().readyKind === panel.type) {
        setReadyKind(null)
      }
    }
  }, [levelId, movingNode, panel, selectedSystemId, setReadyKind])

  if (!pose) return null

  const color = pose.valid ? '#15939d' : '#ef4444'
  return (
    <group
      layers={EDITOR_LAYER}
      position={pose.position}
      ref={groupRef}
      rotation={[0, pose.rotationY, 0]}
    >
      <mesh>
        <boxGeometry args={[panel.width, panel.height, panel.depth]} />
        <meshStandardMaterial color={color} opacity={0.55} transparent />
      </mesh>
      <mesh
        position={[-panel.width / 2 + 0.08, panel.height / 2, panel.depth / 2 + 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.1, 16]} />
        <meshStandardMaterial color="#15939d" />
      </mesh>
      <mesh
        position={[panel.width / 2 - 0.08, panel.height / 2, panel.depth / 2 + 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.1, 16]} />
        <meshStandardMaterial color="#ef6b50" />
      </mesh>
    </group>
  )
}
