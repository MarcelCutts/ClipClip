/**
 * The model behind the two-ceilings lab (W2).
 *
 *   track ─► Channel (TRIM, EQ) ─► CEILING 1: inside the mixer, the red LED (+12)
 *         ─► Record level (MASTER LEVEL, 0 dB at most) ─► CEILING 2: the Howler's input ─► file
 *
 * Levels are on the XDJ-RX2 meter's own dB scale. The Channels control is the track's loudest
 * peak as the channel meter would show it. Ceiling 1 is a hard clip at the red LED (sample 1.0,
 * see xdj.ts). Ceiling 2 is a hard clip at meter +6 with the knob fully up (model.ts: Howler
 * publishes no input limit, so this is an assumption the interface labels). The file's 0 dBFS is
 * ceiling 2, so a recording peak in dBFS is simply how far below ceiling 2 the feed peaks.
 *
 * The Howler records from MASTER 2, so the knob between the ceilings is MASTER LEVEL, which sets
 * the speakers too. On the night it stays fully up and MASTER ATT in UTILITY turns the recording
 * down further; the lab folds both into one knob, from off to fully up.
 */

import { clip, peak, peakIndex, scaled } from '../dsp/analysis';
import { dbToGain } from '../dsp/db';
import { loudnessMatchGain } from '../dsp/loudness';
import { mixStems, renderLoop } from '../dsp/synth';
import { TEST_SIGNAL, testSignalAt } from '../dsp/twoCeilings';
import { HOWLER_CEILING_AT_FULL_KNOB_DB, MIXER_CEILING_DB } from '../model';
import type { ScopeGeometry } from '../viz/scope';
import { meterDbToSample, RANGES } from '../xdj';

/* ------------------------------------------------------------------------------------------ */
/* Controls                                                                                     */

/**
 * The Channels slider: the track's loudest peak in dB on the channel meter's scale. The meter's
 * lights stop at +12, so past that it only shows red.
 */
export const CHANNELS = { min: -6, max: 18, step: 1 } as const;

/** The record level (MASTER LEVEL): fully up is 0 dB, and like every output knob it only turns down. */
export const KNOB = { min: -24, max: RANGES.masterLevel.max, step: 1 } as const;

/** Ceiling 1 in mixer units: the red LED, sample value 1. */
export const CEILING_1 = meterDbToSample(MIXER_CEILING_DB);

/** Ceiling 2 in mixer units, with the knob fully up: 6 dB below the red LED. */
export const CEILING_2 = meterDbToSample(HOWLER_CEILING_AT_FULL_KNOB_DB);

/** Anything within this many dB of a ceiling counts as touching it. */
const TOUCH_DB = 1e-6;

/* ------------------------------------------------------------------------------------------ */
/* Signals                                                                                      */

export type SignalKind = 'track' | 'tones';

export interface LabSignal {
  kind: SignalKind;
  sampleRate: number;
  /** One loop, scaled so its loudest peak is exactly 1. That peak is what the channel meter shows. */
  samples: Float32Array;
  /** The stretch the scopes zoom in on: a few hundredths of a second around the loudest peak. */
  window: { start: number; count: number };
}

/** How much the scopes show, and how far before the loudest peak they start. */
export const ZOOM_MS = 30;
export const ZOOM_LEAD_MS = 4;

const signals = new Map<string, LabSignal>();

function unitPeak(samples: ArrayLike<number>): Float32Array {
  const top = peak(samples);
  return scaled(samples, top > 0 ? 1 / top : 1);
}

/** A loop of the two test tones that closes cleanly at any sample rate. */
function toneLoop(sampleRate: number): Float32Array {
  const base = (TEST_SIGNAL.length * sampleRate) / TEST_SIGNAL.sampleRate;
  let length = Math.round(base * 8);
  for (let k = 1; k <= 64; k++) {
    const l = base * k;
    if (Math.abs(l - Math.round(l)) < 1e-6) {
      length = Math.round(l);
      break;
    }
  }
  return Float32Array.from({ length }, (_, i) => testSignalAt(i / sampleRate));
}

/**
 * The lab's music (synth track A) or, in the engineer view, the two test tones, scaled so the
 * loudest peak is 1: the Channels control then sets where that peak lands on the meter.
 * Rendered once per sample rate and kept.
 */
export function labSignal(kind: SignalKind = 'track', sampleRate = 48_000): LabSignal {
  const key = `${kind}@${sampleRate}`;
  const hit = signals.get(key);
  if (hit) return hit;

  const raw = kind === 'track' ? mixStems(renderLoop({ sampleRate, track: 'a' })) : toneLoop(sampleRate);
  const samples = unitPeak(raw);
  const count = Math.round((ZOOM_MS / 1000) * sampleRate);
  const start = peakIndex(samples) - Math.round((ZOOM_LEAD_MS / 1000) * sampleRate);
  const signal: LabSignal = { kind, sampleRate, samples, window: { start, count } };
  signals.set(key, signal);
  return signal;
}

/* ------------------------------------------------------------------------------------------ */
/* The two ceilings                                                                             */

/** Where a stage stands against its ceiling: room to spare, touching it, or cutting peaks off. */
export type Stage = 'clear' | 'at' | 'over';

export type Crunch = 'clean' | 'some' | 'heavy';

/**
 * Crunch thresholds on the added-distortion ratio. On the lab's loop, 1 dB over a ceiling adds
 * 0.4 %, 3 dB adds 3 %, 4 dB adds 6 % and 6 dB adds 15 %. So "Clean" means nothing was cut,
 * "Some crunch" is up to about 3 dB over, and "Heavy crunch" is 4 dB over or more.
 */
