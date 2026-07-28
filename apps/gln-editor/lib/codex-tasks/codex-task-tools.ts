import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CodexTaskManager } from './codex-task-manager'
import { publicCodexTask } from './codex-task-server'
import {
  CodexSourceContextSchema,
  CodexTaskKindSchema,
  CodexTaskRequestSchema,
  GlnConfigurationRequestSchema,
} from './schema'

export function registerGlnCodexTaskTools(server: McpServer, manager: CodexTaskManager): void {
  server.registerTool(
    'submit_gln_codex_task',
    {
      title: '提交 GLN Codex 任务',
      description:
        '提交白名单住宅重建、光冷暖配置或修复任务。返回任务 ID；ScenePlan 只生成预览，不直接提交。',
      inputSchema: {
        sceneId: CodexTaskRequestSchema.shape.sceneId,
        kind: CodexTaskKindSchema,
        brief: CodexTaskRequestSchema.shape.brief,
        source: CodexSourceContextSchema.optional(),
        glnConfiguration: GlnConfigurationRequestSchema.optional(),
      },
    },
    async (input) => toolResult(publicCodexTask(manager.submit(input))),
  )

  server.registerTool(
    'get_gln_codex_task',
    {
      title: '查询 GLN Codex 任务',
      description: '读取任务进度、安全错误信息和已校验的 ScenePlan 预览。',
      inputSchema: { taskId: z.string().min(1) },
    },
    async ({ taskId }) => {
      const task = manager.get(taskId)
      return task
        ? toolResult(publicCodexTask(task))
        : toolError('codex_task_not_found', '找不到任务。')
    },
  )

  server.registerTool(
    'cancel_gln_codex_task',
    {
      title: '取消 GLN Codex 任务',
      description: '取消排队或正在运行的本地 Codex 任务。',
      inputSchema: { taskId: z.string().min(1) },
    },
    async ({ taskId }) => {
      const task = manager.cancel(taskId)
      return task
        ? toolResult(publicCodexTask(task))
        : toolError('codex_task_not_found', '找不到任务。')
    },
  )
}

function toolResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  }
}

function toolError(code: string, message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }],
  }
}
