import { defineConfig } from '@playwright/test';
// Keep mock translation traffic off the user's running login bridge.
if (process.env.TRANSLATE_AI_LIVE_LOGIN !== '1') process.env.TRANSLATE_AI_TEST_BRIDGE_PORT ||= '18459';
export default defineConfig({
  testDir: './tests', timeout: 60000, expect: { timeout: 12000 }, fullyParallel: false, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'regression', testMatch: /regression\.spec\.js/ },
    { name: 'live', testMatch: /live\.spec\.js/ },
    { name: 'login', testMatch: /login\.spec\.js/ }
  ],
  webServer: { command: 'node tests/server.mjs', url: 'http://127.0.0.1:18457/health', reuseExistingServer: false, timeout: 15000 }
});
