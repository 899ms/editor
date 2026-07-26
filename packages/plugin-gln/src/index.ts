import type { Plugin } from '@pascal-app/core/registry'
import type { ComponentType } from 'react'
import { glnBufferTankNodeDefinition } from './buffer-tank-definition'
import { GLN_PLUGIN_ID } from './constants'
import { glnHydronicPipeNodeDefinition } from './hydronic-pipe-definition'
import { glnOutdoorUnitNodeDefinition } from './outdoor-unit-definition'
import { glnSystemNodeDefinition } from './system-definition'
import { glnWallPanelNodeDefinition } from './wall-panel-definition'

type GlnHostPanel = {
  id: string
  label: string
  icon: { kind: 'iconify'; name: string }
  component: () => Promise<{ default: ComponentType }>
  kinds: readonly string[]
  pluginId: string
  description: string
  creator: { name: string }
  defaultInstalled: boolean
  mandatory: boolean
}

export const glnPlugin: Plugin = {
  id: GLN_PLUGIN_ID,
  apiVersion: 1,
  nodes: [
    glnSystemNodeDefinition,
    glnOutdoorUnitNodeDefinition,
    glnBufferTankNodeDefinition,
    glnWallPanelNodeDefinition,
    glnHydronicPipeNodeDefinition,
  ],
}

export const glnSystemHostPanel: GlnHostPanel = {
  id: 'gln:systems',
  label: '光冷暖系统',
  icon: { kind: 'iconify', name: 'lucide:thermometer-sun' },
  component: () => import('./systems-panel'),
  kinds: ['gln:system'],
  pluginId: GLN_PLUGIN_ID,
  description: '创建、命名并切换光冷暖系统运行模式。',
  creator: { name: 'GLN' },
  defaultInstalled: true,
  mandatory: true,
}

export const glnEquipmentHostPanel: GlnHostPanel = {
  id: 'gln:equipment',
  label: '光冷暖设备',
  icon: { kind: 'iconify', name: 'lucide:fan' },
  component: () => import('./equipment-panel'),
  kinds: ['gln:outdoor-unit', 'gln:buffer-tank', 'gln:wall-panel', 'gln:hydronic-pipe'],
  pluginId: GLN_PLUGIN_ID,
  description: '放置和编辑光冷暖系统的物理设备。',
  creator: { name: 'GLN' },
  defaultInstalled: true,
  mandatory: true,
}

export const glnHostPanels = [glnSystemHostPanel, glnEquipmentHostPanel] as const
export const glnHostPanel = glnSystemHostPanel

export {
  glnBufferTankDefinition,
  glnBufferTankNodeDefinition,
} from './buffer-tank-definition'
export { buildGlnBufferTankFloorplan } from './buffer-tank-floorplan'
export { buildGlnBufferTankGeometry } from './buffer-tank-geometry'
export { getGlnBufferTankPorts } from './buffer-tank-ports'
export { GlnBufferTankFinish, GlnBufferTankNode } from './buffer-tank-schema'
export { GLN_PLUGIN_ID } from './constants'
export {
  glnHydronicPipeDefinition,
  glnHydronicPipeNodeDefinition,
} from './hydronic-pipe-definition'
export { buildGlnHydronicPipeGeometry } from './hydronic-pipe-geometry'
export {
  areGlnHydronicEndpointsCompatible,
  getGlnHydronicPipePorts,
  isGlnHydronicPortCompatible,
} from './hydronic-pipe-ports'
export type { GlnPipeEndpoint } from './hydronic-pipe-schema'
export {
  GlnHydronicCircuit,
  GlnHydronicPipeNode,
  GlnHydronicRoute,
  GlnHydronicRouteReviewReason,
  GlnHydronicRouteState,
  GlnHydronicRouteStrategy,
} from './hydronic-pipe-schema'
export type {
  GlnHydronicRoutePlan,
  GlnRiserCandidate,
  GlnRouteObstacle,
  GlnRoutePoint,
} from './hydronic-routing'
export {
  collectGlnRoutingObstacles,
  planGlnConcealedRoute,
  resolveGlnNodeLevelId,
} from './hydronic-routing'
export { getGlnHydronicTopologyIssues, hasGlnHydronicClosedLoop } from './hydronic-topology'
export {
  glnOutdoorUnitDefinition,
  glnOutdoorUnitNodeDefinition,
} from './outdoor-unit-definition'
export { buildGlnOutdoorUnitFloorplan } from './outdoor-unit-floorplan'
export { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
export { getGlnOutdoorUnitPorts } from './outdoor-unit-ports'
export {
  GlnOutdoorUnitFinish,
  GlnOutdoorUnitNode,
} from './outdoor-unit-schema'
export { glnSystemDefinition, glnSystemNodeDefinition } from './system-definition'
export {
  GlnSystemMode,
  GlnSystemNode,
  GlnZoneSettingSource,
  GlnZoneSettings,
} from './system-schema'
export {
  glnWallPanelDefinition,
  glnWallPanelNodeDefinition,
} from './wall-panel-definition'
export { buildGlnWallPanelFloorplan } from './wall-panel-floorplan'
export {
  resolveWallPanelPlanTarget,
  wallPanelFloorplanMoveTarget,
} from './wall-panel-floorplan-move'
export { buildGlnWallPanelGeometry } from './wall-panel-geometry'
export { buildWallPanelHostPatch, resolveWallPanelTarget } from './wall-panel-installation'
export { getGlnWallPanelPorts, localGlnWallPanelPorts } from './wall-panel-ports'
export {
  GlnWallPanelNode,
  GlnWallPanelSide,
  GlnWallPanelZoneAssignment,
} from './wall-panel-schema'
export { resolveWallPanelZone } from './wall-panel-zone'
export { getGlnZoneControls } from './zone-settings'
