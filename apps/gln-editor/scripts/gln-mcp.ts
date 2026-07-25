#!/usr/bin/env bun

import { runPascalMcp } from '@pascal-app/mcp/cli'
import { prepareGlnMcpRuntime } from '../lib/prepare-gln-mcp'

runPascalMcp(process.argv.slice(2), {
  commandName: 'gln-mcp',
  prepare: () => {
    prepareGlnMcpRuntime()
  },
}).catch((error) => {
  console.error('[gln-mcp] fatal:', error instanceof Error ? (error.stack ?? error.message) : error)
  process.exit(1)
})
