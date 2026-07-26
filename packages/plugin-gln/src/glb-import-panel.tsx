'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, FileUp, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  buildGlbReportScene,
  buildGlbResidentialReplacement,
  glnGlbImportId,
} from './glb-import-application'
import { GlnGlbImportNode } from './glb-import-schema'
import { analyzeLocalGlb } from './glb-local-analysis'
import { useGlnGlbReferenceStore } from './glb-reference-store'
import type {
  GlbResidentialConversionReport,
  GlbResidentialReconstruction,
} from './glb-residential-reconstruction'

type LocalGlbResult = GlbResidentialReconstruction & {
  lowResolutionView: string
  referenceObject: Awaited<ReturnType<typeof analyzeLocalGlb>>['referenceObject']
}

const REVIEW_LABELS: Record<
  GlbResidentialConversionReport['reviewItems'][number]['reason'],
  string
> = {
  'ambiguous-geometry': '几何方向或比例不足以可靠重建',
  'degenerate-geometry': '几何为空或损坏',
  'unsupported-semantic': '缺少可识别的建筑语义名称',
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function GlbReport({
  report,
  lowResolutionView,
}: {
  report: GlbResidentialConversionReport
  lowResolutionView: string
}) {
  return (
    <section
      className="space-y-3 rounded-md border border-sidebar-border bg-sidebar-accent/20 p-3"
      data-gln-glb-report-status={report.status}
    >
      <div className="flex items-start gap-2">
        {report.status === 'draft-ready' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        )}
        <div className="min-w-0">
          <p className="break-all font-medium text-sidebar-foreground text-sm">
            {report.source.path}
          </p>
          <p className="mt-1 text-sidebar-foreground/55 text-xs">
            {formatBytes(report.source.sizeBytes)} · SHA-256 {report.source.sha256.slice(0, 12)}…
          </p>
        </div>
      </div>

      <img
        alt="GLB 本地低分辨率几何视图"
        className="aspect-[18/11] w-full border border-sidebar-border object-contain"
        data-gln-glb-low-res-view
        src={lowResolutionView}
      />

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">源网格</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">{report.geometry.meshCount}</dd>
        </div>
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">三角面</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">
            {report.geometry.triangleCount}
          </dd>
        </div>
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">高置信结构</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">
            {report.nodeCounts.highConfidence}
          </dd>
        </div>
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">待复核</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">{report.nodeCounts.review}</dd>
        </div>
      </dl>

      {report.status === 'report-only' && (
        <p className="rounded border border-amber-500/45 bg-amber-500/10 p-2 text-sidebar-foreground/80 text-xs">
          最低住宅结构未满足。本次只保存几何分析报告，不替换住宅，也不会配置光冷暖设备。
        </p>
      )}

      {report.reviewItems.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sidebar-foreground text-xs">
            查看 {report.reviewItems.length} 个待复核网格
          </summary>
          <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {report.reviewItems.map((item) => (
              <li
                className="rounded border border-sidebar-border px-2 py-1.5 text-sidebar-foreground/70 text-xs"
                key={`${item.meshId}-${item.reason}`}
              >
                <span className="font-medium text-sidebar-foreground">{item.name}</span>
                <span className="ml-1">· {REVIEW_LABELS[item.reason]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function SavedGlbImport({ node }: { node: GlnGlbImportNode }) {
  const referenceAvailable = useGlnGlbReferenceStore(
    (state) => state.references[node.id] !== undefined,
  )
  const removeReference = useGlnGlbReferenceStore((state) => state.removeReference)
  const updateNode = useScene((state) => state.updateNode)
  const readOnly = useScene((state) => state.readOnly)

  const toggle = () =>
    updateNode(node.id as AnyNodeId, { referenceVisible: !node.referenceVisible } as never)
  const remove = () => {
    removeReference(node.id)
    updateNode(node.id as AnyNodeId, { referenceVisible: false } as never)
  }

  return (
    <article
      className="rounded-md border border-sidebar-border p-3"
      data-gln-glb-saved-import={node.id}
    >
      <p className="break-all font-medium text-sidebar-foreground text-sm">
        {node.report.source.path}
      </p>
      <p className="mt-1 text-sidebar-foreground/55 text-xs">
        重建报告已随场景保存，GLB 原文件和预览图没有写入场景。
      </p>
      {!referenceAvailable && (
        <p className="mt-2 text-amber-500/90 text-xs">
          临时参考模型不在当前内存中。重新选择同一 GLB 文件即可恢复。
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="flex h-9 items-center justify-center gap-2 rounded-md border border-sidebar-border text-xs disabled:opacity-45"
          disabled={readOnly || !referenceAvailable}
          onClick={toggle}
          type="button"
        >
          {node.referenceVisible ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {node.referenceVisible ? '隐藏参考' : '显示参考'}
        </button>
        <button
          className="flex h-9 items-center justify-center gap-2 rounded-md border border-sidebar-border text-xs disabled:opacity-45"
          disabled={readOnly || !referenceAvailable}
          onClick={remove}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除临时参考
        </button>
      </div>
    </article>
  )
}

export default function GlnGlbImportPanel() {
  const { nodes, rootNodeIds, collections, materials, installedPlugins, readOnly } = useScene(
    useShallow((state) => ({
      nodes: state.nodes,
      rootNodeIds: state.rootNodeIds,
      collections: state.collections,
      materials: state.materials,
      installedPlugins: state.installedPlugins,
      readOnly: state.readOnly,
    })),
  )
  const savedImports = useMemo(
    () =>
      Object.values(nodes)
        .map((node) => GlnGlbImportNode.safeParse(node))
        .filter((result) => result.success)
        .map((result) => result.data),
    [nodes],
  )
  const [result, setResult] = useState<LocalGlbResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    setConfirmed(false)
    try {
      const next = await analyzeLocalGlb(file)
      setResult(next)
      const matching = savedImports.find(
        (node) => node.report.source.sha256 === next.report.source.sha256,
      )
      if (matching) {
        useGlnGlbReferenceStore.getState().setReference(matching.id, next.referenceObject)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析此 GLB 文件。')
    } finally {
      setBusy(false)
    }
  }

  const applyDraft = () => {
    if (!result?.draft || !confirmed || readOnly) return
    const next = buildGlbResidentialReplacement({
      draft: result.draft,
      installedPlugins,
      report: result.report,
    })
    useScene.getState().setScene(next.nodes as never, next.rootNodeIds as never, {
      collections: {},
      materials: {},
      installedPlugins: next.installedPlugins,
      hasExplicitPluginInstallState: true,
    })
    useGlnGlbReferenceStore
      .getState()
      .setReference(glnGlbImportId(result.report), result.referenceObject)
    setConfirmed(false)
  }

  const saveReport = () => {
    if (result?.report.status !== 'report-only' || readOnly) return
    const next = buildGlbReportScene({
      current: { nodes: nodes as never, rootNodeIds },
      installedPlugins,
      report: result.report,
    })
    useScene.getState().setScene(next.nodes as never, next.rootNodeIds as never, {
      collections,
      materials,
      installedPlugins: next.installedPlugins,
      hasExplicitPluginInstallState: true,
    })
    useGlnGlbReferenceStore
      .getState()
      .setReference(glnGlbImportId(result.report), result.referenceObject)
  }

  return (
    <div className="space-y-4" data-gln-glb-import-panel>
      <header>
        <h3 className="font-semibold text-sidebar-foreground">GLB 可编辑住宅重建</h3>
        <p className="mt-1 text-sidebar-foreground/60 text-xs">
          文件只在本机浏览器解析。仅高置信建筑几何进入草稿，原模型只作为临时对照。
        </p>
      </header>

      <label
        className={`flex h-10 items-center justify-center gap-2 rounded-md border border-sidebar-border text-sm ${
          busy || readOnly
            ? 'cursor-not-allowed opacity-45'
            : 'cursor-pointer hover:border-sidebar-ring'
        }`}
      >
        <FileUp className="h-4 w-4" />
        {busy ? '正在解析…' : '选择 GLB 文件'}
        <input
          accept=".glb,model/gltf-binary"
          className="sr-only"
          disabled={busy || readOnly}
          onChange={(event) => {
            void chooseFile(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
          type="file"
        />
      </label>

      {error && (
        <p className="rounded border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs">
          {error}
        </p>
      )}

      {result && (
        <>
          <GlbReport lowResolutionView={result.lowResolutionView} report={result.report} />
          {result.draft ? (
            <section className="space-y-3 rounded-md border border-sidebar-border p-3">
              <label className="flex items-start gap-2 text-sidebar-foreground text-xs">
                <input
                  checked={confirmed}
                  className="mt-0.5"
                  disabled={readOnly}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>确认以高置信可编辑草稿替换当前住宅。低置信网格不会进入正式场景。</span>
              </label>
              <button
                className="h-10 w-full rounded-md bg-primary font-medium text-primary-foreground text-sm disabled:opacity-45"
                disabled={!confirmed || readOnly}
                onClick={applyDraft}
                type="button"
              >
                替换为可编辑住宅
              </button>
              <p className="text-sidebar-foreground/50 text-xs">
                此步骤只重建住宅，不会自动创建外机、水箱、水管或墙面面板。
              </p>
            </section>
          ) : (
            <button
              className="h-10 w-full rounded-md border border-sidebar-border text-sm disabled:opacity-45"
              disabled={readOnly}
              onClick={saveReport}
              type="button"
            >
              保存检测报告
            </button>
          )}
        </>
      )}

      {savedImports.length > 0 && (
        <section className="space-y-2">
          <h4 className="font-medium text-sidebar-foreground text-sm">已保存的 GLB 重建</h4>
          {savedImports.map((node) => (
            <SavedGlbImport key={node.id} node={node} />
          ))}
        </section>
      )}
    </div>
  )
}
