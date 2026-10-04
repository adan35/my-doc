import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run dev -- --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
