/**
 * The model behind the two-ceilings lab (W2).
 *
 *   track ─► Channel (TRIM, EQ) ─► CEILING 1: inside the mixer, the red LED (+12)
 *         ─► Recording level (0 dB at most) ─► CEILING 2: the Howler's input ─► file
 *
 * Levels are on the XDJ-RX2 meter's own dB scale. The Channel control is the track's loudest
 * peak as the channel meter would show it. Ceiling 1 is a hard clip at the red LED (sample 1.0,
 * see xdj.ts). Ceiling 2 is a hard clip at meter +6 with the recording level fully up (model.ts:
 * Howler publishes no input limit, so this is an assumption the interface labels). The file's
 * 0 dBFS is ceiling 2, so a recording peak in dBFS is how far below ceiling 2 the feed peaks.
 *
 * The recording level stands for whatever sets the level into the Howler. On this rig that is
 * MASTER LEVEL, set at soundcheck (C1), and MASTER ATT in UTILITY if it reaches MASTER 2, which
 * Pioneer does not say. The lab folds them into one knob.
 */

import { clip, peak, peakIndex, scaled } from '../dsp/analysis';
import { dbToGain } from '../dsp/db';
import { loudnessMatchGain } from '../dsp/loudness';
import { mixStems, renderLoop } from '../dsp/synth';
import { HOWLER_CEILING_AT_FULL_KNOB_DB, MIXER_CEILING_DB } from '../model';
import type { ScopeGeometry } from '../viz/scope';
import { meterDbToSample, RANGES } from '../xdj';

/* ------------------------------------------------------------------------------------------ */
/* Controls                                                                                     */

/**
 * The Channel slider: the track's loudest peak in dB on the channel meter's scale. The meter's
 * lights stop at +12, so past that it only shows red.
 */
export const CHANNELS = { min: -6, max: 18, step: 1 } as const;

/** The recording level: fully up is 0 dB, MASTER LEVEL's top, and it only turns down. */
export const KNOB = { min: -24, max: RANGES.masterLevel.max, step: 1 } as const;

/** Ceiling 1 in mixer units: the red LED, sample value 1. */
export const CEILING_1 = meterDbToSample(MIXER_CEILING_DB);

/** Ceiling 2 in mixer units, with the knob fully up: 6 dB below the red LED. */
export const CEILING_2 = meterDbToSample(HOWLER_CEILING_AT_FULL_KNOB_DB);

/** Anything within this many dB of a ceiling counts as touching it. */
const TOUCH_DB = 1e-6;

/* ------------------------------------------------------------------------------------------ */
/* Signals                                                                                      */

export interface LabSignal {
  sampleRate: number;
  /** One loop, scaled so its loudest peak is exactly 1. That peak is what the channel meter shows. */
  samples: Float32Array;
  /** The stretch the scopes zoom in on: a few hundredths of a second around the loudest peak. */
  window: { start: number; count: number };
}

/** How much the scopes show, and how far before the loudest peak they start. */
export const ZOOM_MS = 30;
export const ZOOM_LEAD_MS = 4;

const signals = new Map<number, LabSignal>();

function unitPeak(samples: ArrayLike<number>): Float32Array {
  const top = peak(samples);
  return scaled(samples, top > 0 ? 1 / top : 1);
}

/**
 * The lab's music (synth track A), scaled so the loudest peak is 1: the Channel control then sets
 * where that peak lands on the meter. Rendered once per sample rate and kept.
 */
export function labSignal(sampleRate = 48_000): LabSignal {
  const hit = signals.get(sampleRate);
  if (hit) return hit;

  const samples = unitPeak(mixStems(renderLoop({ sampleRate, track: 'a' })));
  const count = Math.round((ZOOM_MS / 1000) * sampleRate);
  const start = peakIndex(samples) - Math.round((ZOOM_LEAD_MS / 1000) * sampleRate);
  const signal: LabSignal = { sampleRate, samples, window: { start, count } };
  signals.set(sampleRate, signal);
  return signal;
}

/* ------------------------------------------------------------------------------------------ */
/* The two ceilings                                                                             */

/** Where a stage stands against its ceiling: room to spare, touching it, or cutting peaks off. */
export type Stage = 'clear' | 'at' | 'over';

export type Crunch = 'clean' | 'tips' | 'some' | 'heavy';

