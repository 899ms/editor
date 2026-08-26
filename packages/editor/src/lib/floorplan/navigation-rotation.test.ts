import { describe, expect, test } from 'bun:test'

import {
  chooseFloorplanRotationPivot,
  getFloorplanPointerAngleDeltaDegrees,
  getFloorplanRotationViewCenter,
  rotateFloorplanPoint,
} from './navigation-rotation'

describe('chooseFloorplanRotationPivot', () => {
  test('uses the hit node center when it has a stable drag radius', () => {
    expect(
      chooseFloorplanRotationPivot({
        hitCenter: { x: 20, y: 10 },
        pointer: { x: 80, y: 10 },
        viewportCenter: { x: 100, y: 100 },
      }),
    ).toEqual({ x: 20, y: 10 })
  })

  test('falls back to the viewport center for empty space or a near-zero radius', () => {
    const viewportCenter = { x: 100, y: 100 }

    expect(
      chooseFloorplanRotationPivot({
        hitCenter: null,
        pointer: { x: 80, y: 10 },
        viewportCenter,
      }),
    ).toEqual(viewportCenter)
    expect(
      chooseFloorplanRotationPivot({
        hitCenter: { x: 82, y: 10 },
        pointer: { x: 80, y: 10 },
        viewportCenter,
      }),
    ).toEqual(viewportCenter)
  })
})

describe('getFloorplanPointerAngleDeltaDegrees', () => {
  test('responds to a vertical arc around the pivot', () => {
    expect(
      getFloorplanPointerAngleDeltaDegrees({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }),
    ).toBeCloseTo(90)
  })

  test('takes the short path across the signed angle boundary', () => {
    const atDegrees = (degrees: number) => ({
      x: Math.cos((degrees * Math.PI) / 180),
      y: Math.sin((degrees * Math.PI) / 180),
    })

    expect(
      getFloorplanPointerAngleDeltaDegrees({ x: 0, y: 0 }, atDegrees(170), atDegrees(-170)),
    ).toBeCloseTo(20)
  })
})

describe('getFloorplanRotationViewCenter', () => {
  test('keeps an off-center pivot at the same viewport offset while rotating', () => {
    const pivotLocal = { x: 10, y: 0 }
    const pivotOffsetFromViewportCenter = { x: 10, y: 0 }
    const nextRotationDegrees = 90

    const nextCenterLocal = getFloorplanRotationViewCenter({
      nextRotationDegrees,
      pivotLocal,
      pivotOffsetFromViewportCenter,
    })
    const nextPivotSvg = rotateFloorplanPoint(pivotLocal, nextRotationDegrees)
    const nextCenterSvg = rotateFloorplanPoint(nextCenterLocal, nextRotationDegrees)

    expect({
      x: nextPivotSvg.x - nextCenterSvg.x,
      y: nextPivotSvg.y - nextCenterSvg.y,
    }).toEqual(pivotOffsetFromViewportCenter)
  })
})
