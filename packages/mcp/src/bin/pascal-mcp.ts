#!/usr/bin/env bun
import { runPascalMcp } from './run-pascal-mcp'

runPascalMcp().catch((err) => {
  console.error('[pascal-mcp] fatal:', err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
