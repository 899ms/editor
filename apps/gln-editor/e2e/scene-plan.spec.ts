import { expect, test } from '@playwright/test'

const baseUrl = process.env.GLN_E2E_BASE_URL ?? 'http://127.0.0.1:32103'

test('previews and atomically commits one version-bound ScenePlan with one undo step', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)
  await page.goto(`${baseUrl}/scenes`)
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${baseUrl}/api/scenes`,
  )
  await page.getByRole('button', { name: '新建场景' }).first().dispatchEvent('click')
  expect((await createResponsePromise).status()).toBe(201)
  await expect(page).toHaveURL(/\/scene\/[^/]+$/)
  await expect(page.locator('[data-pascal-viewer-3d] canvas')).toBeVisible()

  const sceneId = new URL(page.url()).pathname.split('/').at(-1)!
  let stableReads = 0
  let latestVersion = -1
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
  const initial = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
    version: number
    graph: { nodes: Record<string, { id: string; type: string; name?: string }> }
  }
  const level = Object.values(initial.graph.nodes).find((node) => node.type === 'level')
  if (!level) throw new Error('Default GLN scene has no level')
  const originalName = level.name
  const plan = {
    id: 'e2e-level-rename',
    sceneId,
    baseVersion: initial.version,
    operations: [{ op: 'update', id: level.id, data: { name: '计划提交后的楼层' } }],
  }

  const stale = await request.post(`${baseUrl}/api/scenes/${sceneId}/plans`, {
    data: { action: 'commit', plan: { ...plan, baseVersion: initial.version - 1 } },
  })
  expect(stale.status()).toBe(422)
  expect(
    ((await stale.json()) as { issues: Array<{ code: string }> }).issues.map((issue) => issue.code),
  ).toContain('version-conflict')
  expect(
    ((await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as { version: number })
      .version,
  ).toBe(initial.version)

  await page.getByRole('button', { name: '变更计划' }).click()
  await expect(page.locator('[data-gln-scene-plan-panel]')).toBeVisible()
  await page.getByRole('textbox', { name: '计划输入' }).fill(JSON.stringify(plan))
  await page.getByRole('button', { name: '校验并生成差异预览' }).click()
  const preview = page.locator('[data-gln-scene-plan-preview]')
  await expect(preview).toBeVisible()
  await expect(preview.locator('[data-diff-kind="update"]')).toContainText(level.id)
  await expect(preview.locator('[data-gln-scene-plan-issues]')).toHaveCount(0)

  await page.getByRole('button', { name: '确认并一次提交' }).click()
  await expect(page.getByText(/已原子提交；恢复点/)).toBeVisible()
  await expect
    .poll(async () => {
      const scene = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
        version: number
        graph: { nodes: Record<string, { name?: string }> }
      }
      return { version: scene.version, name: scene.graph.nodes[level.id]?.name }
    })
    .toEqual({ version: initial.version + 1, name: '计划提交后的楼层' })

  await page.keyboard.press('Control+z')
  await expect
    .poll(
      async () => {
        const scene = (await (await request.get(`${baseUrl}/api/scenes/${sceneId}`)).json()) as {
          graph: { nodes: Record<string, { name?: string }> }
        }
        return scene.graph.nodes[level.id]?.name
      },
      { timeout: 15_000 },
    )
    .toBe(originalName)
})
