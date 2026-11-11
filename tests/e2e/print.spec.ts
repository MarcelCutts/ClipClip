import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('the kit fits six A4 sheets with readable instructions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Paper layout is independent of the screen viewport.');
  await page.goto('print/');
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(
    testInfo.outputPath('layout.json'),
    JSON.stringify(
      await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth,
        elements: [
          ...document.querySelectorAll(
            '.print-view, .sheet, .crew-cards, .print-view .card-frame, .print-view .items, .print-view .note',
          ),
        ]
          .slice(0, 32)
          .map((el) => ({
            cls: el.className,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
            font: getComputedStyle(el).fontSize,
            columns: getComputedStyle(el).columnCount,
            container: getComputedStyle(el).containerType,
          })),
      })),
    ),
  );
  const sheets = page.locator('.print-view .sheet');
  await expect(sheets).toHaveCount(6);
  await page.pdf({ path: testInfo.outputPath('print-kit.pdf'), preferCSSPageSize: true, printBackground: true });

  for (const sheet of await sheets.all()) {
    expect((await sheet.boundingBox())!.height, 'must fit between the 10 mm A4 margins').toBeLessThan(
      (277 * 96) / 25.4,
    );
  }
  for (const note of await page.locator('.print-view .qrh-card .note, .print-view .qrh-card .before').all()) {
    expect(await note.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13.32);
  }

  // C1's drawings share the fifth sheet. Their captions are sentences, at 10 pt. A drawing is 300 units wide
  // with 15-unit labels, so at 60 mm or more its labels print at 8.5 pt or more.
  const drawings = sheets.nth(4).locator('figure');
  await expect(drawings).toHaveCount(5);
  for (const drawing of await drawings.all()) {
    await expect(drawing.locator('svg')).toBeVisible();
    expect((await drawing.locator('svg').boundingBox())!.width).toBeGreaterThanOrEqual((60 * 96) / 25.4);
    for (const words of await drawing.locator('.fig-title, .fig-note').all()) {
      expect(await words.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(
        13.32,
      );
    }
  }
});

for (const path of ['night', 'setup']) {
  test(`${path} exports a PDF backup with its instructions exposed`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Export each paper layout once.');
    await page.goto(`${path}/`);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: testInfo.outputPath(`${path}.pdf`),
      format: 'A4',
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      printBackground: true,
    });
    if (path === 'night') {
      await expect(page.locator('[data-list="doors"] figure svg')).toHaveCount(5);
      await expect(page.locator('#rack svg')).toBeVisible();
      await expect(page.locator('#fix-power-cut-step-3')).toBeVisible();
      // The hum drill was retired, and the hollow-sound drill is with the recordings.
      await expect(page.locator('#fix-hum, #fix-hollow').locator('visible=true')).toHaveCount(0);
    } else {
      await expect(page.locator('#driverack')).toBeVisible();
      // The tests and commissioning cards needed a laptop, and have gone.
      await expect(page.locator('#record-level, #test-att, #amp-gains').locator('visible=true')).toHaveCount(0);
    }
  });
}

/**
 * Paper sizes a reader's print dialogue is likely to give, as the area inside the margins in CSS
 * pixels: A4 with this file's 12 mm margins, A4 and US Letter with Chromium's default margins.
 */
const SHEETS = [
  { name: 'A4, 12 mm margins', width: 703, height: 1032 },
  { name: 'A4, default margins', width: 717, height: 1046 },
  { name: 'US Letter, default margins', width: 739, height: 979 },
] as const;

for (const path of ['', 'night/', 'setup/', 'recordings/', 'learn/']) {
  test(`nothing prints over anything else: ${path || 'guide'}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Paper layout is independent of the screen viewport.');
    for (const sheet of SHEETS) {
      await page.goto(path);
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => document.fonts.ready);
      // A PDF cannot be read back here, so lay the page out in sheet-sized columns: the browser
      // breaks columns and paper pages the same way. Crew's C3 once printed over F8 like this,
      // where a grid's rows crossed a page.
      await page.addStyleTag({
        content: `html { overflow: auto; } body { height: ${sheet.height}px; column-width: ${sheet.width}px; column-gap: 40px; column-fill: auto; }`,
      });
      const shared = await page.evaluate(() => {
        const blocks = [
          ...document.querySelectorAll(
            '.checklist, .drill, .proc, .know, .panel, table, figure, .page-body > *, .page-group > *, .subflow > *',
          ),
        ]
          // A lab's panel is one block on paper. Inside it, parts are laid over each other on purpose
          // (the listening test's two screens share a place).
          .filter((el) => !el.parentElement?.closest('.panel'))
          .map((el) => ({
            el,
            name: el.id || el.getAttribute('data-list') || `${el.tagName.toLowerCase()}.${el.classList[0] ?? ''}`,
            rects: [...el.getClientRects()],
          }))
          .filter((block) => block.rects.length > 0);
        const found = new Set<string>();
        blocks.forEach((a, i) => {
          for (const b of blocks.slice(i + 1)) {
            if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
            const overlap = a.rects.some((p) =>
              b.rects.some(
                (q) =>
                  Math.min(p.right, q.right) - Math.max(p.left, q.left) > 2 &&
                  Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 2,
              ),
            );
            if (overlap) found.add(`${a.name} and ${b.name}`);
          }
        });
        return [...found];
      });
      expect(shared, `${sheet.name}: blocks sharing paper`).toEqual([]);
    }
  });
}
