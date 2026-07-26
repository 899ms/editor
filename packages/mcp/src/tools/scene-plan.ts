import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ScenePlanSchema } from '@pascal-app/core/scene-plan'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'

const issueSchema = z.object({
  severity: z.enum(['error', 'warning']),
  code: z.string(),
  message: z.string(),
  nodeIds: z.array(z.string()).optional(),
  operationIndex: z.number().optional(),
  validatorId: z.string().optional(),
})

const diffSchema = z.object({
  kind: z.enum(['create', 'move', 'update', 'delete']),
  nodeId: z.string(),
  nodeType: z.string(),
  changedFields: z.array(z.string()),
})

const preparedOutput = {
  ok: z.boolean(),
  planId: z.string(),
  sceneId: z.string(),
  baseVersion: z.number(),
  diffs: z.array(diffSchema),
  issues: z.array(issueSchema),
}

const commitOutput = {
  ...preparedOutput,
  committed: z.boolean(),
  preCheckpointVersion: z.number().nullable(),
  postCheckpointVersion: z.number().nullable(),
  eventPublished: z.boolean(),
}

function summarizePrepared(prepared: Awaited<ReturnType<SceneOperations['prepareScenePlan']>>) {
  return {
    ok: prepared.ok,
    planId: prepared.plan.id,
    sceneId: prepared.plan.sceneId,
    baseVersion: prepared.plan.baseVersion,
    diffs: prepared.diffs.map(({ kind, nodeId, nodeType, changedFields }) => ({
      kind,
      nodeId,
      nodeType,
      changedFields,
    })),
    issues: prepared.issues,
  }
}

export function registerScenePlanTools(server: McpServer, operations: SceneOperations): void {
  server.registerTool(
    'prepare_scene_plan',
    {
      title: 'Prepare scene plan',
      description:
        'Validate a version-bound ScenePlan and return its non-mutating create/move/update/delete preview.',
      inputSchema: { plan: ScenePlanSchema },
      outputSchema: preparedOutput,
    },
    async ({ plan }) => {
      try {
        const payload = summarizePrepared(await operations.prepareScenePlan(plan))
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
          structuredContent: payload,
        }
      } catch (error) {
        throwMcpError(
          ErrorCode.InvalidRequest,
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )

  server.registerTool(
    'commit_scene_plan',
    {
      title: 'Commit scene plan',
      description:
        'Revalidate and atomically commit a prepared ScenePlan. The versioned before/after graphs become recovery checkpoints.',
      inputSchema: { plan: ScenePlanSchema },
      outputSchema: commitOutput,
    },
    async ({ plan }) => {
      try {
        const result = await operations.commitScenePlan(plan)
        const payload = {
          ...summarizePrepared(result.prepared),
          committed: result.committed,
          preCheckpointVersion: result.preCheckpointVersion,
          postCheckpointVersion: result.postCheckpointVersion,
          eventPublished: result.eventPublished,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
          structuredContent: payload,
        }
      } catch (error) {
        throwMcpError(
          ErrorCode.InvalidRequest,
          error instanceof Error ? error.message : String(error),
        )
      }
    },
  )
}
