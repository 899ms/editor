export type FloorplanRotationPoint = {
  x: number
  y: number
}

export const FLOORPLAN_MIN_ROTATION_RADIUS_PX = 16

export function rotateFloorplanPoint(
  point: FloorplanRotationPoint,
  rotationDegrees: number,
): FloorplanRotationPoint {
  if (rotationDegrees === 0) return point

  const radians = (rotationDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

export function chooseFloorplanRotationPivot({
  hitCenter,
  minimumRadiusPx = FLOORPLAN_MIN_ROTATION_RADIUS_PX,
  pointer,
  viewportCenter,
}: {
  hitCenter: FloorplanRotationPoint | null
  minimumRadiusPx?: number
  pointer: FloorplanRotationPoint
  viewportCenter: FloorplanRotationPoint
}): FloorplanRotationPoint {
  if (
    hitCenter &&
    Math.hypot(pointer.x - hitCenter.x, pointer.y - hitCenter.y) >= minimumRadiusPx
  ) {
    return hitCenter
  }

  return viewportCenter
}

export function getFloorplanPointerAngleDeltaDegrees(
  pivot: FloorplanRotationPoint,
  start: FloorplanRotationPoint,
  current: FloorplanRotationPoint,
): number {
  const startAngle = Math.atan2(start.y - pivot.y, start.x - pivot.x)
  const currentAngle = Math.atan2(current.y - pivot.y, current.x - pivot.x)
  let delta = currentAngle - startAngle

  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta <= -Math.PI) delta += Math.PI * 2

  return (delta * 180) / Math.PI
}

export function getFloorplanRotationViewCenter({
  nextRotationDegrees,
  pivotLocal,
  pivotOffsetFromViewportCenter,
}: {
  nextRotationDegrees: number
  pivotLocal: FloorplanRotationPoint
  pivotOffsetFromViewportCenter: FloorplanRotationPoint
}): FloorplanRotationPoint {
  const nextPivotSvg = rotateFloorplanPoint(pivotLocal, nextRotationDegrees)
  const nextCenterSvg = {
    x: nextPivotSvg.x - pivotOffsetFromViewportCenter.x,
    y: nextPivotSvg.y - pivotOffsetFromViewportCenter.y,
  }

  return rotateFloorplanPoint(nextCenterSvg, -nextRotationDegrees)
}
