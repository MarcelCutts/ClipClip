import { describe, expect, it } from 'vitest';
import { clip, countAtCeiling, hardClip, peak, peakIndex, runsAtCeiling, scaled } from './analysis';

describe('peaks', () => {
  it('finds the largest absolute sample and where it sits, the first of any ties', () => {
    const s = [0.2, -0.9, 0.5, 0.9, -0.1];
    expect(peak(s)).toBe(0.9);
    expect(peakIndex(s)).toBe(1);
    expect(peakIndex(Float32Array.from([0, 0.3, -0.7]))).toBe(2);
  });

  it('reads silence as 0, found at the start', () => {
    expect(peak([])).toBe(0);
    expect(peakIndex([])).toBe(0);
    expect(peakIndex([0, 0, 0])).toBe(0);
  });
});

describe('the ceiling', () => {
  it('clips one value at ±1 and leaves everything inside alone', () => {
    expect([2, 1, 0.25, -1, -1.5].map(clip)).toEqual([1, 1, 0.25, -1, -1]);
  });

  it('hard-clips a signal after its gain, into a new buffer', () => {
    const s = [0.2, -0.6, 0.9];
    const out = hardClip(s, 2);
    expect(out).toBeInstanceOf(Float32Array);
    expect([...out]).toEqual([Math.fround(0.4), -1, 1]);
    expect(s).toEqual([0.2, -0.6, 0.9]);
    expect(countAtCeiling(out)).toBe(2);
  });

  it('scales a signal by a gain, into a new buffer, without clipping it', () => {
    const s = Float32Array.from([0.5, -0.25, 1]);
    const out = scaled(s, 4);
    expect([...out]).toEqual([2, -1, 4]);
    expect(out).not.toBe(s);
    expect([...s]).toEqual([0.5, -0.25, 1]);
  });

  it('counts the samples on the ceiling, top and bottom', () => {
    expect(countAtCeiling([1, -1, 0.999, 1.2])).toBe(3);
    expect(countAtCeiling([0.25, -0.25, 0.2], 0.25)).toBe(2);
  });
});

describe('runs at the ceiling', () => {
  it('finds flat tops and bottoms, splitting where the sign flips', () => {
    expect(runsAtCeiling([0, 1, 1, -1, -1, 0.5, 1])).toEqual([
      { start: 1, end: 2, sign: 1 },
      { start: 3, end: 4, sign: -1 },
      { start: 6, end: 6, sign: 1 },
    ]);
    expect(runsAtCeiling([0.2, -0.99, 0.5])).toEqual([]);
  });

  it('measures against any ceiling, within the tolerance', () => {
    expect(runsAtCeiling([0.5, 0.4999, 0.49], 0.5)).toEqual([{ start: 0, end: 0, sign: 1 }]);
    expect(runsAtCeiling([0.5, 0.4999, 0.49], 0.5, 1e-3)).toEqual([{ start: 0, end: 1, sign: 1 }]);
  });

  it('drops runs shorter than the minimum length', () => {
    const s = [1, 0, 1, 1, 0, -1, -1, -1];
    expect(runsAtCeiling(s, 1, 1e-9, { minLength: 3 })).toEqual([{ start: 5, end: 7, sign: -1 }]);
  });

  it('wraps round the loop, counting from the window’s start', () => {
    const s = [1, 1, 0, 0, -1, -1];
    expect(runsAtCeiling(s, 1, 1e-9, { start: 4, count: 4 })).toEqual([
      { start: 0, end: 1, sign: -1 },
      { start: 2, end: 3, sign: 1 },
    ]);
    // From before the loop's first sample: its last two, then its first.
    expect(runsAtCeiling(s, 1, 1e-9, { start: -2, count: 3 })).toEqual([
      { start: 0, end: 1, sign: -1 },
      { start: 2, end: 2, sign: 1 },
    ]);
  });
});
