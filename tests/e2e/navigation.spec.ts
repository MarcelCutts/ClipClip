import { expect, test } from '@playwright/test';

test('crew pages keep section context and link to one another', async ({ page }) => {
  await page.goto('night/');
  for (const [label, path] of [
    ['Rig reference', 'setup'],
    ['Recordings', 'recordings'],
    ['Print kit', 'print'],
  ] as const) {
    const links = page.getByRole('navigation', { name: 'Crew pages' });
    await links.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${path}/?$`));
    await expect(
      page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Crew' }),
    ).toHaveAttribute('aria-current', 'location');
    await expect(links.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Crew' }).click();
  await expect(page).toHaveURL(/\/night\/?$/);
  await expect(
    page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Crew' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('learning topics open with the keyboard, jump to exercises and adapt to the desktop rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('learn/');
  const index = page.getByRole('navigation', { name: 'All learning topics' });
  const summary = index.locator('summary');
  const meter = index.getByRole('link', { name: '2.2 Meter check', exact: true });
  await expect(meter).toBeHidden();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(meter).toBeVisible();
  await meter.click();
  await expect(page).toHaveURL(/\/learn\/#check$/);
  await expect(page.getByRole('heading', { name: '2.2 Meter check', exact: true })).toBeInViewport();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(summary).toBeHidden();
  // Reflow can change the section in view. Each part remains available in the rail.
  await index.getByRole('link', { name: /Practise a blend/ }).click();
  await expect(meter).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  await expect(meter).toBeHidden();
  await summary.focus();
  await page.keyboard.press('Space');
  await expect(meter).toBeVisible();
});

test.describe('learning navigation without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

  test('the full topic list and its section links remain usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('learn/');
    const index = page.getByRole('navigation', { name: 'All learning topics' });
    await index.locator('summary').click();
    await index.getByRole('link', { name: '3.2 Two ceilings', exact: true }).click();
    await expect(page).toHaveURL(/\/learn\/#two-ceilings$/);
    await expect(page.getByRole('heading', { name: '3.2 Two ceilings', exact: true })).toBeInViewport();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(index.getByRole('link', { name: '2.2 Meter check', exact: true })).toBeVisible();
  });
});
