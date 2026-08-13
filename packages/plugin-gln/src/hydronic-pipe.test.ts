import { describe, expect, test } from 'bun:test'
import { glnHydronicPipeDefinition } from './hydronic-pipe-definition'
import { buildGlnHydronicPipeFloorplan } from './hydronic-pipe-floorplan'
import { buildGlnHydronicPipeGeometry } from './hydronic-pipe-geometry'
import {
  resolveHydronicInstallationPoint,
  snapHydronicPointAlong45,
  snapHydronicPointToWall,
} from './hydronic-pipe-placement'
import {
  areGlnHydronicEndpointsCompatible,
  getGlnHydronicPipePorts,
  isGlnHydronicPortCompatible,
} from './hydronic-pipe-ports'
import { GlnHydronicPipeNode } from './hydronic-pipe-schema'
import { planGlnConcealedRoute } from './hydronic-routing'
import {
  getGlnHydronicDeleteImpact,
  getGlnHydronicTopologyIssues,
  hasGlnHydronicClosedLoop,
} from './hydronic-topology'

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
    expect(pipe).toMatchObject({
      pipeMaterial: 'pex',
      insulationThicknessM: 0.01,
      installationMode: 'ceiling',
      serviceHeightM: 2.3,
    })
    expect(buildGlnHydronicPipeGeometry(pipe).children).toHaveLength(6)
  })

  test('reuses the shared plan path editor while keeping connected endpoints fixed', () => {
    const pipe = GlnHydronicPipeNode.parse({
      systemId: 'gln-system_ground',
      path: [
        [0, 2.3, 0],
        [2, 2.3, 0],
        [2, 2.3, 2],
      ],
    })
    const floorplan = buildGlnHydronicPipeFloorplan(pipe, {
      viewState: { selected: true, highlighted: false, hovered: false },
    } as never)
    const handles =
      floorplan?.kind === 'group'
        ? floorplan.children.filter((child) => child.kind === 'endpoint-handle')
        : []

    expect(handles).toHaveLength(1)
    expect(handles[0]).toMatchObject({
      affordance: 'move-path-point',
      payload: { pointIndex: 1 },
    })
    expect(glnHydronicPipeDefinition.floorplanAffordances?.['move-path-point']).toBeDefined()
  })

  test('supports ceiling, wall-face, and through-wall placement without drainage semantics', () => {
    const nodes = {
      wall: {
        id: 'wall_1',
        type: 'wall',
        parentId: 'level_1',
        start: [0, 0],
        end: [4, 0],
        thickness: 0.2,
      },
    } as never

    expect(snapHydronicPointToWall([2, 0.2], nodes, 'level_1')).toEqual([2, 0.125])
    expect(
      resolveHydronicInstallationPoint({
        mode: 'wall',
        point: [2, 2.3, 0.2],
        nodes,
        levelId: 'level_1',
      }),
    ).toEqual([2, 2.3, 0.125])
    expect(
      resolveHydronicInstallationPoint({
        mode: 'through-wall',
        point: [2, 2.3, -1],
        nodes,
        levelId: 'level_1',
      }),
    ).toEqual([2, 2.3, -1])
    expect(snapHydronicPointAlong45([0, 2.3, 0], [1.7, 2.3, 0.4], 0.5)).toEqual([1.5, 2.3, 0])
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

  test('creates a same-level ceiling route with a concealed wall descent at each endpoint', () => {
    const plan = planGlnConcealedRoute({
      start: [0, 1.8, 0],
      end: [4, 1.6, 3],
      startLevelId: 'level_1',
      endLevelId: 'level_1',
      serviceHeight: 2.3,
    })

    expect(plan.routing).toEqual({ strategy: 'ceiling', state: 'routed', reviewReason: null })
    expect(plan.path[1]).toEqual([0, 2.3, 0])
    expect(plan.path.at(-2)).toEqual([4, 2.3, 3])
    expect(plan.path.at(-1)).toEqual([4, 1.6, 3])
  })

  test('uses a reviewed shaft before an equipment-wall riser for cross-level routing', () => {
    const plan = planGlnConcealedRoute({
      start: [0, 1.5, 0],
      end: [4, 4.3, 3],
      startLevelId: 'level_1',
      endLevelId: 'level_2',
      risers: [
        { id: 'equipment-wall', kind: 'equipment-wall', point: [1, 2.3, 1] },
        { id: 'shaft', kind: 'shaft', point: [2, 2.3, 2] },
      ],
    })

    expect(plan.routing).toEqual({ strategy: 'ceiling-riser', state: 'routed', reviewReason: null })
    expect(plan.path).toContainEqual([2, 2.3, 2])
  })

  test('leaves an obstructed or unapproved cross-level route for manual review', () => {
    const blocked = planGlnConcealedRoute({
      start: [0, 1.8, 0],
      end: [4, 1.8, 3],
      startLevelId: 'level_1',
      endLevelId: 'level_1',
      obstacles: [{ id: 'column_a', kind: 'column', min: [-1, 2.2, -1], max: [5, 2.4, 4] }],
    })
    const missingRiser = planGlnConcealedRoute({
      start: [0, 1.8, 0],
      end: [4, 4.3, 3],
      startLevelId: 'level_1',
      endLevelId: 'level_2',
    })

    expect(blocked.routing).toMatchObject({ state: 'needs-review', reviewReason: 'obstructed' })
    expect(missingRiser.routing).toMatchObject({
      state: 'needs-review',
      reviewReason: 'missing-riser',
    })
  })

  test('predicts affected pipe repairs before deleting equipment without reconnecting the loop', () => {
    const systemId = 'gln-system_ground'
    const nodes = {
      outdoor: { id: 'outdoor', type: 'gln:outdoor-unit', systemId },
      tank: { id: 'tank', type: 'gln:buffer-tank', systemId },
      sourceSupply: GlnHydronicPipeNode.parse({
        systemId,
        circuit: 'supply',
        path: [
          [0, 2.5, 0],
          [1, 2.5, 0],
        ],
        start: { nodeId: 'outdoor', portId: 'supply' },
        end: { nodeId: 'tank', portId: 'source-supply' },
      }),
    }

    const impact = getGlnHydronicDeleteImpact(nodes, systemId, ['tank'])

    expect(impact.affectedPipeIds).toEqual([nodes.sourceSupply.id])
    expect(impact.issuesAfterDelete).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'orphaned-endpoint', pipeId: nodes.sourceSupply.id }),
      ]),
    )
    expect(nodes.sourceSupply.end?.nodeId).toBe('tank')
  })
})
