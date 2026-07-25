'use client'

import { useScene } from '@pascal-app/core'
import { useEditor, useViewer } from '@pascal-app/editor'
import { Fan, MapPin } from 'lucide-react'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGlnEquipmentStore } from './equipment-store'

const OUTDOOR_UNIT_KIND = 'gln:outdoor-unit'

function SystemOption({ systemId }: { systemId: string }) {
  const name = useScene(
    (state) => (state.nodes[systemId as never] as { name?: string } | undefined)?.name,
  )
  return <option value={systemId}>{name ?? '未命名系统'}</option>
}

export default function GlnEquipmentPanel() {
  const systemIds = useScene(
    useShallow((state) =>
      Object.values(state.nodes)
        .filter((node) => (node as { type: string }).type === 'gln:system')
        .map((node) => (node as { id: string }).id),
    ),
  )
  const outdoorUnitCount = useScene(
    (state) =>
      Object.values(state.nodes).filter(
        (node) => (node as { type: string }).type === OUTDOOR_UNIT_KIND,
      ).length,
  )
  const readOnly = useScene((state) => state.readOnly)
  const levelId = useViewer((state) => state.selection.levelId)
  const activeTool = useEditor((state) => state.tool)
  const systemId = useGlnEquipmentStore((state) => state.systemId)
  const setSystemId = useGlnEquipmentStore((state) => state.setSystemId)

  useEffect(() => {
    if (systemId && systemIds.includes(systemId)) return
    setSystemId(systemIds[0] ?? null)
  }, [systemId, systemIds, setSystemId])

  const canPlace = !readOnly && !!levelId && !!systemId
  const placing = activeTool === OUTDOOR_UNIT_KIND

  const activate = () => {
    if (!canPlace) return
    const editor = useEditor.getState()
    ;(editor.setTool as (tool: string) => void)(OUTDOOR_UNIT_KIND)
    editor.setMode('build')
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4" data-gln-equipment-panel>
      <header>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg text-sidebar-foreground">光冷暖设备</h2>
          <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-sidebar-foreground/70 text-xs">
            {outdoorUnitCount} 台
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
        aria-pressed={placing}
        className={`flex min-h-24 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
          placing
            ? 'border-sidebar-ring bg-sidebar-accent'
            : 'border-sidebar-border hover:border-sidebar-ring/60 hover:bg-sidebar-accent/50'
        } disabled:cursor-not-allowed disabled:opacity-45`}
        disabled={!canPlace}
        onClick={activate}
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
