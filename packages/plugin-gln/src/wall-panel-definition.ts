import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { buildGlnWallPanelFloorplan } from './wall-panel-floorplan'
import { wallPanelFloorplanMoveTarget } from './wall-panel-floorplan-move'
import { buildGlnWallPanelGeometry } from './wall-panel-geometry'
import { glnWallPanelParametrics } from './wall-panel-parametrics'
import { getGlnWallPanelPorts } from './wall-panel-ports'
import { wallPanelQuickActions } from './wall-panel-quick-actions'
import { GlnWallPanelNode } from './wall-panel-schema'

type GlnWallPanelDefinition = NodeDefinition<typeof GlnWallPanelNode> & Record<string, unknown>

export const glnWallPanelDefinition: GlnWallPanelDefinition = {
  kind: 'gln:wall-panel',
  schemaVersion: 1,
  schema: GlnWallPanelNode,
  category: 'utility',
  distributionRole: 'terminal',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    systemId: 'gln-system_unassigned',
    wallId: 'wall_unassigned',
    wallStart: [0, 0],
    wallEnd: [1, 0],
    zoneId: null,
    zoneCandidateIds: [],
    zoneAssignment: 'auto',
    position: [0.45, 1.25, 0.16],
    rotation: [0, 0, 0],
    side: 'front',
    width: 0.9,
    height: 2.5,
    depth: 0.12,
    presetId: 'generic-standard',
    specificationSource: 'generic-placeholder',
    installationAreaZoneId: null,
    installationAreaKind: 'unassigned',
    clearanceFront: 0,
    clearanceBack: 0,
    clearanceLeft: 0,
    clearanceRight: 0,
    clearanceTop: 0,
    finishColor: '#e8ddd0',
    connectionDiameterIn: 0.5,
  }),
  capabilities: {
    hostable: { parents: ['wall'], align: 'center' },
    selectable: { hitVolume: 'bbox' },
    movable: { axes: ['x'], gridSnap: true },
    deletable: true,
  },
  relations: {
    references: {
      systemId: ['gln:system'],
      wallId: ['wall'],
      zoneId: ['zone'],
      installationAreaZoneId: ['zone'],
    },
  },
  parametrics: glnWallPanelParametrics,
  geometry: buildGlnWallPanelGeometry,
  geometryKey: (node) =>
    JSON.stringify([
      node.width,
      node.height,
      node.depth,
      node.presetId,
      node.clearanceFront,
      node.clearanceBack,
      node.clearanceLeft,
      node.clearanceRight,
      node.clearanceTop,
      node.finishColor,
      node.connectionDiameterIn,
    ]),
  ports: getGlnWallPanelPorts,
  floorplan: buildGlnWallPanelFloorplan,
  floorplanMoveTarget: wallPanelFloorplanMoveTarget,
  quickActions: wallPanelQuickActions,
  system: { module: () => import('./wall-panel-zone-system') },
  tool: () => import('./wall-panel-tool'),
  floorplanTool: () => import('./wall-panel-floorplan-tool'),
  affordanceTools: { move: () => import('./wall-panel-move-tool') },
  toolHints: [
    { key: 'Mouse', label: '在有效墙面放置' },
    { key: 'R', label: '翻面' },
    { key: 'Esc', label: '退出' },
  ],
  presentation: {
    label: '室内面板',
    description: '贴墙安装的光冷暖辐射面板，顶部局部左供右回。',
    icon: { kind: 'iconify', name: 'lucide:panel-top' },
    paletteSection: 'structure',
    hidden: true,
  },
  mcp: {
    description:
      'Editable GLN wall panel. It is hosted by a wall, serves a Zone, and exposes local-left supply and local-right return ports.',
  },
}

export const glnWallPanelNodeDefinition = glnWallPanelDefinition as unknown as AnyNodeDefinition
