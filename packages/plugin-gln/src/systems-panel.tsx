'use client'

import { type AnyNode, useScene } from '@pascal-app/core'
import { Check, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GLN_PLUGIN_ID } from './constants'
import { useGlnEquipmentStore } from './equipment-store'
import { type GlnSystemMode, GlnSystemNode } from './system-schema'

const MODES: Array<{ value: GlnSystemMode; label: string }> = [
  { value: 'cooling', label: '制冷' },
  { value: 'heating', label: '制热' },
  { value: 'standby', label: '待机' },
]

function SystemNameField({ readOnly, system }: { readOnly: boolean; system: GlnSystemNode }) {
  const updateNode = useScene((state) => state.updateNode)
  const [value, setValue] = useState(system.name)

  useEffect(() => setValue(system.name), [system.name])

  const commit = () => {
    const name = value.trim()
    if (!name) {
      setValue(system.name)
      return
    }
    if (name !== system.name) {
      updateNode(system.id as never, { name } as never)
    }
  }

  return (
    <input
      aria-label="系统名称"
      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      disabled={readOnly}
      id={system.id}
      maxLength={120}
      onBlur={commit}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
      value={value}
    />
  )
}

function SystemCard({ systemId }: { systemId: string }) {
  const rawSystem = useScene((state) => state.nodes[systemId as never])
  const readOnly = useScene((state) => state.readOnly)
  const updateNode = useScene((state) => state.updateNode)
  const system = useMemo(() => {
    const parsed = GlnSystemNode.safeParse(rawSystem)
    return parsed.success ? parsed.data : null
  }, [rawSystem])

  if (!system) return null

  return (
    <section
      className="rounded-lg border border-border bg-background/50 p-3"
      data-gln-system-id={system.id}
    >
      <label className="mb-1.5 block text-muted-foreground text-xs" htmlFor={system.id}>
        系统名称
      </label>
      <SystemNameField readOnly={readOnly} system={system} />

      <div className="mt-4">
        <p className="mb-2 text-muted-foreground text-xs">运行模式</p>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-accent/60 p-1">
          {MODES.map((mode) => {
            const active = system.mode === mode.value
            return (
              <button
                aria-pressed={active}
                className={`flex h-9 items-center justify-center gap-1 rounded text-sm transition-colors ${
                  active
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                key={mode.value}
                disabled={readOnly}
                onClick={() => updateNode(system.id as never, { mode: mode.value } as never)}
                type="button"
              >
                {active && <Check className="h-3.5 w-3.5" />}
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default function GlnSystemsPanel() {
  const systemIds = useScene(
    useShallow((state) =>
      Object.values(state.nodes)
        .filter((node) => (node as { type: string }).type === 'gln:system')
        .map((node) => (node as { id: string }).id),
    ),
  )
  const readOnly = useScene((state) => state.readOnly)

  const createSystem = () => {
    const scene = useScene.getState()
    const system = GlnSystemNode.parse({
      name: `住宅光冷暖系统 ${systemIds.length + 1}`,
    })
    if (!scene.installedPlugins.includes(GLN_PLUGIN_ID)) {
      scene.setInstalledPlugins([...scene.installedPlugins, GLN_PLUGIN_ID], {
        explicit: scene.hasExplicitPluginInstallState,
      })
    }
    scene.createNode(system as unknown as AnyNode)
    useGlnEquipmentStore.getState().setSystemId(system.id)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4" data-gln-systems-panel>
      <div className="mb-4">
        <h2 className="font-semibold text-lg text-sidebar-foreground">光冷暖系统</h2>
        <p className="mt-1 text-sidebar-foreground/60 text-sm">创建系统并设置当前运行模式。</p>
      </div>

      <div className="flex flex-col gap-3">
        {systemIds.map((systemId) => (
          <SystemCard key={systemId} systemId={systemId} />
        ))}
        {systemIds.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground text-sm">
            尚未创建光冷暖系统
          </p>
        )}
      </div>

      <button
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 font-medium text-primary-foreground text-sm disabled:opacity-50"
        disabled={readOnly}
        onClick={createSystem}
        type="button"
      >
        <Plus className="h-4 w-4" />
        新建系统
      </button>
    </div>
  )
}
