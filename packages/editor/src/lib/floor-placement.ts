import {
  type AnyNode,
  type EventSuffix,
  emitter,
  type GridEvent,
  movingFootprintAnchors,
  type NodeEvent,
  nodeRegistry,
  resolveAlignment,
  sceneRegistry,
  snapPointToGrid,
} from '@pascal-app/core'
import { Vector3 } from 'three'

export const FLOOR_PLACEMENT_ALIGNMENT_THRESHOLD_M = 0.08

export const FLOOR_PLACEMENT_CLICK_TRIGGER_KINDS = [
  'shelf',
  'item',
  'slab',
  'ceiling',
  'wall',
  'fence',
  'column',
  'roof',
  'roof-segment',
  'stair',
  'stair-segment',
] as const

export type FloorPlacementClickTriggerEvent = GridEvent | NodeEvent<AnyNode>

type FloorPlacementAlignmentArgs = {
  node: AnyNode
  rawX: number
  rawZ: number
  gridStep: number
  candidates: Parameters<typeof resolveAlignment>[0]['candidates']
  showAlignment?: boolean
  applyAlignmentSnap?: boolean
  bypassGrid?: boolean
  rotationY?: number
}

const worldVector = new Vector3()

export function getLevelLocalSnappedPosition(
  levelId: string,
  event: FloorPlacementClickTriggerEvent,
  gridStep: number,
  bypassGrid = false,
): [number, number, number] {
  const levelObject = sceneRegistry.nodes.get(levelId)
  if (!levelObject) {
    const rawPoint = 'node' in event ? event.position : event.localPosition
    const [sx, sz] = bypassGrid
      ? [rawPoint[0], rawPoint[2]]
      : snapPointToGrid([rawPoint[0], rawPoint[2]], gridStep)
    return [sx, 0, sz]
  }

  worldVector.set(event.position[0], event.position[1], event.position[2])
  levelObject.updateWorldMatrix(true, false)
  levelObject.worldToLocal(worldVector)
  const [sx, sz] = bypassGrid
    ? [worldVector.x, worldVector.z]
    : snapPointToGrid([worldVector.x, worldVector.z], gridStep)
  return [sx, 0, sz]
}

export function resolveAlignedFloorPlacement({
  node,
  rawX,
  rawZ,
  gridStep,
  candidates,
  showAlignment = true,
  applyAlignmentSnap = true,
  bypassGrid = false,
  rotationY = 0,
}: FloorPlacementAlignmentArgs) {
  const [sx, sz] = bypassGrid ? [rawX, rawZ] : snapPointToGrid([rawX, rawZ], gridStep)
  let ax = sx
  let az = sz

  const result =
    showAlignment && candidates.length > 0
      ? resolveAlignment({
          moving: movingFootprintAnchors(node, sx, sz, rotationY),
          candidates,
          threshold: FLOOR_PLACEMENT_ALIGNMENT_THRESHOLD_M,
        })
      : null

  if (result?.snap && applyAlignmentSnap) {
    ax += result.snap.dx
    az += result.snap.dz
  }

  return {
    position: [ax, 0, az] as [number, number, number],
    guides: result?.guides ?? [],
  }
}

function swallowFollowUpBrowserClick() {
  if (typeof window === 'undefined') return
  const swallow = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300)
}

export function stopPlacementCommitPropagation(event: FloorPlacementClickTriggerEvent) {
  const native = (event as { nativeEvent?: unknown }).nativeEvent
  const nativeStopPropagation = (native as { stopPropagation?: () => void } | undefined)
    ?.stopPropagation
  if (typeof nativeStopPropagation === 'function') nativeStopPropagation.call(native)
  const direct = (event as { stopPropagation?: () => void }).stopPropagation
  if (typeof direct === 'function') direct.call(event)
  if ('node' in event) swallowFollowUpBrowserClick()
}

export function subscribeFloorPlacementClicks(
  onClick: (event: FloorPlacementClickTriggerEvent) => void,
) {
  emitter.on('grid:click', onClick)
  const triggerKinds = new Set<string>(FLOOR_PLACEMENT_CLICK_TRIGGER_KINDS)
  for (const [kind] of nodeRegistry.entries()) triggerKinds.add(kind)
  type ClickKey = `${string}:${EventSuffix}`
  for (const kind of triggerKinds) {
    emitter.on(`${kind}:click` as ClickKey as never, onClick as never)
  }

  return () => {
    emitter.off('grid:click', onClick)
    for (const kind of triggerKinds) {
      emitter.off(`${kind}:click` as ClickKey as never, onClick as never)
    }
  }
}

export function subscribeFloorPlacementDoubleClicks(
  onDoubleClick: (event: FloorPlacementClickTriggerEvent) => void,
) {
  emitter.on('grid:double-click', onDoubleClick)
  const triggerKinds = new Set<string>(FLOOR_PLACEMENT_CLICK_TRIGGER_KINDS)
  for (const [kind] of nodeRegistry.entries()) triggerKinds.add(kind)
  type DoubleClickKey = `${string}:${EventSuffix}`
  for (const kind of triggerKinds) {
    emitter.on(`${kind}:double-click` as DoubleClickKey as never, onDoubleClick as never)
  }

  return () => {
    emitter.off('grid:double-click', onDoubleClick)
    for (const kind of triggerKinds) {
      emitter.off(`${kind}:double-click` as DoubleClickKey as never, onDoubleClick as never)
    }
  }
}
