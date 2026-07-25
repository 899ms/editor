// Load shims before the scene bridge imports the browser-oriented core store.
import '../bridge/node-shims'

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { SceneBridge } from '../bridge/scene-bridge'
import { createPascalMcpServer } from '../server'
import { createSceneStore } from '../storage'
import { connectHttp } from '../transports/http'
import { connectStdio } from '../transports/stdio'
import { version } from '../version'

export type PascalMcpRuntimeOptions = {
  /** Product label shown in CLI help and status messages. */
  commandName?: string
  /** Register host-specific plugins before constructing the scene bridge. */
  prepare?: () => void | Promise<void>
}

export async function runPascalMcp(
  args: string[] = process.argv.slice(2),
  options: PascalMcpRuntimeOptions = {},
): Promise<void> {
  const commandName = options.commandName ?? 'pascal-mcp'
  const help = `${commandName} — MCP server for the Pascal editor

USAGE:
  ${commandName} [--stdio | --http --port <n>] [--scene <path>]

OPTIONS:
  --stdio          Use stdio transport (default)
  --http           Use Streamable HTTP transport
  --port <n>       HTTP port (default 3917)
  --host <host>    HTTP bind host (default 127.0.0.1)
  --auth-token <t> Bearer token required for HTTP calls
  --cors-origin <o> Repeatable allowed HTTP CORS origin
  --scene <path>   Initial scene JSON to load
  --version        Print version
  --help           Print this help
`
  const { values } = parseArgs({
    args,
    options: {
      stdio: { type: 'boolean', default: false },
      http: { type: 'boolean', default: false },
      port: { type: 'string', default: '3917' },
      host: { type: 'string', default: '127.0.0.1' },
      'auth-token': { type: 'string' },
      'cors-origin': { type: 'string', multiple: true, default: [] },
      scene: { type: 'string' },
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    console.log(help)
    return
  }

  if (values.version) {
    console.log(version)
    return
  }

  await options.prepare?.()

  const bridge = new SceneBridge()
  if (values.scene) {
    const raw = readFileSync(values.scene, 'utf8')
    bridge.loadJSON(raw)
  } else {
    bridge.loadDefault()
  }

  const store = await createSceneStore()
  const server = createPascalMcpServer({ bridge, store })

  if (values.http) {
    const portNum = Number.parseInt(values.port ?? '3917', 10)
    if (!Number.isFinite(portNum) || portNum < 0 || portNum > 65_535) {
      throw new Error(`invalid --port value: ${values.port}`)
    }
    const handle = await connectHttp(server, portNum, {
      host: values.host,
      authToken: values['auth-token'],
      allowedOrigins: values['cors-origin'],
    })
    console.error(`[${commandName}] HTTP server listening on ${handle.host}:${handle.port}`)
    const shutdown = async () => {
      try {
        await handle.close()
      } finally {
        process.exit(0)
      }
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    return
  }

  await connectStdio(server)
  console.error(`[${commandName}] stdio server running`)
}
