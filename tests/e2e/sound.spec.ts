import { expect, type Page, test } from '@playwright/test';

/** The first Listen key, once it and the Stop bar have woken up: a press before then does nothing. */
async function firstListen(page: Page) {
  const listen = page.getByRole('button', { name: /^Listen/ }).first();
  await listen.scrollIntoViewIfNeeded();
  const islands = page.locator('astro-island');
  await expect(islands.filter({ has: listen }).first()).not.toHaveAttribute('ssr');
  await expect(islands.filter({ has: page.locator('.sound-bar') })).not.toHaveAttribute('ssr');
  return listen;
}

// The one page with sound, the guide: pressing Listen shows the page-wide Stop bar, and Stop or
// Escape silences everything. Nothing plays on load.
for (const path of ['learn/']) {
  test(`sound on /${path} starts only on a press and always stops`, async ({ page }) => {
    await page.goto(path);
    const bar = page.locator('.sound-bar');
    await expect(bar).toBeHidden();

    const listen = await firstListen(page);
    await listen.click();
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Stop' })).toBeVisible();
    // Screen readers hear what started, and that it stopped, from a polite status of its own.
    const status = page.getByRole('status').filter({ hasText: /^Playing/ });
    await expect(status).toHaveText(/^Playing: \S/);

    await bar.getByRole('button', { name: 'Stop' }).click();
    await expect(bar).toBeHidden();
    await expect(page.locator('[data-sound-status]')).toHaveText('Sound stopped');

    await listen.click();
    await expect(bar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bar).toBeHidden();
  });
}

// The Stop bar covers the bottom of the screen, and scroll padding can't scroll past the end of
// the page, so the page makes room for the bar: the footer's links still show when focused.
test('the Stop bar never hides a focused link at the foot of the page', async ({ page }) => {
  await page.goto('learn/');
  const listen = await firstListen(page);
  await listen.click();
  const bar = page.locator('.sound-bar');
  await expect(bar).toBeVisible();
  const links = page.locator('.site-footer a');
  for (let i = 0; i < (await links.count()); i++) {
    const link = links.nth(i);
    // Retried as a whole, in case the bar is still measuring itself on the first go.
    await expect(async () => {
      await link.blur();
      await link.focus();
      const box = await link.boundingBox();
      const top = (await bar.boundingBox())?.y ?? 0;
      expect((box?.y ?? Number.POSITIVE_INFINITY) + (box?.height ?? 0)).toBeLessThanOrEqual(top);
    }).toPass();
  }
});

test('nothing makes a sound on page load', async ({ page }) => {
  await page.goto('learn/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.sound-bar')).toBeHidden();
});
