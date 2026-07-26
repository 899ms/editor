import { describe, expect, test } from 'bun:test'
import {
  type GlbAnalyzedMesh,
  type GlbSourceIdentity,
  reconstructGlbResidential,
} from './glb-residential-reconstruction'

const source: GlbSourceIdentity = {
  path: 'semantic-home.glb',
  sha256: 'c'.repeat(64),
  sizeBytes: 2048,
}

const wall = (
  id: string,
  name: string,
  min: [number, number, number],
  max: [number, number, number],
): GlbAnalyzedMesh => ({
  id,
  name,
  bounds: { min, max },
  triangleCount: 12,
  worldAxisAligned: true,
})

describe('GLB residential reconstruction', () => {
  test('rebuilds an axis-aligned named wall loop as normal editable residential nodes', () => {
    const result = reconstructGlbResidential(
      [
        wall('north', 'Wall North', [0, 0, 0], [6, 2.8, 0.12]),
        wall('east', 'Wall East', [5.88, 0, 0], [6, 2.8, 4]),
        wall('south', 'Wall South', [0, 0, 3.88], [6, 2.8, 4]),
        wall('west', 'Wall West', [0, 0, 0], [0.12, 2.8, 4]),
      ],
      source,
    )

    expect(result.report.status).toBe('draft-ready')
    expect(result.report.minimumStructure).toEqual({ satisfied: true, missing: [] })
    expect(result.report.nodeCounts.source).toBe(4)
    expect(result.report.nodeCounts.highConfidence).toBe(4)
    expect(result.report.generated.zones).toBe(1)
    expect(result.report.generated.ceilings).toBe(1)
    expect(result.draft).not.toBeNull()
    const types = Object.values(result.draft?.nodes ?? {}).map((node) => node.type)
    expect(types.filter((type) => type === 'wall')).toHaveLength(4)
    expect(types).toContain('site')
    expect(types).toContain('building')
    expect(types).toContain('level')
    expect(types).toContain('zone')
    expect(types).toContain('ceiling')
    expect(types.some((type) => type.startsWith('gln:'))).toBe(false)
  })

  test('keeps ambiguous geometry in review and refuses to invent a residence', () => {
    const result = reconstructGlbResidential(
      [
        {
          id: 'mesh_1',
          name: 'Merged Building',
          bounds: { min: [0, 0, 0], max: [8, 3, 8] },
          triangleCount: 30_000,
          worldAxisAligned: false,
        },
      ],
      source,
    )

    expect(result.draft).toBeNull()
    expect(result.report.status).toBe('report-only')
    expect(result.report.minimumStructure.missing).toEqual(['wall', 'zone'])
    expect(result.report.reviewItems).toEqual([
      expect.objectContaining({ meshId: 'mesh_1', reason: 'unsupported-semantic' }),
    ])
  })

  test('rejects wall labels whose geometry is not a reliable wall', () => {
    const result = reconstructGlbResidential(
      [
        {
          id: 'wall_bad',
          name: 'Wall Curved',
          bounds: { min: [0, 0, 0], max: [4, 2.8, 2] },
          triangleCount: 600,
          worldAxisAligned: false,
        },
      ],
      source,
    )

    expect(result.report.reviewItems[0]).toMatchObject({
      meshId: 'wall_bad',
      reason: 'ambiguous-geometry',
    })
    expect(result.report.status).toBe('report-only')
  })
})
