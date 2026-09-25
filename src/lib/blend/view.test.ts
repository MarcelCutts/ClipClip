import { describe, expect, it } from 'vitest';
import { envelopePath, scopeY } from '../viz/scope';
import { envelope } from './view';

const g = { width: 8, height: 100, range: 2 };

describe('envelope', () => {
  const data = Float32Array.from({ length: 64 }, (_, i) => Math.sin(i / 3));

  it('fills the same shape as the shared envelopePath', () => {
    expect(envelope(data, g).area).toBe(envelopePath(data, g));
    // Columns of uneven length take their min and max over the same samples.
    const long = Float32Array.from({ length: 1003 }, (_, i) => Math.sin(i / 7) * Math.cos(i / 41));
    const odd = { width: 37, height: 90, range: 1.2 };
    expect(envelope(long, odd).area).toBe(envelopePath(long, odd));
  });

  it('draws both edges along the fill’s own outline', () => {
    const wave = Float32Array.from({ length: 500 }, (_, i) => Math.sin(i / 5) * (i / 500));
    const { area, upper, lower } = envelope(wave, { width: 60, height: 100, range: 1 }, 12, 2);
    const back = lower.slice(1).split('L').reverse().join('L');
    expect(area).toBe(`${upper}L${back}Z`);
  });

  it('gives open edges, one point per column', () => {
    const { upper, lower } = envelope(data, g);
    expect(upper.startsWith('M0.0 ')).toBe(true);
    expect(upper).not.toContain('Z');
    expect(upper.split('L')).toHaveLength(g.width);
    expect(lower.split('L')).toHaveLength(g.width);
  });

  it('holds each column’s peak over a window, so a fast wave draws as its envelope', () => {
    const wave = Float32Array.from({ length: 800 }, (_, i) => Math.sin((2 * Math.PI * i) / 40));
    const wide = { width: 100, height: 100, range: 1 };
    const plain = envelope(wave, wide).upper.slice(1).split('L');
    const held = envelope(wave, wide, 40).upper.slice(1).split('L');
    const ys = (points: string[]) => new Set(points.map((p) => p.split(' ')[1]));
    expect(ys(plain).size).toBeGreaterThan(3);
    expect(ys(held)).toEqual(new Set([scopeY(1, wide).toFixed(1)]));
  });

  it('softens the steps without lowering a held peak', () => {
    const spike = new Float32Array(1000);
    spike[500] = 1;
    const wide = { width: 100, height: 100, range: 1 };
    const held = envelope(spike, wide, 30, 2).upper.slice(1).split('L');
    const ys = held.map((p) => Number(p.split(' ')[1]));
    expect(Math.min(...ys)).toBe(Number(scopeY(1, wide).toFixed(1)));
  });

  it('draws silence as a flat line on the axis', () => {
    const { upper, lower } = envelope(new Float32Array(32), g);
    const mid = scopeY(0, g).toFixed(1);
    for (const point of [...upper.slice(1).split('L'), ...lower.slice(1).split('L')]) {
      expect(point.split(' ')[1]).toBe(mid);
    }
  });
});
