import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Playwright workers are forked from this process, so setting process.env here
// is the only reliable way to pass .env values to test workers.
// (Bun auto-loads .env for bun scripts, but not for forked Node worker processes.)
try {
  const content = readFileSync('.env', 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
