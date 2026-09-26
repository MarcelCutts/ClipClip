/**
 * W6 "Turn it up afterwards": what recording low costs, and what recording over costs.
 *
 * Everything here is on the recording's own scale, dBFS: 0 is the top of the file and every real
 * level is below it. The reader sets where a loud track's peaks would land (−24 to +6), before any
 * blend or EQ boost adds to them. Above 0 the file can't hold them, so they are stored flat at 0.
 * Normalising turns the whole file up (or down) until its true peak sits at −1 dBTP, and
 * everything recorded in the file moves by the same amount: music, hiss and the recorder's own
 * noise together.
 *
 * Numbers come from the research (audio-science §2, §5, §10, §13; gear-facts §1.5, §1.6; and the
 * fact-checks, which win where they differ):
 * - XDJ-RX2 S/N 112 dB, A-weighted, "at rated output". Pioneer doesn't define rated output; we read
 *   it as the maximum (verify-audio-science A9, B4). On MASTER 1 and 2 the standard output level
 *   sits 18 dB under the rated one (+6 vs +24 dBu, +2 vs +20 dBu). BOOTH's rated level isn't
 *   published, so for the booth feed the 18 dB is an inference.
 * - Howler MK1 records 24-bit/48 kHz WAV and publishes no noise or input figures at all.
 * - A 24-bit file's own floor is about 144 dB under the top (6.02 dB per bit).
 */
import { hardClip, peak, peakIndex, scaled as scaledByGain } from '../dsp/analysis';
import { dbToGain, formatDb, gainToDb, speakDb } from '../dsp/db';
import { mixStems, normaliseLoop, renderLoop } from '../dsp/synth';
import { HOWLER_NOISE_GUESS_DBFS, KICKS_TOGETHER_DB, TARGET } from '../model';
import { RANGES } from '../xdj';

/** The "Recording peak" slider: a loud track's peak level relative to the top of the file. */
export const RECORD_RANGE = { min: -24, max: 6, step: 1 } as const;
export const DEFAULT_PEAK_DBFS = -12;

/**
 * Where the night's peaks should land in the file (audio-science §13; verify-audio-science B12):
 * a loud track around −12 dBFS, the loudest blend no higher than −6, quieter tracks down to about
 * −18. Taken from the record-level targets in model.ts, which the crew page uses too, so the two
 * pages can't disagree. −6 is a blend's ceiling, not a track's target: a track peaking there hits
 * the top of the file as soon as a blend adds its 6 dB.
 */
export const TARGET_BAND = { top: TARGET.blendMax, ideal: TARGET.normal, bottom: TARGET.band.bottom } as const;

/** What a blend adds when the kicks line up. Plan for the worst case (audio-science §2; verify A2). */
export const BLEND_DB = KICKS_TOGETHER_DB;

/**
 * What a bass boost can add on top: the XDJ-RX2's EQ maximum. On real tracks a full LOW boost
 * raises the peak a little less (verify-audio-science A3), so this is the cautious figure.
 */
export const BOOST_DB = RANGES.eq.max;

/** Normalise to a true-peak ceiling, not 0 dBFS (EBU R 128; AES TD1008; audio-science §10). */
export const NORMALISE_TO_DBTP = -1;

/**
 * The 24-bit file's own floor, as usually quoted (24 × 6.02 = 144.5 dB). It belongs to the file,
 * not the recording: a normalised copy saved as 24-bit has its floor here too.
 */
export const FLOOR_24_BIT_DBFS = -144;

/** XDJ-RX2 signal-to-noise from USB, A-weighted, "at rated output" (Quick Start Guide, spec table). */
export const XDJ_SN_DB = 112;
/**
 * Pioneer's "standard output level" sits this far under its "rated output level" on both master
 * outputs (+6 vs +24 dBu, +2 vs +20 dBu). BOOTH's rated level isn't published.
 */
export const XDJ_STANDARD_BELOW_RATED_DB = 18;
/**
 * So with the music at the standard level, the mixer's own hiss rides about this far under it.
 * The model treats the hiss as part of the signal the recorder receives, so it moves with the
 * music. Turning the recording down (MASTER ATT) after the point where the hiss is made would leave
 * the hiss where it is, a little closer to the music; the page's note says so.
 */
