'use client'

import type { SceneGraph } from '@pascal-app/core/clone-scene-graph'
import type { ScenePlan, ScenePlanDiff, ScenePlanIssue } from '@pascal-app/core/scene-plan'
import { useEffect, useMemo, useState } from 'react'

type PreparedResponse = {
  ok: boolean
  plan: ScenePlan
  diffs: Array<Pick<ScenePlanDiff, 'kind' | 'nodeId' | 'nodeType' | 'changedFields'>>
  issues: ScenePlanIssue[]
  committed?: boolean
  meta?: { version: number } | null
  graph?: SceneGraph
  preCheckpointVersion?: number | null
  postCheckpointVersion?: number | null
}

const DIFF_LABELS: Record<ScenePlanDiff['kind'], string> = {
  create: '创建',
  move: '移动',
  update: '更新',
  delete: '删除',
}

const DIFF_STYLES: Record<ScenePlanDiff['kind'], string> = {
  create: 'border-emerald-500/60 bg-emerald-500/15',
  move: 'border-sky-500/60 bg-sky-500/15',
  update: 'border-amber-500/60 bg-amber-500/15',
  delete: 'border-rose-500/60 bg-rose-500/15',
}
const PENDING_PLAN_KEY = 'pascal:gln:pending-scene-plan'

function currentSceneId() {
  const match = window.location.pathname.match(/^\/scene\/([^/]+)/)
  return match ? decodeURIComponent(match[1]!) : null
}

export default function GlnScenePlanPanel() {
  const [source, setSource] = useState('')
  const [prepared, setPrepared] = useState<PreparedResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const parsedPlan = useMemo(() => {
    try {
      return JSON.parse(source) as ScenePlan
    } catch {
      return null
    }
  }, [source])

  useEffect(() => {
    const acceptPlan = (plan: ScenePlan) => {
      setSource(JSON.stringify(plan, null, 2))
      setPrepared(null)
      setMessage('已接收本地 Codex 生成的场景计划。')
      window.sessionStorage.removeItem(PENDING_PLAN_KEY)
    }
    const receivePlan = (event: Event) => {
      const plan = (event as CustomEvent<{ plan?: ScenePlan }>).detail?.plan
      if (!plan) return
      acceptPlan(plan)
    }
    const pending = window.sessionStorage.getItem(PENDING_PLAN_KEY)
    if (pending) {
      try {
        acceptPlan(JSON.parse(pending) as ScenePlan)
      } catch {
        window.sessionStorage.removeItem(PENDING_PLAN_KEY)
      }
    }
    window.addEventListener('pascal:codex-scene-plan-ready', receivePlan)
    return () => window.removeEventListener('pascal:codex-scene-plan-ready', receivePlan)
  }, [])

  const run = async (action: 'prepare' | 'commit') => {
    const sceneId = currentSceneId()
    if (!(sceneId && parsedPlan)) {
      setMessage('请输入有效的 ScenePlan JSON。')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, plan: parsedPlan }),
      })
      const payload = (await response.json()) as PreparedResponse & {
        error?: string
        message?: string
      }
      if (!response.ok && !payload.issues) {
        setMessage(payload.message ?? payload.error ?? '计划请求失败。')
        return
      }
      setPrepared(payload)
      if (payload.committed && payload.graph && payload.meta) {
        window.dispatchEvent(
          new CustomEvent('pascal:scene-plan-committed', {
            detail: {
              sceneId,
              version: payload.meta.version,
              graph: payload.graph,
            },
          }),
        )
        setMessage(
          `已原子提交；恢复点 ${payload.preCheckpointVersion} → ${payload.postCheckpointVersion}。`,
        )
      }
    } catch {
      setMessage('无法连接场景计划服务。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4 text-sidebar-foreground" data-gln-scene-plan-panel>
      <div>
        <h2 className="font-semibold text-lg">场景变更计划</h2>
        <p className="mt-1 text-muted-foreground text-xs">
          所有批量修改先校验并预览，确认后一次提交。
        </p>
      </div>

      <label className="block space-y-2">
        <span className="font-medium text-sm">计划输入</span>
        <textarea
          className="min-h-40 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary"
          onChange={(event) => {
            setSource(event.target.value)
            setPrepared(null)
          }}
          placeholder='{"id":"...","sceneId":"...","baseVersion":1,"operations":[...]}'
          value={source}
        />
      </label>

      <button
        className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
        disabled={busy || !parsedPlan}
        onClick={() => void run('prepare')}
        type="button"
      >
        校验并生成差异预览
      </button>

      {prepared ? (
        <div className="space-y-3" data-gln-scene-plan-preview>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">半透明差异预览</h3>
            <span className="text-muted-foreground text-xs">{prepared.diffs.length} 项变更</span>
          </div>
          <div className="space-y-2">
            {prepared.diffs.map((diff) => (
              <div
                className={`rounded-md border p-3 opacity-75 ${DIFF_STYLES[diff.kind]}`}
                data-diff-kind={diff.kind}
                key={`${diff.kind}:${diff.nodeId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{DIFF_LABELS[diff.kind]}</strong>
                  <code className="truncate text-[11px]">{diff.nodeId}</code>
                </div>
                <p className="mt-1 text-xs">
                  {diff.nodeType} · {diff.changedFields.join('、')}
                </p>
              </div>
            ))}
          </div>
          {prepared.issues.length > 0 ? (
            <div className="space-y-1" data-gln-scene-plan-issues>
              {prepared.issues.map((issue, index) => (
                <p
                  className={
                    issue.severity === 'error'
                      ? 'text-destructive text-xs'
                      : 'text-amber-600 text-xs'
                  }
                  key={`${issue.code}:${index}`}
                >
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
          <button
            className="w-full rounded-md bg-emerald-600 px-3 py-2 font-medium text-sm text-white disabled:opacity-50"
            disabled={busy || !prepared.ok || prepared.committed === true}
            onClick={() => void run('commit')}
            type="button"
          >
            确认并一次提交
          </button>
        </div>
      ) : null}
      {message ? <p className="text-muted-foreground text-xs">{message}</p> : null}
    </div>
  )
}
