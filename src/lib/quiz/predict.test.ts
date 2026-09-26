import { describe, expect, it } from 'vitest';
import { peak } from '../dsp/analysis';
import { dbToGain } from '../dsp/db';
import { PREDICT as LAB_PREDICT } from '../lab/copy';
import { scopeY } from '../viz/scope';
import {
  clip,
  DRIVE_DB,
  drawClipped,
  flatRuns,
  mergeRuns,
  PREDICT,
  PREDICT_SCOPE,
  pictureSource,
  surpriseLine,
  TURN_DOWN_DB,
} from './predict';

const source = pictureSource();
const drive = dbToGain(DRIVE_DB);
const knob = dbToGain(TURN_DOWN_DB);

describe('the question', () => {
  it('offers the misconception, the truth and an honest way out', () => {
    const ids = PREDICT.choices.map((c) => c.id);
    expect(ids).toContain(PREDICT.correct);
    expect(ids).toContain(PREDICT.wrong);
    expect(ids).toContain(PREDICT.unsure);
    // Short enough to sit on one line of a phone's answer row.
    expect(PREDICT.choices.find((c) => c.id === PREDICT.correct)?.label).toBe('Gets quieter but stays');
    expect(PREDICT.learn.path).toBe('/#two-ceilings');
  });

  it('asks about the file after the night, not the record level the two-ceilings lab asks about', () => {
    expect(PREDICT.question).toMatch(/file/);
    expect(PREDICT.question).not.toMatch(/record level/);
    expect(PREDICT.question).not.toBe(LAB_PREDICT.question);
  });

  it('names the surprise when the reader was sure it would go away', () => {
    expect(surpriseLine('away', 'certain')).toBe(
      'You were certain it would go away. A confident wrong guess is the kind people remember once it’s put right.',
    );
    expect(surpriseLine('away', 'fairly')).toMatch(/^You were fairly sure it would go away\. /);
  });

  it('adds nothing to a guess, a right answer or "Not sure"', () => {
    expect(surpriseLine('away', 'guessing')).toBeNull();
    expect(surpriseLine('away', undefined)).toBeNull();
    expect(surpriseLine(PREDICT.correct, 'certain')).toBeNull();
    expect(surpriseLine(PREDICT.unsure, undefined)).toBeNull();
    expect(surpriseLine(undefined, 'certain')).toBeNull();
  });

  it('keeps its copy short and plain', () => {
    const copy = [
      PREDICT.title,
      PREDICT.question,
      PREDICT.reveal,
      PREDICT.learn.text,
      ...PREDICT.choices.map((c) => c.label),
      surpriseLine('away', 'certain') ?? '',
      surpriseLine('away', 'fairly') ?? '',
    ];
    for (const text of copy) {
      expect(text, text).not.toMatch(/[!—]|\bplease\b/i);
      for (const s of text.split(/(?<=[.?])\s+/)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(20);
    }
  });
});

describe('flat runs', () => {
  it('finds the samples sitting on the ceiling, tops and bottoms', () => {
    expect(flatRuns([0, 1, 1, 0.5, -1, -1, -1, 0])).toEqual([
      { start: 1, end: 2, sign: 1 },
      { start: 4, end: 6, sign: -1 },
    ]);
    expect(flatRuns([0.2, -0.99, 0.5])).toEqual([]);
    expect(flatRuns([0.25, 0.25, 0], 0.25)).toEqual([{ start: 0, end: 1, sign: 1 }]);
  });

  it('merges the short breaks a high tone makes at the edge of a flat top', () => {
    const runs = [
      { start: 0, end: 3, sign: 1 as const },
      { start: 5, end: 9, sign: 1 as const },
      { start: 30, end: 40, sign: 1 as const },
      { start: 42, end: 44, sign: -1 as const },
    ];
    expect(mergeRuns(runs, 2)).toEqual([
      { start: 0, end: 9, sign: 1 },
      { start: 30, end: 40, sign: 1 },
      { start: 42, end: 44, sign: -1 },
    ]);
  });
});

describe('the picture tells the truth about the model', () => {
  it('draws from a signal that peaks exactly at the ceiling before the push', () => {
    expect(peak(source)).toBeCloseTo(1, 9);
  });

  it('keeps every flat top when the knob comes down after the ceiling', () => {
    const inMixer = Array.from(source, (v) => clip(v * drive));
    const atRecorder = inMixer.map((v) => v * knob);
    const before = flatRuns(inMixer);
    expect(before.length).toBeGreaterThanOrEqual(4);
    expect(flatRuns(atRecorder, knob)).toEqual(before);
    expect(peak(atRecorder)).toBeCloseTo(knob, 9);
  });

  it('would be clean if the same turn-down came before the ceiling', () => {
    const turnedDownFirst = Array.from(source, (v) => clip(v * drive * knob));
    expect(flatRuns(turnedDownFirst)).toEqual([]);
  });
});

describe('drawing', () => {
  const before = drawClipped(source);
  const after = drawClipped(source, { gainDb: TURN_DOWN_DB });

  it('marks the flat tops on the ceiling, and at the turned-down level afterwards', () => {
    const top = scopeY(1, PREDICT_SCOPE).toFixed(1);
    const low = scopeY(knob, PREDICT_SCOPE).toFixed(1);
    expect(before.flats).toContain(` ${top}L`);
    expect(after.flats).toContain(` ${low}L`);
    expect(after.flats.split('M').length).toBe(before.flats.split('M').length);
  });

  it('draws the missing peaks outside the ceiling and inside the screen', () => {
    for (const d of [before.ghost, before.cap]) expect(d.length).toBeGreaterThan(0);
    const ys = [...before.ghost.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    const top = scopeY(1, PREDICT_SCOPE);
    const bottom = scopeY(-1, PREDICT_SCOPE);
    for (const y of ys) {
      expect(y <= top + 0.05 || y >= bottom - 0.05, String(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(PREDICT_SCOPE.height);
    }
  });

  it('hangs the label over a flat top, on the screen', () => {
    expect(after.label.x).toBeGreaterThan(0);
    expect(after.label.x).toBeLessThan(PREDICT_SCOPE.width);
    expect(after.label.value).toBeCloseTo(knob, 9);
  });

  it('keys the shading with "cut off" just after the first cut-off peak, clear of the next one', () => {
    expect(before.cut).not.toBeNull();
    const x = before.cut?.x ?? 0;
    expect(x).toBeGreaterThan(0);
    // About 50 units of "cut off" fit before the screen's middle, where the second peak starts.
    expect(x + 55).toBeLessThan(PREDICT_SCOPE.width / 2);
    expect(drawClipped(source, { driveDb: -1 }).cut).toBeNull();
  });

  it('draws nothing flat when the push stays under the ceiling', () => {
    const clean = drawClipped(source, { driveDb: -1 });
    expect(clean.flats).toBe('');
    expect(clean.ghost).toBe('');
    expect(clean.cap).toBe('');
    expect(clean.signal.length).toBeGreaterThan(0);
  });
});