export const XDJ_HISS_BELOW_MUSIC_DB = XDJ_SN_DB - XDJ_STANDARD_BELOW_RATED_DB;

/** Where the recording's peaks sit relative to the target. */
export type Zone = 'low' | 'target' | 'hot' | 'over';

/**
 * The slider sets a loud track's peaks, so "target" runs from the bottom of the band up to the
 * loud-track target (−18 to −12 dBFS), where a blend and a bass boost still fit on top. Hotter
 * than that, up to the top of the file, is "hot"; past the top is "over".
 */
export function zoneFor(peakDbfs: number): Zone {
  if (peakDbfs > 0) return 'over';
  if (peakDbfs > TARGET_BAND.ideal) return 'hot';
  if (peakDbfs >= TARGET_BAND.bottom) return 'target';
  return 'low';
}

// ---------------------------------------------------------------------------------------------
// True peak

const phaseTables = new Map<string, Float64Array[]>();

/** Windowed-sinc interpolation coefficients for each in-between phase of an oversampler. */
function phases(oversample: number, halfTaps: number): Float64Array[] {
  const key = `${oversample}:${halfTaps}`;
  const cached = phaseTables.get(key);
  if (cached) return cached;
  const tables: Float64Array[] = [];
  for (let p = 1; p < oversample; p++) {
    const frac = p / oversample;
    const taps = new Float64Array(2 * halfTaps);
    let sum = 0;
    for (let k = 0; k < 2 * halfTaps; k++) {
      // Tap k weights sample (i - halfTaps + 1 + k) for a point `frac` after sample i.
      const t = k - halfTaps + 1 - frac;
      const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * t) / halfTaps);
      taps[k] = sinc * w;
      sum += taps[k]!;
    }
    for (let k = 0; k < taps.length; k++) taps[k] = taps[k]! / sum;
    tables.push(taps);
  }
  phaseTables.set(key, tables);
  return tables;
}

/**
 * The true peak of a signal, as a linear value: the highest point of the waveform the samples
 * describe, including the bulges between samples (ITU-R BS.1770 style, 4× oversampling with a
 * windowed-sinc interpolator, accurate to about 0.05 %). Points between samples are only checked
 * where the interpolator fits inside the signal, so a cut-off excerpt doesn't ring at its edges.
 */
export function truePeak(signal: ArrayLike<number>, oversample = 4, halfTaps = 12): number {
  const n = signal.length;
  const tables = phases(oversample, halfTaps);
  let top = peak(signal);
  // Only the neighbourhood of big samples can bulge past the current peak.
  const worth = top * 0.5;
  for (let i = halfTaps - 1; i < n - halfTaps; i++) {
    if (Math.abs(signal[i]!) < worth && Math.abs(signal[i + 1]!) < worth) continue;
    for (const taps of tables) {
      let y = 0;
      for (let k = 0; k < taps.length; k++) y += signal[i - halfTaps + 1 + k]! * taps[k]!;
      const a = Math.abs(y);
      if (a > top) top = a;
    }
  }
  return top;
}

// ---------------------------------------------------------------------------------------------
// The music: the loudest kick of synth track A, as recorded

/** Sample rate of the Howler's WAV files. */
export const RECORDER_SAMPLE_RATE = 48_000;
/** How much of the loudest kick we draw: from just before it to the fifth cycle. */
const WINDOW_BEFORE_MS = 1;
const WINDOW_AFTER_MS = 47;

let windowCache: Float32Array | null = null;

/**
 * A 48 ms stretch of track A around its loudest kick, scaled so its peak sample is 1.0: the level
 * the music "wanted" to reach. Rendered once and cached (about 15 ms).
 */
export function musicWindow(): Float32Array {
  if (windowCache) return windowCache;
  const loop = normaliseLoop(renderLoop({ sampleRate: RECORDER_SAMPLE_RATE, track: 'a', bars: 1 }), 0);
  const mix = mixStems(loop);
  // Start on the kick that makes the peak: the beat line just before it.
  const onset = Math.floor(peakIndex(mix) / loop.beatLength) * loop.beatLength;
  const from = Math.max(0, Math.round(onset - (WINDOW_BEFORE_MS / 1000) * RECORDER_SAMPLE_RATE));
  const to = Math.round(onset + (WINDOW_AFTER_MS / 1000) * RECORDER_SAMPLE_RATE);
  const out = mix.slice(from, to);
  const p = peak(out);
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / p;
  windowCache = out;
  return out;
}

