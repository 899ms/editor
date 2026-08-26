'use client'

import {
  type AnyNode,
  type AnyNodeId,
  type FloorplanGeometry,
  type LiveNodeOverrides,
  loadAssetUrl,
  nodeRegistry,
  resolveBuildingForLevel,
  useScene,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { FloorplanGeometryRenderer } from '../../components/editor-2d/renderers/floorplan-geometry-renderer'
import { resolveFloorplanLabelAngle } from '../../components/editor-2d/renderers/floorplan-label-angle'
import {
  buildContext,
  floorplanLayerRank,
  getFloorplanLevelData,
  isFloorplanNodeVisible,
  splitFloorplanOverlay,
} from '../../components/editor-2d/renderers/floorplan-registry-layer'
import useEditor from '../../store/use-editor'
import { FLOORPLAN_VIEW_ROTATION_DEG, floorplanLocalToWorldPoint } from './geometry'

/**
 * Floorplan PDF export.
 *
 * Re-runs the same registry-driven geometry pipeline the live 2D layer uses
 * (`def.floorplan(node, ctx)` → `FloorplanGeometryRenderer`) headlessly, with
 * a neutral `viewState` so nodes render in their default, unselected form.
 * Every level of the active building becomes its own page, titled with the
 * level's label, with the plan fit to the page (independent of the live
 * pan/zoom). jsPDF is dynamically imported only when PDF export runs; the
 * standalone SVG path remains vector-based.
 *
 * `scope: 'structure'` keeps only `category === 'structure'` nodes (walls,
 * slabs, ceilings, doors, windows, stairs, columns, roofs…); `'full'` keeps
 * every node that has a floorplan builder and is visible.
 */
export type FloorplanExportScope = 'full' | 'structure'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Meters of margin around the plan bounds. */
const PADDING_M = 1
/** PDF page margin, in pt. */
const PAGE_MARGIN_PT = 36
/** Roughly 154 DPI across an A4 landscape page. The PDF embeds a high-quality
 * JPEG page while the companion SVG remains the lossless vector deliverable. */
const PDF_RASTER_WIDTH_PX = 1800
const PDF_JPEG_QUALITY = 0.96
/** Extra plan-space height reserved for the level title. */
const TITLE_BAND_M = 0.7
/** Matches the live floor-plan viewport's minimum size and content margin. */
const LIVE_FALLBACK_VIEW_SIZE_M = 12
const LIVE_PADDING_M = 2
const FRAME_WAIT_FALLBACK_MS = 500
const PDF_IMAGE_LOAD_TIMEOUT_MS = 5_000

// Neutral view state — no selection / hover / palette, so builders emit their
// default appearance (the core palette only carries selection/handle colors).
const NEUTRAL_VIEW_STATE = {
  selected: false,
  highlighted: false,
  hovered: false,
  moving: false,
  palette: undefined,
} as const

type ExportLevel = { id: AnyNodeId; label: string }

export async function exportFloorplanPdf(scope: FloorplanExportScope): Promise<void> {
  const nodes = useScene.getState().nodes
  const unit = useViewer.getState().unit
  const levels = resolveExportLevels(nodes)
  if (levels.length === 0) {
    console.warn('[floorplan-export] no level to export')
    return
  }

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;'
  document.body.appendChild(host)

  let pageCount = 0
  try {
    for (const level of levels) {
      // Rotate the exported plan to the same north-up orientation the on-screen
      // 2D view uses when aligned to north (user rotation offset = 0), so a PDF
      // points north instead of drawing raw plan-local axes.
      const buildingId = resolveBuildingForLevel(level.id, nodes as Record<AnyNodeId, AnyNode>)
      const building = buildingId ? nodes[buildingId] : undefined
      const buildingRotationY = building?.type === 'building' ? (building.rotation[1] ?? 0) : 0
      const rotationDeg = FLOORPLAN_VIEW_ROTATION_DEG - (buildingRotationY * 180) / Math.PI
      const geometries = collectFloorplanGeometry(nodes, level.id, scope, unit, rotationDeg)
      if (geometries.length === 0) continue

      const mounted = await mountFloorplanSvg(host, geometries, rotationDeg, level.label)
      if (!mounted) continue

      try {
        if (pageCount > 0) doc.addPage()
        pageCount++

        // Fit the complete, browser-rasterized plan into the page. Rasterizing
        // at high resolution preserves Chinese/system-font labels that jsPDF's
        // built-in font and svg2pdf cannot encode reliably. The SVG download
        // remains the lossless vector deliverable.
        const boxX = PAGE_MARGIN_PT
        const boxY = PAGE_MARGIN_PT
        const boxW = pageW - PAGE_MARGIN_PT * 2
        const boxH = pageH - PAGE_MARGIN_PT * 2
        const aspect = mounted.width / mounted.height
        let w = boxW
        let h = w / aspect
        if (h > boxH) {
          h = boxH
          w = h * aspect
        }
        const x = boxX + (boxW - w) / 2
        const y = boxY + (boxH - h) / 2

        const imageData = await rasterizeFloorplanGeometry(
          geometries,
          rotationDeg,
          level.label,
          mounted.contentBBox,
          mounted.width,
          mounted.height,
        )
        // Embedding the browser-encoded JPEG bytes avoids jsPDF decoding a
        // base64 PNG and recompressing millions of pixels on the main thread.
        // That path could exceed the export timeout after a long 3D session.
        doc.addImage(imageData, 'JPEG', x, y, w, h, undefined, 'NONE')
      } finally {
        mounted.cleanup()
      }
    }

    if (pageCount === 0) {
      console.warn(`[floorplan-export] nothing to export for scope "${scope}"`)
      return
    }

    const date = new Date().toISOString().split('T')[0]
    downloadBlob(doc.output('blob'), `floorplan_${scope}_${date}.pdf`)
  } finally {
    host.remove()
  }
}

/**
 * Export the same north-up, bounds-fitted floorplan geometry as standalone SVG.
 * Unlike the live editor viewport, the file is independent of pan and zoom.
 */
export async function exportFloorplanSvg(scope: FloorplanExportScope): Promise<void> {
  const nodes = useScene.getState().nodes
  const unit = useViewer.getState().unit
  const levels = resolveExportLevels(nodes)
  if (levels.length === 0) {
    console.warn('[floorplan-export] no level to export')
    return
  }

  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;'
  document.body.appendChild(host)

  try {
    for (const level of levels) {
      const buildingId = resolveBuildingForLevel(level.id, nodes as Record<AnyNodeId, AnyNode>)
      const building = buildingId ? nodes[buildingId] : undefined
      const buildingRotationY = building?.type === 'building' ? (building.rotation[1] ?? 0) : 0
      const rotationDeg = FLOORPLAN_VIEW_ROTATION_DEG - (buildingRotationY * 180) / Math.PI
      const geometries = collectFloorplanGeometry(nodes, level.id, scope, unit, rotationDeg)
      if (geometries.length === 0) continue

      const mounted = await mountFloorplanSvg(host, geometries, rotationDeg, level.label)
      if (!mounted) continue

      try {
        const svg = mounted.svg.cloneNode(true) as SVGSVGElement
        const exportWidthPx = 1600
        svg.setAttribute('width', `${exportWidthPx}`)
        svg.setAttribute(
          'height',
          `${Math.round((exportWidthPx * mounted.height) / mounted.width)}`,
        )
        const serialized = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
        const levelSuffix = levels.length > 1 ? `_${sanitizeFilePart(level.label)}` : ''
        const date = new Date().toISOString().split('T')[0]
        downloadBlob(
          new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }),
          `floorplan_${scope}${levelSuffix}_${date}.svg`,
        )
      } finally {
        mounted.cleanup()
      }
    }
  } finally {
    host.remove()
  }
}

