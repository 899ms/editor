import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const runDirectory = mkdtempSync(path.join(tmpdir(), 'pascal-gln-e2e-'))
const editorBaseUrl = 'http://127.0.0.1:32102'
const glnBaseUrl = 'http://127.0.0.1:32103'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: glnBaseUrl,
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'bun run dev:e2e:editor',
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
      command: 'bun run dev:e2e:gln',
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