/** The music as it reached the file: scaled to `peakDbfs` and cut flat at ±1.0 (0 dBFS). */
export function recorded(peakDbfs: number, music: Float32Array = musicWindow()): Float32Array {
  return hardClip(music, dbToGain(peakDbfs));
}

/** Scale a signal by a gain in dB. */
export const scaled = (signal: Float32Array, db: number): Float32Array => scaledByGain(signal, dbToGain(db));

const tpCache = new Map<number, number>();

/** True peak of the recorded file, in dBTP, for a given recording level. */
export function recordedTruePeakDb(peakDbfs: number): number {
  const hit = tpCache.get(peakDbfs);
  if (hit !== undefined) return hit;
  let result: number;
  if (peakDbfs <= 0) {
    // A clean recording scales linearly, so one measurement serves every level.
    const clean = tpCache.get(0) ?? gainToDb(truePeak(musicWindow()));
    tpCache.set(0, clean);
    result = clean + peakDbfs;
  } else {
    result = gainToDb(truePeak(recorded(peakDbfs)));
  }
  tpCache.set(peakDbfs, result);
  return result;
}

// ---------------------------------------------------------------------------------------------
// The whole picture for one setting

export interface HeadroomState {
  /** Slider value: where the music's peaks would land. */
  peak: number;
  zone: Zone;
  normalised: boolean;
  /** dB of each loud hit that didn't fit in the file (0 unless over). */
  lost: number;
  /** Room above the peaks before the file's top, as recorded (0 if over). */
  headroom: number;
  /** What Normalise does to the whole file, in dB (applied only when `normalised`). */
  normaliseGain: number;
  /** Gain applied to everything recorded in the file right now. */
  gain: number;
  /** Sample peak in the file now, dBFS. */
  filePeak: number;
  /** True peak of the file now, dBTP. */
  truePeak: number;
  /** Levels of everything recorded in the file, dBFS, after any gain. */
  levels: RecordedLevels;
}

export interface RecordedLevels {
  /** Where the music's peaks would be if nothing had cut them. */
  music: number;
  /** Where the peaks actually are in the file (flat at 0 dBFS, plus gain, when over). */
  peaks: number;
  xdjHiss: number;
  howlerTop: number;
  howlerBottom: number;
}

/** Everything recorded in the file, at a recording level, after a gain (dB) on the whole file. */
export function recordedLevels(peakDbfs: number, gain = 0): RecordedLevels {
  return {
    music: peakDbfs + gain,
    peaks: Math.min(peakDbfs, 0) + gain,
    xdjHiss: peakDbfs - XDJ_HISS_BELOW_MUSIC_DB + gain,
    // Howler publishes no noise figure: a deliberately wide guess, shared in lib/model.ts.
    howlerTop: HOWLER_NOISE_GUESS_DBFS.top + gain,
    howlerBottom: HOWLER_NOISE_GUESS_DBFS.bottom + gain,
  };
}

/**
 * How far the file's peaks sit above the nearest noise: the mixer's hiss or the Howler's own noise,
 * whichever is higher. A range, because the Howler's floor is a guess.
 */
export function roomToNoise(levels: RecordedLevels): { min: number; max: number } {
  const toHiss = levels.peaks - levels.xdjHiss;
  return {
    min: Math.min(toHiss, levels.peaks - levels.howlerTop),
    max: Math.min(toHiss, levels.peaks - levels.howlerBottom),
  };
}

export function headroom(peakDbfs: number, normalised: boolean): HeadroomState {
  const peak = Math.max(RECORD_RANGE.min, Math.min(RECORD_RANGE.max, peakDbfs));
  const recordedPeak = Math.min(peak, 0);
  const tp = recordedTruePeakDb(peak);
  const normaliseGain = NORMALISE_TO_DBTP - tp;
  const gain = normalised ? normaliseGain : 0;
  return {
    peak,
    zone: zoneFor(peak),
    normalised,
    lost: Math.max(0, peak),
    headroom: Math.max(0, -peak),
    normaliseGain,
    gain,
    filePeak: recordedPeak + gain,
    truePeak: tp + gain,
    levels: recordedLevels(peak, gain),
  };
}

