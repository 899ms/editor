import { expect, test } from '@playwright/test'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'

test('places a buffer tank from the 2D floor plan', async ({ page, request }) => {
  await page.goto(`${baseUrl}/scenes`)
  await page.getByRole('button', { name: '新建场景' }).first().click()
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)
  expect(sceneId).toBeTruthy()

  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await page.getByRole('button', { name: '新建系统' }).click()
  await page.getByRole('button', { name: '光冷暖设备' }).click()
  await page.getByRole('button', { name: '2D' }).click()
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()
  const placeTank = page.getByRole('button', { name: /放置缓冲水箱/ })
  await placeTank.click()
  await expect(placeTank).toHaveAttribute('aria-pressed', 'true')
  await expect(placeTank).toHaveAttribute('aria-busy', 'false')

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
