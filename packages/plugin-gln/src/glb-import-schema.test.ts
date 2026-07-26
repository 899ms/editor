import { describe, expect, test } from 'bun:test'
import { GlnGlbImportNode } from './glb-import-schema'

const report = {
  version: 1 as const,
  source: {
    path: 'C:/models/home.glb',
    sha256: 'd'.repeat(64),
    sizeBytes: 8192,
  },
  status: 'draft-ready' as const,
  minimumStructure: { satisfied: true, missing: [] },
  geometry: {
    bounds: { min: [0, 0, 0] as const, max: [6, 2.8, 4] as const },
    meshCount: 4,
    triangleCount: 48,
  },
  nodeCounts: { source: 4, highConfidence: 4, review: 0, draft: 9 },
  generated: { zones: 1, ceilings: 1 },
  reviewItems: [],
}

describe('GLN GLB import record', () => {
  test('persists source identity and report without source bytes or preview images', () => {
    const node = GlnGlbImportNode.parse({
      id: 'gln-glb-import_home',
      type: 'gln:glb-import',
      report,
    })

    expect(node.parentId).toBeNull()
    expect(node.referenceVisible).toBe(false)
    expect(node.report.geometry.meshCount).toBe(4)
    expect(JSON.stringify(node)).not.toContain('arrayBuffer')
    expect(JSON.stringify(node)).not.toContain('data:image')
  })

  test('rejects malformed hashes and unknown review reasons', () => {
    expect(() =>
      GlnGlbImportNode.parse({
        id: 'gln-glb-import_bad',
        type: 'gln:glb-import',
        report: {
          ...report,
          source: { ...report.source, sha256: 'bad' },
        },
      }),
    ).toThrow()
    expect(() =>
      GlnGlbImportNode.parse({
        id: 'gln-glb-import_bad-reason',
        type: 'gln:glb-import',
        report: {
          ...report,
          reviewItems: [
            {
              meshId: 'mesh',
              name: 'Mesh',
              reason: 'guess-it',
            },
          ],
        },
      }),
    ).toThrow()
  })
})
