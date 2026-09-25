import { describe, expect, it } from 'vitest';
import { countAtCeiling, peak } from '../dsp/analysis';
import { dbToGain, gainToDb } from '../dsp/db';
import { HOWLER_NOISE_GUESS_DBFS } from '../model';
import { TARGET } from '../record/model';
import {
  BLEND_DB,
  BOOST_DB,
  headroom,
  musicWindow,
  NORMALISE_TO_DBTP,
  peakLabel,
  recorded,
  recordedLevels,
  recordedTruePeakDb,
  roomToNoise,
  scaled,
  speakPeak,
  spreadLabels,
  TARGET_BAND,
  takeaway,
  truePeak,
  verdictFor,
  waveCaption,
  XDJ_HISS_BELOW_MUSIC_DB,
  zoneFor,
} from './model';

describe('zones', () => {
  it('calls a loud track on target from −18 to −12 dBFS, where a blend and a boost still fit', () => {
    expect(zoneFor(-24)).toBe('low');
    expect(zoneFor(-19)).toBe('low');
    expect(zoneFor(-18)).toBe('target');
    expect(zoneFor(-12)).toBe('target');
    expect(zoneFor(-11)).toBe('hot');
    expect(zoneFor(-6)).toBe('hot');
    expect(zoneFor(0)).toBe('hot');
    expect(zoneFor(1)).toBe('over');
    expect(zoneFor(6)).toBe('over');
  });

  it('uses the crew page’s targets: a loud track at −12, the loudest blend no higher than −6', () => {
    expect(TARGET_BAND).toEqual({ top: TARGET.blendMax, ideal: TARGET.normal, bottom: TARGET.band.bottom });
    expect(TARGET_BAND.top).toBe(TARGET.band.top);
    // A loud track on target plus a blend lands on the band's top, and a blend plus a full bass
    // boost lands on the top of the file, which is why −12 is the target.
    expect(TARGET_BAND.ideal + BLEND_DB).toBe(TARGET_BAND.top);
    expect(TARGET_BAND.ideal + BLEND_DB + BOOST_DB).toBe(0);
  });
});

describe('true peak', () => {
  it('finds the bulge between samples that a sample meter misses', () => {
    // A sine at a quarter of the sample rate, sampled 45° off its crests: every sample reads 0.707.
    const n = 4800;
    const sine = Float32Array.from({ length: n }, (_, i) => Math.sin((Math.PI / 2) * i + Math.PI / 4));
    expect(peak(sine)).toBeCloseTo(Math.SQRT1_2, 5);
    const middle = sine.subarray(200, n - 200);
    expect(truePeak(middle)).toBeGreaterThan(0.995);
    expect(truePeak(middle)).toBeLessThan(1.005);
  });

  it('agrees with the sample peak for a slow wave', () => {
    const slow = Float32Array.from({ length: 4800 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 100 * i) / 48_000));
    expect(truePeak(slow)).toBeCloseTo(0.5, 3);
  });
});

describe('the music', () => {
  const music = musicWindow();

  it('is 48 ms of the loudest kick, peaking at exactly 1.0', () => {
    expect(music.length).toBe(48 * 48);
    expect(peak(music)).toBeCloseTo(1, 10);
    expect(musicWindow()).toBe(music);
  });

  it('keeps its shape when recorded low', () => {
    const low = recorded(-12);
    expect(gainToDb(peak(low))).toBeCloseTo(-12, 6);
    expect(countAtCeiling(low)).toBe(0);
  });

  it('is cut flat at the top of the file when recorded over', () => {
    const over = recorded(6);
    expect(peak(over)).toBe(1);
    expect(countAtCeiling(over)).toBeGreaterThan(200);
  });

  it('has true peaks over 0 dBTP once clipped, so normalising turns it down more than 1 dB', () => {
    expect(recordedTruePeakDb(3)).toBeGreaterThan(0);
    expect(recordedTruePeakDb(-12)).toBeCloseTo(recordedTruePeakDb(0) - 12, 10);
  });
});

