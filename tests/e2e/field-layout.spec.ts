import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test(`practical pages and C1’s drawings fit ${width}px with named navigation`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['', 'night/#doors', 'setup/#wiring', 'recordings/']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
    }
    await page.goto('night/#rack');
    const navigation = page.getByRole('navigation', { name: 'Checklists and drills' });
    for (const label of ['Before doors', 'Changeover', 'Faults', 'End']) {
      await expect(navigation.getByText(label, { exact: true })).toBeVisible();
    }
    // Each drawing sits in C1, above the first line it serves, and is never wider than the card.
    const drawings = page.locator('[data-list="doors"] figure');
    await expect(drawings).toHaveCount(5);
    for (const drawing of await drawings.all()) {
      await drawing.scrollIntoViewIfNeeded();
      await expect(drawing.locator('svg')).toBeVisible();
      const box = await drawing.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    }
    await page.locator('#rack').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`rack-${width}.png`) });
  });
}

test('larger text and keyboard use keep practical instructions available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['', 'setup/', 'recordings/', 'night/#changeover']) {
    await page.goto(path);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => ({ tag: el.tagName, cls: String(el.className), text: el.textContent?.slice(0, 70) }))
        .slice(0, 20),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      `${path}: ${JSON.stringify(overflow)}`,
    ).toBeLessThanOrEqual(0);
  }
  const list = page.locator('[data-list="changeover"]');
  await list.getByRole('checkbox').first().focus();
  await page.keyboard.press('Space');
  await expect(list.getByRole('checkbox').first()).toBeChecked();
});

test('learning allows a prediction without confidence or a reveal without scoring', async ({ page }) => {
  await page.goto('learn/#hear');
  const listening = page.locator('.hear');
  await listening.getByRole('button', { name: 'Reveal without answering' }).click();
  await expect(listening.locator('.verdict')).toContainText('Answer revealed.');
  for (let round = 1; round < 3; round++) {
    await listening.getByRole('button', { name: 'Next round' }).click();
    await listening.getByRole('button', { name: 'Reveal without answering' }).click();
  }
  await listening.getByRole('button', { name: 'See results' }).click();
  await expect(listening).toContainText('You revealed the answers without a score.');
  await page.goto('learn/#check', { waitUntil: 'domcontentloaded' });
  const quiz = page.getByRole('region', { name: 'Meter check' });
  await quiz.getByRole('radio', { name: 'The first orange (0)' }).click();
  await quiz.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(quiz.getByRole('status')).toContainText('Right.');
  await quiz.getByRole('button', { name: 'Next question' }).click();
  await quiz.getByRole('button', { name: 'Reveal without answering' }).click();
  await expect(quiz.locator('.verdict')).toContainText('Answer revealed.');
});

test('a prediction made while the quiz script is loading survives hydration', async ({ page }) => {
  await page.goto('learn/');
  const island = page.locator('astro-island:has(.check)');
  const componentURL = await island.getAttribute('component-url');
  expect(componentURL).toBeTruthy();
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === componentURL,
    async (route) => {
      await held;
      await route.continue();
    },
  );
  await page.goto('about:blank');
  await page.goto('learn/#check', { waitUntil: 'domcontentloaded' });
  const quiz = page.getByRole('region', { name: 'Meter check' });
  await expect(island).toHaveAttribute('ssr', '');
  await expect(quiz.getByRole('button', { name: 'Reveal without answering' })).toBeDisabled();
  await quiz.getByRole('radio', { name: 'The first orange (0)' }).check();
  release();
  await expect(island).not.toHaveAttribute('ssr');
  await expect(quiz.getByRole('radio', { name: 'The first orange (0)' })).toBeChecked();
  await quiz.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(quiz.getByRole('status')).toContainText('Right.');
});

test.describe('the field guide without JavaScript', () => {
  // With JS off, browser-driven smooth fragment scrolling can stall Playwright's stability wait.
  // Exercise native controls without animation; normal motion is covered in the other cases.
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

  test('instructions, checkboxes, drawings and moved links remain usable', async ({ page }) => {
    await page.goto('night/#doors');
    const list = page.locator('[data-list="doors"]');
    await expect(list.getByText('Keep the rack’s power leads out while you connect the speakers.')).toBeVisible();
    await list.getByRole('checkbox').first().check();
    await expect(list.getByRole('checkbox').first()).toBeChecked();
    // The drawings are in the page as it is served, inside the list, with nothing to open.
    await expect(list.locator('figure svg')).toHaveCount(5);
    await expect(list.locator('#rack svg')).toBeVisible();
    // What is found by listening is with the recordings, and its old address on Crew still leads there.
    await page.goto('recordings/#fix-hollow');
    await expect(page.locator('#fix-hollow-step-2')).toContainText('Next recording, the day after');
    await page.goto('night/#fix-hollow');
    await page.getByRole('link', { name: 'Open this section in its new location' }).click();
    await expect(page).toHaveURL(/recordings\/#fix-hollow$/);
    await page.goto('setup/#setup');
    await page.getByRole('link', { name: 'Open this section in its new location' }).click();
    await expect(page).toHaveURL(/night\/#doors$/);
    await page.goto('#trim');
    await expect(page.locator('#trim')).toContainText('in your headphones, loudest part playing');
    await page.getByText('Why this target', { exact: true }).click();
    await expect(page.getByRole('link', { name: 'Read the evidence and limits' })).toBeVisible();
  });
});
