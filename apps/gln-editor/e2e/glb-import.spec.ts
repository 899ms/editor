import path from 'node:path'
import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test'
import { writeSemanticResidenceGlb } from './acceptance-fixtures'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'
const fixture = path.resolve(
  import.meta.dirname,
  '../../editor/public/items/air-conditioning/model.glb',
)

type StoredScene = {
  graph: {
    installedPlugins?: string[]
    nodes: Record<string, Record<string, unknown>>
    rootNodeIds: string[]
  }
  version: number
}

async function fetchScene(request: APIRequestContext, sceneId: string) {
  const response = await request.get(`${baseUrl}/api/scenes/${sceneId}`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as StoredScene
}

async function clickVisible(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEnabled()
  await locator.evaluate((element) => (element as HTMLElement).click())
}

async function captureCanvas(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (!box || !viewport) throw new Error('GLB reference canvas has no measurable bounds')

  const screenshot = await page.screenshot()
  const croppedDataUrl = await page.evaluate(
    async ({ box, screenshotBase64, viewport }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${screenshotBase64}`
      await image.decode()

      const scaleX = image.naturalWidth / viewport.width
      const scaleY = image.naturalHeight / viewport.height
      const left = Math.max(0, Math.floor(box.x * scaleX))
      const top = Math.max(0, Math.floor(box.y * scaleY))
      const right = Math.min(image.naturalWidth, Math.ceil((box.x + box.width) * scaleX))
      const bottom = Math.min(image.naturalHeight, Math.ceil((box.y + box.height) * scaleY))
      const crop = document.createElement('canvas')
      crop.width = right - left
      crop.height = bottom - top
      const context = crop.getContext('2d')
      if (!context || crop.width <= 0 || crop.height <= 0) {
        throw new Error('GLB reference canvas is outside the screenshot viewport')
      }
      context.drawImage(image, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
      return crop.toDataURL('image/png')
    },
    { box, screenshotBase64: screenshot.toString('base64'), viewport },
  )
  return Buffer.from(croppedDataUrl.split(',')[1] ?? '', 'base64')
}

test('analyzes a local GLB without upload and persists only a reconstruction report', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(420_000)
  await page.goto(`${baseUrl}/scenes`)
  await expect(page.locator('html')).toHaveAttribute('data-pascal-hydrated', 'true')

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${baseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().dispatchEvent('click')
  expect((await createResponsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/, { timeout: 30_000 })
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)
  expect(sceneId).toBeTruthy()
  if (!sceneId) return

  await clickVisible(page.getByRole('button', { name: '住宅导入' }))
  await clickVisible(page.getByRole('button', { name: 'GLB' }))
  await expect(page.locator('[data-gln-glb-import-panel]')).toBeVisible()
  await page.locator('input[accept*=".glb"]').setInputFiles(fixture)

  const report = page.locator('[data-gln-glb-report-status]')
  await expect(report).toHaveAttribute('data-gln-glb-report-status', 'report-only', {
    timeout: 60_000,
  })
  const preview = page.locator('[data-gln-glb-low-res-view]')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('src', /^data:image\/svg\+xml,/)
  await clickVisible(page.getByRole('button', { name: '保存检测报告' }))

  let importId = ''
  await expect
    .poll(async () => {
      const scene = await fetchScene(request, sceneId)
      const entry = Object.values(scene.graph.nodes).find((node) => node.type === 'gln:glb-import')
      importId = (entry?.id as string | undefined) ?? ''
      return Boolean(entry)
    })
    .toBe(true)

  const persisted = await fetchScene(request, sceneId)
  const persistedJson = JSON.stringify(persisted.graph)
  expect(persistedJson).not.toContain('data:image')
  expect(persistedJson).not.toContain('arrayBuffer')
  expect(persisted.graph.nodes[importId]).toMatchObject({
    referenceVisible: false,
    report: {
      source: {
        path: 'model.glb',
      },
      status: 'report-only',
    },
  })
  expect(
    (persisted.graph.nodes[importId]?.report as { source?: { sha256?: string } } | undefined)
      ?.source?.sha256 ?? '',
  ).toMatch(/^[a-f0-9]{64}$/)

  const savedCard = page.locator(`[data-gln-glb-saved-import="${importId}"]`)
  await expect(savedCard).toBeVisible()
  const canvas = page.locator('[data-pascal-viewer-3d] canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(500)
  const hiddenFrame = await captureCanvas(page, canvas)
  await clickVisible(savedCard.getByRole('button', { name: '显示参考' }))
  await expect(savedCard.getByRole('button', { name: '隐藏参考' })).toBeVisible()
  await page.waitForTimeout(500)
  const visibleFrame = await captureCanvas(page, canvas)
  await testInfo.attach('glb-reference-visible.png', {
    body: visibleFrame,
    contentType: 'image/png',
  })
  expect(hiddenFrame.equals(visibleFrame)).toBe(false)
  await clickVisible(savedCard.getByRole('button', { name: '隐藏参考' }))
  await expect
    .poll(
      async () =>
        (await fetchScene(request, sceneId)).graph.nodes[importId]?.referenceVisible as boolean,
    )
    .toBe(false)

  await page.goto(page.url(), { timeout: 120_000, waitUntil: 'commit' })
  await clickVisible(page.getByRole('button', { name: '住宅导入' }))
  await clickVisible(page.getByRole('button', { name: 'GLB' }))
  const reloadedCard = page.locator(`[data-gln-glb-saved-import="${importId}"]`)
  await expect(reloadedCard.getByText(/临时参考模型不在当前内存中/)).toBeVisible()
  await expect(reloadedCard.getByRole('button', { name: '显示参考' })).toBeDisabled()

  await page.locator('input[accept*=".glb"]').setInputFiles(fixture)
  await expect(page.locator('[data-gln-glb-report-status]')).toHaveAttribute(
    'data-gln-glb-report-status',
    'report-only',
  )
  await expect(reloadedCard.getByRole('button', { name: '显示参考' })).toBeEnabled()
  await clickVisible(reloadedCard.getByRole('button', { name: '删除临时参考' }))
  await expect(reloadedCard.getByText(/临时参考模型不在当前内存中/)).toBeVisible()

  const semanticFixture = testInfo.outputPath('semantic-residence.glb')
  writeSemanticResidenceGlb(semanticFixture)
  await page.locator('input[accept*=".glb"]').setInputFiles(semanticFixture)
  await expect(page.locator('[data-gln-glb-report-status]')).toHaveAttribute(
    'data-gln-glb-report-status',
    'draft-ready',
  )
  const confirmReplacement = page.getByRole('checkbox', {
    name: /确认以高置信可编辑草稿替换当前住宅/,
  })
  await clickVisible(confirmReplacement)
  await expect(confirmReplacement).toBeChecked()
  await clickVisible(page.getByRole('button', { name: '替换为可编辑住宅' }))

  let editableWallId = ''
  await expect
    .poll(async () => {
      const scene = await fetchScene(request, sceneId)
      const wall = Object.values(scene.graph.nodes).find((node) => node.type === 'wall')
      editableWallId = String(wall?.id ?? '')
      return {
        hasCeiling: Object.values(scene.graph.nodes).some((node) => node.type === 'ceiling'),
        hasZone: Object.values(scene.graph.nodes).some((node) => node.type === 'zone'),
        wallCount: Object.values(scene.graph.nodes).filter((node) => node.type === 'wall').length,
      }
    })
    .toEqual({ hasCeiling: true, hasZone: true, wallCount: 4 })

  const beforeEdit = await fetchScene(request, sceneId)
  const edit = await request.post(`${baseUrl}/api/scenes/${sceneId}/plans`, {
    data: {
      action: 'commit',
      plan: {
        id: 'glb-editable-wall-acceptance',
        sceneId,
        baseVersion: beforeEdit.version,
        operations: [
          {
            op: 'update',
            id: editableWallId,
            data: { name: 'GLB 导入后可编辑墙体' },
          },
        ],
      },
    },
  })
  if (!edit.ok()) {
    throw new Error(`GLB editable-node update failed (${edit.status()}): ${await edit.text()}`)
  }
  await page.goto(page.url(), { timeout: 120_000, waitUntil: 'commit' })
  expect((await fetchScene(request, sceneId)).graph.nodes[editableWallId]).toMatchObject({
    name: 'GLB 导入后可编辑墙体',
    type: 'wall',
  })
})
