/**
 * On a phone the pads sit a screen or more below the meters they change, so a press would change
 * things out of sight. After a tap, bring the meters back: from the top of the challenge to the
 * bottom of the meters and their readout when that fits on screen (so the status chip shows
 * too), otherwise the meters alone. Nothing moves when the meters are already in full view, and
 * the scroll jumps instead of gliding for readers who ask for less motion.
 *
 * Call it from event handlers only: the default window is looked up at call time.
 */
export type View = Pick<Window, 'innerHeight' | 'matchMedia' | 'scrollBy'>;

/**
 * @param top The first thing worth keeping in view with the meters (the challenge).
 * @param meters The meters and their readout.
 * @param pad Room to leave at the top of the screen: the page's scroll-padding-top, in px.
 * @returns Whether the page scrolled.
 */
export function showMeters(
  top: Element | undefined,
  meters: Element | undefined,
  pad = 0,
  view: View = window,
): boolean {
  if (!top || !meters) return false;
  const from = top.getBoundingClientRect().top;
  const { top: metersTop, bottom } = meters.getBoundingClientRect();
  if (metersTop >= pad && bottom <= view.innerHeight) return false;
  const fits = bottom - from <= view.innerHeight - pad;
  const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  view.scrollBy({ top: (fits ? from : metersTop) - pad, behavior: still ? 'instant' : 'smooth' });
  return true;
}
