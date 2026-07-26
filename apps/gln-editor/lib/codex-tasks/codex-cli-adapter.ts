import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { ScenePlanSchema } from '@pascal-app/core/scene-plan'
import { z } from 'zod'
import type { CodexScenePlanAdapter } from './codex-task-manager'

export type CodexProcessInvocation = {
  command: 'codex'
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  stdin: string
  outputPath: string
  signal: AbortSignal
}

export interface CodexProcessLauncher {
  run(input: CodexProcessInvocation): Promise<{ exitCode: number; stderr: string }>
}

export type CreateCodexCliAdapterOptions = {
  launcher?: CodexProcessLauncher
  env?: NodeJS.ProcessEnv
}

const MAX_SCENE_CONTEXT_BYTES = 1_000_000
const SAFE_ENV_KEYS = [
  'PATH',
  'Path',
  'PATHEXT',
  'CODEX_HOME',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
  'SystemRoot',
  'WINDIR',
  'COMSPEC',
] as const

export function createCodexCliAdapter(
  options: CreateCodexCliAdapterOptions = {},
): CodexScenePlanAdapter {
  const launcher = options.launcher ?? nodeProcessLauncher
  const sourceEnv = options.env ?? process.env

  return {
    async generate({ taskId, request, snapshot, signal, reportProgress }) {
      const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gln-codex-'))
      const schemaPath = path.join(workspace, 'scene-plan.schema.json')
      const outputPath = path.join(workspace, 'scene-plan.json')
      try {
        const sceneContext = JSON.stringify({
          id: snapshot.id,
          version: snapshot.version,
          graph: snapshot.graph,
        })
        if (Buffer.byteLength(sceneContext, 'utf8') > MAX_SCENE_CONTEXT_BYTES) {
          throw new Error('scene_context_too_large')
        }
        await fs.writeFile(
          schemaPath,
          JSON.stringify(z.toJSONSchema(ScenePlanSchema), null, 2),
          'utf8',
        )
        reportProgress(30)
        const args = [
          'exec',
          '-',
          '--sandbox',
          'read-only',
          '--skip-git-repo-check',
          '--ephemeral',
          '--ignore-user-config',
          '--ignore-rules',
          '--output-schema',
          schemaPath,
          '--output-last-message',
          outputPath,
          '--color',
          'never',
          '-C',
          workspace,
        ]
        const result = await launcher.run({
          command: 'codex',
          args,
          cwd: workspace,
          env: safeChildEnvironment(sourceEnv),
          stdin: buildPrompt(taskId, request, sceneContext),
          outputPath,
          signal,
        })
        if (result.exitCode !== 0) throw new Error('codex_cli_failed')
        reportProgress(75)
        const raw = await fs.readFile(outputPath, 'utf8')
        return JSON.parse(raw) as unknown
      } finally {
        await fs.rm(workspace, { recursive: true, force: true })
      }
    },
  }
}

function safeChildEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: source.NODE_ENV ?? 'production' }
  for (const key of SAFE_ENV_KEYS) {
    if (source[key] !== undefined) env[key] = source[key]
  }
  return env
}

function buildPrompt(
  taskId: string,
  request: Parameters<CodexScenePlanAdapter['generate']>[0]['request'],
  sceneContext: string,
): string {
  const sourceContext = request.source
    ? {
        kind: request.source.kind,
        summary: request.source.summary,
        originalUploadAuthorized: request.source.uploadOriginal === true,
      }
    : null
  return [
    '你是 GLN Editor 的受限场景规划器。',
    '只返回符合给定 JSON Schema 的 ScenePlan，不要返回 Markdown。',
    '不得执行命令、调用工具、读写文件、修改仓库或请求密钥。',
    '所有变更必须是正常可编辑的 Pascal 场景节点。',
    'configure-gln 和 repair-gln 只能修改 gln:* 节点，不能修改住宅结构。',
    `任务 ID：${taskId}`,
    `任务类型：${request.kind}`,
    `用户目标：${request.brief}`,
    `来源摘要：${JSON.stringify(sourceContext)}`,
    `当前场景：${sceneContext}`,
  ].join('\n')
}

const nodeProcessLauncher: CodexProcessLauncher = {
  run(input) {
    return new Promise((resolve, reject) => {
      const child = spawn(input.command, input.args, {
        cwd: input.cwd,
        env: input.env,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'pipe'],
      })
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length < 16_384) stderr += chunk
      })
      const abort = () => child.kill()
      input.signal.addEventListener('abort', abort, { once: true })
      child.once('error', reject)
      child.once('close', (code) => {
        input.signal.removeEventListener('abort', abort)
        resolve({ exitCode: code ?? 1, stderr })
      })
      child.stdin.end(input.stdin)
    })
  },
}
