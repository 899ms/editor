import { readFile } from 'node:fs/promises'
import { type APIRequestContext, expect, type Locator, test } from '@playwright/test'
import { createGlnConfigurationTestGraph } from '../lib/codex-tasks/gln-configuration-test-fixtures'

const glnBaseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'

type ScenePayload = {
  graph: unknown
  version: number
}

async function readScene(request: APIRequestContext, sceneId: string) {
  const response = await request.get(`${glnBaseUrl}/api/scenes/${sceneId}`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as ScenePayload
}

async function clickVisible(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEnabled()
  await locator.click({ force: true })
}

async function waitForFloorplanViewportToSettle(floorplan: Locator) {
  let previousViewBox: string | null = null
  let stableSamples = 0

  await expect
    .poll(
      async () => {
        const nextViewBox = await floorplan.getAttribute('viewBox')
        stableSamples = nextViewBox === previousViewBox ? stableSamples + 1 : 0
        previousViewBox = nextViewBox
        return stableSamples
      },
      { intervals: [200], timeout: 5_000 },
    )
    .toBeGreaterThanOrEqual(3)
}

async function readFloorplanViewport(floorplan: Locator) {
  return floorplan.evaluate((svg) => {
    const scene = svg.querySelector('[data-floorplan-scene]')
    const surface = svg.getBoundingClientRect()
    const entries = Array.from(svg.querySelectorAll<SVGGElement>('.floorplan-registry-entry'))
      .map((entry) => entry.getBoundingClientRect())
      .filter((bounds) => bounds.width > 0 && bounds.height > 0)
    const content = entries.reduce(
      (bounds, entry) => ({
        bottom: Math.max(bounds.bottom, entry.bottom),
        left: Math.min(bounds.left, entry.left),
        right: Math.max(bounds.right, entry.right),
        top: Math.min(bounds.top, entry.top),
      }),
      {
        bottom: Number.NEGATIVE_INFINITY,
        left: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
      },
    )
    const isCropped =
      content.left < surface.left - 1 ||
      content.right > surface.right + 1 ||
      content.top < surface.top - 1 ||
      content.bottom > surface.bottom + 1
    return {
      isCropped,
      transform: scene?.getAttribute('transform') ?? '',
    }
  })
}

test('fits the complete north-up floor plan and exports GLN SVG/PDF without saving', async ({
  page,
  request,
}) => {
  const fixture = createGlnConfigurationTestGraph('floorplan_export')
  const graph = {
    ...fixture.graph,
    installedPlugins: ['pascal:gln'],
  }
  const createResponse = await request.post(`${glnBaseUrl}/api/scenes`, {
    data: { name: '完整平面图导出回归', graph },
  })
  expect(createResponse.status()).toBe(201)
  const created = (await createResponse.json()) as { id: string }

  await page.goto(`${glnBaseUrl}/scene/${created.id}`)
  await expect(page.locator('html')).toHaveAttribute('data-pascal-hydrated', 'true')
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.locator('[data-pascal-scene-loader]')).toHaveCount(0)

  const twoDimensionalView = page.getByRole('button', { name: '2D', exact: true })
  await clickVisible(twoDimensionalView)
  await expect(twoDimensionalView).toHaveAttribute('aria-pressed', 'true')
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()

  await waitForFloorplanViewportToSettle(floorplan)
  // Headless runners can suspend animation frames after the viewer readiness fallback.
  // Keep the export regression deterministic by exercising the bounded timer path.
  await page.evaluate(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame
    const nativeCancelAnimationFrame = window.cancelAnimationFrame
    Object.defineProperty(window, '__glnRestoreAnimationFrames', {
      configurable: true,
      value: () => {
        window.requestAnimationFrame = nativeRequestAnimationFrame
        window.cancelAnimationFrame = nativeCancelAnimationFrame
        delete (window as typeof window & { __glnRestoreAnimationFrames?: () => void })
          .__glnRestoreAnimationFrames
      },
    })
    window.requestAnimationFrame = () => 1
    window.cancelAnimationFrame = () => {}
    Object.defineProperty(window, 'createImageBitmap', {
      configurable: true,
      value: () => new Promise<ImageBitmap>(() => {}),
    })
  })
  await page.waitForTimeout(1_500)
  const baseline = await readScene(request, created.id)
  let saveRequestCount = 0
  page.on('request', (browserRequest) => {
    if (
      browserRequest.method() === 'PUT' &&
      browserRequest.url() === `${glnBaseUrl}/api/scenes/${created.id}`
    ) {
      saveRequestCount += 1
    }
  })

  await clickVisible(page.getByRole('button', { name: '设置', exact: true }))
  const fitButton = page.getByRole('button', {
    name: '完整平面图 · 视图对齐正北',
    exact: true,
  })
  await clickVisible(fitButton)

  await expect
    .poll(() => readFloorplanViewport(floorplan))
    .toEqual({ isCropped: false, transform: '' })

  const svgDownloadPromise = page.waitForEvent('download')
  await clickVisible(page.getByRole('button', { name: '完整平面图（SVG）', exact: true }))
  const svgDownload = await svgDownloadPromise
  expect(await svgDownload.failure()).toBeNull()
  expect(svgDownload.suggestedFilename()).toMatch(/^floorplan_full_\d{4}-\d{2}-\d{2}\.svg$/)
  const svgPath = await svgDownload.path()
  if (!svgPath) throw new Error('SVG download did not produce a local file')
  const svgText = await readFile(svgPath, 'utf8')
  expect(svgText).toContain('<svg')
  expect(svgText).toContain('客厅')
  expect(svgText).toContain('#d95f45')
  expect(svgText).toContain('#238aa5')

  // The bounded-frame fallback was exercised by fit/SVG. Restore real frames
  // before Canvg is first imported because its third-party raf shim snapshots
  // the global function at module initialization; decoder faults stay active.
  await page.evaluate(() => {
    const testWindow = window as typeof window & { __glnRestoreAnimationFrames?: () => void }
    testWindow.__glnRestoreAnimationFrames?.()
  })

  await page.evaluate(() => {
    const stages: string[] = []
    const record = (stage: string) => stages.push(`${Math.round(performance.now())}:${stage}`)
    const testWindow = window as typeof window & { __glnPdfExportStages?: string[] }
    testWindow.__glnPdfExportStages = stages

    const nativeCreateElement = document.createElement.bind(document)
    Object.defineProperty(document, 'createElement', {
      configurable: true,
      value: (tagName: string, options?: ElementCreationOptions) => {
        const element = nativeCreateElement(tagName, options)
        if (tagName.toLowerCase() === 'canvas') record('canvas-created')
        return element
      },
    })

    const canvasPrototype = HTMLCanvasElement.prototype
    const nativeGetContext = canvasPrototype.getContext
    Object.defineProperty(canvasPrototype, 'getContext', {
      configurable: true,
      value: function (...args: unknown[]) {
        record(`canvas-context:${String(args[0])}`)
        return Reflect.apply(nativeGetContext, this, args)
      },
    })
    const nativeToDataUrl = canvasPrototype.toDataURL
    Object.defineProperty(canvasPrototype, 'toDataURL', {
      configurable: true,
      value: function (...args: unknown[]) {
        record('canvas-data-url:begin')
        const value = Reflect.apply(nativeToDataUrl, this, args)
        record(`canvas-data-url:end:${value.length}`)
        return value
      },
    })

    const nativeCreateObjectUrl = URL.createObjectURL.bind(URL)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (object: Blob | MediaSource) => {
        record(`blob-url:${object instanceof Blob ? `${object.type}:${object.size}` : 'media'}`)
        return nativeCreateObjectUrl(object)
      },
    })
    const nativeAnchorClick = HTMLAnchorElement.prototype.click
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: function () {
        record(`anchor-click:${this.download}`)
        return Reflect.apply(nativeAnchorClick, this, [])
      },
    })
    window.addEventListener('error', (event) => record(`error:${event.message}`))
    window.addEventListener('unhandledrejection', (event) =>
      record(`rejection:${String(event.reason)}`),
    )
  })

  // The decoder fault injection still proves the PDF cannot depend on
  // createImageBitmap while retaining a bounded hang detector.
  const pdfDownloadPromise = page.waitForEvent('download', { timeout: 30_000 })
  await clickVisible(page.getByRole('button', { name: '完整平面图（PDF）', exact: true }))
  const pdfDownload = await pdfDownloadPromise.catch(async (error: unknown) => {
    const stages = await page.evaluate(
      () =>
        (window as typeof window & { __glnPdfExportStages?: string[] }).__glnPdfExportStages ?? [],
    )
    throw new Error(`PDF export stages: ${JSON.stringify(stages)}`, { cause: error })
  })
  expect(await pdfDownload.failure()).toBeNull()
  expect(pdfDownload.suggestedFilename()).toMatch(/^floorplan_full_\d{4}-\d{2}-\d{2}\.pdf$/)
  const pdfPath = await pdfDownload.path()
  if (!pdfPath) throw new Error('PDF download did not produce a local file')
  const pdfBytes = await readFile(pdfPath)
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdfBytes.byteLength).toBeGreaterThan(10_000)

  await page.waitForTimeout(1_000)
  const afterExport = await readScene(request, created.id)
  expect(saveRequestCount).toBe(0)
  expect(afterExport.version).toBe(baseline.version)
  expect(afterExport.graph).toEqual(baseline.graph)
})
