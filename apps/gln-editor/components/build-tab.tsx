'use client'

import { type AnyNode, useScene } from '@pascal-app/core'
import { triggerSFX, useEditor } from '@pascal-app/editor'
import { GLN_PLUGIN_ID, GlnSystemNode, useGlnEquipmentStore } from '@pascal-app/plugin-gln'
import { Cylinder, Fan, GitBranch, PanelTop } from 'lucide-react'
import { useCallback } from 'react'
import { BuildTab, type BuildTabExtraGroup } from '../../editor/components/build-tab'

type GlnQuickTool = 'gln:outdoor-unit' | 'gln:buffer-tank' | 'gln:hydronic-pipe' | 'gln:wall-panel'

const QUICK_TOOLS: Array<{
  kind: GlnQuickTool
  label: string
  description: string
  Icon: typeof Fan
}> = [
  { kind: 'gln:outdoor-unit', label: '外机', description: '室外冷热源', Icon: Fan },
  {
    kind: 'gln:buffer-tank',
    label: '缓冲水箱',
    description: '稳定系统水温',
    Icon: Cylinder,
  },
  { kind: 'gln:hydronic-pipe', label: '水管', description: '连接供回水端口', Icon: GitBranch },
  { kind: 'gln:wall-panel', label: '面板', description: '贴墙室内末端', Icon: PanelTop },
]

function GlnQuickEquipmentPalette() {
  const readOnly = useScene((state) => state.readOnly)
  const hydronicInstallationMode = useGlnEquipmentStore((state) => state.hydronicInstallationMode)
  const setHydronicInstallationMode = useGlnEquipmentStore(
    (state) => state.setHydronicInstallationMode,
  )
  const hydronicServiceHeightM = useGlnEquipmentStore((state) => state.hydronicServiceHeightM)
  const setHydronicServiceHeightM = useGlnEquipmentStore((state) => state.setHydronicServiceHeightM)

  const activate = useCallback(
    (kind: GlnQuickTool) => {
      if (readOnly) return

      const scene = useScene.getState()
      const currentSystemId = useGlnEquipmentStore.getState().systemId
      const nodes = scene.nodes as Record<string, { id: string; type?: string }>
      const currentSystem = currentSystemId ? nodes[currentSystemId] : null
      const firstSystem = Object.values(nodes).find((node) => node.type === 'gln:system')
      const system = currentSystem?.type === 'gln:system' ? currentSystem : firstSystem

      if (system) {
        useGlnEquipmentStore.getState().setSystemId(system.id)
      } else {
        const created = GlnSystemNode.parse({ name: '住宅光冷暖系统 1' })
        if (!scene.installedPlugins.includes(GLN_PLUGIN_ID)) {
          scene.setInstalledPlugins([...scene.installedPlugins, GLN_PLUGIN_ID], {
            explicit: scene.hasExplicitPluginInstallState,
          })
        }
        scene.createNode(created as unknown as AnyNode)
        useGlnEquipmentStore.getState().setSystemId(created.id)
      }

      const editor = useEditor.getState()
      editor.setPhase('structure')
      editor.setStructureLayer('elements')
      editor.setCatalogCategory(null)
      editor.setMode('build')
      editor.setTool(kind)
      triggerSFX('sfx:menu-click')
    },
    [readOnly],
  )

  return (
    <section className="flex flex-col gap-3 py-1" data-gln-quick-equipment>
      <p className="px-0.5 text-muted-foreground text-xs">选择设备后直接在场景中放置。</p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_TOOLS.map(({ Icon, description, kind, label }) => (
          <button
            aria-label={`选择${label}`}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-2 py-3 text-center transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
            data-gln-quick-tool={kind}
            disabled={readOnly}
            key={kind}
            onClick={() => activate(kind)}
            type="button"
          >
            <Icon aria-hidden className="size-7 text-primary" strokeWidth={1.8} />
            <span className="font-medium text-foreground text-sm">{label}</span>
            <span className="text-muted-foreground text-[10px] leading-tight">{description}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2 border-border border-t pt-3">
        <p className="font-medium text-foreground text-xs">水管布置</p>
        <div
          aria-label="布管方式"
          className="grid grid-cols-3 gap-1"
          data-gln-hydronic-installation-mode={hydronicInstallationMode}
          role="group"
        >
          {(
            [
              ['ceiling', '天花板'],
              ['wall', '沿墙'],
              ['through-wall', '穿墙'],
            ] as const
          ).map(([mode, label]) => (
            <button
              aria-pressed={hydronicInstallationMode === mode}
              className={`rounded-md border px-1 py-2 text-xs ${
                hydronicInstallationMode === mode
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/60'
              }`}
              disabled={readOnly}
              key={mode}
              onClick={() => setHydronicInstallationMode(mode)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
          <span>安装高度</span>
          <span className="flex items-center gap-1">
            <input
              aria-label="水管安装高度"
              className="h-8 w-20 rounded border border-border bg-background px-2 text-right text-foreground"
              disabled={readOnly}
              max={6}
              min={0.1}
              onChange={(event) =>
                setHydronicServiceHeightM(
                  Math.max(0.1, Math.min(6, Number(event.target.value) || 2.3)),
                )
              }
              step={0.05}
              type="number"
              value={hydronicServiceHeightM}
            />
            米
          </span>
        </label>
      </div>
      <p className="px-0.5 text-muted-foreground text-xs leading-relaxed">
        外机和缓冲水箱可直接落地放置；水管依次点两个设备端口；面板直接点墙面。
      </p>
    </section>
  )
}

const GLN_BUILD_GROUPS: readonly BuildTabExtraGroup[] = [
  {
    id: 'gln',
    label: '光冷暖',
    icon: <Fan aria-hidden className="size-7" strokeWidth={1.8} />,
    content: <GlnQuickEquipmentPalette />,
  },
]

export function GlnBuildTab() {
  return <BuildTab extraGroups={GLN_BUILD_GROUPS} />
}
