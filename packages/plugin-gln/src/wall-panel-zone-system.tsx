'use client'

import {
  type AnyNodeId,
  pauseSceneHistory,
  resumeSceneHistory,
  useScene,
  type WallNode,
} from '@pascal-app/core'
import { useEffect } from 'react'
import type { GlnWallPanelNode } from './wall-panel-schema'
import { resolveWallPanelZone } from './wall-panel-zone'

export function preservesManualWallPanelZone(
  panel: Pick<GlnWallPanelNode, 'zoneAssignment' | 'zoneId'>,
  candidateIds: readonly string[],
) {
  return (
    panel.zoneAssignment === 'manual' &&
    panel.zoneId !== null &&
    candidateIds.includes(panel.zoneId)
  )
}

export default function WallPanelZoneSystem() {
  const nodes = useScene((state) => state.nodes)

  useEffect(() => {
    const updates: Array<{ id: AnyNodeId; data: Partial<GlnWallPanelNode> }> = []
    for (const node of Object.values(nodes)) {
      if ((node as { type: string }).type !== 'gln:wall-panel') continue
      const panel = node as unknown as GlnWallPanelNode
      const wall = nodes[panel.wallId as AnyNodeId] as WallNode | undefined
      if (!wall) continue
      const resolution = resolveWallPanelZone({
        wall,
        side: panel.side,
        localX: panel.position[0],
        nodes,
      })
      const preserveManual = preservesManualWallPanelZone(panel, resolution.candidateIds)
      const sameCandidates =
        resolution.candidateIds.length === panel.zoneCandidateIds.length &&
        resolution.candidateIds.every((id, index) => panel.zoneCandidateIds[index] === id)
      const sameWallFrame =
        panel.wallStart[0] === wall.start[0] &&
        panel.wallStart[1] === wall.start[1] &&
        panel.wallEnd[0] === wall.end[0] &&
        panel.wallEnd[1] === wall.end[1]
      if (
        (preserveManual || (panel.zoneId === resolution.zoneId && sameCandidates)) &&
        sameWallFrame
      ) {
        continue
      }
      updates.push({
        id: panel.id as AnyNodeId,
        data: preserveManual
          ? {
              wallStart: wall.start,
              wallEnd: wall.end,
            }
          : {
              zoneId: resolution.zoneId,
              zoneCandidateIds: resolution.candidateIds,
              zoneAssignment: 'auto',
              wallStart: wall.start,
              wallEnd: wall.end,
            },
      })
    }
    if (updates.length === 0) return
    pauseSceneHistory(useScene)
    useScene.getState().updateNodes(updates as never)
    resumeSceneHistory(useScene)
  }, [nodes])

  return null
}
