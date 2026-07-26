import type { NextRequest } from 'next/server'
import { getCodexTaskManager, publicCodexTask } from '@/lib/codex-tasks/codex-task-server'
import { guardSceneApiRequest, sceneApiJson, sceneApiPreflight } from '@/lib/scene-api-security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string; taskId: string }> }

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return taskResponse(request, params, false)
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return taskResponse(request, params, true)
}

async function taskResponse(request: NextRequest, params: RouteContext['params'], cancel: boolean) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard
  const { id, taskId } = await params
  const manager = await getCodexTaskManager()
  const task = cancel ? manager.cancel(taskId) : manager.get(taskId)
  if (!(task && task.sceneId === id)) {
    return sceneApiJson(request, { error: 'codex_task_not_found' }, { status: 404 })
  }
  return sceneApiJson(request, publicCodexTask(task))
}
