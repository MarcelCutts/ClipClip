import type { Page } from '@playwright/test';

/** Every page on the site, relative to the base path. */
export const PAGES = [
  { path: '', name: 'guide' },
  { path: 'night/', name: 'night' },
  { path: 'setup/', name: 'setup' },
  { path: 'print/', name: 'print' },
] as const;

/** Old addresses that forward, with where a section link on each should land. */
export const MOVED = [
  { from: 'dj/', to: '#playing' },
  { from: 'dj/#blends', to: '#blends' },
  { from: 'dj/#crew-knobs', to: '#knobs' },
  { from: 'crew/', to: 'night/' },
  { from: 'crew/#troubleshooting', to: 'night/#fixes' },
  { from: 'crew/#record-level', to: 'setup/#record-level' },
  { from: 'lab/', to: '#two-ceilings' },
  { from: 'lab/?lab=sandbox', to: '?lab=sandbox#two-ceilings' },
  { from: 'why/#sources', to: '#sources' },
] as const;

/** Scroll to the bottom and back, so every island that waits to be seen (client:visible) hydrates. */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Jump, don't glide: the site scrolls smoothly unless motion is reduced, and a smooth scroll
    // retargeted every 30 ms never gets far enough down for the lower islands to be seen.
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}
