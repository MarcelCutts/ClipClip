import { describe, expect, it } from 'vitest';
import { peak } from './analysis';
import { gainToDb } from './db';
import { mixStems, normaliseLoop, renderLoop } from './synth';

const sr = 48_000;
const a = normaliseLoop(renderLoop({ sampleRate: sr, track: 'a' }), -1);
const b = normaliseLoop(renderLoop({ sampleRate: sr, track: 'b' }), -1);
const trackA = mixStems(a);
const trackB = mixStems(b);
const sum = (x: Float32Array, y: Float32Array) => x.map((v, i) => v + y[i]!);

describe('synth loops', () => {
  it('renders two bars at 124 BPM, normalised like a mastered track', () => {
    expect(a.length).toBe(Math.round((60 / 124) * sr * 8));
    expect(gainToDb(peak(trackA))).toBeCloseTo(-1, 6);
    expect(gainToDb(peak(trackB))).toBeCloseTo(-1, 6);
    expect(trackA.every(Number.isFinite)).toBe(true);
  });

  it('is deterministic', () => {
    const again = mixStems(normaliseLoop(renderLoop({ sampleRate: sr, track: 'a' }), -1));
    expect(again).toEqual(trackA);
  });

  it('stacks beatmatched kicks to nearly +6 dB, the claim the blend lab makes', () => {
    const rise = gainToDb(peak(sum(trackA, trackB))) - gainToDb(peak(trackA));
    expect(rise).toBeGreaterThan(5);
    expect(rise).toBeLessThanOrEqual(6.03);
  });

  it('renders at other device sample rates', () => {
    const l = renderLoop({ sampleRate: 44_100 });
    expect(l.length).toBe(Math.round((60 / 124) * 44_100 * 8));
  });
});
