import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Optional local browser dependency extracted on hosts without system install access.
const localLibs = path.resolve('.browser-libs/usr/lib/x86_64-linux-gnu');
if (existsSync(localLibs)) {
  process.env.LD_LIBRARY_PATH = [localLibs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
}
export default defineConfig({
  testDir: 'tests', testMatch: '**/*.spec.mjs', fullyParallel: true, workers: 2,
  timeout: 45_000, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1100 }, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/preview.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1100 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1100 } } },
  ],
});
