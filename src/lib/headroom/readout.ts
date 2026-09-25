/**
 * Where to put a chart's crosshair readout: the small box beside the cursor line that lists each
 * line's value there. Used by the home-vs-club chart (W10), whose two lines both rise from left to
 * right and cross, so a label left sitting beside its dot soon lands on a line or on the crossing.
 *
 * The box tries spots in turn: above the lines on the cursor's left, then on its right, then
 * centred over the cursor; then the same three below the lines. A spot counts if the box stays
 * inside the bounds, clears every line over its whole width, and misses every obstacle (the axis
 * title, other labels). Lines that rise left to right make "above, on the left" the natural first
 * choice: they only fall away from the cursor there.
 *
 * If no spot is clear (only on the narrowest phones), the box takes the in-bounds spot that covers
 * the least of the obstacles. It never covers a line.
 *
 * Everything is in px in one coordinate space, with y growing downwards.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReadoutInput {
  /** The cursor line's x. */
  cursorX: number;
  /** The box's size. */
  box: { w: number; h: number };
  /** Where the box may go. */
  bounds: { left: number; right: number; top: number; bottom: number };
  /**
   * The lines' extent over an x range: the smallest y (the highest point) and the largest y (the
   * lowest point) any line reaches between x0 and x1.
   */
  lines: (x0: number, x1: number) => { top: number; bottom: number };
  /** Things the box should not cover. */
  obstacles?: readonly Rect[];
  /** Space between the box and the cursor, and between the box and the lines. */
  gap?: number;
}

export interface ReadoutPlacement extends Rect {
  side: 'before' | 'after' | 'centre';
  spot: 'above' | 'below';
  /** False if no spot was clear and this one covers the least of the obstacles. */
  clear: boolean;
}

/** Default space between the box and the cursor, and between the box and the lines, px. */
export const READOUT_GAP = 8;

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const overlapArea = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function placeReadout({
  cursorX,
  box,
  bounds,
  lines,
  obstacles = [],
  gap = READOUT_GAP,
}: ReadoutInput): ReadoutPlacement {
  const xs = {
    before: cursorX - gap - box.w,
    after: cursorX + gap,
    // Centred over the cursor, but kept inside the bounds.
    centre: Math.max(bounds.left, Math.min(bounds.right - box.w, cursorX - box.w / 2)),
  };
  const candidates: ReadoutPlacement[] = [];
  for (const spot of ['above', 'below'] as const) {
    for (const side of ['before', 'after', 'centre'] as const) {
      const x = xs[side];
      const { top, bottom } = lines(x, x + box.w);
      const y = spot === 'above' ? top - gap - box.h : bottom + gap;
      candidates.push({ x, y, w: box.w, h: box.h, side, spot, clear: true });
    }
  }
  const inBounds = candidates.filter(
    (c) => c.x >= bounds.left && c.x + c.w <= bounds.right && c.y >= bounds.top && c.y + c.h <= bounds.bottom,
  );
  const covered = (c: Rect) => obstacles.reduce((sum, o) => sum + overlapArea(c, o), 0);
  const clear = inBounds.find((c) => covered(c) === 0);
  if (clear) return clear;
  if (inBounds.length > 0) {
    const least = inBounds.reduce((best, c) => (covered(c) < covered(best) ? c : best));
    return { ...least, clear: false };
  }
  // Nothing even fits (a chart narrower than any phone): above, pushed back inside the bounds.
  const c = candidates[2]!;
  return { ...c, y: Math.max(bounds.top, Math.min(bounds.bottom - box.h, c.y)), clear: false };
}