/**
 * Open the live 2D floor plan when needed, align it north-up, and fit every
 * painted node into the available viewport. The geometry is measured through
 * the same registry-driven renderer used by SVG/PDF export, so the result does
 * not depend on the previous pan/zoom pose or on grid bounds.
 */
export async function fitFloorplanViewToContent(): Promise<boolean> {
  const editor = useEditor.getState()
  if (editor.viewMode === '3d') {
    editor.setViewMode('2d')
  }

  // Let the live 2D surface mount before measuring its actual aspect ratio.
  await nextFrames(2)

  const nodes = useScene.getState().nodes
  const selectedLevelId = useViewer.getState().selection.levelId as AnyNodeId | null
  const levelId = selectedLevelId && nodes[selectedLevelId] ? selectedLevelId : firstLevelId(nodes)
  if (!levelId) return false

  const buildingId = resolveBuildingForLevel(levelId, nodes as Record<AnyNodeId, AnyNode>)
  const building = buildingId ? nodes[buildingId] : undefined
  const buildingPosition: [number, number, number] =
    building?.type === 'building' ? [...building.position] : [0, 0, 0]
  const buildingRotationY = building?.type === 'building' ? (building.rotation[1] ?? 0) : 0
  const rotationDeg = FLOORPLAN_VIEW_ROTATION_DEG - (buildingRotationY * 180) / Math.PI
  const geometries = collectFloorplanGeometry(
    nodes,
    levelId,
    'full',
    useViewer.getState().unit,
    rotationDeg,
  )
  if (geometries.length === 0) return false

  const surface = document
    .querySelector<SVGGElement>('[data-floorplan-scene]')
    ?.closest<SVGSVGElement>('svg')
  const surfaceRect = surface?.getBoundingClientRect()
  if (!surfaceRect || !(surfaceRect.width > 0 && surfaceRect.height > 0)) return false

  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;'
  document.body.appendChild(host)

  try {
    const mounted = await mountFloorplanSvg(host, geometries, rotationDeg, '')
    if (!mounted) return false

    try {
      const { contentBBox } = mounted
      const aspect = surfaceRect.width / surfaceRect.height
      const viewWidth = Math.max(
        LIVE_FALLBACK_VIEW_SIZE_M,
        contentBBox.width + LIVE_PADDING_M * 2,
        (contentBBox.height + LIVE_PADDING_M * 2) * aspect,
      )
      const rotatedCenter = {
        x: contentBBox.x + contentBBox.width / 2,
        y: contentBBox.y + contentBBox.height / 2,
      }
      const localCenter = rotatePoint(rotatedCenter, -rotationDeg)
      const worldCenter = floorplanLocalToWorldPoint(
        localCenter,
        buildingPosition,
        buildingRotationY,
      )
      const targetY = useEditor.getState().navigationSyncPose?.target[1] ?? buildingPosition[1]

      // Mark this as an external camera pose so the live 2D panel consumes it.
      // Publishing a 2D source would intentionally be ignored by that same
      // panel to prevent feedback loops with the 3D camera.
      useEditor.getState().publishNavigationSyncPose({
        source: '3d',
        target: [worldCenter.x, targetY, worldCenter.z],
        azimuth: (FLOORPLAN_VIEW_ROTATION_DEG * Math.PI) / 180,
        viewWidth,
      })
      return true
    } finally {
      mounted.cleanup()
    }
  } finally {
    host.remove()
  }
}

