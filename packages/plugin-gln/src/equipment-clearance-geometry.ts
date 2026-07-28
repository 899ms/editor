import { BoxGeometry, type Group, Mesh, MeshBasicMaterial } from 'three'

export type GlnClearanceEnvelope = {
  clearanceBack: number
  clearanceFront: number
  clearanceLeft: number
  clearanceRight: number
  clearanceTop: number
}

/** Adds a visible, editable clearance envelope to its owning equipment only. */
export function addGlnEquipmentClearance(
  group: Group,
  args: GlnClearanceEnvelope & { depth: number; height: number; width: number },
) {
  const clearanceBack = Number.isFinite(args.clearanceBack) ? args.clearanceBack : 0
  const clearanceFront = Number.isFinite(args.clearanceFront) ? args.clearanceFront : 0
  const clearanceLeft = Number.isFinite(args.clearanceLeft) ? args.clearanceLeft : 0
  const clearanceRight = Number.isFinite(args.clearanceRight) ? args.clearanceRight : 0
  const clearanceTop = Number.isFinite(args.clearanceTop) ? args.clearanceTop : 0
  const totalClearance =
    clearanceFront + clearanceBack + clearanceLeft + clearanceRight + clearanceTop
  if (totalClearance === 0) return

  const envelope = new Mesh(
    new BoxGeometry(
      args.width + clearanceLeft + clearanceRight,
      args.height + clearanceTop,
      args.depth + clearanceFront + clearanceBack,
    ),
    new MeshBasicMaterial({
      color: '#f59e0b',
      depthWrite: false,
      opacity: 0.16,
      transparent: true,
    }),
  )
  envelope.name = 'gln-equipment-clearance'
  envelope.position.set(
    (clearanceRight - clearanceLeft) / 2,
    (args.height + clearanceTop) / 2,
    (clearanceFront - clearanceBack) / 2,
  )
  envelope.renderOrder = 1
  group.add(envelope)
}
