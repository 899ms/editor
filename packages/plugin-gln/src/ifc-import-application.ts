import type {
  IfcResidentialConversionReport,
  IfcResidentialSourceGraph,
} from '@pascal-app/ifc-converter'
import { GLN_PLUGIN_ID } from './constants'
import { GlnIfcImportNode } from './ifc-import-schema'

type SceneNode = IfcResidentialSourceGraph['nodes'][string] | GlnIfcImportNode

export type GlnIfcAppliedScene = {
  installedPlugins: string[]
  nodes: Record<string, SceneNode>
  rootNodeIds: string[]
}

const PHYSICAL_OR_SYSTEM_KINDS = new Set([
  'gln:system',
  'gln:outdoor-unit',
  'gln:buffer-tank',
  'gln:wall-panel',
  'gln:hydronic-pipe',
])

export function glnIfcImportId(report: IfcResidentialConversionReport) {
  return `gln-ifc-import_${report.source.sha256.slice(0, 16)}` as const
}

export function createGlnIfcImportRecord(
  report: IfcResidentialConversionReport,
  referenceVisible: boolean,
) {
  return GlnIfcImportNode.parse({
    id: glnIfcImportId(report),
    type: 'gln:ifc-import',
    name: `IFC 导入：${report.source.path.split(/[/\\]/).at(-1) ?? report.source.path}`,
    report,
    referenceVisible,
    visible: true,
  })
}

function withGlnPlugin(installedPlugins: readonly string[]) {
  return [...new Set([...installedPlugins, GLN_PLUGIN_ID])]
}

function assertResidentialDraft(draft: IfcResidentialSourceGraph) {
  const forbidden = Object.values(draft.nodes).find((node) =>
    PHYSICAL_OR_SYSTEM_KINDS.has(node.type),
  )
  if (forbidden) {
    throw new Error(`IFC residential draft must not configure GLN node kind "${forbidden.type}".`)
  }
}

export function buildIfcResidentialReplacement({
  draft,
  installedPlugins,
  report,
}: {
  draft: IfcResidentialSourceGraph
  installedPlugins: readonly string[]
  report: IfcResidentialConversionReport
}): GlnIfcAppliedScene {
  if (report.status !== 'draft-ready' || !report.minimumStructure.satisfied) {
    throw new Error('A residential replacement requires a draft-ready IFC conversion report.')
  }
  assertResidentialDraft(draft)
  const record = createGlnIfcImportRecord(report, false)
  return {
    nodes: { ...draft.nodes, [record.id]: record },
    rootNodeIds: [...draft.rootNodeIds, record.id],
    installedPlugins: withGlnPlugin(installedPlugins),
  }
}

export function buildIfcReportScene({
  current,
  installedPlugins,
  report,
}: {
  current: IfcResidentialSourceGraph
  installedPlugins: readonly string[]
  report: IfcResidentialConversionReport
}): GlnIfcAppliedScene {
  const record = createGlnIfcImportRecord(report, false)
  return {
    nodes: { ...current.nodes, [record.id]: record },
    rootNodeIds: current.rootNodeIds.includes(record.id as never)
      ? [...current.rootNodeIds]
      : [...current.rootNodeIds, record.id],
    installedPlugins: withGlnPlugin(installedPlugins),
  }
}
