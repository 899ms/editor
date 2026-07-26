#!/usr/bin/env bun

import { runPascalMcp } from '@pascal-app/mcp/cli'
import { createCodexCliAdapter } from '../lib/codex-tasks/codex-cli-adapter'
import { createCodexTaskManager } from '../lib/codex-tasks/codex-task-manager'
import { registerGlnCodexTaskTools } from '../lib/codex-tasks/codex-task-tools'
import { prepareGlnMcpRuntime } from '../lib/prepare-gln-mcp'

runPascalMcp(process.argv.slice(2), {
  commandName: 'gln-mcp',
  prepare: () => {
    prepareGlnMcpRuntime()
  },
  configureServer: ({ server, operations }) => {
    registerGlnCodexTaskTools(
      server,
      createCodexTaskManager({
        operations,
        adapter: createCodexCliAdapter(),
      }),
    )
  },
}).catch((error) => {
  console.error('[gln-mcp] fatal:', error instanceof Error ? (error.stack ?? error.message) : error)
  process.exit(1)
})
