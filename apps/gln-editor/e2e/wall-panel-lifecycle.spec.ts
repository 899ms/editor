import { type APIRequestContext, expect, test } from '@playwright/test'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'

type StoredScene = {
  graph: {
    installedPlugins?: string[]
    nodes: Record<string, Record<string, unknown>>
    rootNodeIds: string[]
  }
  version: number
}

async function fetchScene(request: APIRequestContext, sceneId: string) {
  return (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as StoredScene
}

test('edits, rehosts, undoes, and reloads a wall panel with explicit Zone ownership', async ({
  page,
  request,
}) => {
  test.setTimeout(300_000)
  await page.goto(`${baseUrl}/scenes`)
  await page.getByRole('button', { name: '新建场景' }).first().click()
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)
  expect(sceneId).toBeTruthy()
  if (!sceneId) return

  const initial = await fetchScene(request, sceneId)
  const graph = initial.graph
  const level = Object.values(graph.nodes).find((node) => node.type === 'level')
  expect(level).toBeTruthy()
  if (!level) return
  const levelId = level.id as string

  const system = {
    id: 'gln-system_e2e',
    object: 'node',
    parentId: null,
    visible: false,
    metadata: {},
    type: 'gln:system',
    name: '面板测试系统',
    mode: 'heating',
  }
  const wallA = {
    id: 'wall_panel_a',
    object: 'node',
    type: 'wall',
    name: '卧室墙',
    parentId: levelId,
    visible: true,
    metadata: {},
    start: [0, 0],
    end: [4, 0],
    height: 2.8,
    thickness: 0.2,
    children: [] as string[],
    frontSide: 'unknown',
    backSide: 'unknown',
  }
  const wallB = {
    id: 'wall_panel_b',
    object: 'node',
    type: 'wall',
    name: '书房墙',
    parentId: levelId,
    visible: true,
    metadata: {},
    start: [6, 0],
    end: [6, 4],
    height: 2.8,
    thickness: 0.2,
    children: [] as string[],
    frontSide: 'unknown',
    backSide: 'unknown',
  }
  const zone = (id: string, name: string, polygon: number[][]): Record<string, unknown> => ({
    id,
    object: 'node',
    type: 'zone',
    name,
    parentId: levelId,
    visible: false,
    metadata: {},
    polygon,
    autoFromWalls: false,
    boundaryWallIds: [],
    color: '#3b82f6',
  })
  const ambiguousA = zone('zone_panel_a', '卧室 A', [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ])
  const ambiguousB = zone('zone_panel_b', '卧室 B', ambiguousA.polygon as number[][])
  const backZone = zone('zone_panel_back', '走廊', [
    [0, 0],
    [0, -3],
    [4, -3],
    [4, 0],
  ])
  const rehostZone = zone('zone_panel_rehost', '书房', [
    [4, 0],
    [6, 0],
    [6, 4],
    [4, 4],
  ])
  const panel = {
    id: 'gln-wall-panel_e2e',
    object: 'node',
    type: 'gln:wall-panel',
    name: '卧室面板',
    parentId: wallA.id,
    wallId: wallA.id,
    wallStart: wallA.start,
    wallEnd: wallA.end,
    systemId: system.id,
    visible: true,
    metadata: {},
    position: [2, 1.25, 0.16],
    rotation: [0, 0, 0],
    side: 'front',
    width: 0.9,
    height: 2.5,
    depth: 0.12,
    finishColor: '#e8ddd0',
    connectionDiameterIn: 0.5,
    zoneId: null,
    zoneCandidateIds: [ambiguousA.id, ambiguousB.id],
    zoneAssignment: 'auto',
  }

  graph.nodes[levelId] = {
    ...level,
    children: [
      ...((level.children as string[]) ?? []),
      wallA.id,
      wallB.id,
      ambiguousA.id,
      ambiguousB.id,
      backZone.id,
      rehostZone.id,
    ],
  }
  graph.nodes[wallA.id] = { ...wallA, children: [panel.id] }
  graph.nodes[wallB.id] = wallB
  graph.nodes[ambiguousA.id as string] = ambiguousA
  graph.nodes[ambiguousB.id as string] = ambiguousB
  graph.nodes[backZone.id as string] = backZone
  graph.nodes[rehostZone.id as string] = rehostZone
  graph.nodes[panel.id] = panel
  graph.nodes[system.id] = system
  graph.rootNodeIds.push(system.id)
  graph.installedPlugins = ['pascal:gln']

  const seedResponse = await request.put(`${baseUrl}/api/scenes/${sceneId}`, {
    data: {
      name: '贴墙面板生命周期',
      graph,
      expectedVersion: initial.version,
    },
  })
  if (!seedResponse.ok()) {
    throw new Error(
      `wall-panel seed failed (${seedResponse.status()}): ${await seedResponse.text()}`,
    )
  }

  await page.goto(`${baseUrl}/scene/${sceneId}`)
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await page.getByRole('button', { name: '2D' }).click()
  await expect(page.locator('svg.touch-none')).toBeVisible()
  await page.getByRole('button', { name: '选择 V' }).click()

  const panelEntry = page.locator(`.floorplan-registry-entry[data-node-id="${panel.id}"]`).first()
  await expect(panelEntry).toBeVisible()
  await panelEntry.locator('rect').click({ position: { x: 4, y: 4 } })
  await expect(page.getByRole('heading', { name: '室内面板' })).toBeVisible()
  await page.getByRole('button', { name: '展开面板' }).click()
  await page.getByText('0.90', { exact: true }).click()
  const widthInput = page.getByRole('textbox', { name: '面板宽度' })
  await widthInput.fill('1.00')
  await widthInput.press('Enter')

  await page.getByRole('button', { name: '光冷暖设备' }).click()
  await expect(page.getByText('请选择面板所属空间')).toBeVisible()
  await page.getByRole('button', { name: '卧室 A' }).click()
  await expect
    .poll(async () => (await fetchScene(request, sceneId)).graph.nodes[panel.id])
    .toMatchObject({
      width: 1,
      zoneAssignment: 'manual',
      zoneCandidateIds: [],
      zoneId: ambiguousA.id,
    })

  await panelEntry.locator('rect').click({ position: { x: 4, y: 4 } })
  await page.getByRole('button', { name: '翻转到墙体另一侧并重新判断服务空间' }).click()
  await expect
    .poll(async () => (await fetchScene(request, sceneId)).graph.nodes[panel.id])
    .toMatchObject({
      side: 'back',
      wallId: wallA.id,
      zoneAssignment: 'auto',
      zoneId: backZone.id,
    })

  await page.locator('button[aria-label="删除"]').click()
  await expect
    .poll(async () => (await fetchScene(request, sceneId)).graph.nodes[panel.id])
    .toBeUndefined()
  await page.keyboard.press('Control+z')
  await expect
    .poll(async () => (await fetchScene(request, sceneId)).graph.nodes[panel.id])
    .toMatchObject({ width: 1, wallId: wallA.id, zoneId: backZone.id })

  await page.reload()
  await page.getByRole('button', { name: '2D' }).click()
  await expect(
    page.locator(`.floorplan-registry-entry[data-node-id="${panel.id}"]`).first(),
  ).toBeVisible()
  expect((await fetchScene(request, sceneId)).graph.nodes[panel.id]).toMatchObject({
    parentId: wallA.id,
    wallId: wallA.id,
    width: 1,
    zoneId: backZone.id,
  })
})
