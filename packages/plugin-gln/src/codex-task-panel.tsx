'use client'

import { useEffect, useState } from 'react'

type TaskKind = 'reconstruct-home' | 'configure-gln' | 'repair-gln'
type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'
type SourceKind = '' | 'glb' | 'ifc'

type ResidentialReviewItem = {
  nodeId: string
  nodeType: string
  confidence: 'medium' | 'low' | null
  reason: 'medium-confidence' | 'low-confidence' | 'missing-confidence'
  message: string
}

type GlnConfigurationReviewItem = {
  code: 'installation' | 'panel-placement' | 'routing'
  message: string
  nodeIds: string[]
}

type GlnConfigurationCompletenessIssue = {
  code: string
  message: string
  nodeIds: string[]
}

type TaskPayload = {
  id: string
  kind: TaskKind
  status: TaskStatus
  progress: number
  plan: unknown | null
  preview: { ok: boolean; diffs: unknown[]; issues: unknown[] } | null
  residentialReport: {
    status: 'draft-ready' | 'report-only'
    minimumStructure: { satisfied: boolean; missing: string[] }
    reviewItems: ResidentialReviewItem[]
  } | null
  glnConfigurationReport: {
    status: 'ready' | 'needs-review' | 'report-only'
    systems: {
      before: number
      requested: number
      expected: number
      after: number
      affectedIds: string[]
    }
    completenessIssues: GlnConfigurationCompletenessIssue[]
    reviewItems: GlnConfigurationReviewItem[]
  } | null
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
  const [sourceKind, setSourceKind] = useState<SourceKind>('')
  const [sourceSummary, setSourceSummary] = useState('')
  const [targetSystemCount, setTargetSystemCount] = useState(1)
  const [task, setTask] = useState<TaskPayload | null>(null)
  const [message, setMessage] = useState('')
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false)
  const active = task?.status === 'queued' || task?.status === 'running'
  const residentialReviewItems = task?.residentialReport?.reviewItems ?? []
  const glnReviewItems = task?.glnConfigurationReport?.reviewItems ?? []
  const hasReviewItems = residentialReviewItems.length > 0 || glnReviewItems.length > 0

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
    if (kind === 'reconstruct-home' && sourceKind && !sourceSummary.trim()) {
      setMessage('请选择“仅使用文字需求”，或填写资料解析摘要。')
      return
    }
    setMessage('')
    setReviewAcknowledged(false)
    try {
      const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}/codex-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          brief: brief.trim(),
          ...(kind === 'reconstruct-home' && sourceKind && sourceSummary.trim()
            ? {
                source: {
                  kind: sourceKind,
                  summary: sourceSummary.trim(),
                  uploadOriginal: false,
                },
              }
            : {}),
          ...(kind === 'configure-gln'
            ? {
                glnConfiguration: {
                  targetSystemCount,
                },
              }
            : {}),
        }),
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
          onChange={(event) => {
            setKind(event.target.value as TaskKind)
            setTask(null)
            setReviewAcknowledged(false)
          }}
          value={kind}
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {kind === 'reconstruct-home' ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          <label className="block space-y-2">
            <span className="font-medium text-sm">平面资料</span>
            <select
              aria-label="平面资料"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={active}
              onChange={(event) => setSourceKind(event.target.value as SourceKind)}
              value={sourceKind}
            >
              <option value="">仅使用文字需求</option>
              <option value="glb">GLB 本地解析摘要</option>
              <option value="ifc">IFC 本地解析摘要</option>
            </select>
          </label>
          {sourceKind ? (
            <label className="block space-y-2">
              <span className="font-medium text-sm">资料解析摘要</span>
              <textarea
                className="min-h-24 w-full resize-y rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                disabled={active}
                maxLength={50_000}
                onChange={(event) => setSourceSummary(event.target.value)}
                placeholder="粘贴本地导入分析得到的楼层、墙线、空间与不确定项摘要"
                value={sourceSummary}
              />
            </label>
          ) : null}
          <p className="text-muted-foreground text-xs">
            原始文件不会上传；只把本地解析摘要交给受限任务。
          </p>
        </div>
      ) : null}

      {kind === 'configure-gln' ? (
        <label className="block space-y-2">
          <span className="font-medium text-sm">目标系统总数</span>
          <input
            aria-label="目标系统总数"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={active}
            max={8}
            min={1}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isInteger(next)) setTargetSystemCount(Math.min(8, Math.max(1, next)))
            }}
            type="number"
            value={targetSystemCount}
          />
          <span className="block text-muted-foreground text-xs">
            普通住宅默认一套；明确需要分区独立主机时可增加，现有系统不会被自动删除。
          </span>
        </label>
      ) : null}

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
        disabled={
          active ||
          brief.trim().length === 0 ||
          (kind === 'reconstruct-home' && !!sourceKind && sourceSummary.trim().length === 0)
        }
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
          {task.residentialReport?.status === 'report-only' ? (
            <p className="text-destructive text-xs">
              最低住宅结构未满足：
              {task.residentialReport.minimumStructure.missing.join('、')}
            </p>
          ) : null}
          {task.glnConfigurationReport?.status === 'report-only' ? (
            <div className="space-y-1 text-destructive text-xs" data-gln-configuration-report>
              <p>当前计划未形成完整、无重复的光冷暖系统：</p>
              <ul className="space-y-1">
                {task.glnConfigurationReport.completenessIssues.map((issue) => (
                  <li key={`${issue.code}-${issue.nodeIds.join('-')}-${issue.message}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                {task.preview?.ok
                  ? `已通过格式与硬校验，共 ${task.preview.diffs.length} 项变更。`
                  : `已生成 ${task.preview?.diffs.length ?? 0} 项变更，安装位置仍需人工复核，提交按钮会保持禁用。`}
              </p>
              {residentialReviewItems.length > 0 ? (
                <div className="space-y-2" data-residential-review-queue>
                  <strong className="text-sm">
                    住宅构件复核队列（{residentialReviewItems.length}）
                  </strong>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {residentialReviewItems.map((item) => (
                      <li className="rounded-sm bg-amber-500/10 p-2" key={item.nodeId}>
                        {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {glnReviewItems.length > 0 ? (
                <div className="space-y-2" data-gln-configuration-review-queue>
                  <strong className="text-sm">安装与水路复核队列（{glnReviewItems.length}）</strong>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {glnReviewItems.map((item) => (
                      <li
                        className="rounded-sm bg-amber-500/10 p-2"
                        key={`${item.code}-${item.nodeIds.join('-')}-${item.message}`}
                      >
                        {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hasReviewItems ? (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    checked={reviewAcknowledged}
                    className="mt-0.5"
                    onChange={(event) => setReviewAcknowledged(event.target.checked)}
                    type="checkbox"
                  />
                  <span>我已逐项核对这些不确定构件，允许进入差异预览。</span>
                </label>
              ) : null}
              <button
                className="w-full rounded-md bg-emerald-600 px-3 py-2 font-medium text-sm text-white disabled:opacity-50"
                disabled={hasReviewItems && !reviewAcknowledged}
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
