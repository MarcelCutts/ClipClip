import { describe, expect, it } from 'vitest';
import { overlaps, placeReadout } from './readout';

/** A straight line rising left to right across a 300 × 200 box: y = 180 − 0.5x. */
const rising = (x0: number, x1: number) => ({ top: 180 - 0.5 * x1, bottom: 180 - 0.5 * x0 });
const bounds = { left: 0, right: 300, top: 0, bottom: 200 };
const box = { w: 60, h: 30 };

describe('placing a crosshair readout', () => {
  it('prefers above the lines, on the cursor’s left, where the lines fall away', () => {
    const p = placeReadout({ cursorX: 150, box, bounds, lines: rising });
    expect(p).toMatchObject({ side: 'before', spot: 'above', clear: true, x: 82 });
    // Clear of the line over its whole width: the line is highest at the box's right edge.
    expect(p.y + p.h).toBeLessThanOrEqual(180 - 0.5 * (p.x + p.w) - 8);
  });

  it('goes right when there is no room on the left', () => {
    const p = placeReadout({ cursorX: 20, box, bounds, lines: rising });
    expect(p).toMatchObject({ side: 'after', spot: 'above', clear: true, x: 28 });
  });

  it('drops below the lines when something sits above them', () => {
    const title = { x: 0, y: 0, w: 300, h: 110 };
    const p = placeReadout({ cursorX: 150, box, bounds, lines: rising, obstacles: [title] });
    expect(p).toMatchObject({ spot: 'below', clear: true });
    expect(overlaps(p, title)).toBe(false);
    expect(p.y).toBeGreaterThanOrEqual(180 - 0.5 * p.x + 8);
  });

  it('falls back inside the bounds when nothing is clear, and says so', () => {
    const wall = { x: 0, y: 0, w: 300, h: 200 };
    const p = placeReadout({ cursorX: 150, box, bounds, lines: rising, obstacles: [wall] });
    expect(p.clear).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(300);
  });
});
