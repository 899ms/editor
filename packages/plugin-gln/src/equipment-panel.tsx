'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useEditor, useViewer } from '@pascal-app/editor'
import {
  AlertTriangle,
  Cylinder,
  Eye,
  EyeOff,
  Fan,
  GitBranch,
  Lock,
  MapPin,
  PanelTop,
  Play,
  Route,
  Trash2,
  Unlock,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getGlnInstallationIssues } from './equipment-installation'
import type { GlnEquipmentInstallationAreaKind } from './equipment-installation-schema'
import { useGlnEquipmentStore } from './equipment-store'
import { getGlnPort } from './hydronic-pipe-ports'
import {
  type GlnHydronicPipeNode as GlnHydronicPipe,
  GlnHydronicPipeNode,
} from './hydronic-pipe-schema'
import {
  collectGlnRoutingObstacles,
  planGlnConcealedRoute,
  resolveGlnNodeLevelId,
} from './hydronic-routing'
import { getGlnHydronicDeleteImpact, getGlnHydronicTopologyIssues } from './hydronic-topology'
import { deriveGlnRunPreview } from './run-preview'

const OUTDOOR_UNIT_KIND = 'gln:outdoor-unit'
const BUFFER_TANK_KIND = 'gln:buffer-tank'
const WALL_PANEL_KIND = 'gln:wall-panel'
const HYDRONIC_PIPE_KIND = 'gln:hydronic-pipe'

const OUTDOOR_AREA_KINDS: GlnEquipmentInstallationAreaKind[] = ['outdoor-equipment-area']
const TANK_AREA_KINDS: GlnEquipmentInstallationAreaKind[] = [
  'equipment-room',
  'mechanical-room',
  'equipment-area',
]
const INSTALLATION_AREA_KINDS: GlnEquipmentInstallationAreaKind[] = [
  ...OUTDOOR_AREA_KINDS,
  ...TANK_AREA_KINDS,
]
const AREA_KIND_LABELS: Record<GlnEquipmentInstallationAreaKind, string> = {
  unassigned: '未确认',
  'outdoor-equipment-area': '室外设备区',
  'equipment-room': '设备间',
  'mechanical-room': '机房',
  'equipment-area': '设备区',
}

function GlnDisplayModeControl() {
  const displayMode = useGlnEquipmentStore((state) => state.displayMode)
  const setDisplayMode = useGlnEquipmentStore((state) => state.setDisplayMode)
  return (
    <div
      className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-sidebar-accent/60 p-1"
      data-gln-display-mode={displayMode}
    >
      <button
        aria-pressed={displayMode === 'edit'}
        className={`flex h-9 items-center justify-center gap-2 rounded text-sm ${
          displayMode === 'edit' ? 'bg-sidebar font-medium shadow-sm' : 'text-sidebar-foreground/65'
        }`}
        onClick={() => setDisplayMode('edit')}
        type="button"
      >
        <Wrench className="h-4 w-4" />
        编辑视图
      </button>
      <button
        aria-pressed={displayMode === 'run-preview'}
        className={`flex h-9 items-center justify-center gap-2 rounded text-sm ${
          displayMode === 'run-preview'
            ? 'bg-sidebar font-medium shadow-sm'
            : 'text-sidebar-foreground/65'
        }`}
        onClick={() => setDisplayMode('run-preview')}
        type="button"
      >
        <Play className="h-4 w-4" />
        运行预览
      </button>
    </div>
  )
}

function SystemOption({ systemId }: { systemId: string }) {
  const name = useScene(
    (state) => (state.nodes[systemId as never] as { name?: string } | undefined)?.name,
  )
  return <option value={systemId}>{name ?? '未命名系统'}</option>
}

function PipeCoordinateInput({
  axis,
  disabled,
  onCommit,
  pointIndex,
  value,
}: {
  axis: 'X' | 'Y' | 'Z'
  disabled: boolean
  onCommit: (value: number) => void
  pointIndex: number
  value: number
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const next = Number(draft)
    if (!Number.isFinite(next)) {
      setDraft(String(value))
      return
    }
    onCommit(next)
  }
  return (
    <input
      aria-label={`路径点 ${pointIndex + 1} ${axis}`}
      className="h-8 w-full rounded border border-sidebar-border bg-sidebar px-1.5 text-xs"
      disabled={disabled}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      step="0.05"
      type="number"
      value={draft}
    />
  )
}

