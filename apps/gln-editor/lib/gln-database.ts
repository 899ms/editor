import os from 'node:os'
import path from 'node:path'

type DatabaseEnvironment = Record<string, string | undefined>

function expandHome(value: string, homeDirectory: string): string {
  if (value === '~') return homeDirectory
  if (value.startsWith(`~${path.sep}`) || value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(homeDirectory, value.slice(2))
  }
  return value
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => path.resolve(value).replaceAll('/', '\\').toLowerCase()
  return normalize(left) === normalize(right)
}

export function resolveGlnDatabasePath(
  env: DatabaseEnvironment = process.env,
  homeDirectory = os.homedir(),
): string {
  const originalEditorDatabase = path.join(homeDirectory, '.pascal', 'data', 'pascal.db')
  const configuredPath = env.PASCAL_DB_PATH
  const databasePath = configuredPath
    ? path.resolve(expandHome(configuredPath, homeDirectory))
    : path.join(homeDirectory, '.pascal-gln', 'data', 'gln.db')

  if (samePath(databasePath, originalEditorDatabase)) {
    throw new Error('GLN Editor cannot use the original Editor database')
  }

  return databasePath
}

export function configureGlnDatabaseEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  const databasePath = resolveGlnDatabasePath(env)
  env.PASCAL_DB_PATH = databasePath
  delete env.PASCAL_DATA_DIR
  return databasePath
}
