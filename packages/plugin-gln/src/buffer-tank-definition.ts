import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core/registry'
import { buildGlnBufferTankFloorplan } from './buffer-tank-floorplan'
import { buildGlnBufferTankGeometry } from './buffer-tank-geometry'
import { glnBufferTankParametrics } from './buffer-tank-parametrics'
import { getGlnBufferTankPorts } from './buffer-tank-ports'
import { GlnBufferTankNode } from './buffer-tank-schema'

type GlnBufferTankDefinition = NodeDefinition<typeof GlnBufferTankNode> & Record<string, unknown>

export const glnBufferTankDefinition: GlnBufferTankDefinition = {
  kind: 'gln:buffer-tank',
  schemaVersion: 1,
  schema: GlnBufferTankNode,
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
    diameter: 0.65,
    height: 1.5,
    insulationThickness: 0.05,
    finish: 'light',
    jacketColor: '#dfe5e8',
    stratificationView: true,
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
    deletable: true,
    floorPlaced: {
      footprint: (node) => {
        const tank = node as unknown as GlnBufferTankNode
        return {
          dimensions: [tank.diameter, tank.height, tank.diameter],
          rotation: tank.rotation,
        }
      },
      collides: false,
    },
  },

  relations: {
    references: { systemId: ['gln:system'] },
  },

  parametrics: glnBufferTankParametrics,
  geometry: buildGlnBufferTankGeometry,
  geometryKey: (node) =>
    JSON.stringify([
      node.diameter,
      node.height,
      node.insulationThickness,
      node.finish,
      node.jacketColor,
      node.stratificationView,
      node.connectionDiameterIn,
    ]),
  ports: getGlnBufferTankPorts,
  floorplan: buildGlnBufferTankFloorplan,
  preview: () => import('./buffer-tank-preview'),
  tool: () => import('./buffer-tank-tool'),
  toolHints: [
    { key: 'Click', label: '放置缓冲水箱' },
    { key: 'R / T', label: '旋转 ±45°' },
    { key: 'Alt', label: '强制自由放置' },
    { key: 'Esc', label: '退出' },
  ],

  presentation: {
    label: '缓冲水箱',
    description: '稳定光冷暖水系统输出，带主机侧和负载侧四个水路接口。',
    icon: { kind: 'iconify', name: 'lucide:cylinder' },
    paletteSection: 'structure',
    hidden: true,
  },

  mcp: {
    description:
      'Editable GLN hydronic buffer tank with distinct source-side and load-side supply/return ports. Stratification is explanatory only.',
  },
}

export const glnBufferTankNodeDefinition = glnBufferTankDefinition as unknown as AnyNodeDefinition
