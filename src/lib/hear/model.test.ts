import { describe, expect, it } from 'vitest';
import { peak } from '../dsp/analysis';
import { gainToDb } from '../dsp/db';
import { loudnessLufs, loudnessMatchGain } from '../dsp/loudness';
import { prng } from '../dsp/synth';
import { scopeY } from '../viz/scope';
import {
  type Answer,
  assignRounds,
  bufferFor,
  EMPTY_ANSWER,
  FIXED_ROUNDS,
  flatRuns,
  hardClip,
  isSpotted,
  REVEAL_SCOPE,
  ROUND_PUSHES_DB,
  type Round,
  revealView,
  revealWindow,
  summarise,
  versionsFor,
} from './model';

const v48 = versionsFor(48_000);

describe('rounds', () => {
  it('runs obvious to subtle: 12, 6, then 3 dB past the ceiling', () => {
    expect([...ROUND_PUSHES_DB]).toEqual([12, 6, 3]);
    expect(FIXED_ROUNDS.map((r) => r.pushDb)).toEqual([12, 6, 3]);
  });

  it('gives the server render a fixed assignment', () => {
    expect(FIXED_ROUNDS.map((r) => r.clipped)).toEqual(['b', 'a', 'b']);
  });

  it('flips a coin per round for the real test', () => {
    expect(assignRounds(() => 0).map((r) => r.clipped)).toEqual(['a', 'a', 'a']);
    expect(assignRounds(() => 0.99).map((r) => r.clipped)).toEqual(['b', 'b', 'b']);
    const seen = new Set<string>();
    const rand = prng(7);
    for (let i = 0; i < 40; i++)
      seen.add(
        assignRounds(rand)
          .map((r) => r.clipped)
          .join(''),
      );
    expect(seen.size).toBeGreaterThan(4);
  });
});

describe('the six buffers', () => {
  it('plays the clean loop right up to the ceiling and never past it', () => {
    expect(peak(v48.clean)).toBeCloseTo(1, 6);
    for (const b of [...v48.natural, ...v48.matched]) {
      expect(peak(b)).toBeLessThanOrEqual(1);
      expect(b.every(Number.isFinite)).toBe(true);
      expect(b.length).toBe(v48.clean.length);
    }
  });

  it('leaves the clipped copies as loud as the mixer made them, flat at the ceiling', () => {
    for (const b of v48.natural) expect(peak(b)).toBe(1);
  });

  it('turns each clipped copy down to exactly the clean loop’s loudness', () => {
    const target = loudnessLufs(v48.clean, 48_000);
    for (const b of v48.matched) expect(loudnessLufs(b, 48_000)).toBeCloseTo(target, 2);
  });

  it('matches loudness the same way as the shared helper, measuring the clean loop once', () => {
    for (const [i, natural] of v48.natural.entries()) {
      expect(v48.matchDb[i]).toBeCloseTo(gainToDb(loudnessMatchGain(v48.clean, natural, 48_000)), 9);
    }
  });

  it('turns them down by roughly what the research measured (−7.2, −4.9, −2.8 LU)', () => {
    const [m12, m6, m3] = v48.matchDb as [number, number, number];
    expect(m12).toBeGreaterThan(-9);
    expect(m12).toBeLessThan(-6.5);
    expect(m6).toBeGreaterThan(-5.8);
    expect(m6).toBeLessThan(-4.3);
    expect(m3).toBeGreaterThan(-3.4);
    expect(m3).toBeLessThan(-2.4);
    expect(m12).toBeLessThan(m6);
    expect(m6).toBeLessThan(m3);
  });

  it('renders once per sample rate and keeps it', () => {
    expect(versionsFor(48_000)).toBe(v48);
    const v44 = versionsFor(44_100);
    expect(v44).not.toBe(v48);
    expect(v44.clean.length).toBeLessThan(v48.clean.length);
    for (const [i, db] of v44.matchDb.entries()) expect(Math.abs(db - v48.matchDb[i]!)).toBeLessThan(0.4);
  });

  it('hands each button the right buffer', () => {
    const round: Round = { pushDb: 6, clipped: 'a' };
    expect(bufferFor(v48, 1, round, 'b')).toBe(v48.clean);
    expect(bufferFor(v48, 1, round, 'a')).toBe(v48.matched[1]);
    expect(bufferFor(v48, 1, round, 'a', true)).toBe(v48.natural[1]);
    expect(bufferFor(v48, 1, round, 'b', true)).toBe(v48.clean);
  });
});

describe('hardClip', () => {
  it('slices anything past ±1 flat', () => {
    expect([...hardClip([0.2, -0.6, 0.9], 2)]).toEqual([0.4000000059604645, -1, 1]);
  });
});

