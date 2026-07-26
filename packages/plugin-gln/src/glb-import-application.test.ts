import { describe, expect, test } from 'bun:test'
import { buildGlbReportScene, buildGlbResidentialReplacement } from './glb-import-application'
import type {
  GlbResidentialConversionReport,
  GlbResidentialSourceGraph,
} from './glb-residential-reconstruction'

const report: GlbResidentialConversionReport = {
  version: 1,
  source: {
    path: 'home.glb',
    sha256: 'e'.repeat(64),
    sizeBytes: 4096,
  },
  status: 'draft-ready',
  minimumStructure: { satisfied: true, missing: [] },
  geometry: {
    bounds: { min: [0, 0, 0], max: [6, 2.8, 4] },
    meshCount: 4,
    triangleCount: 48,
  },
  nodeCounts: { source: 4, highConfidence: 4, review: 0, draft: 9 },
  generated: { zones: 1, ceilings: 1 },
  reviewItems: [],
}

const draft: GlbResidentialSourceGraph = {
  nodes: {
    site_home: {
      object: 'node',
      id: 'site_home',
      type: 'site',
      parentId: null,
      visible: true,
      metadata: {},
      children: [],
    } as never,
  },
  rootNodeIds: ['site_home' as never],
}

describe('GLN GLB import application', () => {
  test('replaces the residence with editable nodes and one logical GLB record', () => {
    const result = buildGlbResidentialReplacement({
      draft,
      installedPlugins: ['pascal:trees'],
      report,
    })

    expect(result.installedPlugins).toEqual(['pascal:trees', 'pascal:gln'])
    expect(result.nodes.site_home?.type).toBe('site')
    expect(Object.values(result.nodes).some((node) => node.type === 'gln:glb-import')).toBe(true)
    expect(
      Object.values(result.nodes).some((node) =>
        [
          'gln:system',
          'gln:outdoor-unit',
          'gln:buffer-tank',
          'gln:wall-panel',
          'gln:hydronic-pipe',
        ].includes(node.type),
      ),
    ).toBe(false)
    expect(JSON.stringify(result)).not.toContain('data:image')
  })

  test('saves report-only analysis without replacing the current residence', () => {
    const reportOnly: GlbResidentialConversionReport = {
      ...report,
      status: 'report-only',
      minimumStructure: { satisfied: false, missing: ['wall', 'zone'] },
      nodeCounts: { ...report.nodeCounts, draft: 0 },
    }
    const result = buildGlbReportScene({
      current: draft,
      installedPlugins: [],
      report: reportOnly,
    })

    expect(result.nodes.site_home).toBeDefined()
    expect(Object.values(result.nodes).some((node) => node.type === 'gln:glb-import')).toBe(true)
  })
})
