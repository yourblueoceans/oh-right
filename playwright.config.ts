import { defineConfig, devices } from '@playwright/test';

// Runs against local Firebase emulators (see `npm run test:e2e`), never the real project.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    ...devices['Pixel 7'],
    trace: 'off',
  },
  webServer: {
    command: 'npx vite --mode emulator --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
