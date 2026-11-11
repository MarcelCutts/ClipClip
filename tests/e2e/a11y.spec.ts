import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { PAGES, scrollThrough } from './pages';

type Results = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** Audit the page at rest: mid-animation, axe reports moving text as overlapped and skips it. */
const settle = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

const failures = ({ violations }: Results) =>
  violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

/**
 * Text whose contrast axe could not judge because a gradient sits behind it. Axe files these under
 * "incomplete", not under violations, so a gradient on the page's background would pass the audit
 * with most of the text unread. That happened once: keep the count at none.
 */
const unreadOverGradient = ({ incomplete }: Results) =>
  incomplete
    .filter((rule) => rule.id === 'color-contrast')
    .flatMap((rule) => rule.nodes)
    .filter((node) => (node.any[0]?.data as { messageKey?: string } | undefined)?.messageKey === 'bgGradient')
    .map((node) => node.target.join(' '));

for (const { path, name } of PAGES) {
  test(`${name} page has no WCAG 2.2 A or AA violations`, async ({ page }, testInfo) => {
    await page.goto(path);
    // Every island hydrates before the audit.
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');
    await settle(page);
    const forced = testInfo.project.use.forcedColors === 'active';
    let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    // Under forced colours the browser repaints text and backgrounds in system colours, but axe
    // still measures the author's colours, so its contrast results there are false alarms.
    if (forced) axe = axe.disableRules(['color-contrast']);
    const results = await axe.analyze();
    expect(failures(results)).toEqual([]);
    if (forced) return;
    expect(unreadOverGradient(results), 'text axe could not read over a gradient').toEqual([]);

    // The night's colours too: the page tokens change with the reader's setting, and the other
    // dark profile forces system colours, where contrast cannot be measured.
    await page.emulateMedia({ colorScheme: 'dark' });
    await settle(page);
    const dark = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(failures(dark), 'in the dark theme').toEqual([]);
    expect(unreadOverGradient(dark), 'text axe could not read over a gradient, in the dark theme').toEqual([]);
  });
}
