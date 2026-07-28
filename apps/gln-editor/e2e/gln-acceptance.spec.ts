import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import {
  type AcceptanceGraph,
  createLargeAcceptanceGraph,
  createTwoLevelTwoSystemGraph,
} from './acceptance-fixtures'

const glnBaseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'
const editorBaseUrl = process.env.EDITOR_E2E_BASE_URL ?? 'http://localhost:32102'

type StoredScene = {
  graph: AcceptanceGraph
  id: string
  name: string
  nodeCount: number
  version: number
}

async function createScene(
  request: APIRequestContext,
  baseUrl: string,
  name: string,
  graph: AcceptanceGraph,
) {
  const response = await request.post(`${baseUrl}/api/scenes`, { data: { name, graph } })
  if (!response.ok()) {
    throw new Error(`Scene creation failed (${response.status()}): ${await response.text()}`)
  }
  return (await response.json()) as { id: string; version: number }
}

async function fetchScene(request: APIRequestContext, baseUrl: string, sceneId: string) {
  const response = await request.get(`${baseUrl}/api/scenes/${sceneId}`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as StoredScene
}

async function expectPanelFitsViewport(page: Page, selector: string) {
  const panel = page.locator(selector)
  await expect(panel).toBeVisible()
  const metrics = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        'button, input:not([type="checkbox"]):not([type="radio"]), select, textarea',
      ),
    )
      .filter(
        (control) =>
          control.offsetParent !== null &&
          control.getBoundingClientRect().width >= 8 &&
          control.getBoundingClientRect().height >= 8,
      )
      .map((control) => {
        const bounds = control.getBoundingClientRect()
        return {
          clientWidth: control.clientWidth,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right,
          scrollWidth: control.scrollWidth,
          top: bounds.top,
        }
      })
    return {
      clientWidth: element.clientWidth,
      controls,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      rect: {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      },
      scrollWidth: element.scrollWidth,
    }
  })
  expect(metrics.rect.left).toBeGreaterThanOrEqual(0)
  expect(metrics.rect.right).toBeLessThanOrEqual(metrics.innerWidth + 1)
  expect(metrics.rect.top).toBeGreaterThanOrEqual(0)
  expect(metrics.rect.bottom).toBeLessThanOrEqual(metrics.innerHeight + 1)
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  for (const control of metrics.controls) {
    expect(control.left).toBeGreaterThanOrEqual(metrics.rect.left - 1)
    expect(control.right).toBeLessThanOrEqual(metrics.rect.right + 1)
    expect(control.top).toBeGreaterThanOrEqual(metrics.rect.top - 1)
    expect(control.height).toBeGreaterThan(0)
    expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth + 2)
  }
}

