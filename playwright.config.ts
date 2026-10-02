import { defineConfig } from '@playwright/test'
import { readBackendPort, readSettings } from './server/settings.ts'

const apiPort =
  process.env.E2E_API_PORT ?? String(readBackendPort(readSettings()))
const webPort = process.env.E2E_WEB_PORT ?? '5173'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ??
      (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx tests/browser-server.ts',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: 'npx vite',
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
    },
  ],
})
