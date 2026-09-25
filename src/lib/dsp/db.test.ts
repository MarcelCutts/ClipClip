import { describe, expect, it } from 'vitest';
import { dbToGain, formatDb, gainToDb, speakDb } from './db';

describe('decibels', () => {
  it('treats 6 dB as roughly double the amplitude', () => {
    expect(dbToGain(6)).toBeCloseTo(1.995, 3);
    expect(gainToDb(2)).toBeCloseTo(6.02, 2);
    expect(gainToDb(dbToGain(-12.5))).toBeCloseTo(-12.5, 10);
  });

  it('formats with a typographic minus and no signed zero', () => {
    expect(formatDb(6)).toBe('+6 dB');
    expect(formatDb(-12.46, { decimals: 1, unit: 'dBFS' })).toBe('−12.5 dBFS');
    expect(formatDb(-0.01)).toBe('0 dB');
    expect(formatDb(3, { signed: false, unit: '' })).toBe('3');
    expect(formatDb(Number.NEGATIVE_INFINITY)).toBe('off');
  });

  it('spells levels out for screen readers', () => {
    expect(speakDb(-6)).toBe('minus 6 decibels');
    expect(speakDb(3)).toBe('plus 3 decibels');
    expect(speakDb(0)).toBe('0 decibels');
  });
});
