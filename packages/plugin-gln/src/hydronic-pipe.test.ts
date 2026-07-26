import { describe, expect, test } from 'bun:test'
import { buildGlnHydronicPipeGeometry } from './hydronic-pipe-geometry'
import {
  areGlnHydronicEndpointsCompatible,
  getGlnHydronicPipePorts,
  isGlnHydronicPortCompatible,
} from './hydronic-pipe-ports'
import { GlnHydronicPipeNode } from './hydronic-pipe-schema'
import { getGlnHydronicTopologyIssues, hasGlnHydronicClosedLoop } from './hydronic-topology'

describe('GLN hydronic pipe', () => {
  test('stores a system-owned editable multi-point supply path with endpoint references', () => {
    const pipe = GlnHydronicPipeNode.parse({
      systemId: 'gln-system_ground',
      circuit: 'supply',
      path: [
        [0, 2.5, 0],
        [1, 2.5, 0],
        [1, 2.5, 2],
      ],
      start: { nodeId: 'gln-outdoor-unit_1', portId: 'supply' },
      end: { nodeId: 'gln-buffer-tank_1', portId: 'source-supply' },
    })

    expect(pipe.path).toHaveLength(3)
    expect(pipe.start?.portId).toBe('supply')
    expect(pipe.end?.portId).toBe('source-supply')
    expect(buildGlnHydronicPipeGeometry(pipe).children).toHaveLength(3)
  })

  test('exposes open supply or return tips without inferring topology from color or position', () => {
    const pipe = GlnHydronicPipeNode.parse({
      systemId: 'gln-system_ground',
      circuit: 'return',
      path: [
        [0, 2.5, 0],
        [1, 2.5, 0],
      ],
    })
    expect(getGlnHydronicPipePorts(pipe)).toMatchObject([
      { id: 'start', system: 'gln:return' },
      { id: 'end', system: 'gln:return' },
    ])
  })

  test('allows only the matching typed hydronic loop at both ends', () => {
    const sourceSupply = { system: 'gln:source-supply' }
    const loadSupply = { system: 'gln:load-supply' }
    const sourceReturn = { system: 'gln:source-return' }

    expect(isGlnHydronicPortCompatible('supply', sourceSupply)).toBe(true)
    expect(isGlnHydronicPortCompatible('supply', sourceReturn)).toBe(false)
    expect(areGlnHydronicEndpointsCompatible('supply', sourceSupply, sourceSupply)).toBe(true)
    expect(areGlnHydronicEndpointsCompatible('supply', sourceSupply, loadSupply)).toBe(false)
  })

  test('recognizes the complete typed source-side and load-side loop', () => {
    const systemId = 'gln-system_ground'
    const pipe = (
      circuit: 'supply' | 'return',
      start: { nodeId: string; portId: string },
      end: { nodeId: string; portId: string },
    ) =>
      GlnHydronicPipeNode.parse({
        systemId,
        circuit,
        path: [
          [0, 2.5, 0],
          [1, 2.5, 0],
        ],
        start,
        end,
      })
    const nodes = {
      outdoor: { id: 'outdoor', type: 'gln:outdoor-unit', systemId },
      tank: { id: 'tank', type: 'gln:buffer-tank', systemId },
      panel: { id: 'panel', type: 'gln:wall-panel', systemId },
      sourceSupply: pipe(
        'supply',
        { nodeId: 'outdoor', portId: 'supply' },
        { nodeId: 'tank', portId: 'source-supply' },
      ),
      sourceReturn: pipe(
        'return',
        { nodeId: 'tank', portId: 'source-return' },
        { nodeId: 'outdoor', portId: 'return' },
      ),
      loadSupply: pipe(
        'supply',
        { nodeId: 'tank', portId: 'load-supply' },
        { nodeId: 'panel', portId: 'supply' },
      ),
      loadReturn: pipe(
        'return',
        { nodeId: 'panel', portId: 'return' },
        { nodeId: 'tank', portId: 'load-return' },
      ),
    }

    expect(getGlnHydronicTopologyIssues(nodes, systemId)).toEqual([])
    expect(hasGlnHydronicClosedLoop(nodes, systemId)).toBe(true)
  })

  test('does not let a visually similar but incompatible link complete the loop', () => {
    const systemId = 'gln-system_ground'
    const nodes = {
      outdoor: { id: 'outdoor', type: 'gln:outdoor-unit', systemId },
      panel: { id: 'panel', type: 'gln:wall-panel', systemId },
      invalid: GlnHydronicPipeNode.parse({
        systemId,
        circuit: 'supply',
        path: [
          [0, 2.5, 0],
          [1, 2.5, 0],
        ],
        start: { nodeId: 'outdoor', portId: 'supply' },
        end: { nodeId: 'panel', portId: 'supply' },
      }),
    }

    expect(getGlnHydronicTopologyIssues(nodes, systemId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'incompatible-link' })]),
    )
    expect(hasGlnHydronicClosedLoop(nodes, systemId)).toBe(false)
  })
})
