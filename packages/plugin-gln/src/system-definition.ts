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
  }),
  capabilities: {},
  presentation: {
    label: '光冷暖系统',
    description: '管理一套光冷暖水系统的名称与运行模式。',
    icon: { kind: 'iconify', name: 'lucide:thermometer-sun' },
    hidden: true,
  },
  mcp: {
    description:
      'Logical GLN hydronic system. Runtime mode is stored only here as cooling, heating, or standby.',
  },
}

export const glnSystemNodeDefinition = glnSystemDefinition as unknown as AnyNodeDefinition
