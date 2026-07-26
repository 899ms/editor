import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { GlnSystemNode } from './system-schema'

type GlnSystemDefinition = NodeDefinition<typeof GlnSystemNode> & Record<string, unknown>

export const glnSystemDefinition: GlnSystemDefinition = {
  kind: 'gln:system',
  schemaVersion: 1,
  schema: GlnSystemNode,
  category: 'utility',
  bake: 'strip',
  dirtyTracking: false,
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: false,
    metadata: {},
    name: '住宅光冷暖系统',
    mode: 'standby',
    zoneSettings: {},
  }),
  capabilities: {},
  presentation: {
    label: '光冷暖系统',
    description: '管理一套光冷暖水系统的名称、运行模式和分区目标设置。',
    icon: { kind: 'iconify', name: 'lucide:thermometer-sun' },
    hidden: true,
  },
  mcp: {
    description:
      'Logical GLN hydronic system. Runtime mode and zone target settings are stored here; targets are not measurements.',
  },
}

export const glnSystemNodeDefinition = glnSystemDefinition as unknown as AnyNodeDefinition