test('acceptance: persists two independent systems across two levels and previews scientific directions', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(240_000)
  const fixture = createTwoLevelTwoSystemGraph()
  const created = await createScene(request, glnBaseUrl, '双层双系统验收住宅', fixture.graph)

  await page.goto(`${glnBaseUrl}/scene/${created.id}`)
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-pascal-hydrated', 'true')
  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await expect(page.locator('[data-gln-systems-panel]')).toBeVisible()

  const lowerSystem = page.locator(`[data-gln-system-id="${fixture.lower.ids.system}"]`)
  const upperSystem = page.locator(`[data-gln-system-id="${fixture.upper.ids.system}"]`)
  await expect(lowerSystem.getByRole('textbox', { name: '系统名称' })).toHaveValue('首层制冷系统')
  await expect(upperSystem.getByRole('textbox', { name: '系统名称' })).toHaveValue('二层制热系统')
  await upperSystem.getByRole('textbox', { name: '系统名称' }).fill('二层独立制热系统')
  await upperSystem.getByRole('textbox', { name: '系统名称' }).press('Enter')
  const upperTarget = upperSystem.getByRole('textbox', { name: '客厅目标温度' })
  await upperTarget.fill('21')
  await upperTarget.press('Enter')

  await expect
    .poll(async () => {
      const scene = await fetchScene(request, glnBaseUrl, created.id)
      const system = scene.graph.nodes[fixture.upper.ids.system]
      const settings = system?.zoneSettings as
        | Record<string, { targetTemperature?: number }>
        | undefined
      return {
        name: system?.name,
        targetTemperature: settings?.[fixture.upper.ids.livingZone]?.targetTemperature,
      }
    })
    .toEqual({ name: '二层独立制热系统', targetTemperature: 21 })

  const stored = await fetchScene(request, glnBaseUrl, created.id)
  const levels = Object.values(stored.graph.nodes).filter((node) => node.type === 'level')
  const systems = Object.values(stored.graph.nodes).filter((node) => node.type === 'gln:system')
  expect(levels.map((level) => level.level).sort()).toEqual([0, 1])
  expect(systems).toHaveLength(2)
  for (const pipe of Object.values(stored.graph.nodes).filter(
    (node) => node.type === 'gln:hydronic-pipe',
  )) {
    const start = pipe.start as { nodeId: string }
    const end = pipe.end as { nodeId: string }
    expect(stored.graph.nodes[start.nodeId]?.systemId).toBe(pipe.systemId)
    expect(stored.graph.nodes[end.nodeId]?.systemId).toBe(pipe.systemId)
  }

  await page.getByRole('button', { name: '光冷暖设备' }).click()
  await page.getByRole('button', { name: '运行预览' }).click()
  await expect(page.locator('[data-gln-run-preview]')).toBeVisible()
  await expect(page.getByText('夏季：空间 → 面板')).toBeVisible()
  await expect(page.getByText('冬季：面板 → 空间')).toBeVisible()
  await expect(page.getByText('目标温度：21°C')).toBeVisible()
  await expect(page.getByText(/实时温湿度、流量、负荷或设备性能/)).toBeVisible()
  await expect(page.getByText(/送风|风速|实时流量|实时温度/)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('two-level-two-system-preview.png') })

  await page.goto(page.url(), { timeout: 120_000, waitUntil: 'commit' })
  await page.getByRole('button', { name: '光冷暖系统' }).click()
  await expect(
    page
      .locator(`[data-gln-system-id="${fixture.upper.ids.system}"]`)
      .getByRole('textbox', { name: '系统名称' }),
  ).toHaveValue('二层独立制热系统')
  await expect(
    page
      .locator(`[data-gln-system-id="${fixture.upper.ids.system}"]`)
      .getByRole('textbox', { name: '客厅目标温度' }),
  ).toHaveValue('21')
})

test('acceptance: rejected plans leave the persisted graph and version untouched', async ({
  request,
}) => {
  const fixture = createTwoLevelTwoSystemGraph().lower
  const graph = {
    ...(structuredClone(fixture.graph) as AcceptanceGraph),
    installedPlugins: ['pascal:gln'],
  }
  const lockedOutdoor = graph.nodes[fixture.ids.outdoor]!
  lockedOutdoor.metadata = { ...(lockedOutdoor.metadata ?? {}), glnLocked: true }
  const created = await createScene(request, glnBaseUrl, '失败计划原子性验收', graph)
  const baseline = await fetchScene(request, glnBaseUrl, created.id)

  const cases = [
    {
      expectedCode: 'version-conflict',
      id: 'acceptance-stale-version',
      baseVersion: baseline.version - 1,
      operation: {
        op: 'update',
        id: fixture.ids.system,
        data: { name: '不应提交的旧版本名称' },
      },
    },
    {
      expectedCode: 'locked-node',
      id: 'acceptance-locked-node',
      baseVersion: baseline.version,
      operation: {
        op: 'update',
        id: fixture.ids.outdoor,
        data: { position: [2, 0, 2] },
      },
    },
    {
      expectedCode: 'gln-topology-orphaned-endpoint',
      id: 'acceptance-disconnected-topology',
      baseVersion: baseline.version,
      operation: {
        op: 'update',
        id: fixture.ids.pipes[0],
        data: { end: null },
      },
    },
    {
      expectedCode: 'gln-installation-area-kind-invalid',
      id: 'acceptance-illegal-installation',
      baseVersion: baseline.version,
      operation: {
        op: 'update',
        id: fixture.ids.tank,
        data: { installationAreaKind: 'outdoor-equipment-area' },
      },
    },
  ] as const

  for (const entry of cases) {
    const response = await request.post(`${glnBaseUrl}/api/scenes/${created.id}/plans`, {
      data: {
        action: 'commit',
        plan: {
          id: entry.id,
          sceneId: created.id,
          baseVersion: entry.baseVersion,
          operations: [entry.operation],
        },
      },
    })
    expect(response.status()).toBe(422)
    const payload = (await response.json()) as { issues: Array<{ code: string }> }
    expect(payload.issues.map((issue) => issue.code)).toContain(entry.expectedCode)
    const after = await fetchScene(request, glnBaseUrl, created.id)
    expect(after.version).toBe(baseline.version)
    expect(after.graph).toEqual(baseline.graph)
  }
})

