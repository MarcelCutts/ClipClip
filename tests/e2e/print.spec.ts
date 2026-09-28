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
