import { describe, expect, test } from 'bun:test'
import type {
  IfcResidentialConversionReport,
  IfcResidentialSourceGraph,
} from '@pascal-app/ifc-converter'
import { buildIfcReportScene, buildIfcResidentialReplacement } from './ifc-import-application'

const report: IfcResidentialConversionReport = {
  version: 1,
  source: {
    path: 'home.ifc',
    sha256: 'b'.repeat(64),
    sizeBytes: 1024,
  },
  status: 'draft-ready',
  minimumStructure: { satisfied: true, missing: [] },
  nodeCounts: { source: 4, highConfidence: 4, review: 0, draft: 4 },
  generated: { zones: 1, ceilings: 1 },
  reviewItems: [],
}

const draft: IfcResidentialSourceGraph = {
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

describe('GLN IFC import application', () => {
  test('replaces the residence with normal editable nodes and one logical report record', () => {
    const result = buildIfcResidentialReplacement({
      draft,
      installedPlugins: ['pascal:trees'],
      report,
    })

    expect(result.rootNodeIds).toEqual([
      'site_home',
      `gln-ifc-import_${report.source.sha256.slice(0, 16)}`,
    ])
    expect(result.installedPlugins).toEqual(['pascal:trees', 'pascal:gln'])
    expect(result.nodes.site_home?.type).toBe('site')
    const importRecord = Object.values(result.nodes).find((node) => node.type === 'gln:ifc-import')
    expect(importRecord).toMatchObject({ referenceVisible: false })
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
    expect(JSON.stringify(result)).not.toContain('arrayBuffer')
  })

  test('adds a report-only record without replacing the current scene', () => {
    const reportOnly = {
      ...report,
      status: 'report-only' as const,
      minimumStructure: { satisfied: false, missing: ['zone' as const] },
      nodeCounts: { ...report.nodeCounts, draft: 0 },
    }
    const result = buildIfcReportScene({
      current: draft,
      installedPlugins: ['pascal:gln'],
      report: reportOnly,
    })

    expect(result.nodes.site_home).toBeDefined()
    expect(Object.values(result.nodes).some((node) => node.type === 'gln:ifc-import')).toBe(true)
    expect(result.rootNodeIds).toContain('site_home' as never)
  })

  test('rejects inconsistent draft-ready and report-only inputs', () => {
    expect(() =>
      buildIfcResidentialReplacement({
        draft,
        installedPlugins: [],
        report: { ...report, status: 'report-only' },
      }),
    ).toThrow(/draft-ready/)
  })
})