type MountedFloorplan = {
  svg: SVGSVGElement
  contentBBox: { x: number; y: number; width: number; height: number }
  /** Padded viewBox dimensions, in meters — used for aspect-preserving fit. */
  width: number
  height: number
  cleanup: () => void
}

async function mountFloorplanSvg(
  parent: HTMLElement,
  geometries: { id: AnyNodeId; base: FloorplanGeometry }[],
  rotationDeg: number,
  title: string,
): Promise<MountedFloorplan | null> {
  const container = document.createElement('div')
  parent.appendChild(container)
  const root = createRoot(container)
  const cleanup = () => {
    root.unmount()
    container.remove()
  }

  // Render a full `<svg>` as the React root child so React enters the SVG
  // namespace at the `<svg>` tag, then mutate the DOM node afterwards —
  // viewBox/background depend on the post-mount measured bounds.
  flushSync(() => {
    root.render(
      createElement(
        'svg',
        { xmlns: SVG_NS },
        createElement(
          'g',
          { 'data-floorplan-content': '' },
          createElement(
            'g',
            { transform: `rotate(${rotationDeg})` },
            geometries.map(({ id, base }) =>
              createElement(FloorplanGeometryRenderer, { key: id, geometry: base }),
            ),
          ),
        ),
      ),
    )
  })

  // Give async asset images (item icons) a couple of frames to resolve so
  // they're included in the measured bounds and the rendered output.
  await nextFrames(2)

  const svg = container.querySelector('svg')
  const content = svg?.querySelector('[data-floorplan-content]') as SVGGraphicsElement | null
  const bbox = content?.getBBox()
  if (!svg || !bbox || bbox.width === 0 || bbox.height === 0) {
    cleanup()
    return null
  }

  const minX = bbox.x - PADDING_M
  const minY = bbox.y - PADDING_M - TITLE_BAND_M
  const width = bbox.width + PADDING_M * 2
  const height = bbox.height + PADDING_M * 2 + TITLE_BAND_M
  svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`)
  svg.setAttribute('width', `${width}`)
  svg.setAttribute('height', `${height}`)

  const background = document.createElementNS(SVG_NS, 'rect')
  background.setAttribute('x', `${minX}`)
  background.setAttribute('y', `${minY}`)
  background.setAttribute('width', `${width}`)
  background.setAttribute('height', `${height}`)
  background.setAttribute('fill', '#ffffff')
  svg.insertBefore(background, svg.firstChild)

  const titleElement = document.createElementNS(SVG_NS, 'text')
  titleElement.setAttribute('x', `${minX + 0.2}`)
  titleElement.setAttribute('y', `${minY + 0.42}`)
  titleElement.setAttribute('fill', '#111827')
  titleElement.setAttribute('font-family', '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif')
  titleElement.setAttribute('font-size', '0.28')
  titleElement.setAttribute('font-weight', '600')
  titleElement.textContent = title
  svg.appendChild(titleElement)

  return {
    svg,
    contentBBox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
    width,
    height,
    cleanup,
  }
}

function rotatePoint(point: { x: number; y: number }, rotationDeg: number) {
  if (rotationDeg === 0) return point
  const radians = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

async function rasterizeFloorplanGeometry(
  geometries: { id: AnyNodeId; base: FloorplanGeometry }[],
  rotationDeg: number,
  title: string,
  contentBBox: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): Promise<Uint8Array> {
  const exportWidthPx = PDF_RASTER_WIDTH_PX
  const exportHeightPx = Math.max(1, Math.round((exportWidthPx * height) / width))
  const canvas = document.createElement('canvas')
  canvas.width = exportWidthPx
  canvas.height = exportHeightPx
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const pixelsPerMeter = exportWidthPx / width
  const minX = contentBBox.x - PADDING_M
  const minY = contentBBox.y - PADDING_M - TITLE_BAND_M
  const images = await preloadFloorplanImages(geometries.map(({ base }) => base))

  context.save()
  context.scale(pixelsPerMeter, pixelsPerMeter)
  context.translate(-minX, -minY)
  context.save()
  context.rotate((rotationDeg * Math.PI) / 180)
  for (const { base } of geometries) {
    drawFloorplanGeometry(context, base, pixelsPerMeter, images)
  }
  context.restore()

  context.fillStyle = '#111827'
  context.font = '600 0.28px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
  context.textAlign = 'start'
  context.textBaseline = 'alphabetic'
  context.fillText(title, minX + 0.2, minY + 0.42)
  context.restore()

  return canvasToJpegBytes(canvas)
}

type FloorplanImageMap = Map<string, HTMLImageElement | null>

async function preloadFloorplanImages(geometries: FloorplanGeometry[]): Promise<FloorplanImageMap> {
  const urls = new Set<string>()
  const visit = (geometry: FloorplanGeometry) => {
    if (geometry.kind === 'image') urls.add(geometry.url)
    if (geometry.kind === 'group') geometry.children.forEach(visit)
  }
  geometries.forEach(visit)

  const entries = await Promise.all(
    Array.from(urls, async (url) => {
      try {
        const resolvedUrl = await loadAssetUrl(url)
        if (!resolvedUrl) return [url, null] as const
        return [url, await loadFloorplanImage(resolvedUrl)] as const
      } catch {
        return [url, null] as const
      }
    }),
  )
  return new Map(entries)
}

function loadFloorplanImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      resolve(result)
    }
    const timeoutId = window.setTimeout(() => finish(null), PDF_IMAGE_LOAD_TIMEOUT_MS)
    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}

function drawFloorplanGeometry(
  context: CanvasRenderingContext2D,
  geometry: FloorplanGeometry,
  pixelsPerMeter: number,
  images: FloorplanImageMap,
) {
  if (geometry.kind === 'group') {
    context.save()
    if (geometry.transform?.translate) {
      context.translate(geometry.transform.translate[0], geometry.transform.translate[1])
    }
    if (geometry.transform?.rotate !== undefined) context.rotate(geometry.transform.rotate)
    for (const child of geometry.children) {
      drawFloorplanGeometry(context, child, pixelsPerMeter, images)
    }
    context.restore()
    return
  }

  if (geometry.kind === 'text') {
    drawFloorplanText(context, geometry)
    return
  }

  if (geometry.kind === 'image') {
    drawFloorplanImage(context, geometry, images.get(geometry.url) ?? null)
    return
  }

  let path: Path2D | null = null
  switch (geometry.kind) {
    case 'path':
      path = new Path2D(geometry.d)
      break
    case 'polygon':
    case 'polyline': {
      path = new Path2D()
      const [first, ...rest] = geometry.points
      if (!first) return
      path.moveTo(first[0], first[1])
      for (const point of rest) path.lineTo(point[0], point[1])
      if (geometry.kind === 'polygon') path.closePath()
      break
    }
    case 'rect':
      path = new Path2D()
      if ((geometry.rx ?? geometry.ry ?? 0) > 0) {
        path.roundRect(
          geometry.x,
          geometry.y,
          geometry.width,
          geometry.height,
          geometry.rx ?? geometry.ry ?? 0,
        )
      } else {
        path.rect(geometry.x, geometry.y, geometry.width, geometry.height)
      }
      break
    case 'circle':
      path = new Path2D()
      path.arc(geometry.cx, geometry.cy, geometry.r, 0, Math.PI * 2)
      break
    case 'line':
      path = new Path2D()
      path.moveTo(geometry.x1, geometry.y1)
      path.lineTo(geometry.x2, geometry.y2)
      break
    default:
      return
  }

  drawFloorplanPath(context, path, geometry, pixelsPerMeter)
}

function drawFloorplanPath(
  context: CanvasRenderingContext2D,
  path: Path2D,
  style: {
    fill?: string
    fillOpacity?: number
    opacity?: number
    stroke?: string
    strokeDasharray?: string
    strokeLinecap?: 'butt' | 'round' | 'square'
    strokeLinejoin?: 'miter' | 'round' | 'bevel'
    strokeOpacity?: number
    strokeWidth?: number
    vectorEffect?: 'non-scaling-stroke'
  },
  pixelsPerMeter: number,
) {
  context.save()
  const baseOpacity = style.opacity ?? 1
  if (style.fill && style.fill !== 'none') {
    context.globalAlpha = baseOpacity * (style.fillOpacity ?? 1)
    context.fillStyle = style.fill
    context.fill(path)
  }
  if (style.stroke && style.stroke !== 'none') {
    const strokeScale = style.vectorEffect === 'non-scaling-stroke' ? pixelsPerMeter : 1
    context.globalAlpha = baseOpacity * (style.strokeOpacity ?? 1)
    context.strokeStyle = style.stroke
    context.lineWidth = (style.strokeWidth ?? 1) / strokeScale
    context.lineCap = style.strokeLinecap ?? 'butt'
    context.lineJoin = style.strokeLinejoin ?? 'miter'
    context.setLineDash(
      parseStrokeDasharray(style.strokeDasharray).map((value) => value / strokeScale),
    )
    context.stroke(path)
  }
  context.restore()
}

function parseStrokeDasharray(value?: string): number[] {
  if (!value) return []
  return value
    .split(/[\s,]+/)
    .map(Number)
    .filter((entry) => Number.isFinite(entry) && entry >= 0)
}

function drawFloorplanText(
  context: CanvasRenderingContext2D,
  geometry: Extract<FloorplanGeometry, { kind: 'text' }>,
) {
  context.save()
  context.globalAlpha = geometry.opacity ?? 1
  context.font = `${geometry.fontWeight ?? 400} ${geometry.fontSize}px ${geometry.fontFamily ?? 'sans-serif'}`
  context.textAlign = geometry.textAnchor === 'middle' ? 'center' : (geometry.textAnchor ?? 'start')
  context.textBaseline = resolveCanvasTextBaseline(geometry.dominantBaseline)
  context.fillStyle = geometry.fill ?? '#171717'
  if (geometry.stroke) {
    context.strokeStyle = geometry.stroke
    context.lineWidth = geometry.strokeWidth ?? 1
    context.lineCap = 'round'
    context.lineJoin = 'round'
    if (geometry.paintOrder === 'fill') {
      context.fillText(geometry.text, geometry.x, geometry.y)
      context.strokeText(geometry.text, geometry.x, geometry.y)
      context.restore()
      return
    }
    context.strokeText(geometry.text, geometry.x, geometry.y)
  }
  context.fillText(geometry.text, geometry.x, geometry.y)
  context.restore()
}

function resolveCanvasTextBaseline(
  baseline: Extract<FloorplanGeometry, { kind: 'text' }>['dominantBaseline'],
): CanvasTextBaseline {
  if (baseline === 'central') return 'middle'
  if (baseline === 'auto') return 'alphabetic'
  return baseline ?? 'middle'
}

function drawFloorplanImage(
  context: CanvasRenderingContext2D,
  geometry: Extract<FloorplanGeometry, { kind: 'image' }>,
  image: HTMLImageElement | null,
) {
  context.save()
  context.translate(geometry.center[0], geometry.center[1])
  context.rotate(geometry.rotation ?? 0)
  context.globalAlpha = geometry.opacity ?? 1
  const x = -geometry.width / 2
  const y = -geometry.height / 2
  if (!image) {
    context.fillStyle = '#f3f4f6'
    context.strokeStyle = '#9ca3af'
    context.lineWidth = 0.02
    context.fillRect(x, y, geometry.width, geometry.height)
    context.strokeRect(x, y, geometry.width, geometry.height)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + geometry.width, y + geometry.height)
    context.moveTo(x + geometry.width, y)
    context.lineTo(x, y + geometry.height)
    context.stroke()
    context.restore()
    return
  }

  if (geometry.preserveAspectRatio === 'none') {
    context.drawImage(image, x, y, geometry.width, geometry.height)
  } else {
    const scale =
      geometry.preserveAspectRatio?.includes('slice') === true
        ? Math.max(geometry.width / image.naturalWidth, geometry.height / image.naturalHeight)
        : Math.min(geometry.width / image.naturalWidth, geometry.height / image.naturalHeight)
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    context.beginPath()
    context.rect(x, y, geometry.width, geometry.height)
    context.clip()
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  }
  context.restore()
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('Failed to encode floorplan PDF image'))
      },
      'image/jpeg',
      PDF_JPEG_QUALITY,
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

function collectFloorplanGeometry(
  nodes: Record<string, AnyNode>,
  levelId: AnyNodeId,
  scope: FloorplanExportScope,
  unit: 'metric' | 'imperial',
  sceneRotationDeg: number,
): { id: AnyNodeId; base: FloorplanGeometry }[] {
  const noLiveOverrides = new Map<string, LiveNodeOverrides>()
  const levelNodeIdsByType = new Map<string, AnyNodeId[]>()
  const entries: { id: AnyNodeId; node: AnyNode }[] = []

  const visit = (id: AnyNodeId) => {
    const node = nodes[id]
    if (!node) return
    const def = nodeRegistry.get(node.type)
    if (def?.computeFloorplanLevelData) {
      const ids = levelNodeIdsByType.get(node.type)
      if (ids) ids.push(id)
      else levelNodeIdsByType.set(node.type, [id])
    }
    if (
      def?.floorplan &&
      isFloorplanNodeVisible(node) &&
      (scope === 'full' || def.category === 'structure')
    ) {
      entries.push({ id, node })
    }
    const childIds = (node as { children?: AnyNodeId[] }).children
    if (Array.isArray(childIds)) for (const cid of childIds) visit(cid)
  }
  visit(levelId)

  // Document order is paint order — sort the same way the live layer does so
  // zones sit under walls/slabs/furniture rather than on top of them.
  entries.sort((a, b) => floorplanLayerRank(a.node.type) - floorplanLayerRank(b.node.type))

  // One-shot per-type cache for `computeFloorplanLevelData`; value type is
  // module-private to the registry layer, so let it infer.
  const levelDataCache = new Map()
  const out: { id: AnyNodeId; base: FloorplanGeometry }[] = []
  for (const { id, node } of entries) {
    const builder = nodeRegistry.get(node.type)?.floorplan
    if (!builder) continue
    const levelData = getFloorplanLevelData(
      node.type,
      nodes,
      noLiveOverrides,
      levelNodeIdsByType,
      levelDataCache,
    )
    const ctx = buildContext(node, nodes, { ...NEUTRAL_VIEW_STATE, unit }, levelData)
    const geometry = builder(node, ctx)
    if (!geometry) continue
    const { base, overlay } = splitFloorplanOverlay(geometry)
    const staticOverlay = overlay ? buildStaticExportOverlay(overlay, sceneRotationDeg) : null
    const children = [base, staticOverlay].filter(
      (entry): entry is FloorplanGeometry => entry !== null,
    )
    if (children.length === 1) out.push({ id, base: children[0]! })
    else if (children.length > 1) out.push({ id, base: { kind: 'group', children } })
  }
  return out
}

function buildStaticExportOverlay(
  geometry: FloorplanGeometry,
  sceneRotationDeg: number,
): FloorplanGeometry | null {
  if (geometry.kind === 'group') {
    const children = geometry.children
      .map((child) => buildStaticExportOverlay(child, sceneRotationDeg))
      .filter((child): child is FloorplanGeometry => child !== null)
    if (children.length === 0) return null
    return { kind: 'group', children, transform: geometry.transform }
  }

  if (geometry.kind === 'text') {
    if (!geometry.upright) return geometry
    return {
      kind: 'group',
      transform: {
        translate: [geometry.x, geometry.y],
        rotate: (-sceneRotationDeg * Math.PI) / 180,
      },
      children: [{ ...geometry, x: 0, y: 0, upright: false }],
    }
  }

  if (geometry.kind === 'dimension-label') {
    const rotationDeg = resolveFloorplanLabelAngle(
      geometry.angle,
      sceneRotationDeg,
      geometry.screenUpright,
    )
    return {
      kind: 'group',
      transform: {
        translate: [geometry.cx, geometry.cy],
        rotate: (rotationDeg * Math.PI) / 180,
      },
      children: [
        {
          kind: 'text',
          x: 0,
          y: -(geometry.offsetPx ?? 0) * 0.01,
          text: geometry.text,
          fontSize: geometry.appearance === 'outlined' ? 0.12 : 0.1,
          fill: '#ffffff',
          stroke: '#4f46e5',
          strokeWidth: 0.04,
          paintOrder: 'stroke',
          fontFamily: '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
          fontWeight: 600,
          textAnchor: 'middle',
          dominantBaseline: 'central',
        },
      ],
    }
  }

  return null
}

/**
 * Levels to export, ordered bottom-to-top. The active building (the building
 * owning the selected level, or the first one found) contributes all of its
 * level children; if there is no building wrapper we fall back to the single
 * resolved level.
 */
function resolveExportLevels(nodes: Record<string, AnyNode>): ExportLevel[] {
  const selected = useViewer.getState().selection.levelId as AnyNodeId | null | undefined
  const activeLevelId = selected && nodes[selected] ? selected : firstLevelId(nodes)
  if (!activeLevelId) return []

  const buildingId = resolveBuildingForLevel(activeLevelId, nodes as Record<AnyNodeId, AnyNode>)
  let levelNodes: AnyNode[]
  if (buildingId) {
    const childIds = (nodes[buildingId] as { children?: AnyNodeId[] }).children ?? []
    levelNodes = childIds.map((id) => nodes[id]).filter((n): n is AnyNode => n?.type === 'level')
  } else {
    const node = nodes[activeLevelId]
    levelNodes = node ? [node] : []
  }

  levelNodes.sort((a, b) => levelIndexOf(a) - levelIndexOf(b))
  return levelNodes.map((n) => ({ id: n.id as AnyNodeId, label: levelLabelOf(n) }))
}

function firstLevelId(nodes: Record<string, AnyNode>): AnyNodeId | null {
  for (const node of Object.values(nodes)) {
    if (node.type === 'level') return node.id as AnyNodeId
  }
  return null
}

function levelIndexOf(node: AnyNode): number {
  return (node as { level?: number }).level ?? 0
}

function levelLabelOf(node: AnyNode): string {
  const name = node.name?.trim()
  if (name) return name
  return `Level ${levelIndexOf(node)}`
}

function sanitizeFilePart(value: string): string {
  const printable = Array.from(value, (character) =>
    character.charCodeAt(0) < 32 ? '-' : character,
  ).join('')
  const sanitized = printable
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '_')
  return sanitized || 'level'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.dataset.floorplanDownload = ''
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 30_000)
}

function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let finished = false
    let frameId = 0
    let timeoutId = 0
    const finish = () => {
      if (finished) return
      finished = true
      if (frameId) cancelAnimationFrame(frameId)
      if (timeoutId) clearTimeout(timeoutId)
      resolve()
    }
    const tick = (remaining: number) => {
      if (remaining <= 0) {
        finish()
        return
      }
      frameId = requestAnimationFrame(() => tick(remaining - 1))
    }
    timeoutId = window.setTimeout(finish, FRAME_WAIT_FALLBACK_MS)
    tick(count)
  })
}
