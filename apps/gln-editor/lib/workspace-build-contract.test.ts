import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const packageJson = JSON.parse(
  readFileSync(path.join(import.meta.dir, '..', 'package.json'), 'utf8'),
) as {
  scripts: Record<string, string>
}

test('direct GLN dev and build commands compile the viewer package first', () => {
  expect(packageJson.scripts['prepare:viewer']).toBe('bun run --cwd ../../packages/viewer build')

  for (const scriptName of ['dev', 'build']) {
    const script = packageJson.scripts[scriptName]
    expect(script.indexOf('bun run prepare:viewer')).toBeGreaterThanOrEqual(0)
    expect(script.indexOf('bun run prepare:viewer')).toBeLessThan(script.indexOf('next '))
  }
})