/**
 * Crunch thresholds on the added-distortion ratio. On the lab's loop, 1 dB over a ceiling adds
 * 0.4 %, 2 dB adds 1.2 %, 3 dB adds 3 %, 4 dB adds 6 % and 6 dB adds 15 %. So "Clean" means
 * nothing was cut, and "Tips cut" is the first dB over: it cuts less than the blend lab's red
 * that only just lights (under 0.5 %, blend/model.ts BARELY_OVER_DB), which that lab calls too
 * little to hear. "Some crunch" is 2 to 3 dB over, near the blend lab's Top orange pad, which cuts
 * over 2 % and can be heard, and "Heavy crunch" is 4 dB over or more.
 */
export const CRUNCH_LIMITS = { tips: 0.001, some: 0.01, heavy: 0.05 } as const;

export function crunchFor(distortion: number): Crunch {
  if (distortion < CRUNCH_LIMITS.tips) return 'clean';
  if (distortion < CRUNCH_LIMITS.some) return 'tips';
  if (distortion < CRUNCH_LIMITS.heavy) return 'some';
  return 'heavy';
}

export interface Reading {
  channels: number;
  knob: number;
  /** How far the loudest peak tried to go past ceiling 1, in dB. Negative means room to spare. */
  mixerOverDb: number;
  /** How far the feed's loudest peak tried to go past ceiling 2, in dB. */
  recorderOverDb: number;
  mixer: Stage;
  recorder: Stage;
  /** The Howler's LEVEL light: blinking red when the recording reaches its ceiling. */
  howler: 'green' | 'red';
  /** The file's loudest peak. 0 dBFS is ceiling 2. */
  recordingPeakDbfs: number;
  /**
   * Added distortion: RMS of what the ceilings changed, divided by the RMS of the clean signal
   * at the same level. Harmonics, intermodulation and aliasing all count (no oversampling).
   */
  distortion: number;
  crunch: Crunch;
}

const stageFor = (overDb: number): Stage => (overDb > TOUCH_DB ? 'over' : overDb >= -TOUCH_DB ? 'at' : 'clear');

/** Gains that take the unit-peak signal into the mixer, and the mixer into the file. */
function gains(channels: number, knob: number) {
  return { mixer: meterDbToSample(channels), toFile: dbToGain(knob) / CEILING_2 };
}

/** RMS of (file − clean at the same level) over RMS of the clean, for one loop. */
export function addedDistortion(samples: ArrayLike<number>, channels: number, knob: number): number {
  const g = gains(channels, knob);
  let error = 0;
  let clean = 0;
  for (let i = 0; i < samples.length; i++) {
    const inMixer = samples[i]! * g.mixer;
    const wanted = inMixer * g.toFile;
    const file = clip(clip(inMixer) * g.toFile);
    error += (file - wanted) ** 2;
    clean += wanted ** 2;
  }
  return clean > 0 ? Math.sqrt(error / clean) : 0;
}

