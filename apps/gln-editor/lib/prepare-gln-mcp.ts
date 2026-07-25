import { configureGlnDatabaseEnvironment } from './gln-database'
import { ensureGlnPluginRegistered } from './register-gln-plugin'

/** Configure the isolated GLN database and registry before MCP constructs its store. */
export function prepareGlnMcpRuntime(env: NodeJS.ProcessEnv = process.env): string {
  const databasePath = configureGlnDatabaseEnvironment(env)
  ensureGlnPluginRegistered()
  return databasePath
}
