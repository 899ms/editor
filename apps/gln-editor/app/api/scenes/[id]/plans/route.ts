import { ScenePlanSchema } from '@pascal-app/core/scene-plan'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { guardSceneApiRequest, sceneApiJson, sceneApiPreflight } from '@/lib/scene-api-security'
import { getSceneOperations } from '@/lib/scene-store-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const requestSchema = z.object({
  action: z.enum(['prepare', 'commit']),
  plan: ScenePlanSchema,
})

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

function preparedPayload(
  prepared: Awaited<ReturnType<Awaited<ReturnType<typeof getSceneOperations>>['prepareScenePlan']>>,
) {
  return {
    ok: prepared.ok,
    plan: prepared.plan,
    diffs: prepared.diffs.map(({ kind, nodeId, nodeType, changedFields }) => ({
      kind,
      nodeId,
      nodeType,
      changedFields,
    })),
    issues: prepared.issues,
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return sceneApiJson(request, { error: 'invalid_request' }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }
  const { id } = await params
  if (parsed.data.plan.sceneId !== id) {
    return sceneApiJson(request, { error: 'scene_mismatch' }, { status: 409 })
  }

  const operations = await getSceneOperations()
  try {
    if (parsed.data.action === 'prepare') {
      const prepared = await operations.prepareScenePlan(parsed.data.plan)
      return sceneApiJson(request, preparedPayload(prepared))
    }
    const result = await operations.commitScenePlan(parsed.data.plan)
    return sceneApiJson(
      request,
      {
        ...preparedPayload(result.prepared),
        committed: result.committed,
        meta: result.meta,
        preCheckpointVersion: result.preCheckpointVersion,
        postCheckpointVersion: result.postCheckpointVersion,
        eventPublished: result.eventPublished,
        graph: result.committed ? result.prepared.after?.graph : undefined,
      },
      { status: result.committed ? 200 : 422 },
    )
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'version_conflict') {
      return sceneApiJson(request, { error: 'version_conflict' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : String(error)
    return sceneApiJson(request, { error: 'scene_plan_failed', message }, { status: 500 })
  }
}