describe('headroom and normalising', () => {
  it('leaves 12 dB spare at −12 dBFS and puts the floors where the research does', () => {
    const s = headroom(-12, false);
    expect(s.headroom).toBe(12);
    expect(s.lost).toBe(0);
    expect(s.gain).toBe(0);
    expect(s.levels.xdjHiss).toBe(-12 - 94);
    expect(s.levels.howlerTop).toBe(HOWLER_NOISE_GUESS_DBFS.top);
  });

  it('turns a −12 recording up about 11 dB to a −1 dBTP true peak', () => {
    const s = headroom(-12, true);
    expect(s.truePeak).toBeCloseTo(NORMALISE_TO_DBTP, 10);
    expect(s.gain).toBeGreaterThan(10);
    expect(s.gain).toBeLessThan(11.01);
  });

  it('moves everything in the file by the same amount, so the noise stays as far under the music', () => {
    for (const p of [-24, -12, 0, 6]) {
      const before = headroom(p, false);
      const after = headroom(p, true);
      const shift = after.gain;
      expect(after.levels.xdjHiss - before.levels.xdjHiss).toBeCloseTo(shift, 10);
      expect(after.levels.howlerBottom - before.levels.howlerBottom).toBeCloseTo(shift, 10);
      expect(after.levels.peaks - before.levels.peaks).toBeCloseTo(shift, 10);
      expect(after.levels.music - after.levels.xdjHiss).toBeCloseTo(XDJ_HISS_BELOW_MUSIC_DB, 10);
    }
  });

  it('describes the whole file at any gain, for animating between states', () => {
    const halfway = recordedLevels(-12, 5.5);
    expect(halfway.peaks).toBe(-6.5);
    expect(halfway.music - halfway.xdjHiss).toBe(XDJ_HISS_BELOW_MUSIC_DB);
    expect(recordedLevels(3).peaks).toBe(0);
    expect(recordedLevels(3).music).toBe(3);
  });

  it('measures the room down to the nearest noise, whichever floor that is', () => {
    expect(roomToNoise(recordedLevels(-12))).toEqual({ min: 78, max: 94 });
    expect(roomToNoise(recordedLevels(-24))).toEqual({ min: 66, max: 86 });
    // Over the top, the file peaks at 0 but the hiss still rides with the music it came with.
    expect(roomToNoise(recordedLevels(6))).toEqual({ min: 88, max: 88 });
    // Normalising moves everything together, so the room doesn't change.
    const s = headroom(-12, true);
    const room = roomToNoise(s.levels);
    expect(room.min).toBeCloseTo(78, 10);
    expect(room.max).toBeCloseTo(94, 10);
  });

  it('turns a clipped file down, and the tops stay flat', () => {
    const s = headroom(3, true);
    expect(s.zone).toBe('over');
    expect(s.normaliseGain).toBeLessThan(-1);
    expect(s.lost).toBe(3);
    const file = recorded(3);
    const normalised = scaled(file, s.gain);
    const top = peak(normalised);
    expect(gainToDb(top)).toBeCloseTo(s.gain, 6);
    expect(countAtCeiling(normalised, top, 1e-6)).toBe(countAtCeiling(file, 1, 1e-6));
  });
});

