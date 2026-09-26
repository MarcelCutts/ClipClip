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

test('if the clipboard is off limits, it says so, says how to copy by hand, and selects the message', async () => {
  // An in-app browser or an old phone: no clipboard to write to.
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  try {
    const text = '*Heads up.* Two lines.\nhttps://example.com/night/';
    const { container } = await render(CopyText, { text, name: 'Test' });
    container.querySelector<HTMLButtonElement>('button.button')!.click();
    const status = container.querySelector('[role="status"]');
    await expect
      .poll(() => status?.textContent?.trim())
      .toBe('Couldn’t copy. Select the message and press Ctrl+C (⌘C on a Mac), or long-press it.');
    const box = container.querySelector('textarea');
    expect(box?.value).toBe(text);
    await expect.poll(() => document.activeElement).toBe(box);
    expect([box?.selectionStart, box?.selectionEnd]).toEqual([0, text.length]);
  } finally {
    // Back to the browser's own.
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});
