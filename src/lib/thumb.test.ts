import { describe, expect, it } from 'vitest';
import { capCentre, dragTo, fraction, snap } from './thumb';

describe('dragging a slider by its cap', () => {
  it('finds the cap half a cap in from each end, and in between by value', () => {
    expect(capCentre(0, 0, 10, 200, 10)).toBe(10);
    expect(capCentre(10, 0, 10, 200, 10)).toBe(190);
    expect(capCentre(5, 0, 10, 200, 10)).toBe(100);
    // TRIM runs −6 to +12: +6 sits two thirds along.
    expect(capCentre(6, -6, 12, 200, 10)).toBeCloseTo(10 + 180 * (2 / 3), 9);
    expect(fraction(99, 0, 10)).toBe(1);
    expect(fraction(3, 3, 3)).toBe(0);
  });

  it('moves by the distance dragged, so grabbing the cap off-centre moves nothing', () => {
    const fader = { min: 0, max: 10, step: 1 };
    expect(dragTo(4, 0, 180, fader)).toBe(4);
    expect(dragTo(4, 3, 180, fader)).toBe(4);
    expect(dragTo(4, 18, 180, fader)).toBe(5);
    expect(dragTo(4, -36, 180, fader)).toBe(2);
  });

  it('stops at the ends and lands on whole steps', () => {
    const trim = { min: -6, max: 12, step: 1 };
    expect(dragTo(6, 10_000, 150, trim)).toBe(12);
    expect(dragTo(6, -10_000, 150, trim)).toBe(-6);
    expect(Number.isInteger(dragTo(6, 13.7, 150, trim))).toBe(true);
    expect(snap(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(dragTo(3, 50, 0, trim)).toBe(3);
  });
});
