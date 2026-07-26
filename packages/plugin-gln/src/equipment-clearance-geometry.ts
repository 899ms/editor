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
  const totalClearance =
    args.clearanceFront +
    args.clearanceBack +
    args.clearanceLeft +
    args.clearanceRight +
    args.clearanceTop
  if (totalClearance === 0) return

  const envelope = new Mesh(
    new BoxGeometry(
      args.width + args.clearanceLeft + args.clearanceRight,
      args.height + args.clearanceTop,
      args.depth + args.clearanceFront + args.clearanceBack,
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
    (args.clearanceRight - args.clearanceLeft) / 2,
    (args.height + args.clearanceTop) / 2,
    (args.clearanceFront - args.clearanceBack) / 2,
  )
  envelope.renderOrder = 1
  group.add(envelope)
}