describe('flatRuns', () => {
  it('finds stretches on the ceiling, top and bottom', () => {
    const s = [0, 0.5, 1, 1, 1, 0.5, -1, -1, -1, -1, 0];
    expect(flatRuns(s, 0, s.length)).toEqual([
      { from: 2, to: 5, sign: 1 },
      { from: 6, to: 10, sign: -1 },
    ]);
  });

  it('ignores a single sample that just touches the ceiling', () => {
    expect(flatRuns([0, 1, 0, 1, 1, 0], 0, 6)).toEqual([]);
  });

  it('wraps round the loop, including from before its start', () => {
    const s = [1, 1, 0, 0, 0, 1];
    expect(flatRuns(s, -1, 3)).toEqual([{ from: 0, to: 3, sign: 1 }]);
  });
});

describe('the reveal', () => {
  const window = revealWindow(v48);

  it('zooms in on the downbeat kick, starting just before it', () => {
    expect(window.start).toBeLessThan(0);
    expect(window.count).toBe(Math.round(0.09 * 48_000));
  });

  it('draws flat tops on the clipped kick only, fewer as the push shrinks', () => {
    const counts = [0, 1, 2].map((i) => revealView(v48, i).clipped.flats.length);
    expect(revealView(v48, 0).clean.flats).toEqual([]);
    expect(counts[2]).toBeGreaterThan(0);
    expect(counts[0]).toBeGreaterThan(counts[2]!);
  });

  it('shows the clipped kick as heard: turned down, or as loud as the mixer left it', () => {
    const matched = revealView(v48, 0);
    const natural = revealView(v48, 0, true);
    const g = 10 ** (v48.matchDb[0]! / 20);
    expect(matched.clipped.peak).toBeCloseTo(g, 5);
    expect(natural.clipped.peak).toBeCloseTo(1, 6);
    expect(matched.clipped.peak).toBeLessThan(matched.clean.peak);
    const tops = new Set(matched.clipped.flats.map((f) => f.y.toFixed(3)));
    expect(tops).toEqual(new Set([scopeY(g, REVEAL_SCOPE).toFixed(3), scopeY(-g, REVEAL_SCOPE).toFixed(3)]));
    for (const f of natural.clipped.flats) expect([scopeY(1, REVEAL_SCOPE), scopeY(-1, REVEAL_SCOPE)]).toContain(f.y);
  });

  it('sits every round against the mixer’s ceiling: under it when matched, on it when not', () => {
    const mid = REVEAL_SCOPE.height / 2;
    const top = scopeY(1, REVEAL_SCOPE);
    const bottom = scopeY(-1, REVEAL_SCOPE);
    // The ceiling line fits on the screen, with room above it.
    expect(top).toBeGreaterThan(10);
    expect(bottom).toBeLessThan(REVEAL_SCOPE.height - 10);
    // The clean kick peaks just under the line, so it never looks clipped.
    const clean = revealView(v48, 0).clean;
    expect(clean.peak).toBeGreaterThan(0.75);
    expect(clean.peak).toBeLessThan(0.95);
    for (let i = 0; i < ROUND_PUSHES_DB.length; i++) {
      const matched = revealView(v48, i).clipped;
      const natural = revealView(v48, i, true).clipped;
      expect(matched.flats.length).toBeGreaterThan(0);
      // Turned down: a clear gap under the line, even in the subtle last round.
      for (const f of matched.flats) expect(Math.abs(f.y - mid)).toBeLessThan(0.8 * (mid - top));
      for (const f of natural.flats) expect([top, bottom]).toContain(f.y);
    }
  });

  it('keeps every mark on the screen', () => {
    for (const f of revealView(v48, 2).clipped.flats) {
      expect(f.x1).toBeGreaterThanOrEqual(0);
      expect(f.x2).toBeLessThanOrEqual(REVEAL_SCOPE.width);
      expect(f.x2 - f.x1).toBeGreaterThanOrEqual(REVEAL_SCOPE.width / 165 - 0.01);
    }
    expect(revealView(v48, 0).clean.path).not.toContain('NaN');
  });
});

describe('scoring', () => {
  const rounds: Round[] = [
    { pushDb: 12, clipped: 'a' },
    { pushDb: 6, clipped: 'b' },
    { pushDb: 3, clipped: 'b' },
  ];

  it('counts the rounds where the clipped one was picked', () => {
    const answers: Answer[] = [
      { pick: 'a', sure: 'certain' },
      { pick: 'b', sure: 'guessing' },
      { pick: 'a', sure: 'fairly' },
    ];
    expect(isSpotted(rounds[0]!, answers[0]!)).toBe(true);
    expect(summarise(rounds, answers)).toEqual({ spotted: 2, total: 3, confidentMisses: [] });
  });

  it('remembers the rounds you were certain about and got wrong', () => {
    const answers: Answer[] = [
      { pick: 'b', sure: 'certain' },
      { pick: 'b', sure: 'certain' },
      { pick: 'a', sure: 'certain' },
    ];
    expect(summarise(rounds, answers)).toEqual({ spotted: 1, total: 3, confidentMisses: [0, 2] });
  });

  it('treats unanswered rounds as missed, not confidently wrong', () => {
    expect(summarise(rounds, [EMPTY_ANSWER])).toEqual({ spotted: 0, total: 3, confidentMisses: [] });
  });
});
