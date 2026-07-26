import { afterEach, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SiteNode } from '@pascal-app/core/schema'
import { createSceneOperations } from '@pascal-app/mcp/operations'
import { SqliteSceneStore } from '@pascal-app/mcp/storage'
import { createCodexTaskManager } from './codex-task-manager'
import { registerGlnCodexTaskTools } from './codex-task-tools'
import { createDeterministicCodexAdapter } from './deterministic-adapter'

let root = ''
let store: SqliteSceneStore | null = null

afterEach(async () => {
  store?.close()
  store = null
  if (root) await fs.rm(root, { recursive: true, force: true })
  root = ''
})

test('MCP submits and reads the same validated task workflow without an online model', async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'gln-codex-mcp-'))
  store = new SqliteSceneStore({ databasePath: path.join(root, 'tasks.db') })
  const site = SiteNode.parse({ id: 'site_codex_mcp', children: [] })
  const meta = await store.save({
    id: 'scene-codex-mcp',
    name: '住宅',
    graph: { nodes: { [site.id]: site }, rootNodeIds: [site.id] },
  })
  const operations = createSceneOperations({ store })
  const manager = createCodexTaskManager({
    operations,
    adapter: createDeterministicCodexAdapter({
      id: 'mcp-codex-plan',
      sceneId: meta.id,
      baseVersion: meta.version,
      operations: [{ op: 'update', id: site.id, data: { name: 'MCP 重建' } }],
    }),
    createId: () => 'task-mcp-codex',
  })
  const server = new McpServer({ name: 'gln-codex-test', version: '0.0.0' })
  registerGlnCodexTaskTools(server, manager)
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'gln-codex-client', version: '0.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  const submitted = await client.callTool({
    name: 'submit_gln_codex_task',
    arguments: {
      sceneId: meta.id,
      kind: 'reconstruct-home',
      brief: '重建可编辑住宅',
    },
  })
  expect(parseToolText(submitted.content as never).id).toBe('task-mcp-codex')

  await manager.waitForTerminal('task-mcp-codex')
  const status = await client.callTool({
    name: 'get_gln_codex_task',
    arguments: { taskId: 'task-mcp-codex' },
  })
  const payload = parseToolText(status.content as never)
  expect(payload.status).toBe('succeeded')
  expect(payload.plan.id).toBe('mcp-codex-plan')
  expect((await operations.loadStoredScene(meta.id))?.version).toBe(1)
})

function parseToolText(content: Array<{ type: string; text?: string }>): any {
  const text = content.find((item) => item.type === 'text')?.text
  if (!text) throw new Error('missing tool text')
  return JSON.parse(text)
}
