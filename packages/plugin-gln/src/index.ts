import type { Plugin } from '@pascal-app/core/registry'
import type { ComponentType } from 'react'
import { glnBufferTankNodeDefinition } from './buffer-tank-definition'
import { GLN_PLUGIN_ID } from './constants'
import { glnGlbImportNodeDefinition } from './glb-import-definition'
import { glnHydronicPipeNodeDefinition } from './hydronic-pipe-definition'
import { glnIfcImportNodeDefinition } from './ifc-import-definition'
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
    glnIfcImportNodeDefinition,
    glnGlbImportNodeDefinition,
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

export const glnIfcImportHostPanel: GlnHostPanel = {
  id: 'gln:ifc-imports',
  label: '住宅导入',
  icon: { kind: 'iconify', name: 'lucide:file-box' },
  component: () => import('./residential-import-panel'),
  kinds: ['gln:ifc-import', 'gln:glb-import'],
  pluginId: GLN_PLUGIN_ID,
  description: '在本地解析 IFC 或 GLB，并重建为可编辑住宅节点。原文件不写入场景。',
  creator: { name: 'GLN' },
  defaultInstalled: true,
  mandatory: true,
}

export const glnScenePlanHostPanel: GlnHostPanel = {
  id: 'gln:scene-plans',
  label: '变更计划',
  icon: { kind: 'iconify', name: 'lucide:list-checks' },
  component: () => import('./scene-plan-panel'),
  kinds: [],
  pluginId: GLN_PLUGIN_ID,
  description: '校验、预览并原子提交版本绑定的场景变更计划。',
  creator: { name: 'GLN' },
  defaultInstalled: true,
  mandatory: true,
}

export const glnHostPanels = [
  glnSystemHostPanel,
  glnEquipmentHostPanel,
  glnScenePlanHostPanel,
  glnIfcImportHostPanel,
] as const
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
  getGlnInstallationIssues,
  getGlnNodeInstallationIssues,
} from './equipment-installation'
export {
  GlnEquipmentInstallationAreaKind,
  GlnGenericSpecificationSource,
} from './equipment-installation-schema'
export {
  GLN_BUFFER_TANK_PRESETS,
  GLN_GENERIC_SPECIFICATION_SOURCE,
  GLN_OUTDOOR_UNIT_PRESETS,
  GLN_WALL_PANEL_PRESETS,
} from './equipment-presets'
export {
  buildGlbReportScene,
  buildGlbResidentialReplacement,
  createGlnGlbImportRecord,
  glnGlbImportId,
} from './glb-import-application'
export {
  glnGlbImportDefinition,
  glnGlbImportNodeDefinition,
} from './glb-import-definition'
export {
  GlnGlbConversionReport,
  GlnGlbImportNode,
  GlnGlbReviewReason,
} from './glb-import-schema'
export type {
  GlbAnalyzedMesh,
  GlbResidentialConversionReport,
  GlbResidentialReconstruction,
  GlbResidentialReviewItem,
  GlbResidentialReviewReason,
  GlbResidentialSourceGraph,
  GlbSourceIdentity,
} from './glb-residential-reconstruction'
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
  buildIfcReportScene,
  buildIfcResidentialReplacement,
  createGlnIfcImportRecord,
  glnIfcImportId,
} from './ifc-import-application'
export {
  glnIfcImportDefinition,
  glnIfcImportNodeDefinition,
} from './ifc-import-definition'
export {
  GlnIfcConversionReport,
  GlnIfcImportNode,
  GlnIfcReviewReason,
} from './ifc-import-schema'
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
export type { GlnRunPreviewModel } from './run-preview'
export { deriveGlnRunPreview } from './run-preview'
export {
  glnScenePlanValidator,
  validateGlnScenePlan,
} from './scene-plan-validator'
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
