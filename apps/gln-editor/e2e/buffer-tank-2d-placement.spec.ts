import { expect, test } from '@playwright/test'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'

test('places a buffer tank from the 2D floor plan', async ({ page, request }) => {
  test.setTimeout(240_000)
  await page.goto(`${baseUrl}/scenes`)
  await expect(page.locator('html')).toHaveAttribute('data-pascal-hydrated', 'true')
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${baseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().dispatchEvent('click')
  expect((await createResponsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/, { timeout: 15_000 })
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)
  expect(sceneId).toBeTruthy()

  const initialResponse = await request.get(`${baseUrl}/api/scenes/${sceneId}`)
  expect(initialResponse.ok()).toBe(true)
  const initialScene = (await initialResponse.json()) as {
    graph: {
      nodes: Record<
        string,
        {
          children?: string[]
          id: string
          type: string
        }
      >
    }
    version: number
  }
  const level = Object.values(initialScene.graph.nodes).find((node) => node.type === 'level')
  expect(level).toBeTruthy()
  if (!level) return
  const graph = structuredClone(initialScene.graph)
  const zoneId = 'zone_buffer_tank_equipment'
  graph.nodes[level.id]!.children = [...(graph.nodes[level.id]!.children ?? []), zoneId]
  graph.nodes[zoneId] = {
    id: zoneId,
    type: 'zone',
    parentId: level.id,
    name: '水箱设备区',
    visible: false,
    polygon: [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
    ],
    autoFromWalls: false,
    boundaryWallIds: [],
    color: '#3b82f6',
    metadata: {},
    object: 'node',
  } as never
  const seedResponse = await request.put(`${baseUrl}/api/scenes/${sceneId}`, {
    data: {
      graph,
      name: '水箱二维放置测试',
      expectedVersion: initialScene.version,
    },
  })
  expect(seedResponse.ok()).toBe(true)
  await page.goto(page.url(), { timeout: 120_000, waitUntil: 'commit' })

  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await page.getByRole('button', { name: '新建系统' }).click()
  await page.getByRole('button', { name: '光冷暖设备' }).click()
  await page.getByRole('combobox', { name: '安装空间' }).selectOption({ label: '水箱设备区' })
  await page.getByRole('combobox', { name: '区域用途' }).selectOption('equipment-area')
  await page.getByRole('button', { name: '2D' }).click()
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()
  const placeTank = page.getByRole('button', { name: /放置缓冲水箱/ })
  await placeTank.click()
  await expect(placeTank).toHaveAttribute('aria-pressed', 'true')
  await expect(placeTank).toHaveAttribute('aria-busy', 'false', { timeout: 120_000 })

  const bounds = await floorplan.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return
  const x = bounds.x + bounds.width * 0.5
  const y = bounds.y + bounds.height * 0.65
  await page.mouse.move(x, y)
  await expect(page.locator('[data-floorplan-placement-preview]')).toBeVisible()
  await page.mouse.click(x, y)

  await expect
    .poll(async () => {
      const response = await request.get(`${baseUrl}/api/scenes/${sceneId}`)
      const scene = (await response.json()) as {
        graph: { nodes: Record<string, { type: string }> }
      }
      return Object.values(scene.graph.nodes).some((node) => node.type === 'gln:buffer-tank')
    })
    .toBe(true)
})
