import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES, scrollThrough } from './pages';

for (const { path, name } of PAGES) {
  test(`${name} page has no WCAG 2.2 A or AA violations`, async ({ page }, testInfo) => {
    await page.goto(path);
    // Every island hydrates before the audit.
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');
    // Audit the page at rest: mid-animation, axe reports moving text as overlapped and skips it.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    // Under forced colours the browser repaints text and backgrounds in system colours, but axe
    // still measures the author's colours, so its contrast results there are false alarms.
    if (testInfo.project.use.forcedColors === 'active') axe = axe.disableRules(['color-contrast']);
    const { violations } = await axe.analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}
