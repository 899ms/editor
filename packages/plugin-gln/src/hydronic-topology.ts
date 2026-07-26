import type { GlnHydronicPipeNode, GlnPipeEndpoint } from './hydronic-pipe-schema'

type HydronicOwner = { id: string; type: string; systemId?: string }

export type GlnHydronicTopologyIssue = {
  code: 'incompatible-link' | 'missing-link' | 'orphaned-endpoint' | 'wrong-system'
  message: string
  pipeId?: string
}

type ExpectedLink = {
  circuit: GlnHydronicPipeNode['circuit']
  label: string
  endpoints: readonly [{ type: string; portId: string }, { type: string; portId: string }]
}

const REQUIRED_LOOP_LINKS: readonly ExpectedLink[] = [
  {
    circuit: 'supply',
    label: '外机供水到缓冲水箱',
    endpoints: [
      { type: 'gln:outdoor-unit', portId: 'supply' },
      { type: 'gln:buffer-tank', portId: 'source-supply' },
    ],
  },
  {
    circuit: 'return',
    label: '缓冲水箱回水到外机',
    endpoints: [
      { type: 'gln:buffer-tank', portId: 'source-return' },
      { type: 'gln:outdoor-unit', portId: 'return' },
    ],
  },
  {
    circuit: 'supply',
    label: '缓冲水箱供水到室内面板',
    endpoints: [
      { type: 'gln:buffer-tank', portId: 'load-supply' },
      { type: 'gln:wall-panel', portId: 'supply' },
    ],
  },
  {
    circuit: 'return',
    label: '室内面板回水到缓冲水箱',
    endpoints: [
      { type: 'gln:wall-panel', portId: 'return' },
      { type: 'gln:buffer-tank', portId: 'load-return' },
    ],
  },
]

function endpointMatches(
  endpoint: GlnPipeEndpoint,
  owner: HydronicOwner | undefined,
  expected: ExpectedLink['endpoints'][number],
) {
  return owner?.type === expected.type && endpoint.portId === expected.portId
}

function matchesExpectedLink(
  pipe: GlnHydronicPipeNode,
  owners: Readonly<Record<string, HydronicOwner>>,
  expected: ExpectedLink,
) {
  if (!pipe.start || !pipe.end || pipe.circuit !== expected.circuit) return false
  const start = owners[pipe.start.nodeId]
  const end = owners[pipe.end.nodeId]
  return (
    (endpointMatches(pipe.start, start, expected.endpoints[0]) &&
      endpointMatches(pipe.end, end, expected.endpoints[1])) ||
    (endpointMatches(pipe.start, start, expected.endpoints[1]) &&
      endpointMatches(pipe.end, end, expected.endpoints[0]))
  )
}

/**
 * Validates the minimum source-side and load-side loop from persisted endpoint
 * references. Pipe colour and geometry stay deliberately out of this check.
 */
export function getGlnHydronicTopologyIssues(
  nodes: Readonly<Record<string, HydronicOwner>>,
  systemId: string,
): GlnHydronicTopologyIssue[] {
  const allPipes = Object.values(nodes).flatMap((node) =>
    node.type === 'gln:hydronic-pipe' ? [node as GlnHydronicPipeNode] : [],
  )
  const pipes = allPipes.filter((node) => node.systemId === systemId)
  const issues: GlnHydronicTopologyIssue[] = []

  for (const pipe of pipes) {
    for (const endpoint of [pipe.start, pipe.end]) {
      if (!endpoint || !nodes[endpoint.nodeId]) {
        issues.push({
          code: 'orphaned-endpoint',
          message: '管线端点必须连接到一个存在的设备接口。',
          pipeId: pipe.id,
        })
        continue
      }
      if (nodes[endpoint.nodeId]?.systemId !== systemId) {
        issues.push({
          code: 'wrong-system',
          message: '管线端点只能连接同一套光冷暖系统中的设备。',
          pipeId: pipe.id,
        })
      }
    }
    if (!REQUIRED_LOOP_LINKS.some((expected) => matchesExpectedLink(pipe, nodes, expected))) {
      issues.push({
        code: 'incompatible-link',
        message: '供水和回水只能连接到同一回路中的兼容接口。',
        pipeId: pipe.id,
      })
    }
  }

  for (const expected of REQUIRED_LOOP_LINKS) {
    if (!pipes.some((pipe) => matchesExpectedLink(pipe, nodes, expected))) {
      issues.push({ code: 'missing-link', message: `尚未连接：${expected.label}。` })
    }
  }

  return issues
}

export function hasGlnHydronicClosedLoop(
  nodes: Readonly<Record<string, HydronicOwner>>,
  systemId: string,
) {
  return getGlnHydronicTopologyIssues(nodes, systemId).length === 0
}
