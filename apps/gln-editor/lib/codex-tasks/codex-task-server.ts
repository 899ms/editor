import { getSceneOperations } from '../scene-store-server'
import { createCodexCliAdapter } from './codex-cli-adapter'
import {
  type CodexTaskManager,
  type CodexTaskRecord,
  createCodexTaskManager,
} from './codex-task-manager'

let cachedManager: Promise<CodexTaskManager> | null = null

export function getCodexTaskManager(): Promise<CodexTaskManager> {
  if (!cachedManager) {
    cachedManager = getSceneOperations().then((operations) =>
      createCodexTaskManager({
        operations,
        adapter: createCodexCliAdapter(),
      }),
    )
  }
  return cachedManager
}

export function publicCodexTask(task: CodexTaskRecord) {
  return {
    id: task.id,
    sceneId: task.sceneId,
    kind: task.kind,
    status: task.status,
    progress: task.progress,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    plan: task.plan,
    preview: task.preview
      ? {
          ok: task.preview.ok,
          diffs: task.preview.diffs.map(({ kind, nodeId, nodeType, changedFields }) => ({
            kind,
            nodeId,
            nodeType,
            changedFields,
          })),
          issues: task.preview.issues,
        }
      : null,
    error: task.error,
  }
}

export function __setCodexTaskManagerForTests(manager: CodexTaskManager | null): void {
  cachedManager = manager ? Promise.resolve(manager) : null
}
