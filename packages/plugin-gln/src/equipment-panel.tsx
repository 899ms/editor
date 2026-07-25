'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useEditor, useViewer } from '@pascal-app/editor'
import { Cylinder, Fan, MapPin, PanelTop } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useGlnEquipmentStore } from './equipment-store'

const OUTDOOR_UNIT_KIND = 'gln:outdoor-unit'
const BUFFER_TANK_KIND = 'gln:buffer-tank'
const WALL_PANEL_KIND = 'gln:wall-panel'

function SystemOption({ systemId }: { systemId: string }) {
  const name = useScene(
    (state) => (state.nodes[systemId as never] as { name?: string } | undefined)?.name,
  )
  return <option value={systemId}>{name ?? '未命名系统'}</option>
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
          (node as { type: string }).type === WALL_PANEL_KIND,
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

  useEffect(() => {
    if (systemId && systemIds.includes(systemId)) return
    setSystemId(systemIds[0] ?? null)
  }, [systemId, systemIds, setSystemId])

  const canPlace = !readOnly && !!levelId && !!systemId

  useEffect(() => {
    void Promise.all([
      import('./outdoor-unit-tool'),
      import('./buffer-tank-tool'),
      import('./wall-panel-tool'),
    ])
  }, [])

  const activate = (
    kind: typeof OUTDOOR_UNIT_KIND | typeof BUFFER_TANK_KIND | typeof WALL_PANEL_KIND,
  ) => {
    if (!canPlace) return
    setReadyKind(null)
    const editor = useEditor.getState()
    ;(editor.setTool as (tool: string) => void)(kind)
    editor.setMode('build')
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

      <button
        aria-busy={activeTool === OUTDOOR_UNIT_KIND && readyKind !== OUTDOOR_UNIT_KIND}
        aria-pressed={activeTool === OUTDOOR_UNIT_KIND}
        className={`flex min-h-24 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
          activeTool === OUTDOOR_UNIT_KIND
            ? 'border-sidebar-ring bg-sidebar-accent'
            : 'border-sidebar-border hover:border-sidebar-ring/60 hover:bg-sidebar-accent/50'
        } disabled:cursor-not-allowed disabled:opacity-45`}
        disabled={!canPlace}
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
        disabled={!canPlace}
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
