import type { AnyNode, AnyNodeId, ParametricDescriptor, WallNode } from '@pascal-app/core'
import { resolveWallPanelTarget } from './wall-panel-installation'
import type { GlnWallPanelNode } from './wall-panel-schema'

const HOST_CONSTRAINED_FIELDS = ['width', 'height', 'depth', 'position', 'side', 'wallId'] as const

function normalizeWallPanelEdit(
  prev: GlnWallPanelNode,
  next: GlnWallPanelNode,
  patch: Partial<GlnWallPanelNode>,
  nodes: Readonly<Record<AnyNodeId, AnyNode>>,
): Partial<GlnWallPanelNode> | undefined {
  if (!HOST_CONSTRAINED_FIELDS.some((field) => field in patch) && patch.parentId === undefined) {
    return undefined
  }
  const wall = nodes[next.wallId as AnyNodeId] as WallNode | undefined
  if (wall?.type !== 'wall') return undefined
  const target = resolveWallPanelTarget({
    wall,
    nodes,
    localX: next.position[0],
    side: next.side,
    width: next.width,
    height: next.height,
    depth: next.depth,
    ignoreId: next.id,
  })

  if (target.valid) {
    return {
      parentId: wall.id,
      wallId: wall.id,
      position: target.position,
      rotation: target.rotation,
      side: target.side,
    }
  }

  const rollback: Partial<GlnWallPanelNode> = { parentId: prev.wallId, wallId: prev.wallId }
  for (const field of ['width', 'height', 'depth', 'position', 'side', 'wallId'] as const) {
    if (field in patch) rollback[field] = prev[field] as never
  }
  return rollback
}

export const glnWallPanelParametrics: ParametricDescriptor<GlnWallPanelNode> = {
  normalize: normalizeWallPanelEdit,
  groups: [
    {
      label: '尺寸',
      fields: [
        {
          key: 'width',
          kind: 'number',
          label: '面板宽度',
          unit: 'm',
          min: 0.3,
          max: 3,
          step: 0.05,
        },
        {
          key: 'height',
          kind: 'number',
          label: '面板高度',
          unit: 'm',
          min: 0.6,
          max: 4,
          step: 0.05,
        },
        {
          key: 'depth',
          kind: 'number',
          label: '面板厚度',
          unit: 'm',
          min: 0.05,
          max: 0.4,
          step: 0.01,
        },
      ],
    },
    {
      label: '外观',
      fields: [{ key: 'finishColor', kind: 'color', label: '面板颜色' }],
    },
    {
      label: '水路接口',
      fields: [
        {
          key: 'connectionDiameterIn',
          kind: 'number',
          label: '接口管径',
          unit: '英寸',
          min: 0.25,
          max: 1.5,
          step: 0.25,
        },
      ],
    },
  ],
}
