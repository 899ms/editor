import { expect, test } from '@playwright/test'
import { createGlnConfigurationTestGraph } from '../lib/codex-tasks/gln-configuration-test-fixtures'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'

test('shows progress, supports cancellation controls, and hands a validated Codex plan to preview', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  await page.goto(`${baseUrl}/scenes`)
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${baseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().click()
  expect((await createResponsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)!
  const scene = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
    version: number
    graph: { nodes: Record<string, { id: string; type: string }> }
  }
  const level = Object.values(scene.graph.nodes).find((node) => node.type === 'level')
  if (!level) throw new Error('Default GLN scene has no level')
  const plan = {
    id: 'codex-ui-plan',
    sceneId,
    baseVersion: scene.version,
    operations: [{ op: 'update', id: level.id, data: { name: 'AI 重建楼层' } }],
  }
  const queued = {
    id: 'task-codex-ui',
    sceneId,
    kind: 'reconstruct-home',
    status: 'queued',
    progress: 0,
    plan: null,
    preview: null,
    residentialReport: null,
    error: null,
  }
  const succeeded = {
    ...queued,
    status: 'succeeded',
    progress: 100,
    plan,
    preview: {
      diffs: [
        {
          kind: 'update',
          nodeId: level.id,
          nodeType: 'level',
          changedFields: ['name'],
        },
      ],
      issues: [],
    },
    residentialReport: {
      status: 'draft-ready',
      minimumStructure: { satisfied: true, missing: [] },
      reviewItems: [
        {
          nodeId: level.id,
          nodeType: 'level',
          confidence: 'medium',
          reason: 'medium-confidence',
          message: 'AI 重建楼层为中等置信度构件：层高来自平面资料摘要',
        },
      ],
    },
  }
  await page.route(`**/api/scenes/${sceneId}/codex-tasks`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 202,
      body: JSON.stringify(queued),
    })
  })
  await page.route(`**/api/scenes/${sceneId}/codex-tasks/task-codex-ui`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(succeeded),
    })
  })

  await page.getByRole('button', { name: 'AI 场景任务' }).click()
  await expect(page.locator('[data-gln-codex-task-panel]')).toBeVisible()
  await page.getByRole('combobox', { name: '任务类型' }).selectOption('reconstruct-home')
  await page.getByRole('textbox', { name: '任务目标' }).fill('重建为正常可编辑住宅节点')
  await page.getByRole('button', { name: '生成场景计划' }).click()
  await expect(page.getByRole('button', { name: '取消任务' })).toBeVisible()
  await expect(page.getByText('已生成')).toBeVisible()
  await expect(page.getByText('已通过格式与硬校验，共 1 项变更。')).toBeVisible()
  await expect(page.locator('[data-residential-review-queue]')).toContainText(
    'AI 重建楼层为中等置信度构件',
  )
  const sendButton = page.getByRole('button', { name: '发送到变更计划' })
  await expect(sendButton).toBeDisabled()
  await page
    .getByRole('checkbox', { name: '我已逐项核对这些不确定构件，允许进入差异预览。' })
    .check()
  await expect(sendButton).toBeEnabled()
  await sendButton.click()

  await page.getByRole('button', { name: '变更计划', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '计划输入' })).toHaveValue(
    JSON.stringify(plan, null, 2),
  )
  await expect(page.getByText('已接收本地 Codex 生成的场景计划。')).toBeVisible()
})