// ---------------------------------------------------------------------------------------------
// Words

/** A level in the file, with its unit held on by formatDb's no-break space: "−12 dBFS". */
const dbfs = (db: number) => formatDb(db, { unit: 'dBFS' });
/** A size in dB, whole where it is whole ("4 dB"), otherwise to one decimal ("1.3 dB"). */
const db1 = (db: number) => {
  const v = Math.abs(db);
  const whole = Math.abs(v - Math.round(v)) < 0.05;
  return formatDb(v, { decimals: whole ? 0 : 1, signed: false });
};

/**
 * The recording level as the slider shows it. Above the top of the file there is no dBFS value
 * (a file can't hold +6 dBFS), so those read as how far over the peaks went: "6 dB over".
 */
export const peakLabel = (peakDbfs: number): string => (peakDbfs > 0 ? `${db1(peakDbfs)} over` : dbfs(peakDbfs));

const decibels = (n: number) => `${n} ${Math.abs(n) === 1 ? 'decibel' : 'decibels'}`;

/**
 * The slider's spoken value: the level, and the room it leaves above the peaks (or how far over
 * they went), so a screen reader hears each step's numbers from the slider itself.
 */
export function speakPeak(peakDbfs: number): string {
  if (peakDbfs > 0) return `peaks ${decibels(peakDbfs)} over the top of the file`;
  const unit = Math.abs(peakDbfs) === 1 ? 'decibel full scale' : 'decibels full scale';
  const level = `peaks at ${speakDb(peakDbfs, { unit })}`;
  return peakDbfs === 0 ? `${level}, nothing to spare` : `${level}, ${decibels(-peakDbfs)} to spare`;
}

/**
 * What the current setting means. The takeaway sentence is written from it, and the live region
 * speaks only when it changes, because the slider already speaks each step's numbers.
 * - room: a loud track with room for a blend and a bass boost on top (−18 to −12 dBFS)
 * - blend-only: room for a blend, but a boost on top of it could go over
 * - reaches-top: a blend would land exactly on the top of the file
 * - goes-over: a blend would go over
 */
export type Verdict = 'low' | 'room' | 'blend-only' | 'reaches-top' | 'goes-over' | 'over' | 'turned' | 'still-flat';

export function verdictFor(s: HeadroomState): Verdict {
  if (s.normalised) return s.zone === 'over' ? 'still-flat' : 'turned';
  if (s.zone === 'over') return 'over';
  if (s.zone === 'low') return 'low';
  if (s.headroom >= BLEND_DB + BOOST_DB) return 'room';
  if (s.headroom > BLEND_DB) return 'blend-only';
  if (Math.abs(s.headroom - BLEND_DB) < 1e-9) return 'reaches-top';
  return 'goes-over';
}

/**
 * The one sentence that sums up the current setting. Where the next step is worth testing (a
 * quiet file, a clipped one), it ends by suggesting Normalise. It promises room for a blend and a
 * boost only where both fit: a blend can add 6 dB, and a bass boost nearly another 6.
 */
export function takeaway(s: HeadroomState): string {
  const move = s.normaliseGain >= 0 ? `Turned up ${db1(s.normaliseGain)}` : `Turned down ${db1(s.normaliseGain)}`;
  switch (verdictFor(s)) {
    case 'still-flat':
      return `${move}, and the tops are still flat. Normalising can’t put the peaks back.`;
    case 'turned':
      return `${move}, hiss and all, so the noise still sits ${Math.round(roomToNoise(s.levels).min)}\u00a0dB or more under the music.`;
    case 'over':
      return `The peaks go ${db1(s.lost)} over the top. The file stops at ${dbfs(0)}, so every loud hit is stored flat. Try Normalise.`;
    case 'goes-over':
      return `Peaks at ${dbfs(s.peak)} are clean, but a blend adding ${db1(BLEND_DB)} would go over.`;
    case 'reaches-top':
      return `Peaks at ${dbfs(s.peak)} are clean, but a blend adding ${db1(BLEND_DB)} would reach the top, and any boost would clip.`;
    case 'blend-only':
      return `Peaks at ${dbfs(s.peak)} leave room for a blend, but a bass boost on top could go over, so aim nearer ${dbfs(TARGET_BAND.ideal)}.`;
    case 'room':
      return `Peaks at ${dbfs(s.peak)} leave ${db1(s.headroom)} spare. That fits a blend and a bass boost. Normalise afterwards.`;
    case 'low':
      return `Peaks at ${dbfs(s.peak)} are clean, but nearer the recorder’s own noise than they need to be. Try Normalise.`;
  }
}

