import { expect, test } from '@playwright/test';
import { PAGES } from './pages';

// Every page is built the same way (docs/DESIGN.md, Spacing): the site's name at the top left, the
// title block, then the page's body, with the same distances whichever page it is.

const EVERY_PAGE = [...PAGES.map((p) => p.path), 'no-such-page/'];

/** What a reader sees at the top of a page, measured. */
async function top(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const box = (e: Element) => e.getBoundingClientRect();
    const shown = (e: Element) => {
      const b = box(e);
      return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const header = document.querySelector('.site-header') as HTMLElement;
    const mark = header.querySelector('.mark') as HTMLElement;
    const title = document.querySelector('main h1') as HTMLElement;
    const block = title.closest('header') as HTMLElement;
    const kids = [...block.children].filter(shown);
    let next = block.nextElementSibling;
    while (next && !shown(next)) next = next.nextElementSibling;
    return {
      mark: mark?.textContent?.trim(),
      markLeft: Math.round(box(mark).left),
      links: [...header.querySelectorAll('nav a')].map((a) => a.textContent?.trim()),
      headerHeight: Math.round(box(header).height),
      titles: document.querySelectorAll('main h1').length,
      titleSize: getComputedStyle(title).fontSize,
      titleLine: getComputedStyle(title).lineHeight,
      titleLeft: Math.round(box(title).left),
      titleBelowHeader: Math.round(box(title).top - box(header).bottom),
      ledeSize: getComputedStyle(block.querySelector('.lede') as HTMLElement).fontSize,
      // The words of a row of links sit 8px closer than a paragraph's would: its links are 44px tall.
      gaps: kids.slice(1).map((k, i) => Math.round(box(k).top - box(kids[i] as Element).bottom)),
      rows: kids.map((k) => (k.matches('.link-row, nav') ? 'links' : 'text')),
      bodyBelowBlock: next ? Math.round(box(next).top - box(block).bottom) : 0,
      blockFoot: Math.round(parseFloat(getComputedStyle(block).paddingBottom)),
    };
  });
}

test('every page has the same header and the same title block', async ({ page }) => {
  await page.goto('');
  const first = await top(page);
  expect(first.mark).toBe('Out of the red');
  expect(first.links).toEqual(['Playing', 'Crew', 'Learn']);
  for (const path of EVERY_PAGE) {
    await page.goto(path);
    const here = await top(page);
    const where = `/${path}`;
    expect(here.mark, where).toBe(first.mark);
    expect(here.markLeft, where).toBe(first.markLeft);
    expect(here.links, where).toEqual(first.links);
    expect(here.headerHeight, where).toBe(first.headerHeight);
    expect(here.titles, where).toBe(1);
    expect(here.titleSize, where).toBe(first.titleSize);
    expect(here.titleLine, where).toBe(first.titleLine);
    expect(here.titleLeft, where).toBe(first.titleLeft);
    expect(here.titleBelowHeader, where).toBe(first.titleBelowHeader);
    expect(here.ledeSize, where).toBe(first.ledeSize);
    // Inside the block, one text gap between its lines.
    here.gaps.forEach((gap, i) => {
      expect(gap, `${where}, under line ${i + 1}`).toBe(here.rows[i + 1] === 'links' ? 8 : 16);
    });
    // The block ends one block gap above the page's body, and nothing adds to it.
    expect(here.blockFoot, where).toBe(first.blockFoot);
    expect(here.bodyBelowBlock, where).toBe(0);
  }
});

test('blocks sit one gap apart and sections another, on every page', async ({ page }) => {
  const seen = new Set<number>();
  for (const path of ['', 'night/', 'recordings/', 'setup/']) {
    await page.goto(path);
    const gaps = await page.evaluate(() => {
      const body = document.querySelector('.page-body') as HTMLElement;
      const shown = (e: Element) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).position !== 'sticky';
      const blocks = [...body.children].filter(shown).filter((e) => !e.matches('.toc, .legacy-anchors'));
      return blocks.slice(1).map((b, i) => ({
        section: b.classList.contains('section-start'),
        gap: Math.round(b.getBoundingClientRect().top - (blocks[i] as Element).getBoundingClientRect().bottom),
      }));
    });
    const block = new Set(gaps.filter((g) => !g.section).map((g) => g.gap));
    const section = new Set(gaps.filter((g) => g.section).map((g) => g.gap));
    expect(block.size, `/${path}: one gap between blocks, found ${[...block]}`).toBeLessThanOrEqual(1);
    // A rounded pixel either way, where a block's height is a fraction.
    expect(Math.max(...section, 0) - Math.min(...section, 999), `/${path}: ${[...section]}`).toBeLessThanOrEqual(1);
    for (const g of block) seen.add(g);
    for (const g of section) expect(g, `/${path}`).toBeGreaterThan(Math.max(...block, 0));
  }
  expect(seen.size, `one block gap on every page, found ${[...seen]}`).toBe(1);
});

test('rows of links print nothing between the links', async ({ page }) => {
  for (const path of EVERY_PAGE) {
    await page.goto(path);
    const rows = page.locator('.link-row');
    for (const row of await rows.all()) expect(await row.innerText(), `/${path}`).not.toMatch(/[·|•]/);
    // No page sets links apart with a printed dot outside a row either.
    await expect(page.locator('main p:has(a)').filter({ hasText: / · / }), `/${path}`).toHaveCount(0);
  }
});
