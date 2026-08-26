import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const runDirectory = mkdtempSync(path.join(tmpdir(), 'pascal-gln-e2e-'))
const editorBaseUrl = 'http://localhost:32102'
const glnBaseUrl = 'http://127.0.0.1:32103'

export default defineConfig({
  testDir: './e2e',
  testIgnore:
    process.env.GLN_E2E_EXCLUDE_FLOORPLAN === '1' ? '**/floorplan-export.spec.ts' : undefined,
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: glnBaseUrl,
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  expect: {
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  webServer: [
    {
      command: 'bun run start:e2e:editor',
      cwd: '../..',
      env: {
        NEXT_PUBLIC_APP_URL: editorBaseUrl,
        PASCAL_DB_PATH: path.join(runDirectory, 'editor.db'),
      },
      port: 32102,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'bun run start:e2e:gln',
      cwd: '../..',
      env: {
        NEXT_PUBLIC_APP_URL: glnBaseUrl,
        PASCAL_DB_PATH: path.join(runDirectory, 'gln.db'),
      },
      port: 32103,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
