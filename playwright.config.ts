import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173/tintedtasks/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && node scripts/serve-release.mjs',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})