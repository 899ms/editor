import path from 'node:path'
import { type APIRequestContext, expect, test } from '@playwright/test'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'
const fixture = path.resolve(
  import.meta.dirname,
  '../../ifc-converter/public/test-ifc-files/04-ifc-open-house.ifc',
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

test('rebuilds a local IFC as editable residential nodes without configuring GLN equipment', async ({
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
  await page.getByRole('button', { name: '新建场景' }).first().click()
  const createResponse = await createResponsePromise
  expect(createResponse.status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)
  expect(sceneId).toBeTruthy()
  if (!sceneId) return

  await page.getByRole('button', { name: '住宅导入' }).click()
  await expect(page.locator('[data-gln-ifc-import-panel]')).toBeVisible({ timeout: 30_000 })
  await page.locator('input[type="file"]').setInputFiles(fixture)
  const report = page.locator('[data-gln-ifc-report-status]')
  await expect(report).toHaveAttribute('data-gln-ifc-report-status', 'draft-ready', {
    timeout: 180_000,
  })
  await expect(report.getByText('04-ifc-open-house.ifc')).toBeVisible()
  await expect(page.getByRole('button', { name: '替换为可编辑住宅' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /确认以这份可编辑住宅草稿替换当前住宅/ }).check()
  await page.getByRole('button', { name: '替换为可编辑住宅' }).click()

  let importId = ''
  await expect
    .poll(
      async () => {
        const scene = await fetchScene(request, sceneId)
        const importEntry = Object.values(scene.graph.nodes).find(
          (node) => node.type === 'gln:ifc-import',
        )
        importId = (importEntry?.id as string | undefined) ?? ''
        const types = Object.values(scene.graph.nodes).map((node) => node.type)
        return {
          hasBuilding: types.includes('building'),
          hasCeiling: types.includes('ceiling'),
          hasImport: Boolean(importEntry),
          hasLevel: types.includes('level'),
          hasWall: types.includes('wall'),
          hasZone: types.includes('zone'),
          installed: scene.graph.installedPlugins?.includes('pascal:gln') ?? false,
        }
      },
      { timeout: 60_000 },
    )
    .toEqual({
      hasBuilding: true,
      hasCeiling: true,
      hasImport: true,
      hasLevel: true,
      hasWall: true,
      hasZone: true,
      installed: true,
    })

  const persisted = await fetchScene(request, sceneId)
  const persistedJson = JSON.stringify(persisted.graph)
  const nodeTypes = Object.values(persisted.graph.nodes).map((node) => node.type)
  expect(
    nodeTypes.some((type) =>
      [
        'gln:system',
        'gln:outdoor-unit',
        'gln:buffer-tank',
        'gln:wall-panel',
        'gln:hydronic-pipe',
      ].includes(type as string),
    ),
  ).toBe(false)
  expect(persistedJson).not.toContain('arrayBuffer')
  expect(persistedJson).not.toContain('Pset_')
  expect(persisted.graph.rootNodeIds).toContain(importId)
  const importRecord = persisted.graph.nodes[importId]
  expect(importRecord).toMatchObject({
    referenceVisible: false,
    report: {
      source: {
        path: '04-ifc-open-house.ifc',
        sizeBytes: 113264,
      },
      status: 'draft-ready',
    },
  })
  expect(
    (importRecord?.report as { source?: { sha256?: string } } | undefined)?.source?.sha256 ?? '',
  ).toMatch(/^[a-f0-9]{64}$/)

  const savedCard = page.locator(`[data-gln-ifc-saved-import="${importId}"]`)
  await expect(savedCard).toBeVisible()
  const canvas = page.locator('[data-pascal-viewer-3d] canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(500)
  const hiddenReferenceFrame = await canvas.screenshot()
  await savedCard.getByRole('button', { name: '显示参考' }).click()
  await expect(savedCard.getByRole('button', { name: '隐藏参考' })).toBeVisible()
  await expect
    .poll(
      async () =>
        (await fetchScene(request, sceneId)).graph.nodes[importId]?.referenceVisible as boolean,
    )
    .toBe(true)
  await page.waitForTimeout(500)
  const visibleReferenceFrame = await canvas.screenshot({
    path: testInfo.outputPath('ifc-reference-visible.png'),
  })
  expect(hiddenReferenceFrame.equals(visibleReferenceFrame)).toBe(false)
  await savedCard.getByRole('button', { name: '隐藏参考' }).click()
  await expect
    .poll(
      async () =>
        (await fetchScene(request, sceneId)).graph.nodes[importId]?.referenceVisible as boolean,
    )
    .toBe(false)

  await page.reload()
  await page.getByRole('button', { name: '住宅导入' }).click()
  const reloadedCard = page.locator(`[data-gln-ifc-saved-import="${importId}"]`)
  await expect(reloadedCard).toBeVisible({ timeout: 30_000 })
  await expect(reloadedCard.getByText(/临时参考层不在当前内存中/)).toBeVisible()
  await expect(reloadedCard.getByRole('button', { name: '显示参考' })).toBeDisabled()

  await page.locator('input[type="file"]').setInputFiles(fixture)
  await expect(page.locator('[data-gln-ifc-report-status]')).toHaveAttribute(
    'data-gln-ifc-report-status',
    'draft-ready',
    { timeout: 180_000 },
  )
  await expect(reloadedCard.getByRole('button', { name: '显示参考' })).toBeEnabled()
  await reloadedCard.getByRole('button', { name: '删除临时参考' }).click()
  await expect(reloadedCard.getByText(/临时参考层不在当前内存中/)).toBeVisible()

  const latest = await fetchScene(request, sceneId)
  const editableWall = Object.values(latest.graph.nodes).find((node) => node.type === 'wall')
  if (!editableWall?.id) throw new Error('IFC reconstruction produced no editable wall')
  const editableWallId = String(editableWall.id)
  const edit = await request.post(`${baseUrl}/api/scenes/${sceneId}/plans`, {
    data: {
      action: 'commit',
      plan: {
        id: 'ifc-editable-wall-acceptance',
        sceneId,
        baseVersion: latest.version,
        operations: [
          {
            op: 'update',
            id: editableWallId,
            data: { name: 'IFC 导入后可编辑墙体' },
          },
        ],
      },
    },
  })
  if (!edit.ok()) {
    throw new Error(`IFC editable-node update failed (${edit.status()}): ${await edit.text()}`)
  }
  expect((await fetchScene(request, sceneId)).graph.nodes[editableWallId]).toMatchObject({
    name: 'IFC 导入后可编辑墙体',
    type: 'wall',
  })
})
