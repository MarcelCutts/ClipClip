import { describe, expect, it, vi } from 'vitest';
import { showBelow, type Viewport } from './scroll';

const view = (reduced = false): Viewport =>
  ({ innerHeight: 844, matchMedia: () => ({ matches: reduced }) }) as unknown as Viewport;

const element = (bottom: number) => {
  const scrollIntoView = vi.fn();
  return { el: { getBoundingClientRect: () => ({ bottom }), scrollIntoView } as unknown as Element, scrollIntoView };
};

describe('showBelow', () => {
  it('leaves the page alone when the feedback is already on screen', () => {
    const { el, scrollIntoView } = element(840);
    expect(showBelow(el, view())).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls only as far as needed when the feedback lands below the fold', () => {
    const { el, scrollIntoView } = element(1100);
    expect(showBelow(el, view())).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('jumps instead of gliding for readers who ask for reduced motion', () => {
    const { el, scrollIntoView } = element(1100);
    showBelow(el, view(true));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'instant' });
  });

  it('does nothing before the element exists', () => {
    expect(showBelow(undefined, view())).toBe(false);
  });
});
