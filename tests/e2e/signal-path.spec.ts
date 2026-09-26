import { expect, type Locator, type Page, test } from '@playwright/test';
import { COPY, type NodeId, summaryFor } from '../../src/lib/rig';

// The "Which knob touches what" drawing in the guide (#signal); /setup/ links here instead of
// repeating it. The drawing is one radio group, so it takes one Tab stop and the arrow keys move
// the pick along the signal, announcing each part. On a phone the readout rides along the bottom
// of the screen while the drawing scrolls under it, so whichever part you tap, its explanation is
// in sight. Arrowing never lands a part off screen, under the page's tabs or under the readout,
// even at 400% zoom; every part is a 44px target on a 320px phone; and every part's name is 15px
// or more and fits.

async function openDrawing(page: Page): Promise<Locator> {
  await page.goto('');
  const drawing = page.locator('.signal-path');
  await drawing.scrollIntoViewIfNeeded();
  // Islands hydrate as they scroll into view, and Astro drops `ssr` once this one has.
  await expect(page.locator('astro-island:has(.signal-path)')).not.toHaveAttribute('ssr');
  return drawing;
}

/** What the readout says for a part: its title, its line if it has one, and what it reaches or shows. */
const readoutFor = (id: NodeId) => ({
  title: COPY[id].title,
  said: COPY[id].text ?? null,
  items: summaryFor(id).items,
});

/**
 * The focused part: its name, whether it's picked, what the readout says, and whether its focus
 * ring is cut off by the screen's edges, hidden under the page's pinned tabs, or under the readout
 * where it rides along the bottom of the screen.
 */
function focusedPart(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const drawing = el?.closest('.signal-path');
    const readout = drawing?.querySelector('.readout');
    const card = readout?.querySelector('.card:not(.sizer)');
    if (!(el instanceof HTMLInputElement) || !drawing || !readout || !card) return null;
    const ring = 6; // 1px border, 2px offset, 3px outline
    const r = el.getBoundingClientRect();
    const [top, bottom] = [r.top - ring, r.bottom + ring];
    const tabs = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-top')) || 0;
    const sheet = readout.getBoundingClientRect();
    const rides = getComputedStyle(readout).position === 'sticky';
    return {
      name: el.getAttribute('aria-label'),
      picked: el.checked,
      title: card.querySelector('.title')?.textContent ?? null,
      said: card.querySelector('[aria-live] .text')?.textContent ?? null,
      items: card.querySelector('[aria-live] dd')?.textContent ?? null,
      offScreen: top < tabs || bottom > innerHeight,
      underReadout: rides && top < sheet.bottom && bottom > sheet.top && r.left < sheet.right && r.right > sheet.left,
    };
  });
}

