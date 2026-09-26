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

/**
 * A tab's name, code first: "C1: Doors". The colon is visually hidden, and a browser may set a hidden
 * span apart with a space ("C1 : Doors"), which a screen reader doesn't voice.
 */
const named = (code: string, label: string) => new RegExp(`^${code} ?: ${label}$`);

test.describe('the night page', () => {
  test('opens on its tabs, in the order the night runs, each big enough for a thumb', async ({ page }) => {
    await page.goto('night/');
    const tabs = page.getByRole('navigation', { name: 'Checklists and drills' }).getByRole('link');
    // Each named as it reads, code first: "C1: Doors".
    const names = [
      named('C1', 'Doors'),
      named('C2', 'Changeover'),
      named('F', 'Something’s wrong'),
      named('C3', 'After'),
    ];
    await expect(tabs).toHaveCount(names.length);
    for (const [i, name] of names.entries()) await expect(tabs.nth(i)).toHaveAccessibleName(name);
    expect(await tabs.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual([
      '#doors',
      '#changeover',
      '#fixes',
      '#after',
    ]);
    for (const tab of await tabs.all()) expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  });

  test('a drill’s jump lands on its step, clear of the tabs, outlined, and marks the drills tab', async ({ page }) => {
    await page.goto('night/#fix-howler-red');
    const nav = page.getByRole('navigation', { name: 'Checklists and drills' });
    const drill = page.locator('#fix-howler-red');
    // Every jump is a thumb's height tall, though it sits in a line of text.
    for (const jump of await drill.getByRole('link', { name: /^Go to / }).all()) {
      expect((await jump.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await drill.getByRole('link', { name: 'Go to step 3' }).first().click();
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
    // The step it landed on is outlined, so the eye finds it in either theme.
    await expect(step).toHaveCSS('outline-style', 'solid');
    await expect(step).toHaveCSS('outline-width', '3px');
    // Before the step: what it also does, in a plain sentence.
    await expect(step).toContainText('This turns the room down too, so tell the DJ first.');
    await expect(nav.getByRole('link', { name: named('F', 'Something’s wrong') })).toHaveAttribute(
      'aria-current',
      'location',
    );
    await expect(page.getByRole('heading', { level: 2, name: 'F: Something’s wrong' })).toBeAttached();
  });

  test('the changeover’s Howler line leads to its drill when the light blinks red', async ({ page }) => {
    await page.goto('night/#changeover');
    const line = page.locator('.checklist[data-list="changeover"] li').first();
    await expect(line).toContainText('If it blinks red, see F1.');
    await line.getByRole('link', { name: 'see F1' }).click();
    await expect(page).toHaveURL(/#fix-howler-red$/);
    await expect(page.getByRole('heading', { name: 'F1: LEVEL light on the Howler: red' })).toBeInViewport();
    // Following the link never ticks the box.
    await expect(line.getByRole('checkbox')).not.toBeChecked();
  });

  test('on a wide screen, an index rail lists the night, with every drill under F', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('night/#fix-power-cut');
    const rail = page.getByRole('navigation', { name: 'Index' });
    await expect(rail).toBeVisible();
    const parts = rail.locator('.parts > li > a');
    await expect(parts).toHaveText([
      /C1\s*Doors open/,
      /C2\s*Changeover/,
      /F\s*Something’s wrong/,
      /C3\s*After the night/,
    ]);
    // In the drills, F opens on all eleven, each by its code.
    const drills = rail.locator('.subs a');
    await expect(drills).toHaveCount(11);
    // The built page keeps a space either side of a link's words.
    await expect(drills.first()).toHaveText(/^\s*F1 /);
    await expect(drills.last()).toHaveText(/^\s*F11 /);
    await expect(rail.getByRole('link', { name: /^F8 / })).toHaveAttribute('aria-current', 'location');
    // It stays in view under the tabs.
    const [box, tabs] = await Promise.all([
      rail.boundingBox(),
      page.getByRole('navigation', { name: 'Checklists and drills' }).boundingBox(),
    ]);
    expect(box && tabs && box.y >= tabs.y + tabs.height).toBe(true);

    // A phone has the tabs and the drills' own index instead.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(rail).toBeHidden();
  });
});
