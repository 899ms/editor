import { type APIRequestContext, expect, test } from '@playwright/test'

const glnBaseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'
const editorBaseUrl = process.env.EDITOR_E2E_BASE_URL ?? 'http://localhost:32102'

type SceneNode = {
  end?: [number, number]
  id: string
  mode?: string
  name?: string
  start?: [number, number]
  type: string
  visible?: boolean
}

type ScenePayload = {
  graph: {
    installedPlugins?: string[]
    nodes: Record<string, SceneNode>
  }
  nodeCount: number
}

async function fetchScene(request: APIRequestContext, baseUrl: string, id: string) {
  const response = await request.get(`${baseUrl}/api/scenes/${id}`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as ScenePayload
}

test('keeps GLN scenes isolated and persists an edited residential scene', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)

  await page.goto(`${glnBaseUrl}/scenes`)
  await expect(page.getByRole('heading', { name: '我的场景' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-pascal-hydrated', 'true')
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${glnBaseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().click()
  const createResponse = await createResponsePromise
  if (createResponse.status() !== 201) {
    throw new Error(`GLN scene creation failed: ${await createResponse.text()}`)
  }
  await expect(page).toHaveURL(/\/scene\/[^/]+$/, { timeout: 15_000 })

  const sceneId = new URL(page.url()).pathname.split('/').at(-1)
  expect(sceneId).toBeTruthy()
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.getByRole('link', { name: '全部场景' })).toBeVisible()
  const initialScene = await fetchScene(request, glnBaseUrl, sceneId as string)
  expect(initialScene.nodeCount).toBe(3)
  const originalSceneResponse = await request.post(`${editorBaseUrl}/api/scenes`, {
    data: {
      name: '原版隔离场景',
      graph: initialScene.graph,
    },
  })
  expect(originalSceneResponse.status()).toBe(201)
  const originalScene = (await originalSceneResponse.json()) as { id: string }

  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await expect(page.locator('[data-gln-systems-panel]')).toBeVisible()
  await page.getByRole('button', { name: '新建系统' }).click()
  const systemName = page.getByRole('textbox', { name: '系统名称' })
  await expect(systemName).toHaveValue('住宅光冷暖系统 1')
  await systemName.fill('一层光冷暖系统')
  await systemName.press('Enter')
  await page.getByRole('button', { name: '制冷' }).click()

  await expect
    .poll(async () => {
      const scene = await fetchScene(request, glnBaseUrl, sceneId as string)
      const system = Object.values(scene.graph.nodes).find((node) => node.type === 'gln:system')
      return {
        installed: scene.graph.installedPlugins?.includes('pascal:gln') ?? false,
        mode: system?.mode,
        name: system?.name,
        visible: system?.visible,
      }
    })
    .toEqual({
      installed: true,
      mode: 'cooling',
      name: '一层光冷暖系统',
      visible: false,
    })

  await page.keyboard.press('b')
  await page.keyboard.press('c')
  await expect(page.getByRole('button', { name: /单段墙体/ })).toBeVisible()
  await page.getByRole('button', { name: '2D' }).click()
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()
  const bounds = await floorplan.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return

  await floorplan.click({ position: { x: bounds.width * 0.42, y: bounds.height * 0.58 } })
  await floorplan.click({ position: { x: bounds.width * 0.62, y: bounds.height * 0.58 } })

  await expect
    .poll(async () => {
      const scene = await fetchScene(request, glnBaseUrl, sceneId as string)
      return Object.values(scene.graph.nodes).filter((node) => node.type === 'wall').length
    })
    .toBe(1)

  await page.reload()
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.locator('[data-gln-client-node-types]')).toHaveAttribute(
    'data-gln-client-node-types',
    /gln:system.*wall|wall.*gln:system/,
  )
  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await expect(page.getByRole('textbox', { name: '系统名称' })).toHaveValue('一层光冷暖系统')
  await expect(page.getByRole('button', { name: '制冷' })).toHaveAttribute('aria-pressed', 'true')
  const reloadedScene = await fetchScene(request, glnBaseUrl, sceneId as string)
  expect(reloadedScene.nodeCount).toBeGreaterThan(initialScene.nodeCount)
  const walls = Object.values(reloadedScene.graph.nodes).filter((node) => node.type === 'wall')
  expect(walls).toHaveLength(1)
  expect(walls[0]?.start).not.toEqual(walls[0]?.end)
  expect(
    Object.values(reloadedScene.graph.nodes)
      .filter((node) => node.type !== 'gln:system')
      .some((node) => node.mode !== undefined),
  ).toBe(false)
  const originalGlnImport = await request.post(`${editorBaseUrl}/api/scenes`, {
    data: {
      name: '不应导入的 GLN 场景',
      graph: reloadedScene.graph,
    },
  })
  expect(originalGlnImport.status()).toBe(400)

  await page.getByRole('button', { name: '插件' }).click()
  await page.getByRole('button', { name: /^光冷暖系统 已安装/ }).click()
  await expect(page.getByRole('button', { name: '必需' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '卸载' })).toHaveCount(0)

  const glnScenes = (await (await request.get(`${glnBaseUrl}/api/scenes`)).json()) as {
    scenes: { id: string; name: string }[]
  }
  const originalScenes = (await (await request.get(`${editorBaseUrl}/api/scenes`)).json()) as {
    scenes: { id: string; name: string }[]
  }

  expect(glnScenes.scenes.some((scene) => scene.id === originalScene.id)).toBe(false)
  expect(originalScenes.scenes.some((scene) => scene.id === sceneId)).toBe(false)

  await page.goto(`${editorBaseUrl}/scenes`)
  await expect(page.getByRole('heading', { name: '我的场景' })).toBeVisible()
  await page.getByRole('link', { name: '原版隔离场景' }).click()
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-gln-client-node-types]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '光冷暖系统' })).toHaveCount(0)
  const originalHealth = await request.get(`${editorBaseUrl}/api/health`)
  expect(await originalHealth.json()).toMatchObject({ app: 'editor', status: 'ok' })
})