test('generates editable residential nodes, previews, atomically commits, and reloads them', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${baseUrl}/scenes`)
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${baseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().click()
  expect((await createResponsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)!
  const scene = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
    version: number
    graph: { nodes: Record<string, { id: string; type: string }> }
  }
  const level = Object.values(scene.graph.nodes).find((node) => node.type === 'level')
  if (!level) throw new Error('Default GLN scene has no level')

  const wallSpecs = [
    ['wall_ai_e2e_north', [0, 0], [4, 0]],
    ['wall_ai_e2e_east', [4, 0], [4, 3]],
    ['wall_ai_e2e_south', [4, 3], [0, 3]],
    ['wall_ai_e2e_west', [0, 3], [0, 0]],
  ] as const
  const operations = [
    ...wallSpecs.map(([id, start, end]) => ({
      op: 'create',
      parentId: level.id,
      node: {
        object: 'node',
        id,
        type: 'wall',
        children: [],
        parentId: null,
        visible: true,
        start,
        end,
        height: 2.8,
        thickness: 0.2,
        frontSide: 'interior',
        backSide: 'exterior',
        metadata: { source: 'codex-residential', confidence: 'high' },
      },
    })),
    {
      op: 'create',
      parentId: level.id,
      node: {
        object: 'node',
        id: 'zone_ai_e2e_living',
        type: 'zone',
        parentId: null,
        visible: true,
        name: 'AI 客厅',
        polygon: [
          [0, 0],
          [4, 0],
          [4, 3],
          [0, 3],
        ],
        autoFromWalls: true,
        boundaryWallIds: wallSpecs.map(([id]) => id),
        color: '#3b82f6',
        metadata: { source: 'codex-residential', confidence: 'high' },
      },
    },
  ]
  const plan = {
    id: 'codex-residential-e2e-plan',
    sceneId,
    baseVersion: scene.version,
    operations,
  }
  const queued = {
    id: 'task-codex-residential-e2e',
    sceneId,
    kind: 'reconstruct-home',
    status: 'queued',
    progress: 0,
    plan: null,
    preview: null,
    residentialReport: null,
    error: null,
  }
  const succeeded = {
    ...queued,
    status: 'succeeded',
    progress: 100,
    plan,
    preview: {
      diffs: operations.map((operation) => ({
        kind: 'create',
        nodeId: operation.node.id,
        nodeType: operation.node.type,
        changedFields: Object.keys(operation.node),
      })),
      issues: [],
    },
    residentialReport: {
      status: 'draft-ready',
      minimumStructure: { satisfied: true, missing: [] },
      reviewItems: [],
    },
  }

  await page.route(`**/api/scenes/${sceneId}/codex-tasks`, async (route) => {
    const requestBody = route.request().postDataJSON() as {
      kind: string
      source?: { kind: string; summary: string; uploadOriginal: boolean }
    }
    expect(requestBody).toMatchObject({
      kind: 'reconstruct-home',
      source: {
        kind: 'ifc',
        summary: '首层 4 面围护墙，形成 1 个客厅空间。',
        uploadOriginal: false,
      },
    })
    await route.fulfill({
      contentType: 'application/json',
      status: 202,
      body: JSON.stringify(queued),
    })
  })
  await page.route(
    `**/api/scenes/${sceneId}/codex-tasks/task-codex-residential-e2e`,
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify(succeeded),
      })
    },
  )

  await page.getByRole('button', { name: 'AI 场景任务' }).click()
  await page.getByRole('combobox', { name: '任务类型' }).selectOption('reconstruct-home')
  await page.getByRole('combobox', { name: '平面资料' }).selectOption('ifc')
  await page
    .getByRole('textbox', { name: '资料解析摘要' })
    .fill('首层 4 面围护墙，形成 1 个客厅空间。')
  await page.getByRole('textbox', { name: '任务目标' }).fill('生成一套可编辑的一层住宅')
  await page.getByRole('button', { name: '生成场景计划' }).click()
  await expect(page.getByText('已生成')).toBeVisible()
  await page.getByRole('button', { name: '发送到变更计划' }).click()

  await page.getByRole('button', { name: '变更计划', exact: true }).click()
  const previewButton = page.getByRole('button', { name: '校验并生成差异预览' })
  const preview = page.locator('[data-gln-scene-plan-preview]')
  await previewButton.click()
  try {
    await expect(preview).toBeVisible({ timeout: 15_000 })
  } catch {
    await expect(page.getByText('无法连接场景计划服务。')).toBeVisible()
    await page.waitForTimeout(1_000)
    await previewButton.click()
    await expect(preview).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.locator('[data-diff-kind="create"]')).toHaveCount(5)
  await page.getByRole('button', { name: '确认并一次提交' }).click()
  await expect(page.getByText(/已原子提交；恢复点/)).toBeVisible()

  await page.reload()
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  let reloadedVersion = scene.version
  await expect
    .poll(async () => {
      const reloaded = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
        version: number
        graph: {
          nodes: Record<
            string,
            { id: string; type: string; metadata?: Record<string, unknown>; locked?: boolean }
          >
        }
      }
      reloadedVersion = reloaded.version
      return {
        walls: wallSpecs.filter(([id]) => reloaded.graph.nodes[id]?.type === 'wall').length,
        zone: reloaded.graph.nodes.zone_ai_e2e_living?.type,
        editable: wallSpecs.every(
          ([id]) =>
            reloaded.graph.nodes[id]?.locked !== true &&
            reloaded.graph.nodes[id]?.metadata?.locked !== true,
        ),
      }
    })
    .toEqual({
      walls: 4,
      zone: 'zone',
      editable: true,
    })
  expect(reloadedVersion).toBeGreaterThan(scene.version)
  expect(pageErrors).toEqual([])
})

test('configures one editable GLN system by stable IDs without duplicating devices', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000)
  await page.goto(`${baseUrl}/scenes`)
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${baseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().click()
  expect((await createResponsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)!
  await page.goto(`${baseUrl}/scenes`)
  const initial = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
    version: number
  }
  const fixture = createGlnConfigurationTestGraph('codex_e2e')
  const seed = await request.put(`${baseUrl}/api/scenes/${sceneId}`, {
    data: {
      name: 'AI 配置光冷暖',
      graph: {
        ...fixture.residentialGraph,
        installedPlugins: ['pascal:gln'],
      },
      expectedVersion: initial.version,
    },
  })
  if (!seed.ok()) {
    throw new Error(`GLN configuration seed failed (${seed.status()}): ${await seed.text()}`)
  }
  const seeded = (await seed.json()) as { version: number }
  const configuredZoneSettings = {
    [fixture.ids.livingZone]: {
      targetTemperature: 23,
      targetTemperatureSource: 'template',
      targetHumidity: 48,
      targetHumiditySource: 'template',
      enabled: true,
    },
  }
  const plan = {
    id: 'codex-gln-configuration-e2e',
    sceneId,
    baseVersion: seeded.version,
    operations: fixture.glnNodes.map((node) => {
      const configuredNode =
        node.id === fixture.ids.system
          ? {
              ...node,
              name: 'AI 配置住宅主系统',
              zoneSettings: configuredZoneSettings,
            }
          : node
      return {
        op: 'create',
        ...(configuredNode.parentId ? { parentId: configuredNode.parentId } : {}),
        node: configuredNode,
      }
    }),
  }
  const queued = {
    id: 'task-codex-gln-configuration-e2e',
    sceneId,
    kind: 'configure-gln',
    status: 'queued',
    progress: 0,
    plan: null,
    preview: null,
    residentialReport: null,
    glnConfigurationReport: null,
    error: null,
  }
  const succeeded = {
    ...queued,
    status: 'succeeded',
    progress: 100,
    plan,
    preview: {
      ok: true,
      diffs: plan.operations.map((operation) => ({
        kind: 'create',
        nodeId: operation.node.id,
        nodeType: operation.node.type,
        changedFields: Object.keys(operation.node),
      })),
      issues: [],
    },
    glnConfigurationReport: {
      status: 'ready',
      systems: {
        before: 0,
        requested: 1,
        expected: 1,
        after: 1,
        affectedIds: [fixture.ids.system],
      },
      completenessIssues: [],
      reviewItems: [],
    },
  }

  await page.route(`**/api/scenes/${sceneId}/codex-tasks`, async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      kind: 'configure-gln',
      glnConfiguration: { targetSystemCount: 1 },
    })
    await route.fulfill({
      contentType: 'application/json',
      status: 202,
      body: JSON.stringify(queued),
    })
  })
  await page.route(
    `**/api/scenes/${sceneId}/codex-tasks/task-codex-gln-configuration-e2e`,
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify(succeeded),
      })
    },
  )

  await page.goto(`${baseUrl}/scene/${sceneId}`)
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await page
    .locator(
      '.pascal-loader-1, .pascal-loader-2, .pascal-loader-3, .pascal-loader-4, .pascal-loader-5',
    )
    .waitFor({ state: 'detached', timeout: 20_000 })
  let stableReads = 0
  let latestVersion = plan.baseVersion
  while (stableReads < 3) {
    await page.waitForTimeout(500)
    const current = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
      version: number
    }
    if (current.version === latestVersion) stableReads += 1
    else {
      latestVersion = current.version
      stableReads = 0
    }
  }
  plan.baseVersion = latestVersion
  await page.getByRole('button', { name: 'AI 场景任务' }).click()
  await expect(page.getByRole('spinbutton', { name: '目标系统总数' })).toHaveValue('1')
  await page.getByRole('textbox', { name: '任务目标' }).fill('为住宅配置一套光冷暖系统')
  await page.getByRole('button', { name: '生成场景计划' }).click()
  await expect(page.getByText('已生成')).toBeVisible()
  await expect(
    page.getByText(`已通过格式与硬校验，共 ${fixture.glnNodes.length} 项变更。`),
  ).toBeVisible()
  await page.getByRole('button', { name: '发送到变更计划' }).click()
  await page.getByRole('button', { name: '变更计划', exact: true }).click()
  await page.getByRole('button', { name: '校验并生成差异预览' }).click()
  await expect(page.locator('[data-diff-kind="create"]')).toHaveCount(fixture.glnNodes.length)
  await expect(page.locator('[data-diff-kind="create"]').first()).toContainText(fixture.ids.system)
  await page.getByRole('button', { name: '确认并一次提交' }).click()
  await expect(page.getByText(/已原子提交；恢复点/)).toBeVisible()

  const summarize = async () => {
    const current = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
      version: number
      graph: { nodes: Record<string, Record<string, unknown>> }
    }
    const nodes = Object.values(current.graph.nodes)
    const system = current.graph.nodes[fixture.ids.system]
    const level = current.graph.nodes[fixture.ids.level]
    const panel = current.graph.nodes[fixture.ids.panel]
    const hostWall = current.graph.nodes[String(panel?.parentId ?? '')]
    const levelHostedIds = [fixture.ids.outdoor, fixture.ids.tank, ...fixture.ids.pipes]
    return {
      version: current.version,
      systems: nodes.filter((node) => node.type === 'gln:system').length,
      outdoors: nodes.filter((node) => node.type === 'gln:outdoor-unit').length,
      tanks: nodes.filter((node) => node.type === 'gln:buffer-tank').length,
      panels: nodes.filter((node) => node.type === 'gln:wall-panel').length,
      pipes: nodes.filter((node) => node.type === 'gln:hydronic-pipe').length,
      temperature: (
        system?.zoneSettings as Record<string, { targetTemperature?: number }> | undefined
      )?.[fixture.ids.livingZone]?.targetTemperature,
      locked: Object.values(current.graph.nodes).some(
        (node) =>
          node.type?.toString().startsWith('gln:') &&
          (node.locked === true ||
            (node.metadata as Record<string, unknown> | undefined)?.locked === true),
      ),
      hierarchy:
        levelHostedIds.every(
          (id) =>
            current.graph.nodes[id]?.parentId === fixture.ids.level &&
            (level?.children as string[] | undefined)?.includes(id),
        ) &&
        panel?.parentId === hostWall?.id &&
        (hostWall?.children as string[] | undefined)?.includes(fixture.ids.panel),
    }
  }

  await expect.poll(summarize).toMatchObject({
    systems: 1,
    outdoors: 1,
    tanks: 1,
    panels: 1,
    pipes: 4,
    temperature: 23,
    locked: false,
    hierarchy: true,
  })

  await page.keyboard.press('Control+z')
  await expect.poll(summarize).toMatchObject({
    systems: 0,
    outdoors: 0,
    tanks: 0,
    panels: 0,
    pipes: 0,
    locked: false,
  })

  const afterUndo = await summarize()
  const recreatePlan = {
    ...plan,
    id: 'codex-gln-configuration-recreate-e2e',
    baseVersion: afterUndo.version,
  }
  const recreate = await request.post(`${baseUrl}/api/scenes/${sceneId}/plans`, {
    data: { action: 'commit', plan: recreatePlan },
  })
  if (!recreate.ok()) {
    throw new Error(`GLN recreation failed (${recreate.status()}): ${await recreate.text()}`)
  }
  await page.reload()
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect.poll(summarize).toMatchObject({
    systems: 1,
    outdoors: 1,
    tanks: 1,
    panels: 1,
    pipes: 4,
    temperature: 23,
    locked: false,
    hierarchy: true,
  })

  const afterRecreate = await summarize()
  const rerunPlan = {
    ...plan,
    id: 'codex-gln-configuration-rerun-e2e',
    baseVersion: afterRecreate.version,
    operations: [
      {
        op: 'update',
        id: fixture.ids.system,
        data: {
          name: 'AI 再次配置住宅主系统',
          zoneSettings: {
            [fixture.ids.livingZone]: {
              ...configuredZoneSettings[fixture.ids.livingZone],
              targetTemperature: 22,
            },
          },
        },
      },
    ],
  }
  const rerun = await request.post(`${baseUrl}/api/scenes/${sceneId}/plans`, {
    data: { action: 'commit', plan: rerunPlan },
  })
  if (!rerun.ok()) {
    throw new Error(`GLN stable-ID rerun failed (${rerun.status()}): ${await rerun.text()}`)
  }
  await page.reload()
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect.poll(summarize).toMatchObject({
    systems: 1,
    outdoors: 1,
    tanks: 1,
    panels: 1,
    pipes: 4,
    temperature: 22,
    locked: false,
    hierarchy: true,
  })

  await page.getByRole('button', { name: '2D' }).click()
  await page.getByRole('button', { name: '选择 V' }).click()
  const panelEntry = page
    .locator(`.floorplan-registry-entry[data-node-id="${fixture.ids.panel}"]`)
    .first()
  await expect(panelEntry).toBeVisible()
  await panelEntry.locator('rect').click({ position: { x: 4, y: 4 } })
  await page.getByRole('button', { name: '光冷暖设备' }).click()
  await expect(page.locator('[data-gln-ai-lock]')).toBeVisible()
  await page.getByRole('button', { name: '锁定 AI 变更' }).click()
  await expect
    .poll(async () => {
      const current = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
        graph: { nodes: Record<string, { metadata?: Record<string, unknown> }> }
      }
      return current.graph.nodes[fixture.ids.panel]?.metadata?.glnLocked
    })
    .toBe(true)
  await page.getByRole('button', { name: '允许 AI 变更' }).click()
  await expect
    .poll(async () => {
      const current = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
        graph: { nodes: Record<string, { metadata?: Record<string, unknown> }> }
      }
      return current.graph.nodes[fixture.ids.panel]?.metadata?.glnLocked
    })
    .toBe(false)
})
