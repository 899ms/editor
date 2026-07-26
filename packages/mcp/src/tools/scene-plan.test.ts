import { beforeEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SiteNode } from '@pascal-app/core/schema'
import type { SceneOperations } from '../operations'
import { createTestSceneOperations, parseToolText } from './scene-lifecycle/test-utils'
import { registerScenePlanTools } from './scene-plan'

describe('ScenePlan MCP tools', () => {
  let client: Client
  let operations: SceneOperations
  let sceneId: string
  let version: number
  let siteId: string

  beforeEach(async () => {
    const runtime = createTestSceneOperations()
    operations = runtime.operations
    const site = SiteNode.parse({ id: 'site_mcp_plan', name: '提交前', children: [] })
    const meta = await runtime.store.save({
      id: 'mcp-plan-home',
      name: 'MCP 计划住宅',
      graph: { nodes: { [site.id]: site }, rootNodeIds: [site.id] },
    })
    runtime.bridge.setScene({ [site.id]: site }, [site.id])
    runtime.bridge.setActiveScene(meta)
    runtime.bridge.clearHistory()
    sceneId = meta.id
    version = meta.version
    siteId = site.id

    const server = new McpServer({ name: 'scene-plan-test', version: '0.0.0' })
    registerScenePlanTools(server, operations)
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'scene-plan-client', version: '0.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  test('previews and commits through the same SceneOperations path', async () => {
    const plan = {
      id: 'mcp-rename',
      sceneId,
      baseVersion: version,
      operations: [{ op: 'update', id: siteId, data: { name: '提交后' } }],
    }
    const preview = await client.callTool({
      name: 'prepare_scene_plan',
      arguments: { plan },
    })
    const previewPayload = parseToolText(preview.content as never)
    expect(previewPayload.ok).toBe(true)
    expect(previewPayload.diffs).toEqual([
      {
        kind: 'update',
        nodeId: siteId,
        nodeType: 'site',
        changedFields: ['name'],
      },
    ])
    expect(operations.getNode(siteId)?.name).toBe('提交前')

    const commit = await client.callTool({
      name: 'commit_scene_plan',
      arguments: { plan },
    })
    const commitPayload = parseToolText(commit.content as never)
    expect(commitPayload.committed).toBe(true)
    expect(commitPayload.preCheckpointVersion).toBe(1)
    expect(commitPayload.postCheckpointVersion).toBe(2)
    expect(operations.getNode(siteId)?.name).toBe('提交后')
    expect(operations.getHistory()).toEqual({ pastCount: 1, futureCount: 0 })
  })
})
