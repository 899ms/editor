'use client'

import GlnWallPanelPlacementDriver from './wall-panel-placement-driver'
import type { GlnWallPanelNode } from './wall-panel-schema'

export default function GlnWallPanelMoveTool({ node }: { node: GlnWallPanelNode }) {
  return <GlnWallPanelPlacementDriver node={node} />
}
