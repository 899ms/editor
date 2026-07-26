type PreviewNode = {
  id: string
  type: string
  systemId?: string
  mode?: 'cooling' | 'heating' | 'standby'
  zoneId?: string | null
  zoneSettings?: Record<
    string,
    {
      enabled?: boolean
      targetHumidity?: number | null
      targetTemperature?: number | null
    }
  >
  circuit?: 'supply' | 'return'
  start?: { nodeId: string; portId: string } | null
  end?: { nodeId: string; portId: string } | null
}

type EndpointRole = { nodeType: string; portId: string }
type ExpectedFlow = {
  circuit: 'supply' | 'return'
  destination: EndpointRole
  origin: EndpointRole
}

const EXPECTED_FLOWS: ExpectedFlow[] = [
  {
    circuit: 'supply',
    origin: { nodeType: 'gln:outdoor-unit', portId: 'supply' },
    destination: { nodeType: 'gln:buffer-tank', portId: 'source-supply' },
  },
  {
    circuit: 'return',
    origin: { nodeType: 'gln:buffer-tank', portId: 'source-return' },
    destination: { nodeType: 'gln:outdoor-unit', portId: 'return' },
  },
  {
    circuit: 'supply',
    origin: { nodeType: 'gln:buffer-tank', portId: 'load-supply' },
    destination: { nodeType: 'gln:wall-panel', portId: 'supply' },
  },
  {
    circuit: 'return',
    origin: { nodeType: 'gln:wall-panel', portId: 'return' },
    destination: { nodeType: 'gln:buffer-tank', portId: 'load-return' },
  },
]

export type GlnRunPreviewModel = {
  panels: Array<{
    panelId: string
    energyDirection: 'space-to-panel' | 'panel-to-space'
    targetHumidity: number | null
    targetTemperature: number | null
    zoneId: string
  }>
  pipes: Array<{
    pipeId: string
    pathDirection: 'forward' | 'reverse'
  }>
}

function matches(
  endpoint: { nodeId: string; portId: string },
  role: EndpointRole,
  nodes: Readonly<Record<string, PreviewNode>>,
) {
  return nodes[endpoint.nodeId]?.type === role.nodeType && endpoint.portId === role.portId
}

function pipeDirection(
  pipe: PreviewNode,
  nodes: Readonly<Record<string, PreviewNode>>,
): 'forward' | 'reverse' | null {
  if (!(pipe.circuit && pipe.start && pipe.end)) return null
  const startNode = nodes[pipe.start.nodeId]
  const endNode = nodes[pipe.end.nodeId]
  if (
    !pipe.systemId ||
    startNode?.systemId !== pipe.systemId ||
    endNode?.systemId !== pipe.systemId
  ) {
    return null
  }
  for (const expected of EXPECTED_FLOWS) {
    if (expected.circuit !== pipe.circuit) continue
    if (
      matches(pipe.start, expected.origin, nodes) &&
      matches(pipe.end, expected.destination, nodes)
    ) {
      return 'forward'
    }
    if (
      matches(pipe.end, expected.origin, nodes) &&
      matches(pipe.start, expected.destination, nodes)
    ) {
      return 'reverse'
    }
  }
  return null
}

export function deriveGlnRunPreview(
  nodes: Readonly<Record<string, PreviewNode>>,
): GlnRunPreviewModel {
  const systems = new Map(
    Object.values(nodes)
      .filter((node) => node.type === 'gln:system')
      .map((node) => [node.id, node]),
  )
  const pipes = Object.values(nodes)
    .filter((node) => {
      const system = node.systemId ? systems.get(node.systemId) : undefined
      return node.type === 'gln:hydronic-pipe' && !!system?.mode && system.mode !== 'standby'
    })
    .flatMap((pipe) => {
      const direction = pipeDirection(pipe, nodes)
      return direction ? [{ pipeId: pipe.id, pathDirection: direction }] : []
    })
    .sort((left, right) => left.pipeId.localeCompare(right.pipeId))

  const connectedPanelIds = new Map<string, Set<'return' | 'supply'>>()
  for (const pipe of Object.values(nodes)) {
    if (!pipes.some((entry) => entry.pipeId === pipe.id)) continue
    for (const endpoint of [pipe.start, pipe.end]) {
      if (!endpoint || nodes[endpoint.nodeId]?.type !== 'gln:wall-panel') continue
      if (endpoint.portId === 'supply' || endpoint.portId === 'return') {
        const ports = connectedPanelIds.get(endpoint.nodeId) ?? new Set()
        ports.add(endpoint.portId)
        connectedPanelIds.set(endpoint.nodeId, ports)
      }
    }
  }

  const panels = Object.values(nodes)
    .filter((node) => {
      const ports = connectedPanelIds.get(node.id)
      return node.type === 'gln:wall-panel' && ports?.has('supply') && ports.has('return')
    })
    .flatMap((panel) => {
      const system = panel.systemId ? systems.get(panel.systemId) : undefined
      if (!(system && panel.zoneId && system.mode && system.mode !== 'standby')) return []
      const settings = system.zoneSettings?.[panel.zoneId]
      if (settings?.enabled === false) return []
      return [
        {
          panelId: panel.id,
          energyDirection:
            system.mode === 'cooling' ? ('space-to-panel' as const) : ('panel-to-space' as const),
          targetHumidity: settings?.targetHumidity ?? null,
          targetTemperature: settings?.targetTemperature ?? null,
          zoneId: panel.zoneId,
        },
      ]
    })
    .sort((left, right) => left.panelId.localeCompare(right.panelId))

  return { panels, pipes }
}
