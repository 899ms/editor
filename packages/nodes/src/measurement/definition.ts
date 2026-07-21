import { measurementReferenceNodeIds, type NodeDefinition } from '@pascal-app/core'
import { buildMeasurementFloorplan } from './floorplan'
import { measurementMoveVertexAffordance } from './floorplan-affordance'
import { MeasurementNode } from './schema'

export const measurementDefinition: NodeDefinition<typeof MeasurementNode> = {
  kind: 'measurement',
  bake: 'strip',
  snapProfile: 'structural',
  schemaVersion: 2,
  schema: MeasurementNode,
  category: 'analysis',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    measurement: {
      kind: 'distance',
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
    },
  }),

  capabilities: {
    selectable: { hitVolume: 'bbox' },
    deletable: true,
    duplicable: true,
    presettable: false,
  },

  dirtyTracking: false,

  renderer: {
    kind: 'parametric',
    module: () => import('./renderer'),
  },
  floorplan: buildMeasurementFloorplan,
  floorplanDependencies: (node) => measurementReferenceNodeIds(node.measurement),
  floorplanAffordances: {
    'move-measurement-vertex': measurementMoveVertexAffordance,
  },
  affordanceTools: {
    selection: () => import('./selection'),
  },
  tool: () => import('./tool-router'),
  toolHints: [
    { key: 'Left click', label: 'Place measurement point', labelKey: 'editor:contextual.hints.placeMeasurementPoint' },
    { key: 'Enter', label: 'Finish measurement', labelKey: 'editor:contextual.hints.finishMeasurement' },
    { key: 'Backspace', label: 'Remove last point', labelKey: 'editor:contextual.hints.removeLastPoint' },
    { key: 'Esc', label: 'Finish and continue', labelKey: 'editor:contextual.hints.finishAndContinue' },
  ],

  presentation: {
    label: 'Measurement',
    labelKey: 'nodes:kinds.measurement',
    descriptionKey: 'nodes:descriptions.measurement',
    description: 'A persistent distance, angle, area, perimeter, or volume annotation.',
    icon: { kind: 'iconify', name: 'lucide:ruler' },
    hidden: true,
    actionMenu: false,
  },

  mcp: {
    description:
      'A persistent level-local distance, angle, area, perimeter, or volume measurement.',
  },
}
