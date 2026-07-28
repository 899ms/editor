import { type APIRequestContext, expect, test } from '@playwright/test'

const glnBaseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'
const editorBaseUrl = process.env.EDITOR_E2E_BASE_URL ?? 'http://localhost:32102'

type SceneNode = {
  autoFromWalls?: boolean
  boundaryWallIds?: string[]
  children?: string[]
  color?: string
  diameter?: number
  end?: [number, number]
  finish?: string
  id: string
  mode?: string
  metadata?: Record<string, unknown>
  name?: string
  object?: string
  parentId?: string | null
  position?: [number, number, number]
  rotation?: [number, number, number]
  start?: [number, number]
  systemId?: string
  stratificationView?: boolean
  type: string
  visible?: boolean
  width?: number
  polygon?: number[][]
}

type ScenePayload = {
  graph: {
    installedPlugins?: string[]
    nodes: Record<string, SceneNode>
  }
  nodeCount: number
  version: number
}

async function fetchScene(request: APIRequestContext, baseUrl: string, id: string) {
  const response = await request.get(`${baseUrl}/api/scenes/${id}`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as ScenePayload
}

async function fetchNode(
  request: APIRequestContext,
  baseUrl: string,
  sceneId: string,
  nodeId: string,
) {
  const scene = await fetchScene(request, baseUrl, sceneId)
  return scene.graph.nodes[nodeId]
}

test('keeps GLN scenes isolated and persists an edited residential scene', async ({
  page,
  request,
}) => {
  test.setTimeout(900_000)

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

  const equipmentLevel = Object.values(initialScene.graph.nodes).find(
    (node) => node.type === 'level',
  )
  if (!equipmentLevel) throw new Error('GLN default scene did not include a placement level')
  const graphWithEquipmentArea = structuredClone(initialScene.graph)
  const equipmentArea: SceneNode = {
    id: 'zone_gln_equipment_area',
    object: 'node',
    type: 'zone',
    name: '设备阳台',
    parentId: equipmentLevel.id,
    visible: false,
    metadata: {},
    polygon: [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
    ],
    autoFromWalls: false,
    boundaryWallIds: [],
    color: '#3b82f6',
  }
  const seededLevel = graphWithEquipmentArea.nodes[equipmentLevel.id] as SceneNode
  seededLevel.children = [...(seededLevel.children ?? []), equipmentArea.id]
  graphWithEquipmentArea.nodes[equipmentArea.id] = equipmentArea
  const seedResponse = await request.put(`${glnBaseUrl}/api/scenes/${sceneId}`, {
    data: {
      name: '光冷暖设备安装测试',
      graph: graphWithEquipmentArea,
      expectedVersion: initialScene.version,
    },
  })
  if (!seedResponse.ok()) {
    throw new Error(`GLN equipment-area seed failed: ${await seedResponse.text()}`)
  }
  await page.reload({ timeout: 120_000, waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()

  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await expect(page.locator('[data-gln-systems-panel]')).toBeVisible({ timeout: 30_000 })
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

  await page.getByRole('button', { name: '新建系统' }).click()
  const backupSystemName = page.getByRole('textbox', { name: '系统名称' }).last()
  await expect(backupSystemName).toHaveValue('住宅光冷暖系统 2')
  await backupSystemName.fill('备用光冷暖系统')
  await backupSystemName.press('Enter')

  await page.getByRole('button', { name: '光冷暖设备' }).click()
  await expect(page.locator('[data-gln-equipment-panel]')).toBeVisible({ timeout: 30_000 })
  const systemSelector = page.getByRole('combobox', { name: '所属系统' })
  await systemSelector.selectOption({ label: '一层光冷暖系统' })
  const selectedSystemId = await systemSelector.inputValue()
  expect(selectedSystemId).toMatch(/^gln-system_/)

  await page.waitForTimeout(500)
  const beforePreview = await fetchScene(request, glnBaseUrl, sceneId as string)
  await page.getByRole('button', { name: '运行预览' }).click()
  await expect(page.locator('[data-gln-run-preview]')).toBeVisible()
  await expect(page.getByText('同一实时场景，仅显示拓扑方向和用户目标设置。')).toBeVisible()
  await expect(page.getByText('运行预览不表示实时温湿度、流量、负荷或设备性能。')).toBeVisible()
  await expect(page.locator('[data-gln-installation-area]')).toHaveCount(0)
  await page.waitForTimeout(1_000)
  const afterPreview = await fetchScene(request, glnBaseUrl, sceneId as string)
  expect(afterPreview.version).toBe(beforePreview.version)
  expect(afterPreview.graph).toEqual(beforePreview.graph)
  await page.getByRole('button', { name: '编辑视图' }).click()
  await expect(page.locator('[data-gln-installation-area]')).toBeVisible()

  await page.getByRole('combobox', { name: '安装空间' }).selectOption({ label: '设备阳台' })
  await page.getByRole('combobox', { name: '区域用途' }).selectOption('outdoor-equipment-area')
  await page.getByRole('button', { name: /放置外机/ }).click()
  const canvas = page.locator('[data-pascal-viewer-3d] canvas')
  await expect(canvas).toBeVisible()
  const canvasBounds = await canvas.boundingBox()
  expect(canvasBounds).not.toBeNull()
  if (!canvasBounds) return
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * 0.62,
    canvasBounds.y + canvasBounds.height * 0.66,
  )
  await page.mouse.click(
    canvasBounds.x + canvasBounds.width * 0.62,
    canvasBounds.y + canvasBounds.height * 0.66,
  )

  let outdoorUnitId = ''
  let initialOutdoorPosition: [number, number, number] | undefined
  await expect
    .poll(async () => {
      const scene = await fetchScene(request, glnBaseUrl, sceneId as string)
      const unit = Object.values(scene.graph.nodes).find((node) => node.type === 'gln:outdoor-unit')
      outdoorUnitId = unit?.id ?? ''
      initialOutdoorPosition = unit?.position
      return unit
        ? {
            parented: Boolean(
              (scene.graph.nodes[unit.id] as SceneNode & { parentId?: string }).parentId,
            ),
            systemId: unit.systemId,
            type: unit.type,
          }
        : null
    })
    .toEqual({
      parented: true,
      systemId: selectedSystemId,
      type: 'gln:outdoor-unit',
    })

  await expect(page.getByRole('heading', { name: '外机' })).toBeVisible()
  await page.getByRole('button', { name: '展开面板' }).click()
  await page.getByText('0.90', { exact: true }).click()
  const dimensionInput = page.getByRole('textbox', { name: '宽度' })
  await dimensionInput.fill('1.20')
  await dimensionInput.press('Enter')
  await page.getByRole('button', { name: '石墨灰' }).click()
  await page.keyboard.press('r')
  await expect
    .poll(async () => {
      const unit = await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId)
      return {
        finish: unit?.finish,
        rotation: unit?.rotation,
        width: unit?.width,
      }
    })
    .toEqual({
      finish: 'graphite',
      rotation: [0, Math.PI / 4, 0],
      width: 1.2,
    })
  expect(initialOutdoorPosition).toBeDefined()
  const initialPositionJson = JSON.stringify(initialOutdoorPosition)

  await page
    .locator('button')
    .filter({ hasText: /^移动$/ })
    .click()
  await page.waitForTimeout(500)
  const moveX = canvasBounds.x + canvasBounds.width * 0.78
  const moveY = canvasBounds.y + canvasBounds.height * 0.72
  await page.mouse.move(moveX - 80, moveY - 40)
  await page.mouse.move(moveX, moveY, { steps: 4 })
  await page.mouse.click(moveX, moveY)

  let movedOutdoorPosition: [number, number, number] | undefined
  await expect
    .poll(async () => {
      const unit = await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId)
      movedOutdoorPosition = unit?.position
      return JSON.stringify(unit?.position)
    })
    .not.toBe(initialPositionJson)

  await page.keyboard.press('Control+z')
  await expect
    .poll(async () =>
      JSON.stringify(
        (await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId))?.position,
      ),
    )
    .toBe(initialPositionJson)

  await page.keyboard.press('Control+Shift+z')
  const movedPositionJson = JSON.stringify(movedOutdoorPosition)
  await expect
    .poll(async () =>
      JSON.stringify(
        (await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId))?.position,
      ),
    )
    .toBe(movedPositionJson)

  await page.getByRole('button', { name: '2D' }).click()
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()
  const outdoorUnit2d = page
    .locator(`.floorplan-registry-entry[data-node-id="${outdoorUnitId}"]`)
    .first()
  await expect(outdoorUnit2d).toBeVisible()
  await outdoorUnit2d.hover()
  await outdoorUnit2d.click()
  await page.locator('button[aria-label="移动"]').click()
  await page.waitForTimeout(300)
  const bounds = await floorplan.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return
  const floorplanMoveX = bounds.x + bounds.width * 0.68
  const floorplanMoveY = bounds.y + bounds.height * 0.44
  await page.mouse.move(floorplanMoveX - 60, floorplanMoveY + 40)
  await page.mouse.move(floorplanMoveX, floorplanMoveY, { steps: 4 })
  await page.mouse.click(floorplanMoveX, floorplanMoveY)

  let floorplanPositionJson = ''
  await expect
    .poll(async () => {
      const unit = await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId)
      floorplanPositionJson = JSON.stringify(unit?.position)
      return floorplanPositionJson
    })
    .not.toBe(movedPositionJson)

  const deleteAction = page.locator('button[aria-label="删除"]')
  await expect(deleteAction).toBeVisible()
  await deleteAction.click()
  await expect
    .poll(async () => await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId))
    .toBeUndefined()

  await page.keyboard.press('Control+z')
  await expect
    .poll(async () =>
      JSON.stringify(
        (await fetchNode(request, glnBaseUrl, sceneId as string, outdoorUnitId))?.position,
      ),
    )
    .toBe(floorplanPositionJson)

  const expandSidebar = page.getByRole('button', { name: '展开侧栏' })
  if (await expandSidebar.isVisible()) await expandSidebar.click()
  if (!(await page.locator('[data-gln-equipment-panel]').isVisible())) {
    await page.getByRole('button', { name: '光冷暖设备' }).click()
  }
  await expect(page.locator('[data-gln-equipment-panel]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('combobox', { name: '区域用途' }).selectOption('equipment-area')
  const placeTank = page.getByRole('button', { name: /放置缓冲水箱/ })
  await placeTank.click()
  await expect(placeTank).toHaveAttribute('aria-pressed', 'true')
  await expect(placeTank).toHaveAttribute('aria-busy', 'false')
  const tankPlaceX = bounds.x + bounds.width * 0.58
  const tankPlaceY = bounds.y + bounds.height * 0.72
  await page.mouse.move(tankPlaceX - 40, tankPlaceY - 30)
  await page.mouse.move(tankPlaceX, tankPlaceY, { steps: 4 })
  await expect(page.locator('[data-floorplan-placement-preview]')).toBeVisible()
  await page.mouse.click(tankPlaceX, tankPlaceY)

  let bufferTankId = ''
  let initialTankPosition: [number, number, number] | undefined
  await expect
    .poll(async () => {
      const scene = await fetchScene(request, glnBaseUrl, sceneId as string)
      const tank = Object.values(scene.graph.nodes).find((node) => node.type === 'gln:buffer-tank')
      bufferTankId = tank?.id ?? ''
      initialTankPosition = tank?.position
      return tank
        ? {
            systemId: tank.systemId,
            type: tank.type,
            stratificationView: tank.stratificationView,
          }
        : null
    })
    .toEqual({
      systemId: selectedSystemId,
      type: 'gln:buffer-tank',
      stratificationView: true,
    })

  await expect(page.getByRole('heading', { name: '缓冲水箱' })).toBeVisible()
  await page.getByRole('button', { name: '展开面板' }).click()
  await page.getByText('0.65', { exact: true }).click()
  const diameterInput = page.getByRole('textbox', { name: '水箱直径' })
  await diameterInput.fill('0.80')
  await diameterInput.press('Enter')
  await page.getByRole('button', { name: '石墨灰' }).click()
  await page.keyboard.press('r')
  await expect
    .poll(async () => {
      const tank = await fetchNode(request, glnBaseUrl, sceneId as string, bufferTankId)
      return {
        diameter: tank?.diameter,
        finish: tank?.finish,
        rotation: tank?.rotation,
      }
    })
    .toEqual({
      diameter: 0.8,
      finish: 'graphite',
      rotation: [0, Math.PI / 4, 0],
    })

  expect(initialTankPosition).toBeDefined()
  const initialTankPositionJson = JSON.stringify(initialTankPosition)
  const threeDimensionalView = page.getByRole('button', { name: '3D' })
  await threeDimensionalView.evaluate((element) => (element as HTMLButtonElement).click())
  await expect(threeDimensionalView).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toBeVisible()
  await page
    .locator('button')
    .filter({ hasText: /^移动$/ })
    .click()
  await page.waitForTimeout(300)
  const tankMoveX = canvasBounds.x + canvasBounds.width * 0.32
  const tankMoveY = canvasBounds.y + canvasBounds.height * 0.74
  await page.mouse.move(tankMoveX - 50, tankMoveY - 30)
  await page.mouse.move(tankMoveX, tankMoveY, { steps: 4 })
  await page.mouse.click(tankMoveX, tankMoveY)

  let movedTankPositionJson = ''
  await expect
    .poll(async () => {
      const tank = await fetchNode(request, glnBaseUrl, sceneId as string, bufferTankId)
      movedTankPositionJson = JSON.stringify(tank?.position)
      return movedTankPositionJson
    })
    .not.toBe(initialTankPositionJson)

  await page.getByRole('button', { name: '2D' }).click()
  await expect(floorplan).toBeVisible()
  const bufferTank2d = page
    .locator(`.floorplan-registry-entry[data-node-id="${bufferTankId}"]`)
    .first()
  await expect(bufferTank2d).toBeVisible()
  await bufferTank2d.click()
  await page.locator('button[aria-label="移动"]').click()
  await page.waitForTimeout(300)
  const tankFloorplanMoveX = bounds.x + bounds.width * 0.34
  const tankFloorplanMoveY = bounds.y + bounds.height * 0.38
  await page.mouse.move(tankFloorplanMoveX - 45, tankFloorplanMoveY + 35)
  await page.mouse.move(tankFloorplanMoveX, tankFloorplanMoveY, { steps: 4 })
  await page.mouse.click(tankFloorplanMoveX, tankFloorplanMoveY)

  let tankFloorplanPositionJson = ''
  await expect
    .poll(async () => {
      const tank = await fetchNode(request, glnBaseUrl, sceneId as string, bufferTankId)
      tankFloorplanPositionJson = JSON.stringify(tank?.position)
      return tankFloorplanPositionJson
    })
    .not.toBe(movedTankPositionJson)

  const tankDeleteAction = page.locator('button[aria-label="删除"]')
  await expect(tankDeleteAction).toBeVisible()
  await tankDeleteAction.click()
  await expect
    .poll(async () => await fetchNode(request, glnBaseUrl, sceneId as string, bufferTankId))
    .toBeUndefined()
  await page.keyboard.press('Control+z')
  await expect
    .poll(async () =>
      JSON.stringify(
        (await fetchNode(request, glnBaseUrl, sceneId as string, bufferTankId))?.position,
      ),
    )
    .toBe(tankFloorplanPositionJson)

  await page.keyboard.press('b')
  await page.keyboard.press('c')
  await expect(page.getByRole('button', { name: /单段墙体/ })).toBeVisible()

  await floorplan.click({ position: { x: bounds.width * 0.42, y: bounds.height * 0.58 } })
  await floorplan.click({ position: { x: bounds.width * 0.62, y: bounds.height * 0.58 } })

  await expect
    .poll(async () => {
      const scene = await fetchScene(request, glnBaseUrl, sceneId as string)
      return Object.values(scene.graph.nodes).filter((node) => node.type === 'wall').length
    })
    .toBe(1)

  await page.reload({ timeout: 120_000, waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.locator('[data-gln-client-node-types]')).toHaveAttribute(
    'data-gln-client-node-types',
    /gln:buffer-tank/,
  )
  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await expect(page.locator('[data-gln-systems-panel]')).toBeVisible({ timeout: 30_000 })
  const reloadedSystemNames = page.getByRole('textbox', { name: '系统名称' })
  await expect(reloadedSystemNames.first()).toHaveValue('一层光冷暖系统')
  await expect(reloadedSystemNames.last()).toHaveValue('备用光冷暖系统')
  const reloadedCoolingModes = page.getByRole('button', { name: '制冷' })
  await expect(reloadedCoolingModes.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(reloadedCoolingModes.last()).toHaveAttribute('aria-pressed', 'false')
  const reloadedScene = await fetchScene(request, glnBaseUrl, sceneId as string)
  expect(reloadedScene.nodeCount).toBeGreaterThan(initialScene.nodeCount)
  const walls = Object.values(reloadedScene.graph.nodes).filter((node) => node.type === 'wall')
  expect(walls).toHaveLength(1)
  expect(walls[0]?.start).not.toEqual(walls[0]?.end)
  expect(reloadedScene.graph.nodes[outdoorUnitId]).toMatchObject({
    finish: 'graphite',
    id: outdoorUnitId,
    position: JSON.parse(floorplanPositionJson),
    rotation: [0, Math.PI / 4, 0],
    systemId: selectedSystemId,
    type: 'gln:outdoor-unit',
    width: 1.2,
  })
  expect(reloadedScene.graph.nodes[bufferTankId]).toMatchObject({
    diameter: 0.8,
    finish: 'graphite',
    id: bufferTankId,
    position: JSON.parse(tankFloorplanPositionJson),
    rotation: [0, Math.PI / 4, 0],
    stratificationView: true,
    systemId: selectedSystemId,
    type: 'gln:buffer-tank',
  })
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
  await page.getByRole('button', { name: /^住宅导入 已安装/ }).click()
  await expect(page.getByText('pascal:gln', { exact: true })).toBeVisible()
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
