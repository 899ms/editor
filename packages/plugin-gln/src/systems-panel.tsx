'use client'

import { type AnyNode, useScene } from '@pascal-app/core'
import { Check, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GLN_PLUGIN_ID } from './constants'
import { useGlnEquipmentStore } from './equipment-store'
import { type GlnSystemMode, GlnSystemNode } from './system-schema'
import { type GlnZoneControl, getGlnZoneControls } from './zone-settings'

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

function ZoneNumberField({
  control,
  label,
  settingKey,
  sourceKey,
  system,
  readOnly,
  max,
  min,
  suffix,
  source,
}: {
  control: GlnZoneControl
  label: string
  settingKey: 'targetTemperature' | 'targetHumidity'
  sourceKey: 'targetTemperatureSource' | 'targetHumiditySource'
  system: GlnSystemNode
  readOnly: boolean
  max: number
  min: number
  suffix: string
  source: 'unset' | 'user' | 'template'
}) {
  const updateNode = useScene((state) => state.updateNode)
  const value = control.settings[settingKey]
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const active = control.panelCount > 0

  useEffect(() => setDraft(value === null ? '' : String(value)), [value])

  const commit = () => {
    const next = draft.trim() === '' ? null : Number(draft)
    if (next !== null && (!Number.isFinite(next) || next < min || next > max)) {
      setDraft(value === null ? '' : String(value))
      return
    }
    if (next === value) return
    updateNode(
      system.id as never,
      {
        zoneSettings: {
          ...system.zoneSettings,
          [control.zoneId]: {
            ...control.settings,
            [settingKey]: next,
            [sourceKey]: next === null ? 'unset' : 'user',
          },
        },
      } as never,
    )
  }

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sidebar-foreground text-xs">
      <span className="flex items-center justify-between gap-1">
        {label}
        <span className="shrink-0 text-sidebar-foreground/55">
          {source === 'template' ? '模板建议' : source === 'user' ? '用户输入' : '未设置'}
        </span>
      </span>
      <div className="flex h-9 items-center rounded-md border border-sidebar-border bg-sidebar px-2">
        <input
          aria-label={`${control.zoneName}${label}`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          disabled={readOnly || !active}
          inputMode="decimal"
          max={max}
          min={min}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          placeholder="未设置"
          value={draft}
        />
        <span className="text-sidebar-foreground/55">{suffix}</span>
      </div>
    </label>
  )
}

function ZoneControlCard({
  control,
  readOnly,
  system,
}: {
  control: GlnZoneControl
  readOnly: boolean
  system: GlnSystemNode
}) {
  const updateNode = useScene((state) => state.updateNode)
  const active = control.panelCount > 0

  return (
    <section
      className="rounded-md border border-border bg-background/40 p-3"
      data-gln-zone-control={control.zoneId}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-medium text-sidebar-foreground text-sm">{control.zoneName}</h4>
          <p className="mt-0.5 text-sidebar-foreground/55 text-xs">
            {active
              ? `${control.panelCount} 块面板共享一组目标`
              : '未安装面板，已保留设置但暂不启用'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <ZoneNumberField
          control={control}
          label="目标温度"
          max={40}
          min={5}
          readOnly={readOnly}
          settingKey="targetTemperature"
          sourceKey="targetTemperatureSource"
          source={control.settings.targetTemperatureSource}
          suffix="°C"
          system={system}
        />
        <ZoneNumberField
          control={control}
          label="目标湿度"
          max={90}
          min={10}
          readOnly={readOnly}
          settingKey="targetHumidity"
          sourceKey="targetHumiditySource"
          source={control.settings.targetHumiditySource}
          suffix="%"
          system={system}
        />
      </div>
      <label className="mt-3 flex items-center justify-between gap-3 text-sidebar-foreground text-xs">
        <span>分区启用</span>
        <input
          aria-label={`${control.zoneName}分区启用`}
          checked={active && control.settings.enabled}
          disabled={readOnly || !active}
          onChange={(event) =>
            updateNode(
              system.id as never,
              {
                zoneSettings: {
                  ...system.zoneSettings,
                  [control.zoneId]: { ...control.settings, enabled: event.target.checked },
                },
              } as never,
            )
          }
          type="checkbox"
        />
      </label>
      <p className="mt-2 text-sidebar-foreground/50 text-xs">
        目标设置不代表实际测量、负荷计算或独立除湿能力。
      </p>
    </section>
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
  const nodes = useScene((state) => state.nodes)
  const controls = useMemo(() => (system ? getGlnZoneControls(system, nodes) : []), [nodes, system])

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
      <div className="mt-4">
        <p className="mb-2 text-muted-foreground text-xs">分区目标设置</p>
        {controls.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-muted-foreground text-xs">
            安装室内面板后，对应空间会在这里启用目标设置。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {controls.map((control) => (
              <ZoneControlCard
                control={control}
                key={control.zoneId}
                readOnly={readOnly}
                system={system}
              />
            ))}
          </div>
        )}
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
