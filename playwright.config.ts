import { defineConfig, devices } from '@playwright/test';

// Test the built site under the same base path it will be served from, so base-path bugs fail
// here rather than on GitHub Pages. Run `pnpm build` first with the same BASE_PATH.
const basePath = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
// Not 4321, so a running dev server is never mistaken for the build under test.
const port = Number(process.env.E2E_PORT ?? 4322);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The strictest tsconfig rejects `workers: undefined`, hence the spread.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `${origin}${basePath}`, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    {
      name: 'a11y-prefs',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce', forcedColors: 'active', colorScheme: 'dark' },
    },
    // Optional local Safari-engine run. Normal CI only needs the Chromium installation.
    ...(process.env.CROSS_BROWSER === '1' ? [{ name: 'webkit-phone', use: { ...devices['iPhone 13'] } }] : []),
  ],
  webServer: {
    // Run astro itself (node_modules/.bin is on the PATH under `pnpm test:e2e`), not through
    // `pnpm exec`, which doesn't pass the stop signal on. --ignore-lock keeps Astro 7 in the
    // foreground even when it detects a coding agent, so Playwright can stop it afterwards.
    command: `astro preview --port ${port} --ignore-lock`,
    url: `${origin}${basePath}`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 3000 },
  },
});
