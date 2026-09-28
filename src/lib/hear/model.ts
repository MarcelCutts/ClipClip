/**
 * The model behind "Can you hear it?", a blind listening test.
 *
 * Each round plays the same loop of track A twice: once clean, once pushed past the mixer's
 * ceiling and hard-clipped there, the way a digital mixer clips (no oversampling). The clipped
 * copy is then turned down until both are equally loud (BS.1770 K-weighted loudness), because
 * a louder copy nearly always sounds "better" and would give the answer away. The match is
 * measured on the full range: a speaker that drops the bass leaves round 1's clipped copy about
 * 1.5 LU louder, and the copy recommends headphones there (copy.ts, DEVICE_TIPS).
 *
 * Levels: sample value 1.0 is the mixer's ceiling (the red LED, see xdj.ts). The clean loop
 * peaks exactly there, so "pushed 12 dB past the ceiling" means its peaks would have reached
 * 12 dB past it. Nothing we play goes above 1.0.
 */
import { hardClip, peak, runsAtCeiling, scaled } from '../dsp/analysis';
import { dbToGain, gainToDb } from '../dsp/db';
import { kWeightedPower } from '../dsp/loudness';
import { mixStems, renderLoop } from '../dsp/synth';
import { type ScopeGeometry, scopePath, scopeY } from '../viz/scope';

export { hardClip } from '../dsp/analysis';

export type Side = 'a' | 'b';
export type Confidence = 'guessing' | 'fairly' | 'certain';
export type Device = 'phone' | 'laptop' | 'headphones';

export const SIDES: readonly Side[] = ['a', 'b'];
export const CONFIDENCES: readonly Confidence[] = ['guessing', 'fairly', 'certain'];
export const DEVICES: readonly Device[] = ['phone', 'laptop', 'headphones'];

/** How far past the ceiling each round pushes the clipped copy, in dB. Obvious first, subtle last. */
export const ROUND_PUSHES_DB = [12, 6, 3] as const;
export const ROUND_COUNT = ROUND_PUSHES_DB.length;

export interface Round {
  /** How far past the ceiling the clipped copy was pushed, in dB. */
  pushDb: number;
  /** Which button plays the clipped copy. */
  clipped: Side;
}

export interface Answer {
  pick: Side | null;
  sure: Confidence | null;
}

export const EMPTY_ANSWER: Answer = { pick: null, sure: null };

/**
 * A fixed assignment for the server render. Nothing about it shows until a round is answered,
 * and the browser swaps in a random one before anyone can play a note.
 */
export const FIXED_ROUNDS: readonly Round[] = ROUND_PUSHES_DB.map((pushDb, i) => ({
  pushDb,
  clipped: i % 2 === 0 ? 'b' : 'a',
}));

/** A fresh blind assignment: each round flips its own coin. */
export function assignRounds(random: () => number = Math.random): Round[] {
  return ROUND_PUSHES_DB.map((pushDb) => ({ pushDb, clipped: random() < 0.5 ? 'a' : 'b' }));
}

export const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');

/** Did this answer pick the clipped copy? */
export const isSpotted = (round: Round, answer: Answer): boolean => answer.pick === round.clipped;

export interface Summary {
  spotted: number;
  total: number;
  /** Rounds (0-based) the reader was certain about and got wrong. */
  confidentMisses: number[];
}

/** Score only predictions; revealing without answering is not a failed prediction. */
export function summarise(rounds: readonly Round[], answers: readonly Answer[]): Summary {
  let spotted = 0;
  const confidentMisses: number[] = [];
  rounds.forEach((round, i) => {
    const answer = answers[i] ?? EMPTY_ANSWER;
    if (isSpotted(round, answer)) spotted++;
    else if (answer.pick && answer.sure === 'certain') confidentMisses.push(i);
  });
  return { spotted, total: rounds.filter((_, i) => answers[i]?.pick).length, confidentMisses };
}

export interface Versions {
  sampleRate: number;
  /** Samples per beat, for finding the kicks. */
  beatLength: number;
  /** One loop of track A, peaking exactly at the ceiling. */
  clean: Float32Array;
  /** Per round: pushed past the ceiling and clipped, as the mixer leaves it (as loud as it gets). */
  natural: Float32Array[];
  /** Per round: the clipped copy turned down to the clean loop's loudness. What the test plays. */
  matched: Float32Array[];
  /** Per round: how far the clipped copy was turned down to match, in dB (negative). */
  matchDb: number[];
}

const cache = new Map<number, Versions>();

/**
 * Every buffer the test can play, rendered once per sample rate and kept, so switching between
 * A and B never waits for maths. The first call does all of it (tens of milliseconds, more on a
 * slow phone), so the widget calls it while the page is idle, before anyone presses a button.
 */
