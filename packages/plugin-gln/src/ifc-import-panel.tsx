'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import {
  convertIfcToResidential,
  type IfcResidentialConversionReport,
  type IfcResidentialReconstruction,
} from '@pascal-app/ifc-converter'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, FileUp, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  buildIfcReportScene,
  buildIfcResidentialReplacement,
  glnIfcImportId,
} from './ifc-import-application'
import { GlnIfcImportNode } from './ifc-import-schema'
import { useGlnIfcReferenceStore } from './ifc-reference-store'

const REVIEW_LABELS: Record<
  IfcResidentialConversionReport['reviewItems'][number]['reason'],
  string
> = {
  'invalid-geometry': '几何信息不足',
  'missing-parent': '缺少可编辑的上级节点',
  'unsupported-kind': '首版暂不支持的构件',
}

const MINIMUM_KIND_LABELS: Record<
  IfcResidentialConversionReport['minimumStructure']['missing'][number],
  string
> = {
  building: '建筑',
  level: '楼层',
  wall: '墙体',
  zone: '空间',
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function ConversionReport({ report }: { report: IfcResidentialConversionReport }) {
  return (
    <section
      className="space-y-3 rounded-md border border-sidebar-border bg-sidebar-accent/20 p-3"
      data-gln-ifc-report-status={report.status}
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

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">源节点</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">{report.nodeCounts.source}</dd>
        </div>
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">可编辑草稿</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">{report.nodeCounts.draft}</dd>
        </div>
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">生成空间</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">{report.generated.zones}</dd>
        </div>
        <div className="rounded border border-sidebar-border p-2">
          <dt className="text-sidebar-foreground/55">待复核</dt>
          <dd className="mt-1 font-medium text-sidebar-foreground">{report.nodeCounts.review}</dd>
        </div>
      </dl>

      {report.status === 'report-only' && (
        <p className="rounded border border-amber-500/45 bg-amber-500/10 p-2 text-sidebar-foreground/80 text-xs">
          住宅结构不完整：缺少
          {report.minimumStructure.missing.map((kind) => MINIMUM_KIND_LABELS[kind]).join('、')}。
          本次只保存检测报告，不替换住宅，也不会配置光冷暖设备。
        </p>
      )}

      {report.reviewItems.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sidebar-foreground text-xs">
            查看 {report.reviewItems.length} 个待复核节点
          </summary>
          <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {report.reviewItems.map((item) => (
              <li
                className="rounded border border-sidebar-border px-2 py-1.5 text-sidebar-foreground/70 text-xs"
                key={`${item.nodeId}-${item.reason}`}
              >
                <span className="font-medium text-sidebar-foreground">{item.name}</span>
                <span className="ml-1">· {REVIEW_LABELS[item.reason]}</span>
                {item.ifcType && <span className="block break-all opacity-60">{item.ifcType}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function SavedImportCard({ node }: { node: GlnIfcImportNode }) {
  const referenceAvailable = useGlnIfcReferenceStore(
    (state) => state.references[node.id] !== undefined,
  )
  const removeReference = useGlnIfcReferenceStore((state) => state.removeReference)
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
      data-gln-ifc-saved-import={node.id}
    >
      <p className="break-all font-medium text-sidebar-foreground text-sm">
        {node.report.source.path}
      </p>
      <p className="mt-1 text-sidebar-foreground/55 text-xs">
        转换报告已随场景保存，IFC 原文件没有写入场景。
      </p>
      {!referenceAvailable && (
        <p className="mt-2 text-amber-500/90 text-xs">
          临时参考层不在当前内存中。重新选择同一 IFC 文件即可恢复。
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

export default function GlnIfcImportPanel() {
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
        .map((node) => GlnIfcImportNode.safeParse(node))
        .filter((result) => result.success)
        .map((result) => result.data),
    [nodes],
  )
  const [result, setResult] = useState<IfcResidentialReconstruction | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    setConfirmed(false)
    setProgress('正在读取本地 IFC…')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const sourcePath = file.webkitRelativePath || file.name
      const next = await convertIfcToResidential(
        bytes,
        sourcePath,
        (message, percent) => setProgress(`${message} ${Math.round(percent)}%`),
        { wasmPath: '/' },
      )
      setResult(next)
      setProgress('本地解析完成')

      const matching = savedImports.find(
        (node) => node.report.source.sha256 === next.report.source.sha256,
      )
      if (matching) {
        useGlnIfcReferenceStore.getState().setReference(matching.id, next.referenceGraph)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析此 IFC 文件。')
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  const applyDraft = () => {
    if (!result?.draft || !confirmed || readOnly) return
    const next = buildIfcResidentialReplacement({
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
    useGlnIfcReferenceStore
      .getState()
      .setReference(glnIfcImportId(result.report), result.referenceGraph)
    setConfirmed(false)
  }

  const saveReport = () => {
    if (result?.report.status !== 'report-only' || readOnly) return
    const next = buildIfcReportScene({
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
  }

  return (
    <div className="space-y-4 p-3" data-gln-ifc-import-panel>
      <header>
        <h3 className="font-semibold text-sidebar-foreground">IFC 可编辑住宅重建</h3>
        <p className="mt-1 text-sidebar-foreground/60 text-xs">
          文件只在本机浏览器解析。高置信构件转换为普通可编辑节点，BIM 属性不会进入场景。
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
        {busy ? '正在解析…' : '选择 IFC 文件'}
        <input
          accept=".ifc,application/x-step"
          className="sr-only"
          disabled={busy || readOnly}
          onChange={(event) => {
            void chooseFile(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
          type="file"
        />
      </label>

      {progress && <p className="text-sidebar-foreground/60 text-xs">{progress}</p>}
      {error && (
        <p className="rounded border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs">
          {error}
        </p>
      )}

      {result && (
        <>
          <ConversionReport report={result.report} />
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
                <span>
                  确认以这份可编辑住宅草稿替换当前住宅。现有建筑节点、场景材质和集合将被替换。
                </span>
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
          <h4 className="font-medium text-sidebar-foreground text-sm">已保存的 IFC 转换</h4>
          {savedImports.map((node) => (
            <SavedImportCard key={node.id} node={node} />
          ))}
        </section>
      )}
    </div>
  )
}
