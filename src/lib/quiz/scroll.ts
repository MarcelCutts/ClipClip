/**
 * After an answer, the feedback appears under the button that was just pressed. On a phone that
 * button is usually near the bottom of the screen, so the feedback lands out of sight and the
 * reader sees nothing happen. Bring it into view, only as far as needed (block: 'nearest'), and
 * only when part of it is below the bottom edge. Focus stays where it is; the live region
 * already reads the verdict to screen readers.
 *
 * Call it from event handlers only: the default window is looked up at call time.
 */
export type Viewport = Pick<Window, 'innerHeight' | 'matchMedia'>;

export function showBelow(el: Element | undefined, view: Viewport = window): boolean {
  if (!el || el.getBoundingClientRect().bottom <= view.innerHeight) return false;
  const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: still ? 'instant' : 'smooth' });
  return true;
}
