import { describe, expect, test } from 'bun:test'
import { Group, type Intersection, Mesh, type Object3D, Vector3 } from 'three'
import {
  hasOrbitTargetDragStarted,
  isOrbitTargetNodeEligible,
  ORBIT_TARGET_DRAG_THRESHOLD_PX,
  resolveOrbitTargetIntersection,
} from './orbit-target'

function hit(object: Object3D, distance: number, point: [number, number, number]) {
  return {
    distance,
    object,
    point: new Vector3(...point),
  } as Intersection<Object3D>
}

describe('orbit target resolution', () => {
  test('shares model-node eligibility across 2D and 3D navigation', () => {
    expect(isOrbitTargetNodeEligible({ type: 'wall', visible: true })).toBe(true)
    expect(isOrbitTargetNodeEligible({ type: 'guide', visible: true })).toBe(false)
    expect(isOrbitTargetNodeEligible({ type: 'measurement', visible: true })).toBe(false)
    expect(isOrbitTargetNodeEligible({ type: 'site', visible: true })).toBe(false)
    expect(isOrbitTargetNodeEligible({ type: 'wall', visible: false })).toBe(false)
  })

  test('starts only after the pointer moves through the shared 4px drag threshold', () => {
    expect(ORBIT_TARGET_DRAG_THRESHOLD_PX).toBe(4)
    expect(hasOrbitTargetDragStarted({ x: 100, y: 100 }, { x: 103, y: 102 })).toBe(false)
    expect(hasOrbitTargetDragStarted({ x: 100, y: 100 }, { x: 104, y: 100 })).toBe(true)
  })

  test('skips annotation hits and uses the nearest visible model node', () => {
    const level = new Group()
    const guide = new Group()
    const guideMesh = new Mesh()
    const wall = new Group()
    const wallMesh = new Mesh()
    guide.add(guideMesh)
    wall.add(wallMesh)
    level.add(guide, wall)

    const registeredNodeIds = new Map<Object3D, string>([
      [level, 'level'],
      [guide, 'guide'],
      [wall, 'wall'],
    ])
    const nodes = {
      level: { type: 'level', visible: true },
      guide: { type: 'guide', visible: true },
      wall: { type: 'wall', visible: true },
    }

    const result = resolveOrbitTargetIntersection(
      [hit(guideMesh, 1, [15.5, 0, 8.6]), hit(wallMesh, 2, [6, 1.2, 5])],
      registeredNodeIds,
      nodes,
    )

    expect(result?.point.toArray()).toEqual([6, 1.2, 5])
  })

  test('does not fall through an excluded registered node to its eligible parent', () => {
    const level = new Group()
    const measurement = new Group()
    const labelMesh = new Mesh()
    measurement.add(labelMesh)
    level.add(measurement)

    const result = resolveOrbitTargetIntersection(
      [hit(labelMesh, 1, [13.9, 0.05, 5])],
      new Map<Object3D, string>([
        [level, 'level'],
        [measurement, 'measurement'],
      ]),
      {
        level: { type: 'level', visible: true },
        measurement: { type: 'measurement', visible: true },
      },
    )

    expect(result).toBeNull()
  })

  test('ignores hidden model nodes', () => {
    const wall = new Group()
    const wallMesh = new Mesh()
    wall.add(wallMesh)

    const result = resolveOrbitTargetIntersection(
      [hit(wallMesh, 1, [6, 1.2, 5])],
      new Map<Object3D, string>([[wall, 'wall']]),
      { wall: { type: 'wall', visible: false } },
    )

    expect(result).toBeNull()
  })
})
