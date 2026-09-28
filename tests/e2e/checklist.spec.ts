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
  // WebKit may include this deliberately held module in its load event.
  await page.goto('night/#doors', { waitUntil: 'domcontentloaded' });
  const boxes = page.locator('.checklist[data-list="doors"] input.box');
  await expect(island).toHaveAttribute('ssr', '');
  await boxes.nth(1).check();
  await boxes.nth(3).check();

  release();
  await expect(island).not.toHaveAttribute('ssr');
  await expect(boxes.nth(1)).toBeChecked();
  await expect(boxes.nth(3)).toBeChecked();
  await expect(page.locator('.checklist[data-list="doors"] .count')).toContainText('2 of');
  const saved = await page.evaluate(() =>
    localStorage.getItem(Object.keys(localStorage).find((key) => key.includes(':checklist:doors:')) ?? ''),
  );
  expect(JSON.parse(saved ?? '{}').done).toHaveLength(2);
});

/**
 * A tab's name, code first: "C1: Doors". The colon is visually hidden, and a browser may set a hidden
 * span apart with a space ("C1 : Doors"), which a screen reader doesn't voice.
 */
const named = (code: string, label: string) => new RegExp(`^${code} ?: ${label}$`);

/** Narrower than the index rail needs (80rem): the tabs are the way round the page. */
const BELOW_THE_RAIL = { width: 1024, height: 768 };

test.describe('the night page', () => {
  test('opens on its tabs, in the order the night runs, each big enough for a thumb', async ({ page }) => {
    if ((page.viewportSize()?.width ?? 0) >= 1280) await page.setViewportSize(BELOW_THE_RAIL);
    await page.goto('night/');
    const tabs = page.getByRole('navigation', { name: 'Checklists and drills' }).getByRole('link');
    // Each named as it reads, code first: "C1: Doors".
    const names = [
      named('C1', 'Before doors'),
      named('C2', 'Changeover'),
      named('F', 'Something’s wrong'),
      named('C3', 'End of the night'),
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
    if ((page.viewportSize()?.width ?? 0) >= 1280) await page.setViewportSize(BELOW_THE_RAIL);
    await page.goto('night/#fix-howler-red');
    const nav = page.getByRole('navigation', { name: 'Checklists and drills' });
    const drill = page.locator('#fix-howler-red');
    // Every jump is a thumb's height tall, though it sits in a line of text.
    for (const jump of await drill.getByRole('link', { name: /^Go to / }).all()) {
      expect((await jump.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await drill.getByRole('link', { name: 'Go to step 2' }).first().click();
    await expect(page).toHaveURL(/#fix-howler-red-step-2$/);
    const step = page.locator('#fix-howler-red-step-2');
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
    // Before the recording is turned down, which turns the room down too, the DJ is told, in these words.
    await expect(step).toContainText(
      'Say to the DJ: “The room will go quieter until the amps are turned up. Keep your levels as they are.”',
    );
    // One knob, and no menu: MASTER LEVEL comes down until the light is green.
    const down = page.locator('#fix-howler-red-step-3');
    await expect(down).toContainText('MASTER LEVEL');
    await expect(down).toContainText('down a little at a time, until the Howler’s LEVEL light blinks green');
    await expect(drill).not.toContainText('MASTER ATT');
    // Every way through ends by looking at the Howler's light again.
    await expect(page.locator('#fix-howler-red-step-5')).toContainText('Howler LEVEL light');
    await expect(page.locator('#fix-howler-red-step-6')).toHaveCount(0);
    await expect(nav.getByRole('link', { name: named('F', 'Something’s wrong') })).toHaveAttribute(
      'aria-current',
      'location',
    );
    await expect(page.getByRole('heading', { level: 2, name: 'F: Something’s wrong' })).toBeAttached();
  });

  test('the changeover’s Howler line gives the first action, then leads to its drill', async ({ page }) => {
    await page.goto('night/#changeover');
    const line = page.locator('.checklist[data-list="changeover"] li').first();
    await expect(line).toContainText('If it blinks red, look at the MASTER meters, the pair in the middle, first.');
    await expect(line).toContainText('If they are below red, go to F1.');
    await line.getByRole('link', { name: 'go to F1' }).click();
    await expect(page).toHaveURL(/#fix-howler-red$/);
    await expect(page.getByRole('heading', { name: 'F1: Howler LEVEL light: red' })).toBeInViewport();
    // Following the link never ticks the box.
    await expect(line.getByRole('checkbox')).not.toBeChecked();
  });

  test('on a wide screen, an index rail lists the night, each drill under the part it’s in', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('night/#fix-power-cut');
    const rail = page.getByRole('navigation', { name: 'Index' });
    await expect(rail).toBeVisible();
    const parts = rail.locator('.parts > li > a');
    await expect(parts).toHaveText([
      /C1\s*Before doors/,
      /C2\s*Changeover/,
      /F\s*Something’s wrong/,
      /C3\s*End of the night/,
    ]);
    // F opens on the booth's eight drills, each by its code. The next day's two are with the recordings.
    const drills = rail.locator('.part[data-open] .subs a');
    await expect(drills).toHaveCount(8);
    // The built page keeps a space either side of a link's words.
    await expect(drills.first()).toHaveText(/^\s*F1 /);
    await expect(drills.last()).toHaveText(/^\s*F8 /);
    await expect(rail.getByRole('link', { name: /^F8 / })).toHaveAttribute('aria-current', 'location');
    await expect(rail.locator('.subs a')).toHaveCount(8);
    // The rail does the tabs' job here, as on every page with a rail, and a jump lands at the top.
    const tabs = page.locator('[data-night-tabs]');
    await expect(tabs).toBeHidden();
    const landed = await page.locator('#fix-power-cut').boundingBox();
    expect(landed && landed.y >= 0 && landed.y < 64).toBe(true);

    // A phone has the tabs and the drills' own index instead.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(rail).toBeHidden();
    await expect(tabs).toBeVisible();
  });
});
