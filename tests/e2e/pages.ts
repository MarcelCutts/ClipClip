import { expect, type Page } from '@playwright/test';

/** Every page on the site, relative to the base path. */
export const PAGES = [
  { path: '', name: 'guide' },
  { path: 'night/', name: 'night' },
  { path: 'setup/', name: 'setup' },
  { path: 'print/', name: 'print' },
  { path: 'learn/', name: 'learn' },
  { path: 'recordings/', name: 'recordings' },
] as const;

/** Old addresses that forward, with where a section link on each should land. */
export const MOVED = [
  { from: 'dj/', to: '#playing' },
  { from: 'dj/#blends', to: '#blends' },
  { from: 'dj/#crew-knobs', to: '#knobs' },
  { from: 'crew/', to: 'night/' },
  { from: 'crew/#troubleshooting', to: 'night/#fixes' },
  { from: 'crew/#record-level', to: 'night/#doors' },
  { from: 'setup/#record-level', to: 'night/#doors' },
  { from: 'setup/#amp-gains', to: 'setup/#driverack' },
  { from: 'lab/', to: 'learn/#two-ceilings' },
  { from: 'lab/?lab=sandbox', to: 'learn/?lab=sandbox#two-ceilings' },
  { from: '#hear', to: 'learn/#hear' },
  { from: 'setup/#setup', to: 'night/#doors' },
  { from: 'night/#next-day', to: 'recordings/#next-day' },
  { from: 'night/#fix-crunch-step-2', to: 'recordings/#fix-crunch-step-2' },
  { from: 'night/#fix-hollow', to: 'recordings/#fix-hollow' },
  { from: 'night/#fix-hum', to: 'night/#fixes' },
  { from: 'why/#sources', to: 'learn/#sources' },
] as const;

/** Visit each island, allowing its visibility observer to run before scrolling onwards. */
export async function scrollThrough(page: Page): Promise<void> {
  for (const island of await page.locator('astro-island').all()) {
    // astro-island itself uses display:contents, so scroll to its rendered content.
    if ((await island.getAttribute('client')) === 'visible') {
      await island.locator(':scope > :not(style)').first().scrollIntoViewIfNeeded();
    }
    await expect(island).not.toHaveAttribute('ssr');
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}
