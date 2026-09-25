import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CopyText from '../../src/islands/CopyText.svelte';

test('every chat bubble fills its column, short or long, so bubbles side by side end on one edge', async () => {
  const short = await render(CopyText, { text: '*Short.* One line.', name: 'Short' });
  const long = await render(CopyText, {
    text: `*Long.* ${'A message that wraps onto several lines. '.repeat(4)}\nhttps://example.com/${'x'.repeat(80)}`,
    name: 'Long',
  });
  for (const { container } of [short, long]) {
    container.style.width = '320px';
    // Without the component's grid, any block would fill the column and the test would prove nothing.
    expect(getComputedStyle(container.querySelector('.copy')!).display).toBe('grid');
    expect(container.querySelector('.bubble')?.getBoundingClientRect().width).toBe(320);
  }
});
