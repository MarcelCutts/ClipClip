import { describe, expect, it, vi } from 'vitest';
import { showMeters, type View } from './scroll';

const view = (reduced = false, innerHeight = 844) => {
  const scrollBy = vi.fn();
  return { view: { innerHeight, matchMedia: () => ({ matches: reduced }), scrollBy } as unknown as View, scrollBy };
};

const box = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }) }) as unknown as Element;

describe('showMeters', () => {
  it('leaves the page alone while the meters are in full view', () => {
    const { view: v, scrollBy } = view();
    expect(showMeters(box(-60, 0), box(100, 500), 24, v)).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('brings the challenge and the meters back when a pad far below was pressed', () => {
    const { view: v, scrollBy } = view();
    // The prompt is 1,200px above the top of the screen and the meters end 500px under it.
    expect(showMeters(box(-1200, -1120), box(-1100, -700), 24, v)).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ top: -1224, behavior: 'smooth' });
  });

  it('shows the meters alone when the challenge and the meters won’t fit together', () => {
    const { view: v, scrollBy } = view(false, 390);
    showMeters(box(-1200, -1120), box(-1100, -700), 24, v);
    expect(scrollBy).toHaveBeenCalledWith({ top: -1124, behavior: 'smooth' });
  });

  it('scrolls the other way when the meters run off the bottom', () => {
    const { view: v, scrollBy } = view();
    showMeters(box(500, 580), box(600, 1000), 24, v);
    expect(scrollBy).toHaveBeenCalledWith({ top: 476, behavior: 'smooth' });
  });

  it('jumps instead of gliding for readers who ask for reduced motion', () => {
    const { view: v, scrollBy } = view(true);
    showMeters(box(-1200, -1120), box(-1100, -700), 24, v);
    expect(scrollBy).toHaveBeenCalledWith({ top: -1224, behavior: 'instant' });
  });

  it('does nothing before the elements exist', () => {
    const { view: v } = view();
    expect(showMeters(undefined, box(0, 10), 0, v)).toBe(false);
  });
});
