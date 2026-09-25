import { describe, expect, it } from 'vitest';
import {
  equalLoudnessCrossing,
  hearingThreshold,
  ISO226_TABLE,
  inValidRange,
  iso226Parameters,
  phonForSpl,
  splForPhon,
  validPhonRange,
} from './iso226';

/** The research values are rounded to 0.1, so allow a little over half a step either way. */
const near = (actual: number, expected: number, tolerance = 0.06) =>
  expect(Math.abs(actual - expected), `${actual.toFixed(3)} vs ${expected}`).toBeLessThanOrEqual(tolerance);

describe('ISO 226:2023 Formula (1), level needed for a loudness level', () => {
  it('matches the research table for a 50 Hz bass', () => {
    near(splForPhon(50, 40), 77.8);
    near(splForPhon(50, 60), 89.9);
    near(splForPhon(50, 80), 101.8);
    near(splForPhon(50, 90), 107.7);
  });

  it('gives phon = dB SPL at 1 kHz, by definition', () => {
    for (const phon of [20, 40, 55.5, 70, 90]) expect(splForPhon(1000, phon)).toBeCloseTo(phon, 10);
  });

  it('finds 3.15 kHz the most sensitive frequency, needing 35.5 dB at 40 phon', () => {
    near(splForPhon(3150, 40), 35.5);
    for (const phon of [40, 80]) {
      const best = ISO226_TABLE.reduce((a, b) => (splForPhon(b.hz, phon) < splForPhon(a.hz, phon) ? b : a));
      expect(best.hz).toBe(3150);
    }
  });

  it('reproduces the rest of the research table', () => {
    near(splForPhon(3150, 60), 56.4);
    near(splForPhon(3150, 80), 77.2);
    near(splForPhon(3150, 90), 87.5);
    near(splForPhon(2500, 40), 36.6);
    near(splForPhon(4000, 40), 36.7);
    near(splForPhon(5000, 40), 40.1);
    near(splForPhon(1600, 40), 42.6);
  });
});

describe('ISO 226:2023 Formula (2), loudness level of a tone', () => {
  it('reproduces the worked example: club level, the bass wins', () => {
    near(phonForSpl(50, 100), 76.9, 0.2);
    near(phonForSpl(3150, 70), 73.1, 0.2);
  });

  it('reproduces the worked example: the same file 30 dB quieter, the crunch wins', () => {
    near(phonForSpl(50, 70), 28.0, 0.2);
    near(phonForSpl(3150, 40), 44.3, 0.2);
  });

  it('shows deep bass losing more loudness than the mids for the same turn-down', () => {
    const loss = (hz: number) => phonForSpl(hz, 85) - phonForSpl(hz, 65);
    near(loss(50), 30.9);
    near(loss(100), 28.2);
    near(loss(1000), 20.0);
    near(loss(3150), 19.2);
  });

  it('inverts Formula (1) at every table frequency', () => {
    for (const { hz } of ISO226_TABLE) {
      for (const phon of [20, 40, 60, 80]) expect(phonForSpl(hz, splForPhon(hz, phon))).toBeCloseTo(phon, 8);
    }
  });

  it('gives the threshold of hearing the 1 kHz threshold loudness (2.4 phon), and less below it', () => {
    for (const { hz } of ISO226_TABLE) expect(phonForSpl(hz, hearingThreshold(hz))).toBeCloseTo(2.4, 6);
    const below = phonForSpl(50, 20);
    expect(below).toBeLessThan(2.4);
    expect(Number.isFinite(below)).toBe(true);
    expect(inValidRange(50, below)).toBe(false);
  });
});

describe('frequencies between the table rows', () => {
  it('uses the table exactly at its own frequencies', () => {
    expect(iso226Parameters(50)).toEqual({ alpha: 0.509, lu: -16.1, tf: 44.0 });
  });

  it('interpolates in log frequency, landing between the neighbours', () => {
    const between = splForPhon(56, 60);
    expect(between).toBeLessThan(splForPhon(50, 60));
    expect(between).toBeGreaterThan(splForPhon(63, 60));
    // Halfway in log frequency gets halfway parameters.
    const mid = Math.sqrt(50 * 63);
    expect(iso226Parameters(mid).alpha).toBeCloseTo((0.509 + 0.482) / 2, 10);
  });

  it('refuses frequencies the standard does not cover', () => {
    expect(() => splForPhon(10, 60)).toThrow(RangeError);
    expect(() => phonForSpl(16000, 60)).toThrow(RangeError);
  });
});

describe('valid range', () => {
  it('is 20 to 90 phon up to 4 kHz and 20 to 80 phon above', () => {
    expect(validPhonRange(50)).toEqual({ min: 20, max: 90 });
    expect(validPhonRange(3150)).toEqual({ min: 20, max: 90 });
    expect(validPhonRange(8000)).toEqual({ min: 20, max: 80 });
    expect(inValidRange(50, 19.9)).toBe(false);
    expect(inValidRange(50, 90)).toBe(true);
    expect(inValidRange(8000, 85)).toBe(false);
  });
});

describe('where bass and crunch sound equally loud', () => {
  it('puts a 50 Hz bass and a product 30 dB lower at 3.15 kHz level at about 94.7 dB SPL', () => {
    const at = equalLoudnessCrossing(50, 3150, 30);
    expect(at).not.toBeNull();
    near(at!, 94.7, 0.05);
    near(phonForSpl(50, at!), phonForSpl(3150, at! - 30), 1e-6);
  });

  it('returns null when the tones never cross in the range searched', () => {
    expect(equalLoudnessCrossing(50, 3150, 30, 40, 80)).toBeNull();
  });
});
