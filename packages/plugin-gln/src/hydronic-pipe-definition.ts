import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { buildGlnHydronicPipeGeometry } from './hydronic-pipe-geometry'
import { getGlnHydronicPipePorts } from './hydronic-pipe-ports'
import { GlnHydronicPipeNode } from './hydronic-pipe-schema'

export const glnHydronicPipeDefinition: NodeDefinition<typeof GlnHydronicPipeNode> = {
  kind: 'gln:hydronic-pipe',
  schemaVersion: 1,
  schema: GlnHydronicPipeNode,
  category: 'utility',
  distributionRole: 'run',
  snapProfile: 'structural',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    systemId: 'gln-system_unassigned',
    circuit: 'supply',
    path: [
      [0, 2.5, 0],
      [1, 2.5, 0],
    ],
    diameterIn: 1,
    start: null,
    end: null,
    concealed: true,
    routing: { strategy: 'manual', state: 'routed', reviewReason: null },
  }),
  capabilities: {
    selectable: { hitVolume: 'bbox' },
    deletable: true,
    duplicable: true,
  },
  relations: { references: { systemId: ['gln:system'] } },
  geometry: buildGlnHydronicPipeGeometry,
  renderer: { kind: 'parametric', module: () => import('./hydronic-pipe-renderer') },
  system: { module: () => import('./hydronic-topology-system'), priority: 6 },
  geometryKey: (node) => JSON.stringify([node.path, node.circuit, node.diameterIn, node.concealed]),
  ports: getGlnHydronicPipePorts,
  tool: () => import('./hydronic-pipe-tool'),
  toolHints: [
    { key: 'Click', label: '添加路径点' },
    { key: 'Enter', label: '完成管线' },
    { key: 'Esc', label: '取消绘制' },
  ],
  presentation: {
    label: '供回水管',
    description: '独立可编辑的光冷暖供水或回水路径。',
    icon: { kind: 'iconify', name: 'lucide:git-branch' },
    paletteSection: 'structure',
    hidden: true,
  },
  mcp: {
    description:
      'Editable GLN hydronic supply or return pipe. Endpoints reference compatible typed hydronic ports; colors do not define topology.',
  },
}

export const glnHydronicPipeNodeDefinition =
  glnHydronicPipeDefinition as unknown as AnyNodeDefinition