export function versionsFor(sampleRate: number): Versions {
  const hit = cache.get(sampleRate);
  if (hit) return hit;

  const loop = renderLoop({ sampleRate, track: 'a' });
  const mix = mixStems(loop);
  const top = peak(mix);
  const clean = scaled(mix, top > 0 ? 1 / top : 1);

  // The loudness match (as in loudnessMatchGain), with the clean loop measured once for all rounds.
  const reference = kWeightedPower(clean, sampleRate);
  const natural: Float32Array[] = [];
  const matched: Float32Array[] = [];
  const matchDb: number[] = [];
  for (const pushDb of ROUND_PUSHES_DB) {
    const clipped = hardClip(clean, dbToGain(pushDb));
    const power = kWeightedPower(clipped, sampleRate);
    const gain = power > 0 ? Math.sqrt(reference / power) : 1;
    natural.push(clipped);
    matched.push(scaled(clipped, gain));
    matchDb.push(gainToDb(gain));
  }

  const versions: Versions = { sampleRate, beatLength: loop.beatLength, clean, natural, matched, matchDb };
  cache.set(sampleRate, versions);
  return versions;
}

/**
 * The buffer behind one button in one round. The test always plays the matched copy; `unmatched`
 * is the clipped copy as the mixer left it, which the tests use to check the matching.
 */
export function bufferFor(
  versions: Versions,
  roundIndex: number,
  round: Round,
  side: Side,
  unmatched = false,
): Float32Array {
  if (side !== round.clipped) return versions.clean;
  const set = unmatched ? versions.natural : versions.matched;
  return set[roundIndex] ?? versions.clean;
}

/* ------------------------------------------------------------------------------------------ */
/* The reveal: both waveforms, zoomed in on one kick.                                           */

/**
 * Which kick the reveal zooms in on: the downbeat. It has no clap on top, so the clean kick
 * draws as a smooth wave and the flat tops stand out.
 */
export const REVEAL_BEAT = 0;
export const REVEAL_PRE_MS = 4;
export const REVEAL_LENGTH_MS = 90;

/** The sample the reveal window starts at, and how many samples it shows. */
export function revealWindow(versions: Versions): { start: number; count: number } {
  const ms = versions.sampleRate / 1000;
  const onset = Math.round(REVEAL_BEAT * versions.beatLength);
  return { start: onset - Math.round(REVEAL_PRE_MS * ms), count: Math.round(REVEAL_LENGTH_MS * ms) };
}

export interface Run {
  /** First sample of the run, relative to the window start. */
  from: number;
  /** One past the last sample of the run. */
  to: number;
  /** +1 for a flat top, −1 for a flat bottom. */
  sign: 1 | -1;
}

/**
 * Stretches of at least `minLength` samples sitting on the ceiling: the flat tops. `signal`
 * must be at the mixer's level, where the ceiling is exactly ±1. The window wraps round the loop.
 */
export function flatRuns(signal: ArrayLike<number>, start: number, count: number, minLength = 3): Run[] {
  return runsAtCeiling(signal, 1, 1e-6, { start, count, minLength }).map((run) => ({
    from: run.start,
    to: run.end + 1,
    sign: run.sign,
  }));
}

export interface Segment {
  x1: number;
  x2: number;
  y: number;
}

export interface ScopeView {
  /** SVG path of the waveform. */
  path: string;
  /** The flat tops, as horizontal strokes to draw over the waveform. */
  flats: Segment[];
  /** Highest peak in the window, as a sample value (1 is the ceiling). */
  peak: number;
}

export interface RevealView {
  clean: ScopeView;
  clipped: ScopeView;
}

/**
 * The reveal's scope size, in SVG units. Fixed vertical scale: the clean kick nearly fills the
 * screen. It is drawn wide (990 units for 90 ms, about 4 samples a column) so the waveform stays
 * smooth when the screen is scaled up on a desktop.
 */
export const REVEAL_SCOPE: ScopeGeometry = { width: 990, height: 396, range: 1.12 };

/** Wrap-safe copy of the window, scaled, so the scope helpers never read past the loop. */
function windowOf(signal: Float32Array, start: number, count: number, gain = 1): Float32Array {
  const n = signal.length;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = signal[(((start + i) % n) + n) % n]! * gain;
  return out;
}

/**
 * Both waveforms of a round as the listener heard them: the clean loop, and the clipped copy
 * turned down to match. With `unmatched`, the clipped copy at the mixer's level instead, which
 * the tests use to check the drawing against the ceiling line.
 */
export function revealView(
  versions: Versions,
  roundIndex: number,
  unmatched = false,
  geometry: ScopeGeometry = REVEAL_SCOPE,
): RevealView {
  const { start, count } = revealWindow(versions);
  const natural = versions.natural[roundIndex] ?? versions.clean;
  const gain = unmatched ? 1 : dbToGain(versions.matchDb[roundIndex] ?? 0);

  const cleanWindow = windowOf(versions.clean, start, count);
  const clippedWindow = windowOf(natural, start, count, gain);
  const x = (i: number) => (i / Math.max(1, count - 1)) * geometry.width;

  // Keep the shortest flats visible: at least 1/165 of the screen wide.
  const shortest = geometry.width / 165;
  const flats = flatRuns(natural, start, count).map((run) => {
    const x1 = x(run.from);
    const x2 = x(run.to - 1);
    const pad = Math.max(0, (shortest - (x2 - x1)) / 2);
    return {
      x1: Math.max(0, x1 - pad),
      x2: Math.min(geometry.width, x2 + pad),
      y: scopeY(run.sign * gain, geometry),
    };
  });

  return {
    clean: { path: scopePath(cleanWindow, geometry), flats: [], peak: peak(cleanWindow) },
    clipped: { path: scopePath(clippedWindow, geometry), flats, peak: peak(clippedWindow) },
  };
}
