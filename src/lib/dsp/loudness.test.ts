import { describe, expect, it } from 'vitest';
import { loudnessLufs, loudnessMatchGain } from './loudness';

const sine = (hz: number, sr: number, amp = 1) =>
  Float64Array.from({ length: sr }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));

describe('loudness', () => {
  it('reads a full-scale 997 Hz sine as −3.01 LUFS, the BS.1770 reference', () => {
    expect(loudnessLufs(sine(997, 48_000), 48_000)).toBeCloseTo(-3.01, 2);
    expect(loudnessLufs(sine(997, 44_100), 44_100)).toBeCloseTo(-3.01, 2);
  });

  it('weights deep bass down, like the ear', () => {
    expect(loudnessLufs(sine(25, 48_000), 48_000)).toBeLessThan(loudnessLufs(sine(997, 48_000), 48_000) - 8);
  });

  it('finds the gain that matches two signals', () => {
    const g = loudnessMatchGain(sine(997, 48_000, 0.5), sine(997, 48_000, 1), 48_000);
    expect(g).toBeCloseTo(0.5, 6);
  });
});