/**
 * The chart's title: what it finds, with the numbers. At the loud-track target the music sits this
 * far above the nearest noise (a range, because the Howler's floor is a guess), which is why
 * recording that low costs nothing anyone can hear.
 */
export function finding(): string {
  const room = roomToNoise(recordedLevels(TARGET_BAND.ideal));
  const span =
    Math.round(room.min) === Math.round(room.max)
      ? `about ${db1(room.max)}`
      : `${Math.round(room.min)} to ${db1(Math.round(room.max))}`;
  return `Recorded at ${dbfs(TARGET_BAND.ideal)}, a loud track’s peaks still sit ${span} above the noise.`;
}

/** Short caption under the waveform: what it shows, and what to notice about its shape. */
export function waveCaption(s: HeadroomState): string {
  if (!s.normalised) return s.zone === 'over' ? 'Loudest kick, tops cut flat' : 'Loudest kick, as recorded';
  if (s.zone === 'over') return s.normaliseGain >= 0 ? 'Turned up, still flat' : 'Turned down, still flat';
  return s.normaliseGain >= 0 ? 'Turned up, same shape' : 'Turned down, same shape';
}

// ---------------------------------------------------------------------------------------------
// Label layout

/**
 * Spread labels along one axis so none overlap: each wants to sit centred on `at`, is `size`
 * tall, and must stay within `min`…`max`. Order is kept. Returns the centre for each label.
 */
export function spreadLabels(labels: ReadonlyArray<{ at: number; size: number }>, min: number, max: number): number[] {
  const items = labels.map((l, i) => ({ ...l, i })).sort((a, b) => a.at - b.at);
  interface Cluster {
    members: typeof items;
    size: number;
    /** Where the cluster starts (its first label's top edge). */
    start: number;
  }
  // A run of labels stacked edge to edge sits where its members are, on average, closest to home.
  const settle = (members: typeof items): Cluster => {
    let offset = 0;
    let sum = 0;
    for (const m of members) {
      sum += m.at - (offset + m.size / 2);
      offset += m.size;
    }
    return { members, size: offset, start: sum / members.length };
  };
  const clusters = items.map((m) => settle([m]));
  for (let k = 0; k < clusters.length - 1; ) {
    const a = clusters[k]!;
    const b = clusters[k + 1]!;
    if (a.start + a.size > b.start + 1e-9) {
      clusters.splice(k, 2, settle([...a.members, ...b.members]));
      k = Math.max(0, k - 1);
    } else {
      k++;
    }
  }
  // Lay them out, then keep everything inside the bounds without re-opening overlaps.
  const starts: number[] = [];
  const sizes: number[] = [];
  for (const c of clusters) {
    let at = c.start;
    for (const m of c.members) {
      starts.push(at);
      sizes.push(m.size);
      at += m.size;
    }
  }
  for (let k = 0; k < starts.length; k++) {
    const floor = k === 0 ? min : starts[k - 1]! + sizes[k - 1]!;
    starts[k] = Math.max(starts[k]!, floor);
  }
  for (let k = starts.length - 1; k >= 0; k--) {
    const ceiling = (k === starts.length - 1 ? max : starts[k + 1]!) - sizes[k]!;
    starts[k] = Math.min(starts[k]!, ceiling);
  }
  const out = new Array<number>(labels.length);
  items.forEach((m, k) => {
    out[m.i] = starts[k]! + sizes[k]! / 2;
  });
  return out;
}