export const CRUNCH_LIMITS = { some: 0.001, heavy: 0.05 } as const;

export function crunchFor(distortion: number): Crunch {
  if (distortion < CRUNCH_LIMITS.some) return 'clean';
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

export type Step = 1 | 2 | 3 | 4 | 5;
export const STEP_COUNT = 5;
export const SANDBOX: Step = 5;

export interface StepSetup {
  /** Where the controls start when the step opens. Null keeps whatever the reader left. */
  start: { channels: number; knob: number } | null;
  lockChannels: boolean;
  lockKnob: boolean;
}

/**
 * Steps 2 to 4 each have one live control, so the task is plain: the knob, then the channels,
 * then the knob again. The sandbox unlocks both.
 */
export const STEP_SETUP: Record<Step, StepSetup> = {
  1: { start: { channels: 18, knob: -12 }, lockChannels: true, lockKnob: true },
  2: { start: { channels: 18, knob: -12 }, lockChannels: true, lockKnob: false },
  3: { start: { channels: 18, knob: -12 }, lockChannels: false, lockKnob: true },
  4: { start: { channels: 9, knob: 0 }, lockChannels: true, lockKnob: false },
  5: { start: null, lockChannels: false, lockKnob: false },
};

/** The screen each step is about: where its control moves the wave. The sandbox shows both. */
export type ScopeFocus = 'mixer' | 'recording' | 'both';

export const STEP_SCOPE: Record<Step, ScopeFocus> = {
  1: 'mixer',
  2: 'recording',
  3: 'mixer',
  4: 'recording',
  5: 'both',
};

/**
 * Challenge 1 (productive failure) reveals itself after this many knob moves, or this long after
 * the first one. The clock waits for a move, so a slow reader never has the answer sprung on them.
 */
export const REVEAL_AFTER_MOVES = 3;
export const REVEAL_AFTER_MS = 20_000;
/**
 * A knob move counts once the knob has been still this long, so a drag, a run of arrow-key
 * presses or a few quick − / + taps each count as one try, not one per decibel.
 */
export const MOVE_SETTLE_MS = 600;

export const isStep = (n: number): n is Step => Number.isInteger(n) && n >= 1 && n <= STEP_COUNT;

/**
 * Has the reader done what the step asks? Step 3 also wants the channel meter out of the red:
 * touching +12 cuts nothing yet, but leaves no room at all.
 */
export function goalMet(step: Step, r: Reading): boolean {
  if (step === 3) return r.crunch === 'clean' && r.howler === 'green' && r.mixer === 'clear';
  if (step === 4) return r.crunch === 'clean' && r.howler === 'green';
  return false;
}

/* ------------------------------------------------------------------------------------------ */
/* Which knob can fix which crunch                                                              */

/** The two controls, and the two places crunch is made. */
export type Fixer = 'channels' | 'knob';
export type Ceiling = 'mixer' | 'recorder';

/** The chain in the order the sound meets it: a control can only fix a ceiling that comes after it. */
const CHAIN_ORDER: ReadonlyArray<Fixer | Ceiling> = ['channels', 'mixer', 'knob', 'recorder'];

/** Can this control take the crunch out, by turning the level down before the ceiling that makes it? */
export const canFix = (fixer: Fixer, ceiling: Ceiling): boolean =>
  CHAIN_ORDER.indexOf(fixer) < CHAIN_ORDER.indexOf(ceiling);

export type Prediction = 'goes-away' | 'quieter-stays' | 'not-sure';
export type Confidence = 'guessing' | 'fairly-sure' | 'certain';

/* ------------------------------------------------------------------------------------------ */
/* Presets and deep links                                                                       */

export type PresetId = 'channels-red' | 'knob-high' | 'clean';

export interface Preset {
  id: PresetId;
  label: string;
  channels: number;
  knob: number;
  /** LED colour on the pad. */
  tone: 'red' | 'green';
}

export const PRESETS: readonly Preset[] = [
  { id: 'channels-red', label: 'Channels in the red', channels: 18, knob: -12, tone: 'red' },
  { id: 'knob-high', label: 'Record level too high', channels: 9, knob: 0, tone: 'red' },
  { id: 'clean', label: 'Channels tidy, level set', channels: 3, knob: -9, tone: 'green' },
];

export const presetById = (id: PresetId): Preset => PRESETS.find((p) => p.id === id)!;

export function matchingPreset(channels: number, knob: number): PresetId | null {
  return PRESETS.find((p) => p.channels === channels && p.knob === knob)?.id ?? null;
}

const isPresetId = (v: string | null): v is PresetId => PRESETS.some((p) => p.id === v);

/**
 * Read `?lab=sandbox&preset=channels-red`. A preset on its own also opens the sandbox, since
 * presets live there. Anything unknown is ignored.
 */
export function parseDeepLink(search: string): { sandbox: boolean; preset: PresetId | null } {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { sandbox: false, preset: null };
  }
  const preset = params.get('preset');
  const known = isPresetId(preset) ? preset : null;
  return { sandbox: params.get('lab') === 'sandbox' || known !== null, preset: known };
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

  const key = `${signal.kind}@${sampleRate}:${channels}:${knob}`;
  let match = matchCache.get(key);
  if (match === undefined) {
    match = loudnessMatchGain(samples, file, sampleRate);
    if (matchCache.size > 256) matchCache.clear();
    matchCache.set(key, match);
  }
  for (let i = 0; i < file.length; i++) file[i] = file[i]! * match;
  return file;
}
