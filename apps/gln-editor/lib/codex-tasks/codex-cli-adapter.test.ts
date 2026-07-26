import { expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import type { ScenePlan } from '@pascal-app/core/scene-plan'
import {
  type CodexProcessInvocation,
  type CodexProcessLauncher,
  createCodexCliAdapter,
} from './codex-cli-adapter'

test('launches only the fixed local Codex command in an isolated read-only workspace', async () => {
  const plan: ScenePlan = {
    id: 'codex-cli-plan',
    sceneId: 'scene-cli',
    baseVersion: 3,
    operations: [
      {
        op: 'update',
        id: 'gln_system_cli',
        data: { name: '本地 Codex 计划' },
      },
    ],
  }
  let invocation: CodexProcessInvocation | null = null
  const launcher: CodexProcessLauncher = {
    async run(input) {
      invocation = input
      await fs.writeFile(input.outputPath, JSON.stringify(plan), 'utf8')
      return { exitCode: 0, stderr: '' }
    },
  }
  const adapter = createCodexCliAdapter({
    launcher,
    env: {
      PATH: process.env.PATH,
      OPENAI_API_KEY: 'must-not-reach-child',
      CODEX_HOME: process.env.CODEX_HOME,
    },
  })

  const output = await adapter.generate({
    taskId: 'task-cli',
    request: {
      kind: 'configure-gln',
      sceneId: 'scene-cli',
      brief: '配置一套系统',
    },
    snapshot: {
      id: 'scene-cli',
      name: '住宅',
      projectId: null,
      thumbnailUrl: null,
      version: 3,
      createdAt: '2026-07-26T00:00:00.000Z',
      updatedAt: '2026-07-26T00:00:00.000Z',
      ownerId: null,
      sizeBytes: 0,
      nodeCount: 0,
      graph: { nodes: {}, rootNodeIds: [] },
    },
    signal: new AbortController().signal,
    reportProgress() {},
  })

  expect(output).toEqual(plan)
  expect(invocation?.command).toBe('codex')
  expect(invocation?.args.slice(0, 2)).toEqual(['exec', '-'])
  expect(invocation?.args).toContain('read-only')
  expect(invocation?.args).toContain('--ephemeral')
  expect(invocation?.args).toContain('--ignore-user-config')
  expect(invocation?.args).toContain('--ignore-rules')
  expect(invocation?.args).not.toContain('--dangerously-bypass-approvals-and-sandbox')
  expect(invocation?.env.OPENAI_API_KEY).toBeUndefined()
  expect(invocation?.cwd).not.toContain('pascal-editor')
  expect(invocation?.stdin).toContain('只返回符合给定 JSON Schema 的 ScenePlan')
})
