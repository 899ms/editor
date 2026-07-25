import { beforeEach, describe, expect, test } from 'bun:test'
import path from 'node:path'
import { getMandatoryPluginIds, nodeRegistry } from '@pascal-app/core/registry'
import { GLN_PLUGIN_ID } from '@pascal-app/plugin-gln'
import { prepareGlnMcpRuntime } from './prepare-gln-mcp'

describe('GLN MCP runtime preparation', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('uses the isolated database and registers the mandatory GLN schema', () => {
    const configuredPath = path.join('D:', 'gln-mcp-data', 'gln.db')
    const env = {
      PASCAL_DATA_DIR: path.join('D:', 'original-editor-data'),
      PASCAL_DB_PATH: configuredPath,
    } as NodeJS.ProcessEnv

    const databasePath = prepareGlnMcpRuntime(env)

    expect(databasePath).toBe(path.resolve(configuredPath))
    expect(env.PASCAL_DB_PATH).toBe(databasePath)
    expect(env.PASCAL_DATA_DIR).toBeUndefined()
    expect(nodeRegistry.has('gln:system')).toBe(true)
    expect(nodeRegistry.has('gln:outdoor-unit')).toBe(true)
    expect(getMandatoryPluginIds()).toContain(GLN_PLUGIN_ID)
  })
})
