import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 60000, expect: { timeout: 12000 }, fullyParallel: false, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'regression', testMatch: /regression\.spec\.js/ },
    { name: 'live', testMatch: /live\.spec\.js/ }
  ],
  webServer: { command: 'node tests/server.mjs', url: 'http://127.0.0.1:18457/health', reuseExistingServer: false, timeout: 15000 }
});
