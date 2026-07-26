import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { GlnGlbImportNode } from './glb-import-schema'

type GlnGlbImportDefinition = NodeDefinition<typeof GlnGlbImportNode> & Record<string, unknown>

export const glnGlbImportDefinition: GlnGlbImportDefinition = {
  kind: 'gln:glb-import',
  schemaVersion: 1,
  schema: GlnGlbImportNode,
  category: 'utility',
  bake: 'strip',
  dirtyTracking: false,
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    referenceVisible: false,
    report: {
      version: 1,
      source: { path: 'unknown.glb', sha256: '0'.repeat(64), sizeBytes: 0 },
      status: 'report-only',
      minimumStructure: { satisfied: false, missing: ['wall', 'zone'] },
      geometry: {
        bounds: { min: [0, 0, 0], max: [0, 0, 0] },
        meshCount: 0,
        triangleCount: 0,
      },
      nodeCounts: { source: 0, highConfidence: 0, review: 0, draft: 0 },
      generated: { zones: 0, ceilings: 0 },
      reviewItems: [],
    },
  }),
  capabilities: {},
  renderer: {
    kind: 'parametric',
    module: () => import('./glb-reference-renderer'),
  },
  presentation: {
    label: 'GLB 导入记录',
    description: '保存本地 GLB 的路径、哈希和重建报告，不保存原文件。',
    icon: { kind: 'iconify', name: 'lucide:box' },
    hidden: true,
  },
  mcp: {
    description:
      'Logical GLB import record. Stores source identity and reconstruction report without embedding source bytes.',
  },
}

export const glnGlbImportNodeDefinition = glnGlbImportDefinition as unknown as AnyNodeDefinition
