import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { GlnIfcImportNode } from './ifc-import-schema'

type GlnIfcImportDefinition = NodeDefinition<typeof GlnIfcImportNode> & Record<string, unknown>

export const glnIfcImportDefinition: GlnIfcImportDefinition = {
  kind: 'gln:ifc-import',
  schemaVersion: 1,
  schema: GlnIfcImportNode,
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
      source: { path: 'unknown.ifc', sha256: '0'.repeat(64), sizeBytes: 0 },
      status: 'report-only',
      minimumStructure: {
        satisfied: false,
        missing: ['building', 'level', 'wall', 'zone'],
      },
      nodeCounts: { source: 0, highConfidence: 0, review: 0, draft: 0 },
      generated: { zones: 0, ceilings: 0 },
      reviewItems: [],
    },
  }),
  capabilities: {},
  renderer: {
    kind: 'parametric',
    module: () => import('./ifc-reference-renderer'),
  },
  presentation: {
    label: 'IFC 导入记录',
    description: '保存本地 IFC 的路径、哈希和转换报告，不保存原文件。',
    icon: { kind: 'iconify', name: 'lucide:file-box' },
    hidden: true,
  },
  mcp: {
    description:
      'Logical IFC import record. Stores source identity and conversion report without embedding source bytes.',
  },
}

export const glnIfcImportNodeDefinition = glnIfcImportDefinition as unknown as AnyNodeDefinition