test('acceptance: Chinese GLN panels fit the target desktop viewport', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(240_000)
  const fixture = createTwoLevelTwoSystemGraph()
  const created = await createScene(request, glnBaseUrl, '中文桌面布局验收', fixture.graph)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${glnBaseUrl}/scene/${created.id}`)
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()

  const panels = [
    ['光冷暖系统', '[data-gln-systems-panel]'],
    ['光冷暖设备', '[data-gln-equipment-panel]'],
    ['AI 场景任务', '[data-gln-codex-task-panel]'],
    ['变更计划', '[data-gln-scene-plan-panel]'],
    ['住宅导入', '[data-gln-residential-import-panel]'],
  ] as const
  for (const [buttonName, selector] of panels) {
    const button = page.getByRole('button', { name: buttonName, exact: true })
    await expect(button).toBeVisible()
    await button.evaluate((element) => (element as HTMLButtonElement).click())
    await expectPanelFitsViewport(page, selector)
    const text = await page.locator(selector).innerText()
    expect(text).not.toMatch(
      /\b(?:Actions|Delete|Dimensions|Height|Length|Move|Place|Position|Preferences|Search|Show|Thickness)\b/,
    )
  }
  await page.screenshot({ path: testInfo.outputPath('gln-zh-desktop-layout.png') })
})

test('acceptance: large residence selection, move, and preview stay within the smoke baseline', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(240_000)
  const fixture = createLargeAcceptanceGraph()
  const created = await createScene(request, glnBaseUrl, '大型住宅性能验收', fixture.graph)
  const stored = await fetchScene(request, glnBaseUrl, created.id)
  expect(fixture.wallCount).toBe(512)
  expect(stored.nodeCount).toBeGreaterThan(540)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${glnBaseUrl}/scene/${created.id}`)
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.locator('[class*="pascal-loader-"]')).toHaveCount(0, { timeout: 120_000 })
  const twoDimensionalView = page.getByRole('button', { name: '2D' })
  await twoDimensionalView.evaluate((element) => (element as HTMLButtonElement).click())
  await expect(twoDimensionalView).toHaveAttribute('aria-pressed', 'true')
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()
  await page.getByRole('button', { name: '选择 V' }).click()
  const entry = page
    .locator(`.floorplan-registry-entry[data-node-id="${fixture.measuredNodeId}"]`)
    .first()
  await expect(entry).toBeVisible()

  const selectionStarted = Date.now()
  const entryBounds = await entry.boundingBox()
  if (!entryBounds) throw new Error('Measured GLN node has no clickable bounds')
  await page.mouse.click(
    entryBounds.x + entryBounds.width / 2,
    entryBounds.y + entryBounds.height / 2,
  )
  await expect(page.locator('button[aria-label="移动"]')).toBeVisible()
  const selectionMs = Date.now() - selectionStarted

  const beforeMove = stored.graph.nodes[fixture.measuredNodeId]?.position
  const moveStarted = Date.now()
  await page.locator('button[aria-label="移动"]').click()
  const bounds = await floorplan.boundingBox()
  if (!bounds) throw new Error('2D floor plan has no measurable bounds')
  const targetX = bounds.x + bounds.width * 0.44
  const targetY = bounds.y + bounds.height * 0.42
  await page.mouse.move(targetX - 60, targetY + 35)
  await page.mouse.move(targetX, targetY, { steps: 4 })
  await page.mouse.click(targetX, targetY)
  await expect
    .poll(
      async () =>
        JSON.stringify(
          (await fetchScene(request, glnBaseUrl, created.id)).graph.nodes[fixture.measuredNodeId]
            ?.position,
        ),
      { timeout: 10_000 },
    )
    .not.toBe(JSON.stringify(beforeMove))
  const moveMs = Date.now() - moveStarted

  await page.getByRole('button', { name: '光冷暖设备' }).click()
  const previewStarted = Date.now()
  await page.getByRole('button', { name: '运行预览' }).click()
  await expect(page.locator('[data-gln-run-preview]')).toBeVisible()
  await expect(page.getByText('夏季：空间 → 面板')).toBeVisible()
  const previewMs = Date.now() - previewStarted

  expect(selectionMs).toBeLessThan(3_000)
  expect(moveMs).toBeLessThan(5_000)
  expect(previewMs).toBeLessThan(3_000)
  await testInfo.attach('performance.json', {
    body: JSON.stringify(
      {
        nodeCount: stored.nodeCount,
        previewMs,
        selectionMs,
        moveMs,
        viewport: '1440x900',
        wallCount: fixture.wallCount,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})

test('acceptance: original Editor keeps its normal edit, undo, save, and reload path', async ({
  page,
  request,
}) => {
  test.setTimeout(420_000)
  await page.goto(`${editorBaseUrl}/scenes`)
  await expect(page.getByRole('heading', { name: '我的场景' })).toBeVisible()
  const createButton = page.getByRole('button', { name: '新建场景' }).first()
  await page.waitForFunction(() => localStorage.getItem('pascal.locale') !== null, null, {
    timeout: 120_000,
  })
  const createResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === 'POST' &&
      url.origin === new URL(editorBaseUrl).origin &&
      url.pathname === '/api/scenes'
    )
  })
  await createButton.dispatchEvent('click')
  const createResponse = await createResponsePromise
  expect(createResponse.status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/, { timeout: 60_000 })
  const sceneId = new URL(page.url()).pathname.split('/').at(-1)!
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect(page.locator('[data-gln-client-node-types]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '光冷暖系统' })).toHaveCount(0)
  await expect(page.locator('[class*="pascal-loader-"]')).toHaveCount(0, { timeout: 120_000 })

  const twoDimensionalView = page.getByRole('button', { name: '2D' })
  await twoDimensionalView.evaluate((element) => (element as HTMLButtonElement).click())
  await expect(twoDimensionalView).toHaveAttribute('aria-pressed', 'true')
  const floorplan = page.locator('svg.touch-none')
  await expect(floorplan).toBeVisible()
  const bounds = await floorplan.boundingBox()
  if (!bounds) throw new Error('Original Editor floor plan has no measurable bounds')
  await page.keyboard.press('b')
  await page.keyboard.press('c')
  await expect(page.getByRole('button', { name: /单段墙体/ })).toBeVisible()
  await floorplan.dispatchEvent('click', {
    clientX: bounds.x + bounds.width * 0.38,
    clientY: bounds.y + bounds.height * 0.5,
    detail: 1,
  })
  await expect(page.locator('[data-floorplan-wall-draft-active="true"]')).toBeAttached()
  await floorplan.dispatchEvent('click', {
    clientX: bounds.x + bounds.width * 0.62,
    clientY: bounds.y + bounds.height * 0.5,
    detail: 1,
  })

  const wallCount = async () =>
    Object.values((await fetchScene(request, editorBaseUrl, sceneId)).graph.nodes).filter(
      (node) => node.type === 'wall',
    ).length
  await expect.poll(wallCount).toBe(1)
  await page.keyboard.press('Control+z')
  await expect.poll(wallCount).toBe(0)
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(wallCount).toBe(1)
  const sceneUrl = page.url()
  const browserContext = page.context()
  await page.close()
  page = await browserContext.newPage()
  await page.goto(sceneUrl, { timeout: 120_000, waitUntil: 'commit' })
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()
  await expect.poll(wallCount).toBe(1)

  const originalScenes = (await (await request.get(`${editorBaseUrl}/api/scenes`)).json()) as {
    scenes: Array<{ id: string }>
  }
  const glnScenes = (await (await request.get(`${glnBaseUrl}/api/scenes`)).json()) as {
    scenes: Array<{ id: string }>
  }
  expect(originalScenes.scenes.some((scene) => scene.id === sceneId)).toBe(true)
  expect(glnScenes.scenes.some((scene) => scene.id === sceneId)).toBe(false)
  expect(await (await request.get(`${editorBaseUrl}/api/health`)).json()).toMatchObject({
    app: 'editor',
    status: 'ok',
  })
})
