import type { AnyNode, AnyNodeId, NodeQuickActionProvider, WallNode } from '@pascal-app/core'
import type { GlnWallPanelNode } from './wall-panel-schema'
import { resolveWallPanelZone } from './wall-panel-zone'

export const wallPanelQuickActions: NodeQuickActionProvider<GlnWallPanelNode> = ({
  node,
  nodes,
}) => [
  {
    id: 'flip-wall-panel-side',
    label: '翻面',
    title: '翻转到墙体另一侧并重新判断服务空间',
    icon: { kind: 'iconify', name: 'lucide:flip-horizontal-2' },
    history: 'single',
    run: ({ sceneApi }) => {
      const wall = nodes[node.wallId as AnyNodeId] as WallNode | undefined
      if (!wall) return
      const side = node.side === 'front' ? 'back' : 'front'
      const resolution = resolveWallPanelZone({
        wall,
        side,
        localX: node.position[0],
        nodes: nodes as Readonly<Record<AnyNodeId, AnyNode>>,
      })
      sceneApi.update(
        node.id as AnyNodeId,
        {
          side,
          position: [node.position[0], node.position[1], -node.position[2]],
          rotation: [0, side === 'front' ? 0 : Math.PI, 0],
          zoneId: resolution.zoneId,
          zoneCandidateIds: resolution.candidateIds,
          zoneAssignment: 'auto',
        } as never,
      )
    },
  },
]