for (const viewport of [
  // 400% zoom on a 1280×1024 screen: too short for the readout to ride along, so it scrolls away.
  { width: 320, height: 256 },
  // A phone: the readout rides along the bottom, and focus scrolls each part clear of it.
  { width: 390, height: 844 },
]) {
  test(`the drawing is one Tab stop, and the arrow keys walk every part in sight at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    // Instant scrolling, so each check sees where focus scrolling ends up.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const drawing = await openDrawing(page);
    const parts = drawing.getByRole('radio');
    const all = await parts.evaluateAll((els) =>
      els.map((el) => ({ name: el.getAttribute('aria-label'), id: (el as HTMLInputElement).value })),
    );
    expect(all.length).toBeGreaterThan(20);

    // Tab lands on the picked part, and the next Tab leaves the parts (for the drawing's note link).
    const picked = drawing.locator('input:checked');
    const pickedName = await picked.getAttribute('aria-label');
    await picked.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedPart(page)).toMatchObject({ name: pickedName, picked: true });
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type)).not.toBe('radio');

    // Home, then the arrow keys, pick each part in turn. Each is announced and stays in sight.
    const inSight = (i: number) => ({
      name: all[i]?.name ?? null,
      picked: true,
      ...readoutFor(all[i]?.id as NodeId),
      offScreen: false,
      underReadout: false,
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

test('on a phone, a tapped part’s explanation is on screen beside it, with drawing still in sight', async ({
  page,
}) => {
  // The smallest phone the readout rides along on, where captions wrap the most.
  await page.setViewportSize({ width: 320, height: 640 });
  const drawing = await openDrawing(page);
  const readout = drawing.locator('.readout');
  for (const part of await drawing.getByRole('radio').all()) {
    await part.scrollIntoViewIfNeeded();
    await part.check();
    const id = await part.getAttribute('value');
    const seen = await readout.evaluate((el) => {
      const sheet = el.getBoundingClientRect();
      const tabs = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-top')) || 0;
      return {
        sticky: getComputedStyle(el).position === 'sticky',
        onScreen: sheet.top >= 0 && sheet.bottom <= innerHeight + 0.5,
        // The drawing keeps at least 40% of the screen between the tabs and the readout.
        room: (sheet.top - tabs) / innerHeight,
      };
    });
    const card = drawing.locator('.readout .card:not(.sizer)');
    await expect(card.locator('.title')).toHaveText(COPY[id as NodeId].title);
    await expect(card.locator('[aria-live] dd').first()).toHaveText(summaryFor(id as NodeId).items);
    expect(seen.sticky, id ?? '').toBe(true);
    expect(seen.onScreen, id ?? '').toBe(true);
    expect(seen.room, id ?? '').toBeGreaterThan(0.4);
  }
});

test('every part of the drawing is a 44px target on a 320px phone', async ({ page }) => {
  // Tall enough to show the whole drawing, and the readout under it, below the page's tabs.
  await page.setViewportSize({ width: 320, height: 1300 });
  const drawing = await openDrawing(page);
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

for (const viewport of [
  { width: 320, height: 700 },
  { width: 1040, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`every part’s name is at least 15px and fits inside the part at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const drawing = await openDrawing(page);
    await page.evaluate(() => document.fonts.ready);
    // The picked part has the heaviest edge, so check with a long name picked too.
    for (const pick of [null, /^DriveRack/]) {
      if (pick) await drawing.getByRole('radio', { name: pick }).check();
      const problems = await drawing.locator('.node').evaluateAll((nodes) =>
        nodes.flatMap((node) => {
          const box = node.getBoundingClientRect();
          const id = node.querySelector('input')?.value;
          return [...node.querySelectorAll('.name, .band .hw-label, .sub')].flatMap((text) => {
            const out: string[] = [];
            if (!text.matches('.sub') && Number.parseFloat(getComputedStyle(text).fontSize) < 15) {
              out.push(`${id}: ${text.textContent} is ${getComputedStyle(text).fontSize}`);
            }
            const range = document.createRange();
            range.selectNodeContents(text);
            for (const line of range.getClientRects()) {
              const inside =
                line.left >= box.left + 1 &&
                line.right <= box.right - 1 &&
                line.top >= box.top &&
                line.bottom <= box.bottom;
              if (!inside) out.push(`${id}: ${text.textContent} runs out of its part`);
            }
            return out;
          });
        }),
      );
      expect(problems).toEqual([]);
    }
  });
}

test('the guide’s drawing is a named region with its own ids, and a pick rewrites the readout', async ({ page }) => {
  const drawing = await openDrawing(page);
  await expect(page.getByRole('region', { name: 'Which knob touches what' })).toBeVisible();
  const ids = await page.locator('.signal-path [id]').evaluateAll((els) => els.map((el) => el.id));
  expect(ids.length).toBeGreaterThan(20);
  expect(new Set(ids).size, 'every id is unique').toBe(ids.length);
  await drawing.getByRole('radio', { name: /^Amps/ }).check();
  await expect(drawing.locator('input:checked')).toHaveAttribute('value', 'amps');
  await expect(drawing.locator('[aria-live] .text')).toHaveText(COPY.amps.text ?? '');
  // The drawing's caveat points to the one place the guide says what the makers leave out.
  const note = drawing.locator('.note a');
  await expect(note).toHaveAttribute('href', /^#[a-z-]+$/);
  await expect(page.locator((await note.getAttribute('href')) ?? '')).toHaveCount(1);
});
