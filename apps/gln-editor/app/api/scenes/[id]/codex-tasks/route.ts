import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { getCodexTaskManager, publicCodexTask } from '@/lib/codex-tasks/codex-task-server'
import { guardSceneApiRequest, sceneApiJson, sceneApiPreflight } from '@/lib/scene-api-security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard
  const { id } = await params
  const manager = await getCodexTaskManager()
  return sceneApiJson(request, {
    tasks: manager.list(id).map(publicCodexTask),
  })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return sceneApiJson(request, { error: 'invalid_request' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sceneApiJson(request, { error: 'invalid_request' }, { status: 400 })
  }
  try {
    const manager = await getCodexTaskManager()
    const task = manager.submit({ ...body, sceneId: id })
    return sceneApiJson(request, publicCodexTask(task), { status: 202 })
  } catch (error) {
    if (error instanceof ZodError) {
      return sceneApiJson(
        request,
        { error: 'invalid_request', details: error.issues },
        { status: 400 },
      )
    }
    return sceneApiJson(request, { error: 'codex_task_unavailable' }, { status: 503 })
  }
}