function SelectedPipeEditor({ pipe, readOnly }: { pipe: GlnHydronicPipe; readOnly: boolean }) {
  const updatePath = (path: GlnHydronicPipe['path']) =>
    useScene.getState().updateNode(pipe.id as AnyNodeId, { path } as never)
  const addPoint = () => {
    const endIndex = pipe.path.length - 1
    const previous = pipe.path[endIndex - 1]!
    const end = pipe.path[endIndex]!
    updatePath([
      ...pipe.path.slice(0, endIndex),
      [(previous[0] + end[0]) / 2, (previous[1] + end[1]) / 2, (previous[2] + end[2]) / 2],
      end,
    ])
  }
  const updateCoordinate = (pointIndex: number, coordinate: 0 | 1 | 2, next: number) => {
    updatePath(
      pipe.path.map((point, index) =>
        index === pointIndex
          ? ([
              coordinate === 0 ? next : point[0],
              coordinate === 1 ? next : point[1],
              coordinate === 2 ? next : point[2],
            ] as [number, number, number])
          : point,
      ),
    )
  }
  const deletePoint = (pointIndex: number) =>
    updatePath(pipe.path.filter((_, index) => index !== pointIndex))

  return (
    <section className="rounded-lg border border-sidebar-border p-3" data-gln-pipe-editor>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sidebar-foreground text-sm">
            {pipe.circuit === 'supply' ? '供水路径' : '回水路径'}
          </p>
          <p className="text-sidebar-foreground/55 text-xs">端点固定连接，允许编辑中间路径点。</p>
        </div>
        <button
          className="rounded-md border border-sidebar-border px-2 py-1 text-xs hover:border-sidebar-ring disabled:opacity-45"
          disabled={readOnly}
          onClick={addPoint}
          type="button"
        >
          新增路径点
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {pipe.path.map((point, index) => {
          const isEndpoint = index === 0 || index === pipe.path.length - 1
          return (
            <div
              className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-1.5"
              key={`path-point-${index}`}
            >
              <span className="text-sidebar-foreground/55 text-xs">
                {isEndpoint ? '端点' : `点 ${index}`}
              </span>
              {(['X', 'Y', 'Z'] as const).map((axis, coordinate) => (
                <PipeCoordinateInput
                  axis={axis}
                  disabled={readOnly || isEndpoint}
                  key={axis}
                  onCommit={(next) => updateCoordinate(index, coordinate as 0 | 1 | 2, next)}
                  pointIndex={index}
                  value={point[coordinate]!}
                />
              ))}
              {!isEndpoint && (
                <button
                  aria-label={`删除路径点 ${index + 1}`}
                  className="text-sidebar-foreground/60 text-xs hover:text-destructive disabled:opacity-45"
                  disabled={readOnly}
                  onClick={() => deletePoint(index)}
                  type="button"
                >
                  删除
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function routeReviewLabel(reason: NonNullable<GlnHydronicPipe['routing']['reviewReason']>) {
  if (reason === 'missing-riser') return '跨层连接未找到已确认的竖井或设备墙，请人工确定立管位置。'
  if (reason === 'obstructed') return '吊顶候选路径碰到门窗、立柱或设备，请手动调整路径点。'
  return '管线端点不完整，无法生成隐蔽路径。'
}

function SelectedPipeRouting({ pipe, readOnly }: { pipe: GlnHydronicPipe; readOnly: boolean }) {
  const nodes = useScene((state) => state.nodes)
  const route = () => {
    if (!pipe.start || !pipe.end) {
      useScene.getState().updateNode(
        pipe.id as AnyNodeId,
        {
          routing: { strategy: 'manual', state: 'needs-review', reviewReason: 'missing-endpoint' },
        } as never,
      )
      return
    }
    const startNode = nodes[pipe.start.nodeId as never] as { id: string; type: string } | undefined
    const endNode = nodes[pipe.end.nodeId as never] as { id: string; type: string } | undefined
    if (!startNode || !endNode) return
    const start = getGlnPort(startNode, pipe.start)
    const end = getGlnPort(endNode, pipe.end)
    if (!start || !end) {
      useScene.getState().updateNode(
        pipe.id as AnyNodeId,
        {
          routing: { strategy: 'manual', state: 'needs-review', reviewReason: 'missing-endpoint' },
        } as never,
      )
      return
    }
    const plan = planGlnConcealedRoute({
      start: start.position as [number, number, number],
      end: end.position as [number, number, number],
      startNodeId: startNode.id,
      endNodeId: endNode.id,
      startLevelId: resolveGlnNodeLevelId(nodes as never, startNode.id),
      endLevelId: resolveGlnNodeLevelId(nodes as never, endNode.id),
      obstacles: collectGlnRoutingObstacles(nodes as never),
    })
    useScene.getState().updateNode(pipe.id as AnyNodeId, plan as never)
  }

  return (
    <section className="rounded-lg border border-sidebar-border p-3" data-gln-concealed-routing>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sidebar-foreground text-sm">隐蔽路径复核</p>
          <p className="mt-1 text-sidebar-foreground/55 text-xs">
            同层沿吊顶走线，面板前在墙内下行；跨层未确认立管时只提示人工复核。
          </p>
        </div>
        <Route className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/60" />
      </div>
      <button
        className="mt-3 flex h-9 w-full items-center justify-center rounded-md border border-sidebar-border text-sm hover:border-sidebar-ring disabled:opacity-45"
        disabled={readOnly}
        onClick={route}
        type="button"
      >
        按吊顶规则整理路径
      </button>
      {pipe.routing.state === 'needs-review' && pipe.routing.reviewReason && (
        <p className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sidebar-foreground/75 text-xs">
          待人工复核：{routeReviewLabel(pipe.routing.reviewReason)}
        </p>
      )}
    </section>
  )
}

export default function GlnEquipmentPanel() {
  const nodes = useScene((state) => state.nodes)
  const systemIds = useMemo(
    () =>
      Object.values(nodes)
        .filter((node) => (node as { type: string }).type === 'gln:system')
        .map((node) => (node as { id: string }).id),
    [nodes],
  )
  const equipmentCount = useMemo(
    () =>
      Object.values(nodes).filter(
        (node) =>
          (node as { type: string }).type === OUTDOOR_UNIT_KIND ||
          (node as { type: string }).type === BUFFER_TANK_KIND ||
          (node as { type: string }).type === WALL_PANEL_KIND ||
          (node as { type: string }).type === HYDRONIC_PIPE_KIND,
      ).length,
    [nodes],
  )
  const readOnly = useScene((state) => state.readOnly)
  const levelId = useViewer((state) => state.selection.levelId)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const selectedPanel = useMemo(() => {
    const selected = selectedIds.length === 1 ? nodes[selectedIds[0] as never] : undefined
    if ((selected as { type?: string } | undefined)?.type !== WALL_PANEL_KIND) return null
    return selected as unknown as {
      id: string
      zoneCandidateIds: string[]
    }
  }, [nodes, selectedIds])
  const selectedPipe = useMemo(() => {
    const selected = selectedIds.length === 1 ? nodes[selectedIds[0] as never] : undefined
    return (selected as { type?: string } | undefined)?.type === HYDRONIC_PIPE_KIND
      ? (GlnHydronicPipeNode.safeParse(selected).data ?? null)
      : null
  }, [nodes, selectedIds])
  const selectedPhysicalNode = useMemo(() => {
    const selected = selectedIds.length === 1 ? nodes[selectedIds[0] as never] : undefined
    const type = (selected as { type?: string } | undefined)?.type
    return type === OUTDOOR_UNIT_KIND ||
      type === BUFFER_TANK_KIND ||
      type === WALL_PANEL_KIND ||
      type === HYDRONIC_PIPE_KIND
      ? (selected as {
          id: string
          type: string
          systemId?: string
          metadata?: unknown
          locked?: boolean
        })
      : null
  }, [nodes, selectedIds])
  const selectedPhysicalNodeGenericLocked = Boolean(
    selectedPhysicalNode?.locked === true ||
      (selectedPhysicalNode?.metadata &&
        typeof selectedPhysicalNode.metadata === 'object' &&
        !Array.isArray(selectedPhysicalNode.metadata) &&
        (selectedPhysicalNode.metadata as Record<string, unknown>).locked === true),
  )
  const selectedPhysicalNodeAiLocked = Boolean(
    selectedPhysicalNode?.metadata &&
      typeof selectedPhysicalNode.metadata === 'object' &&
      !Array.isArray(selectedPhysicalNode.metadata) &&
      (selectedPhysicalNode.metadata as Record<string, unknown>).glnLocked === true,
  )
  const selectedEquipmentAsset = useMemo(() => {
    const selected = selectedIds.length === 1 ? nodes[selectedIds[0] as never] : undefined
    const type = (selected as { type?: string } | undefined)?.type
    return type === OUTDOOR_UNIT_KIND || type === BUFFER_TANK_KIND || type === WALL_PANEL_KIND
      ? (selected as { id: string; type: string })
      : null
  }, [nodes, selectedIds])
  const ambiguousZones = useMemo(
    () =>
      (selectedPanel?.zoneCandidateIds ?? []).map((id) => ({
        id,
        name: (nodes[id as never] as { name?: string } | undefined)?.name ?? '未命名空间',
      })),
    [nodes, selectedPanel],
  )
  const activeTool = useEditor((state) => state.tool)
  const readyKind = useGlnEquipmentStore((state) => state.readyKind)
  const setReadyKind = useGlnEquipmentStore((state) => state.setReadyKind)
  const systemId = useGlnEquipmentStore((state) => state.systemId)
  const setSystemId = useGlnEquipmentStore((state) => state.setSystemId)
  const hydronicCircuit = useGlnEquipmentStore((state) => state.hydronicCircuit)
  const setHydronicCircuit = useGlnEquipmentStore((state) => state.setHydronicCircuit)
  const showConcealedRoutes = useGlnEquipmentStore((state) => state.showConcealedRoutes)
  const setShowConcealedRoutes = useGlnEquipmentStore((state) => state.setShowConcealedRoutes)
  const installationAreaZoneId = useGlnEquipmentStore((state) => state.installationAreaZoneId)
  const setInstallationAreaZoneId = useGlnEquipmentStore((state) => state.setInstallationAreaZoneId)
  const installationAreaKind = useGlnEquipmentStore((state) => state.installationAreaKind)
  const setInstallationAreaKind = useGlnEquipmentStore((state) => state.setInstallationAreaKind)
  const displayMode = useGlnEquipmentStore((state) => state.displayMode)
  const [deletePreviewOpen, setDeletePreviewOpen] = useState(false)

  useEffect(() => {
    if (systemId && systemIds.includes(systemId)) return
    setSystemId(systemIds[0] ?? null)
  }, [systemId, systemIds, setSystemId])

  const canPlace = !readOnly && !!levelId && !!systemId
  const installationZones = useMemo(
    () =>
      Object.values(nodes)
        .filter((node) => node.type === 'zone' && node.parentId === levelId)
        .map((node) => {
          const zone = node as unknown as { id: string; name?: string }
          return { id: zone.id, name: zone.name?.trim() || '未命名空间' }
        }),
    [levelId, nodes],
  )
  const outdoorInstallationReady =
    !!installationAreaZoneId && installationAreaKind === 'outdoor-equipment-area'
  const tankInstallationReady =
    !!installationAreaZoneId && TANK_AREA_KINDS.includes(installationAreaKind)
  const topologyIssues = useMemo(
    () => (systemId ? getGlnHydronicTopologyIssues(nodes as never, systemId) : []),
    [nodes, systemId],
  )
  const installationIssues = useMemo(() => getGlnInstallationIssues(nodes as never), [nodes])
  const runPreview = useMemo(() => deriveGlnRunPreview(nodes as never), [nodes])
  const deleteImpact = useMemo(
    () =>
      selectedPhysicalNode && systemId && selectedPhysicalNode.systemId === systemId
        ? getGlnHydronicDeleteImpact(nodes as never, systemId, [selectedPhysicalNode.id])
        : null,
    [nodes, selectedPhysicalNode, systemId],
  )

  useEffect(() => {
    void Promise.all([
      import('./outdoor-unit-tool'),
      import('./buffer-tank-tool'),
      import('./hydronic-pipe-tool'),
      import('./wall-panel-tool'),
    ])
  }, [])

  const activate = (
    kind:
      | typeof OUTDOOR_UNIT_KIND
      | typeof BUFFER_TANK_KIND
      | typeof WALL_PANEL_KIND
      | typeof HYDRONIC_PIPE_KIND,
  ) => {
    if (!canPlace) return
    if (kind === OUTDOOR_UNIT_KIND && !outdoorInstallationReady) return
    if (kind === BUFFER_TANK_KIND && !tankInstallationReady) return
    setReadyKind(null)
    const editor = useEditor.getState()
    ;(editor.setTool as (tool: string) => void)(kind)
    editor.setMode('build')
  }

  if (displayMode === 'run-preview') {
    return (
      <div
        className="flex h-full flex-col gap-4 overflow-y-auto p-4"
        data-gln-equipment-panel
        data-gln-run-preview
      >
        <header>
          <h2 className="font-semibold text-lg text-sidebar-foreground">光冷暖运行预览</h2>
          <p className="mt-1 text-sidebar-foreground/60 text-sm">
            同一实时场景，仅显示拓扑方向和用户目标设置。
          </p>
          <GlnDisplayModeControl />
        </header>
        {runPreview.panels.length === 0 && (
          <p className="rounded-md border border-dashed border-sidebar-border p-3 text-sidebar-foreground/60 text-xs">
            暂无可预览的完整面板回路。请回到编辑视图检查供回水连接。
          </p>
        )}
        {runPreview.panels.map((panel) => {
          const zoneName =
            (nodes[panel.zoneId as never] as { name?: string } | undefined)?.name ?? '未命名空间'
          return (
            <section
              className="rounded-md border border-sidebar-border bg-sidebar-accent/35 p-3"
              data-gln-preview-panel={panel.panelId}
              key={panel.panelId}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-sidebar-foreground text-sm">{zoneName}</p>
                <span className="text-sidebar-foreground/60 text-xs">
                  {panel.energyDirection === 'space-to-panel'
                    ? '夏季：空间 → 面板'
                    : '冬季：面板 → 空间'}
                </span>
              </div>
              <div className="mt-2 flex gap-3 text-sidebar-foreground/70 text-xs">
                <span>
                  目标温度：
                  {panel.targetTemperature === null ? '未设置' : `${panel.targetTemperature}°C`}
                </span>
                <span>
                  目标湿度：
                  {panel.targetHumidity === null ? '未设置' : `${panel.targetHumidity}%`}
                </span>
              </div>
            </section>
          )
        })}
        <p className="text-sidebar-foreground/50 text-xs">
          运行预览不表示实时温湿度、流量、负荷或设备性能。
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4" data-gln-equipment-panel>
      <header>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg text-sidebar-foreground">光冷暖设备</h2>
          <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-sidebar-foreground/70 text-xs">
            {equipmentCount} 台
          </span>
        </div>
        <p className="mt-1 text-sidebar-foreground/60 text-sm">
          选择所属系统，然后在场景中放置设备。
        </p>
        <GlnDisplayModeControl />
      </header>

      <label className="flex flex-col gap-1.5 text-sidebar-foreground text-sm">
        所属系统
        <select
          aria-label="所属系统"
          className="h-10 rounded-md border border-sidebar-border bg-sidebar px-3 outline-none focus:border-sidebar-ring"
          disabled={systemIds.length === 0 || readOnly}
          onChange={(event) => setSystemId(event.target.value || null)}
          value={systemId ?? ''}
        >
          {systemIds.length === 0 && <option value="">请先创建系统</option>}
          {systemIds.map((id) => (
            <SystemOption key={id} systemId={id} />
          ))}
        </select>
      </label>

      <section className="rounded-lg border border-sidebar-border p-3" data-gln-installation-area>
        <p className="font-medium text-sidebar-foreground text-sm">确认安装区域</p>
        <p className="mt-1 text-sidebar-foreground/55 text-xs">
          外机仅限室外设备区；水箱仅限设备间、机房或设备区。该选择会写入新设备。
        </p>
        <label className="mt-3 flex flex-col gap-1.5 text-sidebar-foreground text-xs">
          安装空间
          <select
            aria-label="安装空间"
            className="h-9 rounded-md border border-sidebar-border bg-sidebar px-2 text-sm outline-none focus:border-sidebar-ring"
            disabled={readOnly || !levelId}
            onChange={(event) => setInstallationAreaZoneId(event.target.value || null)}
            value={installationAreaZoneId ?? ''}
          >
            <option value="">请选择空间</option>
            {installationZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 flex flex-col gap-1.5 text-sidebar-foreground text-xs">
          区域用途
          <select
            aria-label="区域用途"
            className="h-9 rounded-md border border-sidebar-border bg-sidebar px-2 text-sm outline-none focus:border-sidebar-ring"
            disabled={readOnly}
            onChange={(event) =>
              setInstallationAreaKind(event.target.value as GlnEquipmentInstallationAreaKind)
            }
            value={installationAreaKind}
          >
            <option value="unassigned">未确认</option>
            {INSTALLATION_AREA_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {AREA_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <button
        aria-busy={activeTool === OUTDOOR_UNIT_KIND && readyKind !== OUTDOOR_UNIT_KIND}
        aria-pressed={activeTool === OUTDOOR_UNIT_KIND}
        className={`flex min-h-24 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
          activeTool === OUTDOOR_UNIT_KIND
            ? 'border-sidebar-ring bg-sidebar-accent'
            : 'border-sidebar-border hover:border-sidebar-ring/60 hover:bg-sidebar-accent/50'
        } disabled:cursor-not-allowed disabled:opacity-45`}
        disabled={!canPlace || !outdoorInstallationReady}
        onClick={() => activate(OUTDOOR_UNIT_KIND)}
        type="button"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background">
          <Fan className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">放置外机</span>
          <span className="mt-1 block text-sidebar-foreground/55 text-xs">
            参数化设备，带供水和回水接口
          </span>
        </span>
      </button>

      <section className="rounded-lg border border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background">
            <GitBranch className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-sidebar-foreground text-sm">绘制供回水管</p>
            <p className="text-sidebar-foreground/55 text-xs">
              点击添加路径点，Enter 完成并连接端口
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="管路类型">
          {(['supply', 'return'] as const).map((circuit) => (
            <button
              aria-pressed={hydronicCircuit === circuit}
              className={`rounded-md border px-3 py-2 text-sm ${
                hydronicCircuit === circuit
                  ? 'border-sidebar-ring bg-sidebar-accent'
                  : 'border-sidebar-border hover:border-sidebar-ring/60'
              }`}
              key={circuit}
              onClick={() => setHydronicCircuit(circuit)}
              type="button"
            >
              {circuit === 'supply' ? '供水' : '回水'}
            </button>
          ))}
        </div>
        <button
          aria-pressed={activeTool === HYDRONIC_PIPE_KIND}
          className="mt-2 flex h-10 w-full items-center justify-center rounded-md bg-sidebar-accent font-medium text-sidebar-foreground text-sm hover:bg-sidebar-accent/75 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!canPlace}
          onClick={() => activate(HYDRONIC_PIPE_KIND)}
          type="button"
        >
          {hydronicCircuit === 'supply' ? '绘制供水路径' : '绘制回水路径'}
        </button>
        <button
          aria-pressed={showConcealedRoutes}
          className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-sidebar-border text-sidebar-foreground text-sm hover:border-sidebar-ring"
          onClick={() => setShowConcealedRoutes(!showConcealedRoutes)}
          type="button"
        >
          {showConcealedRoutes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showConcealedRoutes ? '关闭隐蔽路径检查' : '检查隐蔽路径'}
        </button>
      </section>

      {selectedPipe && <SelectedPipeEditor pipe={selectedPipe} readOnly={readOnly} />}
      {selectedPipe && <SelectedPipeRouting pipe={selectedPipe} readOnly={readOnly} />}

      {selectedEquipmentAsset && (
        <section
          className="rounded-md border border-sidebar-border bg-sidebar-accent/35 p-3"
          data-gln-generic-specification
        >
          <p className="font-medium text-sidebar-foreground text-sm">产品资料</p>
          <p className="mt-1 text-sidebar-foreground/65 text-xs">
            通用占位尺寸预设，型号未指定。当前仅保存可编辑外形与手工填写的检修净空，不代表厂家品牌、容量、性能或检修要求。
          </p>
        </section>
      )}

      {selectedPhysicalNode && (
        <section className="rounded-lg border border-sidebar-border p-3" data-gln-ai-lock>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sidebar-foreground text-sm">AI 变更锁定</p>
              <p className="mt-1 text-sidebar-foreground/55 text-xs">
                {selectedPhysicalNodeGenericLocked
                  ? '此节点已被场景通用锁锁定，AI 变更状态只能在解除通用锁后调整。'
                  : '锁定后，本地 Codex 不能更新、移动或删除此节点；你仍可手动编辑。'}
              </p>
            </div>
            {selectedPhysicalNodeAiLocked ? (
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            ) : (
              <Unlock className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            )}
          </div>
          <button
            aria-pressed={selectedPhysicalNodeAiLocked}
            className="mt-3 flex h-9 w-full items-center justify-center rounded-md border border-sidebar-border text-sm hover:border-sidebar-ring disabled:opacity-45"
            disabled={readOnly || selectedPhysicalNodeGenericLocked}
            onClick={() => {
              const metadata =
                selectedPhysicalNode.metadata &&
                typeof selectedPhysicalNode.metadata === 'object' &&
                !Array.isArray(selectedPhysicalNode.metadata)
                  ? (selectedPhysicalNode.metadata as Record<string, unknown>)
                  : {}
              useScene.getState().updateNodes([
                {
                  id: selectedPhysicalNode.id as AnyNodeId,
                  data: {
                    metadata: {
                      ...metadata,
                      glnLocked: !selectedPhysicalNodeAiLocked,
                    },
                  } as never,
                },
              ])
            }}
            type="button"
          >
            {selectedPhysicalNodeGenericLocked
              ? '场景节点已锁定'
              : selectedPhysicalNodeAiLocked
                ? '允许 AI 变更'
                : '锁定 AI 变更'}
          </button>
        </section>
      )}

      {systemId && topologyIssues.length > 0 && (
        <section
          className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
          data-gln-topology-issues
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="font-medium text-sidebar-foreground text-sm">水路待修复</p>
          </div>
          <ul className="mt-1 space-y-1 text-sidebar-foreground/65 text-xs">
            {topologyIssues.map((issue) => (
              <li key={`${issue.code}-${issue.pipeId ?? issue.message}`}>
                <button
                  className="text-left underline-offset-2 hover:text-sidebar-foreground hover:underline"
                  onClick={() => {
                    const target = issue.pipeId ?? issue.nodeIds[0]
                    if (target)
                      useViewer.getState().setSelection({ selectedIds: [target as never] })
                  }}
                  type="button"
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {installationIssues.length > 0 && (
        <section
          className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
          data-gln-installation-issues
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="font-medium text-sidebar-foreground text-sm">安装待复核</p>
          </div>
          <ul className="mt-1 space-y-1 text-sidebar-foreground/65 text-xs">
            {installationIssues.map((issue) => (
              <li key={`${issue.code}-${issue.nodeIds.join('-')}`}>
                <button
                  className="text-left underline-offset-2 hover:text-sidebar-foreground hover:underline"
                  onClick={() =>
                    useViewer.getState().setSelection({ selectedIds: [issue.nodeIds[0] as never] })
                  }
                  type="button"
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedPhysicalNode && deleteImpact && (
        <section className="rounded-lg border border-sidebar-border p-3" data-gln-delete-impact>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sidebar-foreground text-sm">删除影响</p>
              <p className="mt-1 text-sidebar-foreground/55 text-xs">
                删除不会自动重连相邻设备，未受影响节点将保持不变。
              </p>
            </div>
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/60" />
          </div>
          {!deletePreviewOpen ? (
            <button
              className="mt-3 flex h-9 w-full items-center justify-center rounded-md border border-sidebar-border text-sm hover:border-sidebar-ring disabled:opacity-45"
              disabled={readOnly}
              onClick={() => setDeletePreviewOpen(true)}
              type="button"
            >
              查看删除影响
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sidebar-foreground/70 text-xs">
                将影响 {deleteImpact.affectedPipeIds.length} 条管线，删除后有{' '}
                {deleteImpact.issuesAfterDelete.length} 项待修复。
              </p>
              <div className="flex gap-2">
                <button
                  className="h-9 flex-1 rounded-md border border-sidebar-border text-sm hover:border-sidebar-ring"
                  onClick={() => setDeletePreviewOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="h-9 flex-1 rounded-md border border-destructive/60 bg-destructive/10 text-destructive text-sm hover:bg-destructive/20 disabled:opacity-45"
                  disabled={readOnly}
                  onClick={() => {
                    useScene.getState().deleteNode(selectedPhysicalNode.id as AnyNodeId)
                    useViewer.getState().setSelection({ selectedIds: [] })
                    setDeletePreviewOpen(false)
                  }}
                  type="button"
                >
                  确认删除
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <button
        aria-busy={activeTool === WALL_PANEL_KIND && readyKind !== WALL_PANEL_KIND}
        aria-pressed={activeTool === WALL_PANEL_KIND}
        className={`flex min-h-24 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
          activeTool === WALL_PANEL_KIND
            ? 'border-sidebar-ring bg-sidebar-accent'
            : 'border-sidebar-border hover:border-sidebar-ring/60 hover:bg-sidebar-accent/50'
        } disabled:cursor-not-allowed disabled:opacity-45`}
        disabled={!canPlace}
        onClick={() => activate(WALL_PANEL_KIND)}
        type="button"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background">
          <PanelTop className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">放置室内面板</span>
          <span className="mt-1 block text-sidebar-foreground/55 text-xs">
            贴墙安装，顶部局部左供右回
          </span>
        </span>
      </button>

      {selectedPanel && ambiguousZones.length > 1 && (
        <section className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="font-medium text-sidebar-foreground text-sm">请选择面板所属空间</p>
          <p className="mt-1 text-sidebar-foreground/60 text-xs">
            该墙面邻接多个空间，系统不会自动猜测。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ambiguousZones.map((zone) => (
              <button
                className="rounded-md border border-sidebar-border bg-sidebar px-2.5 py-1.5 text-sidebar-foreground text-xs hover:border-sidebar-ring"
                key={zone.id}
                onClick={() =>
                  useScene.getState().updateNodes([
                    {
                      id: selectedPanel.id as AnyNodeId,
                      data: {
                        zoneId: zone.id,
                        zoneCandidateIds: [],
                        zoneAssignment: 'manual',
                      } as never,
                    },
                  ])
                }
                type="button"
              >
                {zone.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        aria-busy={activeTool === BUFFER_TANK_KIND && readyKind !== BUFFER_TANK_KIND}
        aria-pressed={activeTool === BUFFER_TANK_KIND}
        className={`flex min-h-24 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
          activeTool === BUFFER_TANK_KIND
            ? 'border-sidebar-ring bg-sidebar-accent'
            : 'border-sidebar-border hover:border-sidebar-ring/60 hover:bg-sidebar-accent/50'
        } disabled:cursor-not-allowed disabled:opacity-45`}
        disabled={!canPlace || !tankInstallationReady}
        onClick={() => activate(BUFFER_TANK_KIND)}
        type="button"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background">
          <Cylinder className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">放置缓冲水箱</span>
          <span className="mt-1 block text-sidebar-foreground/55 text-xs">
            带主机侧与负载侧四个水路接口
          </span>
        </span>
      </button>

      {!levelId && (
        <p className="flex items-start gap-2 rounded-md border border-dashed border-sidebar-border p-3 text-sidebar-foreground/60 text-xs">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          请先选择一个楼层。
        </p>
      )}
      {systemIds.length === 0 && (
        <p className="rounded-md border border-dashed border-sidebar-border p-3 text-sidebar-foreground/60 text-xs">
          请先在“光冷暖系统”面板中新建系统。
        </p>
      )}
    </div>
  )
}
