import { expect, test } from '@playwright/test'

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
  await page.getByRole('button', { name: '发送到变更计划' }).click()

  await page.getByRole('button', { name: '变更计划', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '计划输入' })).toHaveValue(
    JSON.stringify(plan, null, 2),
  )
  await expect(page.getByText('已接收本地 Codex 生成的场景计划。')).toBeVisible()
})
