/// <reference types="vitest/config" />
import { playwright } from '@vitest/browser-playwright';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    projects: [
      {
        // The maths: DSP, the simulation model, content data. Fast, in Node.
        test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        // Components, in real Chromium: sliders, meters, the audio engine.
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
