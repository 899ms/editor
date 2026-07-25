import { expect, test } from 'bun:test'
import path from 'node:path'
import { configureGlnDatabaseEnvironment, resolveGlnDatabasePath } from './gln-database'

test('uses a GLN-specific database by default', () => {
  const home = path.join('C:', 'Users', 'test-user')
  const databasePath = resolveGlnDatabasePath({}, home)

  expect(databasePath).toBe(path.join(home, '.pascal-gln', 'data', 'gln.db'))
  expect(databasePath).not.toBe(path.join(home, '.pascal', 'data', 'pascal.db'))
})

test('accepts an explicit GLN database path', () => {
  const databasePath = resolveGlnDatabasePath(
    { PASCAL_DB_PATH: path.join('D:', 'gln-data', 'project.db') },
    path.join('C:', 'Users', 'test-user'),
  )

  expect(databasePath).toBe(path.resolve(path.join('D:', 'gln-data', 'project.db')))
})

test('rejects the original Editor default database', () => {
  const home = path.join('C:', 'Users', 'test-user')

  expect(() =>
    resolveGlnDatabasePath(
      { PASCAL_DB_PATH: path.join(home, '.pascal', 'data', 'pascal.db') },
      home,
    ),
  ).toThrow('GLN Editor cannot use the original Editor database')
})

test('configures storage from only the resolved GLN database path', () => {
  const env = {
    PASCAL_DATA_DIR: path.join('D:', 'legacy-data'),
    PASCAL_DB_PATH: path.join('D:', 'gln-data', 'project.db'),
  }

  const databasePath = configureGlnDatabaseEnvironment(env)

  expect(databasePath).toBe(path.resolve(path.join('D:', 'gln-data', 'project.db')))
  expect(env.PASCAL_DB_PATH).toBe(databasePath)
  expect('PASCAL_DATA_DIR' in env).toBe(false)
})
