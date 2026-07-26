import { describe, expect, test } from 'bun:test'
import { GlnIfcImportNode } from './ifc-import-schema'

const report = {
  version: 1 as const,
  source: {
    path: 'C:/models/home.ifc',
    sha256: 'a'.repeat(64),
    sizeBytes: 4096,
  },
  status: 'draft-ready' as const,
  minimumStructure: { satisfied: true, missing: [] },
  nodeCounts: { source: 20, highConfidence: 17, review: 3, draft: 19 },
  generated: { zones: 1, ceilings: 1 },
  reviewItems: [
    {
      nodeId: 'item_unsupported',
      name: 'Furniture',
      ifcType: 'IFCFURNISHINGELEMENT',
      reason: 'unsupported-kind' as const,
    },
  ],
}

describe('GLN IFC import record', () => {
  test('persists source identity and report without embedding source bytes', () => {
    const node = GlnIfcImportNode.parse({
      id: 'gln-ifc-import_home',
      type: 'gln:ifc-import',
      report,
    })

    expect(node.parentId).toBeNull()
    expect(node.referenceVisible).toBe(false)
    expect(node.report.source.sha256).toHaveLength(64)
    expect(JSON.stringify(node)).not.toContain('arrayBuffer')
    expect(JSON.stringify(node)).not.toContain('Pset_')
  })

  test('rejects malformed hashes and unknown review reasons', () => {
    expect(() =>
      GlnIfcImportNode.parse({
        id: 'gln-ifc-import_bad',
        type: 'gln:ifc-import',
        report: {
          ...report,
          source: { ...report.source, sha256: 'not-a-hash' },
        },
      }),
    ).toThrow()
    expect(() =>
      GlnIfcImportNode.parse({
        id: 'gln-ifc-import_bad-reason',
        type: 'gln:ifc-import',
        report: {
          ...report,
          reviewItems: [{ ...report.reviewItems[0], reason: 'guess-it' }],
        },
      }),
    ).toThrow()
  })
})
