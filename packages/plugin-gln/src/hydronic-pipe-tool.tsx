'use client'

import { emitter, type GridEvent, type NodePort, nodeRegistry, useScene } from '@pascal-app/core'
import {
  CursorSphere,
  EDITOR_LAYER,
  isGridSnapActive,
  markToolCancelConsumed,
  triggerSFX,
  useEditor,
  useInteractionScope,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, LineBasicMaterial, Vector3 } from 'three'
import { useGlnEquipmentStore } from './equipment-store'
import { glnHydronicPipeDefinition } from './hydronic-pipe-definition'
import {
  areGlnHydronicEndpointsCompatible,
  isGlnHydronicPortCompatible,
} from './hydronic-pipe-ports'
import { GlnHydronicPipeNode, type GlnPipeEndpoint } from './hydronic-pipe-schema'

type Point = [number, number, number]
type Candidate = { endpoint: GlnPipeEndpoint; port: NodePort }
const PORT_SNAP_RADIUS_M = 0.45

function nearbyPort(
  point: Point,
  systemId: string,
  circuit: 'supply' | 'return',
  first: Candidate | null,
): Candidate | null {
  let best: { candidate: Candidate; distance: number } | null = null
  for (const node of Object.values(useScene.getState().nodes)) {
    if (!node || (node as { systemId?: string }).systemId !== systemId) continue
    for (const port of nodeRegistry.get(node.type)?.ports?.(node) ?? []) {
      if (!isGlnHydronicPortCompatible(circuit, port)) continue
      if (first && !areGlnHydronicEndpointsCompatible(circuit, first.port, port)) continue
      const distance = Math.hypot(port.position[0] - point[0], port.position[2] - point[2])
      if (distance > PORT_SNAP_RADIUS_M || (best && distance >= best.distance)) continue
      best = { candidate: { endpoint: { nodeId: node.id, portId: port.id }, port }, distance }
    }
  }
  return best?.candidate ?? null
}

export default function GlnHydronicPipeTool() {
  const activeLevelId = useViewer((state) => state.selection.levelId)
  const [points, setPoints] = useState<Point[]>([])
  const [endpoints, setEndpoints] = useState<Array<Candidate | null>>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const pointsRef = useRef(points)
  const endpointsRef = useRef(endpoints)
  pointsRef.current = points
  endpointsRef.current = endpoints

  useEffect(() => {
    if (!activeLevelId) return
    useInteractionScope.getState().begin({ kind: 'drafting', tool: 'gln:hydronic-pipe' })
    const resolve = (event: GridEvent) => {
      const store = useGlnEquipmentStore.getState()
      if (!store.systemId || !store.hydronicCircuit) return null
      const grid = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const raw: Point = [event.localPosition[0], 2.5, event.localPosition[2]]
      const snapped: Point =
        grid > 0
          ? [Math.round(raw[0] / grid) * grid, raw[1], Math.round(raw[2] / grid) * grid]
          : raw
      const first = endpointsRef.current[0] ?? null
      const candidate = event.nativeEvent?.altKey
        ? null
        : nearbyPort(snapped, store.systemId, store.hydronicCircuit, first)
      return { point: candidate ? ([...candidate.port.position] as Point) : snapped, candidate }
    }

    const onMove = (event: GridEvent) => {
      const next = resolve(event)
      if (next) setCursor(next.point)
    }
    const onClick = (event: GridEvent) => {
      const next = resolve(event)
      if (!next) return
      setPoints((current) => [...current, next.point])
      setEndpoints((current) => [...current, next.candidate])
      triggerSFX('sfx:grid-snap')
    }
    const finish = () => {
      const draft = pointsRef.current
      const refs = endpointsRef.current
      const store = useGlnEquipmentStore.getState()
      const start = refs[0]
      const end = refs.at(-1)
      if (!store.systemId || !store.hydronicCircuit || draft.length < 2 || !start || !end) return
      if (!areGlnHydronicEndpointsCompatible(store.hydronicCircuit, start.port, end.port)) return
      const pipe = GlnHydronicPipeNode.parse({
        ...glnHydronicPipeDefinition.defaults(),
        systemId: store.systemId,
        circuit: store.hydronicCircuit,
        path: draft,
        start: start.endpoint,
        end: end.endpoint,
      })
      useScene.getState().createNode(pipe as never, activeLevelId)
      setPoints([])
      setEndpoints([])
      setCursor(null)
      triggerSFX('sfx:item-place')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.matches('input, textarea, select')) return
      if (event.key === 'Enter') {
        event.preventDefault()
        finish()
      }
      if (event.key === 'Escape') {
        markToolCancelConsumed()
        setPoints([])
        setEndpoints([])
        setCursor(null)
      }
    }
    const onCancel = () => {
      if (pointsRef.current.length > 0) markToolCancelConsumed()
      setPoints([])
      setEndpoints([])
      setCursor(null)
    }
    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('tool:cancel', onCancel)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('tool:cancel', onCancel)
      window.removeEventListener('keydown', onKeyDown)
      useInteractionScope
        .getState()
        .endIf((scope) => scope.kind === 'drafting' && scope.tool === 'gln:hydronic-pipe')
    }
  }, [activeLevelId])

  const circuit = useGlnEquipmentStore((state) => state.hydronicCircuit)
  const previewPoints = useMemo(() => (cursor ? [...points, cursor] : points), [cursor, points])
  return (
    <>
      {previewPoints.length >= 2 && (
        <HydronicPathPreview circuit={circuit} points={previewPoints} />
      )}
      {cursor && (
        <CursorSphere color={circuit === 'supply' ? '#e66a4e' : '#2c9dc0'} position={cursor} />
      )}
    </>
  )
}

function HydronicPathPreview({
  circuit,
  points,
}: {
  circuit: 'supply' | 'return'
  points: Point[]
}) {
  const geometry = useMemo(
    () => new BufferGeometry().setFromPoints(points.map((point) => new Vector3(...point))),
    [points],
  )
  const material = useMemo(
    () =>
      new LineBasicMaterial({
        color: circuit === 'supply' ? '#e66a4e' : '#2c9dc0',
        depthTest: false,
        opacity: 0.7,
        transparent: true,
      }),
    [circuit],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  // @ts-expect-error - `<line>` is a valid R3F intrinsic but conflicts with SVG line typing.
  return <line geometry={geometry} layers={EDITOR_LAYER} material={material} renderOrder={1} />
}
