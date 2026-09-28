import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, webkit } from '@playwright/test';
import { serveBuiltGuide } from './offline-server';

test('saved guide reopens offline with pages, fonts, diagrams, islands and old links', async ({
  context,
  page,
  browserName,
}) => {
  test.setTimeout(60000);
  const server = await serveBuiltGuide();
  try {
    await page.goto(server.url);
    await page.getByRole('button', { name: 'Save for offline use' }).click();
    await expect(page.locator('[data-status]')).toContainText('Saved on this device', { timeout: 30000 });
    await page.close();
    await server.stop();
    // Playwright 1.63 WebKit rejects SW responses when setOffline(true): microsoft/playwright#42775.
    // Stopping this test's origin exercises the real cached response in both engines.
    await expect(fetch(server.url)).rejects.toThrow();
    if (browserName !== 'webkit') await context.setOffline(true);
    const reopened = await context.newPage();
    const errors: string[] = [];
    reopened.on('pageerror', (error) => errors.push(error.message));
    for (const path of ['', 'night/?event=test#fix-howler-red', 'setup/', 'recordings/', 'learn/#hear', 'print/']) {
      await reopened.goto(`${server.url}${path}`);
      await expect(reopened.locator('h1')).toBeVisible();
      await reopened.evaluate(() => document.fonts.ready);
      expect(await reopened.evaluate(() => [...document.fonts].some((face) => face.status === 'loaded'))).toBe(true);
    }
    await reopened.goto(`${server.url}night/#changeover`);
    const list = reopened.locator('[data-list="changeover"]');
    await list.getByRole('checkbox').first().check();
    await expect(list.locator('.count')).toContainText('1 of');
    await reopened.reload();
    await expect(list.getByRole('checkbox').first()).toBeChecked();
    await reopened.goto(`${server.url}night/#rack`);
    await expect(reopened.locator('[data-list="doors"] figure svg')).toHaveCount(5);
    await expect(reopened.locator('#rack')).toBeVisible();
    await reopened.goto(`${server.url}lab/`);
    await expect(reopened).toHaveURL(/learn\/#two-ceilings$/);
    const lab = reopened.locator('.two-ceilings');
    await lab.getByRole('button', { name: 'Show the result' }).click();
    await expect(lab.getByText('The crunch is still there', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await server.stop();
  }
});

test('an incomplete saved package is detected and can be repaired', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Save for offline use' }).click();
  await expect(page.locator('[data-status]')).toContainText('Saved on this device', { timeout: 30000 });
  await page.evaluate(async () => {
    const key = (await caches.keys()).find((name) => name.startsWith('out-of-the-red:'))!;
    const cache = await caches.open(key);
    const font = (await cache.keys()).find((request) => request.url.endsWith('.woff2'))!;
    await cache.delete(font);
  });
  await page.reload();
  await expect(page.locator('[data-status]')).toContainText('No complete offline copy');
  await page.getByRole('button', { name: 'Save for offline use' }).click();
  await expect(page.locator('[data-status]')).toContainText('Saved on this device', { timeout: 30000 });
});

test('the saved guide survives a complete browser restart with its origin stopped', async ({
  browserName,
}, testInfo) => {
  test.skip(
    !['desktop', 'webkit-phone'].includes(testInfo.project.name),
    'Restart each browser engine once; device layouts are tested separately.',
  );
  const server = await serveBuiltGuide();
  const baseURL = server.url;
  const engine = browserName === 'webkit' ? webkit : chromium;
  const profile = await mkdtemp(join(tmpdir(), 'clipclip-offline-'));
  let persistent = await engine.launchPersistentContext(profile, { headless: true, baseURL });
  try {
    const online = await persistent.newPage();
    await online.goto('night/');
    await online.getByRole('button', { name: 'Save for offline use' }).click();
    await expect(online.locator('[data-status]')).toContainText('Saved on this device', { timeout: 30000 });
    await persistent.close();
    await server.stop();
    await expect(fetch(server.url)).rejects.toThrow();
    persistent = await engine.launchPersistentContext(profile, {
      headless: true,
      baseURL,
      offline: browserName !== 'webkit',
    });
    const reopened = await persistent.newPage();
    await reopened.goto('night/#fix-howler-red');
    await expect(reopened.locator('#fix-howler-red')).toBeVisible();
    await expect(reopened.locator('[data-status]')).toContainText('Saved on this device');
    await reopened.goto('setup/#wiring');
    await expect(reopened.locator('#wiring')).toBeVisible();
  } finally {
    await persistent.close();
    await server.stop();
    await rm(profile, { recursive: true, force: true });
  }
});
