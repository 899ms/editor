'use client'

import { useEffect, useState } from 'react'

type TaskKind = 'reconstruct-home' | 'configure-gln' | 'repair-gln'
type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'

type TaskPayload = {
  id: string
  kind: TaskKind
  status: TaskStatus
  progress: number
  plan: unknown | null
  preview: { diffs: unknown[]; issues: unknown[] } | null
  error: { code: string; message: string } | null
}

const KIND_LABELS: Record<TaskKind, string> = {
  'reconstruct-home': '住宅重建',
  'configure-gln': '配置光冷暖',
  'repair-gln': '修复光冷暖',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '已生成',
  failed: '失败',
  cancelled: '已取消',
  timed_out: '已超时',
}
const PENDING_PLAN_KEY = 'pascal:gln:pending-scene-plan'

function currentSceneId() {
  const match = window.location.pathname.match(/^\/scene\/([^/]+)/)
  return match ? decodeURIComponent(match[1]!) : null
}

export default function GlnCodexTaskPanel() {
  const [kind, setKind] = useState<TaskKind>('configure-gln')
  const [brief, setBrief] = useState('')
  const [task, setTask] = useState<TaskPayload | null>(null)
  const [message, setMessage] = useState('')
  const active = task?.status === 'queued' || task?.status === 'running'

  useEffect(() => {
    if (!active || !task) return
    const sceneId = currentSceneId()
    if (!sceneId) return
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/scenes/${encodeURIComponent(sceneId)}/codex-tasks/${encodeURIComponent(task.id)}`,
        )
        if (!response.ok) return
        setTask((await response.json()) as TaskPayload)
      } catch {
        setMessage('无法读取任务进度。')
      }
    }, 800)
    return () => window.clearInterval(interval)
  }, [active, task])

  const submit = async () => {
    const sceneId = currentSceneId()
    if (!(sceneId && brief.trim())) {
      setMessage('请填写场景任务目标。')
      return
    }
    setMessage('')
    try {
      const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}/codex-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, brief: brief.trim() }),
      })
      const payload = (await response.json()) as TaskPayload & { error?: string }
      if (!response.ok) {
        setMessage(payload.error ?? '无法提交本地 Codex 任务。')
        return
      }
      setTask(payload)
    } catch {
      setMessage('无法连接本地 Codex 任务服务。')
    }
  }

  const cancel = async () => {
    const sceneId = currentSceneId()
    if (!(sceneId && task)) return
    const response = await fetch(
      `/api/scenes/${encodeURIComponent(sceneId)}/codex-tasks/${encodeURIComponent(task.id)}`,
      { method: 'DELETE' },
    )
    if (response.ok) setTask((await response.json()) as TaskPayload)
  }

  const sendToPreview = () => {
    if (!task?.plan) return
    window.sessionStorage.setItem(PENDING_PLAN_KEY, JSON.stringify(task.plan))
    window.dispatchEvent(
      new CustomEvent('pascal:codex-scene-plan-ready', { detail: { plan: task.plan } }),
    )
    setMessage('已发送到“变更计划”，请检查差异后再确认提交。')
  }

  return (
    <div className="space-y-4 p-4 text-sidebar-foreground" data-gln-codex-task-panel>
      <div>
        <h2 className="font-semibold text-lg">AI 场景任务</h2>
        <p className="mt-1 text-muted-foreground text-xs">
          本机 Codex 只生成可校验的场景计划，不直接修改场景。
        </p>
      </div>

      <label className="block space-y-2">
        <span className="font-medium text-sm">任务类型</span>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={active}
          onChange={(event) => setKind(event.target.value as TaskKind)}
          value={kind}
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="font-medium text-sm">任务目标</span>
        <textarea
          className="min-h-28 w-full resize-y rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          disabled={active}
          maxLength={8000}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="例如：为现有住宅配置一套光冷暖系统"
          value={brief}
        />
      </label>

      <button
        className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
        disabled={active || brief.trim().length === 0}
        onClick={() => void submit()}
        type="button"
      >
        生成场景计划
      </button>

      {task ? (
        <div className="space-y-3 rounded-md border border-border p-3" data-codex-task-status>
          <div className="flex items-center justify-between gap-3 text-sm">
            <strong>{STATUS_LABELS[task.status]}</strong>
            <span className="text-muted-foreground">{task.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          {task.error ? <p className="text-destructive text-xs">{task.error.message}</p> : null}
          {active ? (
            <button
              className="w-full rounded-md border border-destructive px-3 py-2 text-destructive text-sm"
              onClick={() => void cancel()}
              type="button"
            >
              取消任务
            </button>
          ) : null}
          {task.status === 'succeeded' && task.plan ? (
            <>
              <p className="text-muted-foreground text-xs">
                已通过格式与硬校验，共 {task.preview?.diffs.length ?? 0} 项变更。
              </p>
              <button
                className="w-full rounded-md bg-emerald-600 px-3 py-2 font-medium text-sm text-white"
                onClick={sendToPreview}
                type="button"
              >
                发送到变更计划
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="text-muted-foreground text-xs">{message}</p> : null}
    </div>
  )
}
