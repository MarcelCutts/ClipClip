import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { serveBuiltGuide } from './offline-server';

test('a failed update preserves the guide; a complete update activates after old tabs close', async ({
  page,
  context,
}, testInfo) => {
  test.skip(!['desktop', 'webkit-phone'].includes(testInfo.project.name), 'Exercise the lifecycle once per engine.');
  const server = await serveBuiltGuide();
  const { worker, config } = server;
  const nextHTML = (await readFile('dist/index.html', 'utf8')).replace(
    '</head>',
    '<meta name="test-deployment" content="next"></head>',
  );
  const nextWorker = worker.replace(
    worker.split('\n')[0]!,
    `const CONFIG = ${JSON.stringify({
      ...config,
      version: `${config.version}-next`,
      integrity: {
        ...config.integrity,
        [config.base]: `sha256-${createHash('sha256').update(nextHTML).digest('base64')}`,
      },
    })};`,
  );
  const origin = server.url;
  try {
    await page.goto(origin);
    await page.getByRole('button', { name: 'Save for offline use' }).click();
    await expect(page.locator('[data-status]')).toContainText('Saved on this device');

    // sw.js advertises new HTML, while the host still serves the previous HTML with HTTP 200.
    // Integrity checking must reject that mixed package, without losing the old cache.
    server.files.set('sw.js', nextWorker);
    await page.getByRole('button', { name: 'Check for an update' }).click();
    await expect(page.locator('[data-status]')).toContainText('Your previous complete guide is still available');
    await server.stop();
    await expect(fetch(origin)).rejects.toThrow();
    await page.goto(`${origin}night/#fix-howler-red`);
    await expect(page.locator('#fix-howler-red')).toBeVisible();
    await expect(page.locator('[data-status]')).toContainText('Saved on this device');

    await server.start();
    server.files.set('index.html', nextHTML);
    await page.getByRole('button', { name: 'Check for an update' }).click();
    await expect(page.locator('[data-status]')).toContainText('Update saved');
    await expect(page.locator('[data-status]')).toContainText('Your current saved version remains available');
    await page.goto(origin);
    await expect(page.locator('meta[name="test-deployment"]')).toHaveCount(0);
    const saved = await page.evaluate(async () =>
      (await caches.keys()).filter((key) => key.startsWith('out-of-the-red:')),
    );
    expect(saved).toHaveLength(2);

    // Close the old tab: navigating to about:blank can retain a WebKit back/forward-cache client.
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(origin);
    await expect
      .poll(
        async () =>
          reopened.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith('out-of-the-red:'))),
        { timeout: 15000 },
      )
      .toHaveLength(1);
    await reopened.reload();
    await expect(reopened.locator('meta[name="test-deployment"]')).toHaveAttribute('content', 'next');
    await expect(reopened.locator('[data-status]')).toContainText('Saved on this device');
    await server.stop();
    await reopened.goto(`${origin}night/#fix-howler-red`);
    await expect(reopened.locator('#fix-howler-red')).toBeVisible();
  } finally {
    await server.stop();
  }
});
