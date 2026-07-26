import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { buildGlnOutdoorUnitFloorplan } from './outdoor-unit-floorplan'
import { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
import { glnOutdoorUnitParametrics } from './outdoor-unit-parametrics'
import { getGlnOutdoorUnitPorts } from './outdoor-unit-ports'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'

type GlnOutdoorUnitDefinition = NodeDefinition<typeof GlnOutdoorUnitNode> & Record<string, unknown>

export const glnOutdoorUnitDefinition: GlnOutdoorUnitDefinition = {
  kind: 'gln:outdoor-unit',
  schemaVersion: 1,
  schema: GlnOutdoorUnitNode,
  category: 'utility',
  distributionRole: 'equipment',
  snapProfile: 'item',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    systemId: 'gln-system_unassigned',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    width: 0.9,
    depth: 0.42,
    height: 0.75,
    presetId: 'generic-standard',
    specificationSource: 'generic-placeholder',
    installationAreaZoneId: null,
    installationAreaKind: 'unassigned',
    clearanceFront: 0,
    clearanceBack: 0,
    clearanceLeft: 0,
    clearanceRight: 0,
    clearanceTop: 0,
    finish: 'light',
    bodyColor: '#e8ecef',
    grilleColor: '#333a40',
    connectionDiameterIn: 1,
  }),

  capabilities: {
    hostable: { parents: ['level'], align: 'bottom' },
    selectable: { hitVolume: 'bbox' },
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: {
      axes: ['y'],
      snapAngles: Array.from({ length: 8 }, (_, index) => (index * Math.PI) / 4),
    },
    duplicable: true,
    deletable: true,
    floorPlaced: {
      footprint: (node) => {
        const unit = node as unknown as GlnOutdoorUnitNode
        return {
          dimensions: [unit.width, unit.height, unit.depth],
          rotation: unit.rotation,
        }
      },
      collides: true,
    },
  },

  relations: {
    references: { systemId: ['gln:system'], installationAreaZoneId: ['zone'] },
  },

  parametrics: glnOutdoorUnitParametrics,
  geometry: buildGlnOutdoorUnitGeometry,
  geometryKey: (node) =>
    JSON.stringify([
      node.width,
      node.depth,
      node.height,
      node.presetId,
      node.clearanceFront,
      node.clearanceBack,
      node.clearanceLeft,
      node.clearanceRight,
      node.clearanceTop,
      node.finish,
      node.bodyColor,
      node.grilleColor,
      node.connectionDiameterIn,
    ]),
  ports: getGlnOutdoorUnitPorts,
  floorplan: buildGlnOutdoorUnitFloorplan,
  preview: () => import('./outdoor-unit-preview'),
  tool: () => import('./outdoor-unit-tool'),
  toolHints: [
    { key: 'Click', label: '放置外机' },
    { key: 'R / T', label: '旋转 ±45°' },
    { key: 'Alt', label: '强制自由放置' },
    { key: 'Esc', label: '退出' },
  ],

  presentation: {
    label: '外机',
    description: '光冷暖系统的室外冷热源设备，带供水和回水接口。',
    icon: { kind: 'iconify', name: 'lucide:fan' },
    paletteSection: 'structure',
    hidden: true,
  },

  mcp: {
    description:
      'Editable GLN hydronic outdoor unit. It belongs to exactly one gln:system and exposes typed supply and return water ports.',
  },
}

export const glnOutdoorUnitNodeDefinition = glnOutdoorUnitDefinition as unknown as AnyNodeDefinition
