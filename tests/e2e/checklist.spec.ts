import { expect, test } from '@playwright/test';

// On a slow connection a crew member can tick boxes before the checklist's script arrives. Those
// ticks must survive it waking up, and be saved.
test('ticks made before the checklist wakes up are kept', async ({ page }) => {
  await page.goto('night/');
  const island = page.locator('astro-island:has(.checklist[data-list="doors"])');
  const componentUrl = await island.getAttribute('component-url');
  expect(componentUrl).toBeTruthy();

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Routing turns the HTTP cache off, so the reload below has to fetch the script again.
  await page.route(
    (url) => url.pathname === componentUrl,
    async (route) => {
      await held;
      await route.continue();
    },
  );
  // A fresh load: going from night/ to night/#doors would only change the hash, and the list is
  // already awake by then.
  await page.goto('about:blank');
  await page.goto('night/#doors');
  const boxes = page.locator('.checklist[data-list="doors"] input.box');
  await expect(island).toHaveAttribute('ssr', '');
  await boxes.nth(1).check();
  await boxes.nth(3).check();

  release();
  await expect(island).not.toHaveAttribute('ssr');
  await expect(boxes.nth(1)).toBeChecked();
  await expect(boxes.nth(3)).toBeChecked();
  await expect(page.locator('.checklist[data-list="doors"] .count')).toContainText('2 of');
  const saved = await page.evaluate(() => localStorage.getItem('out-of-the-red:checklist:doors'));
  expect(JSON.parse(saved ?? '{}').done).toHaveLength(2);
});

test.describe('the night page', () => {
  test('opens on its tabs, in the order the night runs, each big enough for a thumb', async ({ page }) => {
    await page.goto('night/');
    const tabs = page.getByRole('navigation', { name: 'Checklists and drills' }).getByRole('link');
    await expect(tabs).toHaveText([/C1\s+Doors/, /C2\s+Changeover/, /F\s+Something’s wrong/, /C3\s+After/]);
    expect(await tabs.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual([
      '#doors',
      '#changeover',
      '#fixes',
      '#after',
    ]);
    for (const tab of await tabs.all()) expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  });

  test('a drill’s jump lands on its step, clear of the tabs, and marks the drills tab', async ({ page }) => {
    await page.goto('night/#fix-howler-red');
    const nav = page.getByRole('navigation', { name: 'Checklists and drills' });
    await page.locator('#fix-howler-red').getByRole('link', { name: 'Go to step 3' }).first().click();
    await expect(page).toHaveURL(/#fix-howler-red-step-3$/);
    const step = page.locator('#fix-howler-red-step-3');
    // Settled just under the sticky tabs, not behind them.
    await expect
      .poll(async () => {
        const [landed, tabs] = await Promise.all([step.boundingBox(), nav.boundingBox()]);
        if (!landed || !tabs) return false;
        const gap = landed.y - (tabs.y + tabs.height);
        return gap >= 0 && gap < 64;
      })
      .toBe(true);
    await expect(nav.getByRole('link', { name: /Something’s wrong/ })).toHaveAttribute('aria-current', 'location');
  });
});