/** Everything the readouts show, for one setting of the two controls. */
export function readLab(signal: LabSignal, channels: number, knob: number): Reading {
  const mixerOverDb = channels - MIXER_CEILING_DB;
  const recorderOverDb = Math.min(channels, MIXER_CEILING_DB) + knob - HOWLER_CEILING_AT_FULL_KNOB_DB;
  const recorder = stageFor(recorderOverDb);
  const distortion = addedDistortion(signal.samples, channels, knob);
  return {
    channels,
    knob,
    mixerOverDb,
    recorderOverDb,
    mixer: stageFor(mixerOverDb),
    recorder,
    howler: recorder === 'clear' ? 'green' : 'red',
    recordingPeakDbfs: Math.min(0, recorderOverDb),
    distortion,
    crunch: crunchFor(distortion),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Scopes                                                                                       */

/**
 * Both screens share one fixed scale, in mixer units: ceiling 1 is ±1 and ceiling 2 is
 * ±CEILING_2. A peak 6 dB past ceiling 1 (×2) still fits on the screen.
 */
export const LAB_SCOPE: ScopeGeometry = { width: 330, height: 150, range: 2.2 };

/**
 * One screen's worth of signal, in mixer units: ceiling 1 is ±1 and ceiling 2 is ±CEILING_2.
 * Nothing is magnified, so a knob turned down 12 dB draws the wave at a quarter of the height.
 */
export interface ScopeTrace {
  /** What the signal would have been with no ceiling in the way. */
  wanted: Float32Array;
  /** What it actually is. */
  actual: Float32Array;
}

/**
 * The zoom window inside the mixer (cut at ceiling 1), and at the Howler's input after the knob
 * (cut at ceiling 2), which is what the file keeps. Both are on the mixer's scale.
 */
export function scopeTraces(
  signal: LabSignal,
  channels: number,
  knob: number,
): { mixer: ScopeTrace; recording: ScopeTrace } {
  const { samples, window } = signal;
  const toMixer = gains(channels, knob).mixer;
  const knobGain = dbToGain(knob);
  const n = samples.length;
  const mixer = { wanted: new Float32Array(window.count), actual: new Float32Array(window.count) };
  const recording = { wanted: new Float32Array(window.count), actual: new Float32Array(window.count) };
  for (let i = 0; i < window.count; i++) {
    const inMixer = samples[(((window.start + i) % n) + n) % n]! * toMixer;
    const cut = clip(inMixer);
    mixer.wanted[i] = inMixer;
    mixer.actual[i] = cut;
    // After the knob, the same as clip(cut × toFile) × CEILING_2 in the file's own units.
    const fed = cut * knobGain;
    recording.wanted[i] = inMixer * knobGain;
    recording.actual[i] = fed > CEILING_2 ? CEILING_2 : fed < -CEILING_2 ? -CEILING_2 : fed;
  }
  return { mixer, recording };
}

export interface ScopeDrawing {
  /** The signal as it is. */
  trace: string;
  /** Dashed: where the peaks would have gone. Only drawn where something was cut. */
  ghost: string;
  /** The flat tops, to stroke in the damage colour. */
  flats: string;
  /** The area between ghost and flat top: what was cut off. */
  cut: string;
}

/** A number of tenths as short SVG path text: 25 → "2.5", −4 → "-.4", 30 → "3". */
function tenths(t: number): string {
  if (t % 10 === 0) return String(t / 10);
  const s = (t / 10).toFixed(1);
  return s.replace(/^(-?)0\./, '$1.');
}

/** "l" steps between points given in tenths. The first point is the current position. */
function steps(xs: readonly number[], ys: readonly number[], from: number, to: number, dir: 1 | -1 = 1): string {
  let d = '';
  for (let c = from + dir; dir > 0 ? c <= to : c >= to; c += dir) {
    const dy = ys[c]! - ys[c - dir]!;
    d += `l${tenths(xs[c]! - xs[c - dir]!)}${dy < 0 ? '' : ' '}${tenths(dy)}`;
  }
  return d;
}

/**
 * SVG paths for one screen, one point per `columnWidth` units, taken at the column's largest
 * wanted value so peaks and flat tops survive the thinning, and ghost and trace share their
 * columns. Coordinates are rounded to tenths and written as relative steps, which keeps the
 * server-rendered page light and each slider update cheap.
 */
export function drawScope(
  { wanted, actual }: ScopeTrace,
  geometry: ScopeGeometry = LAB_SCOPE,
  columnWidth = 2,
): ScopeDrawing {
  const columns = Math.max(2, Math.round(geometry.width / columnWidth));
  const count = wanted.length;
  const half = geometry.height / 2;
  // Not clamped: a ghost bigger than the screen runs off the top, as it would on a real scope.
  const yOf = (v: number) => Math.round((half - (v / geometry.range) * (half - 4)) * 10);
  const xs: number[] = [];
  const want: number[] = [];
  const got: number[] = [];
  const wantY: number[] = [];
  const gotY: number[] = [];
  for (let c = 0; c < columns; c++) {
    const from = Math.floor((c * count) / columns);
    const to = Math.max(from + 1, Math.floor(((c + 1) * count) / columns));
    let pick = from;
    for (let i = from; i < to && i < count; i++) if (Math.abs(wanted[i]!) > Math.abs(wanted[pick]!)) pick = i;
    xs.push(Math.round((c / (columns - 1)) * geometry.width * 10));
    want.push(wanted[pick] ?? 0);
    got.push(actual[pick] ?? 0);
    wantY.push(yOf(wanted[pick] ?? 0));
    gotY.push(yOf(actual[pick] ?? 0));
  }

  const at = (c: number, ys: readonly number[]) => `${tenths(xs[c]!)} ${tenths(ys[c]!)}`;
  const trace = `M${at(0, gotY)}${steps(xs, gotY, 0, columns - 1)}`;

  // Runs of columns where the ceiling cut something off, split where the sign changes.
  const runs: Array<[from: number, to: number]> = [];
  let start = -1;
  const isCut = (c: number) => Math.abs(want[c]! - got[c]!) > 1e-6;
  for (let c = 0; c <= columns; c++) {
    const cut = c < columns && isCut(c);
    const sameSign = start >= 0 && c < columns && Math.sign(want[c]!) === Math.sign(want[start]!);
    if (start >= 0 && (!cut || !sameSign)) {
      runs.push([start, c - 1]);
      start = -1;
    }
    if (cut && start < 0) start = c;
  }

  let ghost = '';
  let flats = '';
  let cutArea = '';
  for (const [from, to] of runs) {
    // Anchor the ghost on the trace one column either side, so it rises out of the wave.
    const a = Math.max(0, from - 1);
    const b = Math.min(columns - 1, to + 1);
    const g = `M${at(a, wantY)}${steps(xs, wantY, a, b)}`;
    ghost += g;
    flats += `M${at(from, gotY)}H${tenths(xs[to]!)}`;
    // Back along the trace from the far anchor, then close: the area the ceiling removed.
    cutArea += `${g}L${at(b, gotY)}${steps(xs, gotY, b, a, -1)}Z`;
  }
  return { trace, ghost, flats, cut: cutArea };
}

/* ------------------------------------------------------------------------------------------ */
/* Guided flow                                                                                  */

/**
 * Three steps, each with one live control: the recording level with the channel in the red (it
 * cannot remove the crunch), the channel (it can), then the recording level again, with the
 * channel clean and the Howler's input overloaded (it can).
 */
export type Step = 1 | 2 | 3;
export const STEP_COUNT = 3;

/** The two controls: the channel before ceiling 1, the recording level between the ceilings. */
export type Control = 'channels' | 'knob';

export interface StepSetup {
  /** Where the controls start when the step opens. */
  start: { channels: number; knob: number };
  /** The one control the step lets you move. The other is locked. */
  live: Control;
}

export const STEP_SETUP: Record<Step, StepSetup> = {
  1: { start: { channels: 18, knob: -12 }, live: 'knob' },
  2: { start: { channels: 18, knob: -12 }, live: 'channels' },
  3: { start: { channels: 9, knob: 0 }, live: 'knob' },
};

/** The screen each step is about: where its control moves the wave. The other screen follows. */
export type ScopeFocus = 'mixer' | 'recording';

export const STEP_SCOPE: Record<Step, ScopeFocus> = {
  1: 'recording',
  2: 'mixer',
  3: 'recording',
};

/**
 * Step 1 has no solution. It reveals itself after this many knob moves, or this long after the
 * first one. The clock waits for a move, so a slow reader never has the answer sprung on them.
 */
export const REVEAL_AFTER_MOVES = 3;
export const REVEAL_AFTER_MS = 20_000;
/**
 * A knob move counts once the knob has been still this long, so a drag, a run of arrow-key
 * presses or a few quick − / + taps each count as one try, not one per decibel.
 */
export const MOVE_SETTLE_MS = 600;

/**
 * Has the reader done what the step asks? Step 2 also wants the channel meter out of the red:
 * touching +12 cuts nothing yet, but a blend on top would clip.
 */
export function goalMet(step: Step, r: Reading): boolean {
  if (step === 2) return r.crunch === 'clean' && r.howler === 'green' && r.mixer === 'clear';
  if (step === 3) return r.crunch === 'clean' && r.howler === 'green';
  return false;
}

/* ------------------------------------------------------------------------------------------ */
/* Sound                                                                                        */

const matchCache = new Map<string, number>();

/**
 * One loop of what the Howler wrote, at the device's sample rate, turned up to the clean
 * track's loudness (with loudnessMatchGain), the way the file is normalised after the set.
 * `clean` plays the same music with nothing cut off, at the same loudness, so an A/B between
 * them differs only in crunch. Everything stays within ±1, as the audio engine requires.
 */
export function playbackLoop(signal: LabSignal, channels: number, knob: number, clean: boolean): Float32Array {
  const { samples, sampleRate } = signal;
  if (clean) return samples;
  const g = gains(channels, knob);
  const file = new Float32Array(samples.length);
  for (let i = 0; i < file.length; i++) file[i] = clip(clip(samples[i]! * g.mixer) * g.toFile);

  const key = `${sampleRate}:${channels}:${knob}`;
  let match = matchCache.get(key);
  if (match === undefined) {
    match = loudnessMatchGain(samples, file, sampleRate);
    if (matchCache.size > 256) matchCache.clear();
    matchCache.set(key, match);
  }
  for (let i = 0; i < file.length; i++) file[i] = file[i]! * match;
  return file;
}
