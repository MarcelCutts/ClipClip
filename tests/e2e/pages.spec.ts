import { expect, test } from '@playwright/test';
import { MOVED, PAGES, scrollThrough } from './pages';

for (const { path, name } of PAGES) {
  test(`${name} page loads cleanly`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    // Islands below the fold only hydrate once seen, and an error while hydrating counts too.
    await scrollThrough(page);
    await expect(page.locator('astro-island[ssr]'), 'every island hydrates').toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page must never scroll sideways').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('internal links resolve under the base path', async ({ page, request }) => {
  const seen = new Set<string>();
  for (const { path } of PAGES) {
    await page.goto(path);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== new URL(page.url()).origin || seen.has(url.pathname)) continue;
      seen.add(url.pathname);
      const res = await request.get(url.pathname);
      expect(res.status(), `${url.pathname} (linked from /${path})`).toBe(200);
    }
  }
  // Every page, at least, is linked from somewhere.
  expect(seen.size).toBeGreaterThanOrEqual(PAGES.length);
});

// Printed QR codes and old chat links point at the old pages: each forwards to the same section
// in its new home.
for (const { from, to } of MOVED) {
  test(`/${from} forwards to /${to}`, async ({ page, baseURL }) => {
    await page.goto(from);
    await expect(page).toHaveURL(`${baseURL}${to}`);
  });
}

test('the old pages tell search engines where their content went', async ({ request }) => {
  const html = await (await request.get('lab/')).text();
  expect(html).toContain('<meta name="robots" content="noindex">');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  expect(canonical, 'points at the guide, not the old page').not.toContain('/lab/');
});

test('the guide opens for DJs: one box of three lines, then the way to the crew page', async ({ page }) => {
  await page.goto('');
  const box = page.locator('.kbh');
  await expect(box).toHaveCount(1);
  await expect(box.locator('.item')).toHaveCount(3);
  await expect(page.locator('.opening').getByRole('link', { name: 'Crew' })).toHaveAttribute('href', /\/night\/$/);
  // The index lists the guide's own parts. The drills are on the crew page.
  await expect(page.locator('[data-toc] a[href*="night"]')).toHaveCount(0);
});

test('the header names the pages the same way on every page that has it', async ({ page }) => {
  for (const { path } of PAGES.filter((p) => p.name !== 'print')) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link')).toHaveText([
      'Guide',
      'Crew',
      'Setting up',
      'Print kit',
    ]);
  }
});

test('only the guide’s footer says what the demos are', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.site-footer')).toContainText('synthesised in your browser');
  for (const path of ['night/', 'setup/', 'no-such-page/']) {
    await page.goto(path);
    await expect(page.locator('.site-footer')).not.toContainText('synthesised');
  }
});

test('old links into the guide still land on their topic', async ({ page }) => {
  await page.goto('');
  // The drills and the clip checker link to #record-level, the old lab page to #model, the old long
  // version to #hood.
  for (const id of ['record-level', 'model', 'hood']) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
});

test('unknown pages get the 404 page', async ({ page }) => {
  const response = await page.goto('no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Nothing here');
});

test('glossary terms reveal their meaning on tap', async ({ page }) => {
  await page.goto('');
  const term = page.locator('button.term').first();
  await term.click();
  const pop = page.locator('.term-pop:popover-open');
  await expect(pop).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
});

test.describe('glossary bubbles on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // The night page is checklists and drills, with no terms to open.
  for (const path of ['', 'setup/'] as const) {
    test(`open at full width, on screen, on /${path}`, async ({ page }) => {
      await page.goto(path);
      const terms = page.locator('button.term');
      const count = await terms.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const term = terms.nth(i);
        // Mid-screen the bubble has room below the word; at the bottom edge it has to go above.
        for (const block of ['center', 'end'] as const) {
          await term.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'instant' }), block);
          await term.click();
          const fit = await term.evaluate((button) => {
            const pop = document.getElementById(button.getAttribute('popovertarget') ?? '');
            if (!pop?.matches(':popover-open')) return 'not open';
            const word = button.getBoundingClientRect();
            const box = pop.getBoundingClientRect();
            // How wide the bubble wants to be: its text on one line, up to its max-width.
            const probe = pop.cloneNode(true) as HTMLElement;
            probe.removeAttribute('popover');
            probe.removeAttribute('id');
            Object.assign(probe.style, {
              position: 'absolute',
              visibility: 'hidden',
              width: 'max-content',
              maxWidth: getComputedStyle(pop).maxWidth,
            });
            document.body.append(probe);
            const wanted = probe.getBoundingClientRect().width;
            probe.remove();
            const problems: string[] = [];
            if (box.width < wanted - 1) {
              problems.push(`squeezed to ${Math.round(box.width)} of ${Math.round(wanted)}px`);
            }
            if (box.left < 0 || box.right > innerWidth || box.top < 0 || box.bottom > innerHeight) {
              problems.push('off screen');
            }
            if (box.top < word.bottom - 1 && box.bottom > word.top + 1) problems.push('covers the word');
            return problems.join(', ') || 'ok';
          });
          expect(fit, `“${await term.textContent()}” scrolled to the ${block}`).toBe('ok');
          await page.keyboard.press('Escape');
        }
      }
    });
  }
});
