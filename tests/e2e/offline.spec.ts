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
    await lab.getByRole('button', { name: 'Show the answer' }).click();
    await expect(lab.locator('.goal-title')).toHaveText('It is green');
    expect(errors).toEqual([]);

    // Safari plays a video only from the parts it asks for, so the saved clip answers a range with
    // that range. This test's server never does: the part comes from the saved copy.
    await reopened.goto(`${server.url}print/`);
    const part = await reopened.evaluate(async () => {
      const clip = document.querySelector('video source, video')?.getAttribute('src') ?? '';
      const response = await fetch(clip, { headers: { Range: 'bytes=0-1' } });
      return {
        status: response.status,
        range: response.headers.get('Content-Range'),
        bytes: (await response.arrayBuffer()).byteLength,
      };
    });
    expect(part.status).toBe(206);
    expect(part.range).toMatch(/^bytes 0-1\/\d+$/);
    expect(part.bytes).toBe(2);

    // A mistyped address has no page in the package. With no connection it gets the guide's own
    // "nothing here" page and its links, not the browser's error.
    const missing = await reopened.goto(`${server.url}Night/`);
    expect(missing?.status()).toBe(404);
    await expect(reopened.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(reopened.getByRole('main').getByRole('link', { name: 'Crew' })).toBeVisible();
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

test('the guide can be kept on a Home Screen: its manifest opens inside the guide, with its icons', async ({
  page,
  baseURL,
}) => {
  await page.goto('');
  const link = await page.locator('link[rel="manifest"]').getAttribute('href');
  const base = new URL(baseURL!).pathname;
  expect(link).toBe(`${base}manifest.webmanifest`);
  const response = await page.request.get(link!);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  // A Home Screen app has storage of its own, which is where the saved copy must go: it opens at
  // the guide's own address under any base path, and stays inside it.
  expect(manifest.start_url).toBe(base);
  expect(manifest.scope).toBe(base);
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    const image = await page.request.get(icon.src);
    expect(image.ok(), icon.src).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }
  // The saved package carries the manifest and its icons, so the app's own files are there offline.
  const worker = await (await page.request.get(`${base}sw.js`)).text();
  for (const file of [link!, ...manifest.icons.map((icon) => icon.src)]) expect(worker).toContain(`"${file}"`);
});

test('the copy says when it was saved, and a look for a newer version says when it looked', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Save for offline use' }).click();
  const status = page.locator('[data-status]');
  const today = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(Date.now());
  await expect(status).toContainText(`Saved on this device on ${today}`, { timeout: 30000 });
  await page.getByRole('button', { name: 'Check for an update' }).click();
  await expect(status).toContainText(/No newer version at \d\d:\d\d\./, { timeout: 30000 });
  await expect(status).toContainText(`Saved on this device on ${today}`);
});
