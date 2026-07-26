import { GLN_PLUGIN_ID } from './constants'
import { GlnGlbImportNode } from './glb-import-schema'
import type {
  GlbResidentialConversionReport,
  GlbResidentialSourceGraph,
} from './glb-residential-reconstruction'

type SceneNode = GlbResidentialSourceGraph['nodes'][string] | GlnGlbImportNode

export type GlnGlbAppliedScene = {
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

export function glnGlbImportId(report: GlbResidentialConversionReport) {
  return `gln-glb-import_${report.source.sha256.slice(0, 16)}` as const
}

export function createGlnGlbImportRecord(
  report: GlbResidentialConversionReport,
  referenceVisible: boolean,
) {
  return GlnGlbImportNode.parse({
    id: glnGlbImportId(report),
    type: 'gln:glb-import',
    name: `GLB 导入：${report.source.path.split(/[/\\]/).at(-1) ?? report.source.path}`,
    report,
    referenceVisible,
    visible: true,
  })
}

function withGlnPlugin(installedPlugins: readonly string[]) {
  return [...new Set([...installedPlugins, GLN_PLUGIN_ID])]
}

function assertResidentialDraft(draft: GlbResidentialSourceGraph) {
  const forbidden = Object.values(draft.nodes).find((node) =>
    PHYSICAL_OR_SYSTEM_KINDS.has(node.type),
  )
  if (forbidden) {
    throw new Error(`GLB residential draft must not configure GLN node kind "${forbidden.type}".`)
  }
}

export function buildGlbResidentialReplacement({
  draft,
  installedPlugins,
  report,
}: {
  draft: GlbResidentialSourceGraph
  installedPlugins: readonly string[]
  report: GlbResidentialConversionReport
}): GlnGlbAppliedScene {
  if (report.status !== 'draft-ready' || !report.minimumStructure.satisfied) {
    throw new Error('A residential replacement requires a draft-ready GLB analysis report.')
  }
  assertResidentialDraft(draft)
  const record = createGlnGlbImportRecord(report, false)
  return {
    nodes: { ...draft.nodes, [record.id]: record },
    rootNodeIds: [...draft.rootNodeIds, record.id],
    installedPlugins: withGlnPlugin(installedPlugins),
  }
}

export function buildGlbReportScene({
  current,
  installedPlugins,
  report,
}: {
  current: GlbResidentialSourceGraph
  installedPlugins: readonly string[]
  report: GlbResidentialConversionReport
}): GlnGlbAppliedScene {
  const record = createGlnGlbImportRecord(report, false)
  return {
    nodes: { ...current.nodes, [record.id]: record },
    rootNodeIds: current.rootNodeIds.includes(record.id as never)
      ? [...current.rootNodeIds]
      : [...current.rootNodeIds, record.id],
    installedPlugins: withGlnPlugin(installedPlugins),
  }
}
