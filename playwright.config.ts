import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', timeout: 15_000,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 15_000 },
});