describe('words', () => {
  it('says what to notice for each zone', () => {
    expect(takeaway(headroom(-12, false))).toMatch(/12\u00a0dB spare/);
    expect(takeaway(headroom(-3, false))).toContain('blend');
    expect(takeaway(headroom(-24, false))).toContain('own noise');
    expect(takeaway(headroom(4, false))).toContain('stored flat');
    expect(takeaway(headroom(-12, true))).toMatch(/^Turned up 1[01]\u00a0dB/);
    expect(takeaway(headroom(4, true))).toMatch(/^Turned down .*still flat/);
  });

  it('grades each level by what still fits on top of it', () => {
    const at = (p: number, normalised = false) => verdictFor(headroom(p, normalised));
    expect([-24, -19].map((p) => at(p))).toEqual(['low', 'low']);
    expect([-18, -15, -12].map((p) => at(p))).toEqual(['room', 'room', 'room']);
    expect([-11, -9, -7].map((p) => at(p))).toEqual(['blend-only', 'blend-only', 'blend-only']);
    expect(at(-6)).toBe('reaches-top');
    expect([-5, -1, 0].map((p) => at(p))).toEqual(['goes-over', 'goes-over', 'goes-over']);
    expect([1, 6].map((p) => at(p))).toEqual(['over', 'over']);
    expect(at(-12, true)).toBe('turned');
    expect(at(-24, true)).toBe('turned');
    expect(at(3, true)).toBe('still-flat');
  });

  it('promises room for a blend and a boost only where both fit', () => {
    for (let p = -18; p <= -12; p++)
      expect(takeaway(headroom(p, false))).toContain('That fits a blend and a bass boost.');
    for (let p = -11; p <= 6; p++) {
      expect(takeaway(headroom(p, false))).not.toContain('fits a blend and a bass boost');
      expect(takeaway(headroom(p, false))).not.toContain('spare');
    }
    expect(takeaway(headroom(-9, false))).toBe(
      'Peaks at −9\u00a0dBFS leave room for a blend, but a bass boost on top could go over, so aim nearer −12\u00a0dBFS.',
    );
    // A blend on top of −6 lands on 0 dBFS, where the record-level demo's light turns red.
    expect(takeaway(headroom(-6, false))).toBe(
      'Peaks at −6\u00a0dBFS are clean, but a blend adding 6\u00a0dB would reach the top, and any boost would clip.',
    );
    expect(takeaway(headroom(-5, false))).toBe(
      'Peaks at −5\u00a0dBFS are clean, but a blend adding 6\u00a0dB would go over.',
    );
  });

  it('writes whole numbers whole and keeps numbers with their units', () => {
    expect(takeaway(headroom(4, false))).toMatch(/^The peaks go 4\u00a0dB over the top\./);
    expect(takeaway(headroom(4, true))).toMatch(/^Turned down 1\.\d\u00a0dB/);
    // Just the no-break space, with no invisible word joiners around it.
    for (const p of [-24, -12, -9, -6, 0, 4]) {
      for (const n of [false, true]) expect(takeaway(headroom(p, n))).not.toMatch(/\u2060/);
    }
  });

  it('suggests Normalise where pressing it teaches something: a quiet file, a clipped one', () => {
    expect(takeaway(headroom(-24, false))).toMatch(/Try Normalise\.$/);
    expect(takeaway(headroom(4, false))).toMatch(/Try Normalise\.$/);
    expect(takeaway(headroom(-12, false))).not.toContain('Try');
    expect(takeaway(headroom(-3, false))).not.toContain('Try');
    expect(takeaway(headroom(-9, false))).not.toContain('Try');
    expect(takeaway(headroom(-24, true))).not.toContain('Try');
  });

  it('never leaves a plain space between a number and its unit', () => {
    for (const p of [-24, -18, -12, -6, -3, 0, 3, 6]) {
      for (const n of [false, true]) expect(takeaway(headroom(p, n))).not.toMatch(/\d dB/);
    }
  });

  it('shows levels over the top as how far over, since a file holds no +6 dBFS', () => {
    expect(peakLabel(-12)).toBe('−12\u00a0dBFS');
    expect(peakLabel(0)).toBe('0\u00a0dBFS');
    expect(peakLabel(6)).toBe('6\u00a0dB over');
  });

  it('speaks each step’s level and the room it leaves, so the live region needn’t repeat them', () => {
    expect(speakPeak(-12)).toBe('peaks at minus 12 decibels full scale, 12 decibels to spare');
    expect(speakPeak(-1)).toBe('peaks at minus 1 decibel full scale, 1 decibel to spare');
    expect(speakPeak(0)).toBe('peaks at 0 decibels full scale, nothing to spare');
    expect(speakPeak(1)).toBe('peaks 1 decibel over the top of the file');
    expect(speakPeak(6)).toBe('peaks 6 decibels over the top of the file');
  });

  it('captions the waveform', () => {
    expect(waveCaption(headroom(4, false))).toBe('Loudest kick, tops cut flat');
    expect(waveCaption(headroom(-12, false))).toBe('Loudest kick, as recorded');
    expect(waveCaption(headroom(-12, true))).toBe('Turned up, same shape');
    expect(waveCaption(headroom(5, true))).toBe('Turned down, still flat');
  });
});

describe('spreading labels', () => {
  it('leaves labels that fit alone', () => {
    expect(
      spreadLabels(
        [
          { at: 10, size: 10 },
          { at: 50, size: 10 },
        ],
        0,
        100,
      ),
    ).toEqual([10, 50]);
  });

  it('centres a clash on the labels’ own positions', () => {
    const [a, b] = spreadLabels(
      [
        { at: 50, size: 20 },
        { at: 50, size: 20 },
      ],
      0,
      100,
    );
    expect(a).toBe(40);
    expect(b).toBe(60);
  });

  it('keeps order and bounds', () => {
    const out = spreadLabels(
      [
        { at: 2, size: 10 },
        { at: 3, size: 10 },
        { at: 98, size: 10 },
      ],
      0,
      100,
    );
    expect(out).toEqual([5, 15, 95]);
  });

  it('never overlaps, even in a crowd', () => {
    const labels = [5, 6, 7, 30, 31, 90, 91, 92].map((at) => ({ at, size: 8 }));
    const out = spreadLabels(labels, 0, 100);
    const sorted = [...out].sort((x, y) => x - y);
    for (let k = 1; k < sorted.length; k++) expect(sorted[k]! - sorted[k - 1]!).toBeGreaterThanOrEqual(8 - 1e-9);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...out)).toBeLessThanOrEqual(96);
  });
});

it('uses decibel helpers consistently', () => {
  expect(gainToDb(dbToGain(-12))).toBeCloseTo(-12, 10);
});
