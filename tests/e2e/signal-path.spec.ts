import { expect, type Locator, type Page, test } from '@playwright/test';
import { captionFor, type NodeId, type Variant } from '../../src/lib/rig';

// The "Which knob touches what" drawing: in the guide (#signal) and again on /setup/, both in the
// full view (the DJ view stays in the component for any page that wants it). The drawing is one
// radio group, so it takes one Tab stop and the arrow keys move the pick along the signal,
// announcing each part. Arrowing never lands a part off screen or under the pinned title, even at
// 400% zoom, the pinned title fits in the room focus scrolling keeps for it, and every part is a
// 44px target on a 320px phone.

const DRAWINGS = [
  { path: '', variant: 'full', name: 'drawing in the guide' },
  { path: 'setup/', variant: 'full', name: 'drawing on the setup page' },
] as const;

async function openDrawing(page: Page, path: string, variant: Variant): Promise<Locator> {
  await page.goto(path);
  const drawing = page.locator(`.signal-path[data-variant="${variant}"]`);
  await drawing.scrollIntoViewIfNeeded();
  // Islands hydrate as they scroll into view, and Astro drops `ssr` once this one has.
  await expect(page.locator(`astro-island:has(.signal-path[data-variant="${variant}"])`)).not.toHaveAttribute('ssr');
  return drawing;
}

/**
 * The focused part: its name, whether it's picked, what the readout says, and whether its focus
 * ring is cut off by the screen edge or the pinned title.
 */
function focusedPart(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const drawing = el?.closest('.signal-path');
    const pinned = drawing?.querySelector('.pinned');
    if (!(el instanceof HTMLInputElement) || !drawing || !pinned) return null;
    const ring = 6; // 1px border, 2px offset, 3px outline
    const r = el.getBoundingClientRect();
    const [top, bottom] = [r.top - ring, r.bottom + ring];
    const p = pinned.getBoundingClientRect();
    const pins = getComputedStyle(pinned).position === 'sticky';
    return {
      name: el.getAttribute('aria-label'),
      picked: el.checked,
      said: drawing.querySelector('[aria-live] .text')?.textContent ?? null,
      offScreen: top < 0 || bottom > innerHeight,
      underTitle: pins && top < p.bottom && bottom > p.top,
    };
  });
}

for (const { path, variant, name } of DRAWINGS) {
  for (const viewport of [
    // 400% zoom on a 1280×1024 screen: too short to pin the title, so it scrolls away.
    { width: 320, height: 256 },
    // A phone: the title pins to the top, and focus scrolls each part clear of it.
    { width: 390, height: 844 },
  ]) {
    test(`the ${name} is one Tab stop, and the arrow keys walk every part in sight at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      // Instant scrolling, so each check sees where focus scrolling ends up.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const drawing = await openDrawing(page, path, variant);
      const parts = drawing.getByRole('radio');
      const all = await parts.evaluateAll((els) =>
        els.map((el) => ({ name: el.getAttribute('aria-label'), id: (el as HTMLInputElement).value })),
      );
      expect(all.length).toBeGreaterThan(20);

      // Tab lands on the picked part, and the next Tab leaves the drawing.
      const picked = drawing.locator('input:checked');
      const pickedName = await picked.getAttribute('aria-label');
      await picked.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect.poll(() => focusedPart(page)).toMatchObject({ name: pickedName, picked: true });
      await page.keyboard.press('Tab');
      expect(await drawing.evaluate((el) => el.contains(document.activeElement))).toBe(false);

      // Home, then the arrow keys, pick each part in turn. Each is announced and stays in sight.
      const inSight = (i: number) => ({
        name: all[i]?.name ?? null,
        picked: true,
        said: captionFor(all[i]?.id as NodeId, variant).text,
        offScreen: false,
        underTitle: false,
      });
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Home');
      await expect.poll(() => focusedPart(page)).toEqual(inSight(0));
      for (let i = 1; i < all.length; i++) {
        await page.keyboard.press(i % 2 ? 'ArrowDown' : 'ArrowRight');
        await expect.poll(() => focusedPart(page)).toEqual(inSight(i));
      }
      for (let i = all.length - 2; i >= 0; i--) {
        await page.keyboard.press(i % 2 ? 'ArrowUp' : 'ArrowLeft');
        await expect.poll(() => focusedPart(page)).toEqual(inSight(i));
      }
      await page.keyboard.press('End');
      await expect.poll(() => focusedPart(page)).toEqual(inSight(all.length - 1));
    });
  }

  test(`the ${name}’s pinned title fits in the room focus scrolling keeps for it`, async ({ page }) => {
    // The narrowest phone that pins the title, where titles wrap the most.
    await page.setViewportSize({ width: 320, height: 568 });
    const drawing = await openDrawing(page, path, variant);
    const pinned = drawing.locator('.pinned');
    const parts = drawing.getByRole('radio');
    // Focus scrolling leaves this much room above a part; the title pins `top` below the screen edge.
    const room = await parts.first().evaluate((el) => Number.parseFloat(getComputedStyle(el).scrollMarginTop));
    for (const part of await parts.all()) {
      await part.check();
      const box = await pinned.evaluate((el) => {
        const style = getComputedStyle(el);
        return { position: style.position, bottom: Number.parseFloat(style.top) + el.getBoundingClientRect().height };
      });
      const title = await pinned.innerText();
      expect(box.position, title).toBe('sticky');
      expect(box.bottom, title).toBeLessThan(room);
    }
  });

  test(`every part of the ${name} is a 44px target on a 320px phone`, async ({ page }) => {
    // Tall enough to show the whole drawing below the readout, so the pinned title covers no part.
    await page.setViewportSize({ width: 320, height: 1200 });
    const drawing = await openDrawing(page, path, variant);
    await drawing.locator('.body').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const small = await drawing.locator('.node').evaluateAll((els) =>
      els.flatMap((el) => {
        const b = el.getBoundingClientRect();
        // How far past an edge a tap still lands on this part, in 0.1px steps.
        const reach = (dx: number, dy: number) => {
          let d = 0;
          while (d < 12) {
            const x = dx === 0 ? b.left + b.width / 2 : (dx < 0 ? b.left : b.right) + dx * (d + 0.1);
            const y = dy === 0 ? b.top + b.height / 2 : (dy < 0 ? b.top : b.bottom) + dy * (d + 0.1);
            const hit = document.elementFromPoint(x, y);
            if (!hit || !el.contains(hit)) break;
            d += 0.1;
          }
          return d;
        };
        const w = b.width + reach(-1, 0) + reach(1, 0);
        const h = b.height + reach(0, -1) + reach(0, 1);
        const label = el.querySelector('input')?.getAttribute('aria-label');
        return w >= 44 && h >= 44 ? [] : [`${label}: ${w.toFixed(1)}×${h.toFixed(1)}`];
      }),
    );
    expect(small).toEqual([]);
  });
}

test('the guide’s drawing is a named region with its own ids, and a pick rewrites the readout', async ({ page }) => {
  const full = await openDrawing(page, '', 'full');
  await expect(page.getByRole('region', { name: 'Which knob touches what' })).toHaveAttribute('data-variant', 'full');
  const ids = await page.locator('.signal-path [id]').evaluateAll((els) => els.map((el) => el.id));
  expect(ids.length).toBeGreaterThan(20);
  expect(new Set(ids).size, 'every id is unique').toBe(ids.length);
  await full.getByRole('radio', { name: /^Amps/ }).check();
  await expect(full.locator('input:checked')).toHaveAttribute('value', 'amps');
  await expect(full.locator('[aria-live] .text')).toHaveText(captionFor('amps', 'full').text);
});
