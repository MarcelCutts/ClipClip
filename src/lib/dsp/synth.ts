/**
 * A tiny deterministic synth for drums and a bass line, so every demo on the site uses sound we
 * made ourselves: no samples, no licences, identical on every device and in tests.
 *
 * A loop renders as three stems (low, mid, high) because that is how a DJ EQ thinks about
 * a track. Summing the stems gives the track. Every sound that runs past the end of the loop
 * wraps round to the start, so the loop plays back seamlessly.
 */
import { peak } from './analysis';

export interface Stems {
  /** Kick and bass line. What the LOW knob controls. */
  low: Float32Array;
  /** Claps and chord stabs. */
  mid: Float32Array;
  /** Hi-hats. */
  high: Float32Array;
}

export type TrackId = 'a' | 'b';

export interface LoopOptions {
  sampleRate: number;
  bpm?: number;
  bars?: number;
  /** Which of the two tracks to render. They share a key and a tempo, like a good blend. */
  track?: TrackId;
}

export interface Loop extends Stems {
  sampleRate: number;
  bpm: number;
  bars: number;
  /** Samples per beat, for lining up kicks. */
  beatLength: number;
  length: number;
}

/** Mulberry32: a small seeded PRNG, good enough for noise. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/** Add a rendered sound into a looped buffer, wrapping anything that runs off the end. */
function addWrapped(buffer: Float32Array, start: number, sound: Float32Array, gain = 1): void {
  const n = buffer.length;
  for (let i = 0; i < sound.length; i++) {
    const j = (start + i) % n;
    buffer[j] = buffer[j]! + sound[i]! * gain;
  }
}

/** Kick drum: a sine that sweeps down in pitch, with a short click on the front. */
function kick(sr: number, { top = 150, bottom = 47, sweep = 0.034, decay = 0.15, length = 0.42 } = {}, rand = prng(1)) {
  const n = Math.round(length * sr);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = bottom + (top - bottom) * Math.exp(-t / sweep);
    phase += (2 * Math.PI * f) / sr;
    const attack = Math.min(1, t / 0.0015);
    const body = Math.sin(phase) * attack * Math.exp(-t / decay);
    const click = (rand() * 2 - 1) * Math.exp(-t / 0.0012) * 0.12;
    out[i] = body + click;
  }
  return out;
}

/** State-variable filter, one sample at a time. Returns low-pass, band-pass and high-pass outputs. */
function svf(sr: number) {
  let low = 0;
  let band = 0;
  return (x: number, cutoff: number, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, sr / 6)) / sr);
    const damp = 1 / q;
    const high = x - low - damp * band;
    band += f * high;
    low += f * band;
    return { low, band, high };
  };
}

/** Band-limited sawtooth using polyBLEP, so high notes don't alias into mush. */
function sawOsc(sr: number) {
  let phase = 0;
  return (hz: number) => {
    const dt = hz / sr;
    phase += dt;
    if (phase >= 1) phase -= 1;
    let v = 2 * phase - 1;
    if (phase < dt) {
      const x = phase / dt;
      v -= x + x - x * x - 1;
    } else if (phase > 1 - dt) {
      const x = (phase - 1) / dt;
      v -= x * x + x + x + 1;
    }
    return v;
  };
}

/** Bass note: a filtered saw with a plucky envelope. */
function bassNote(sr: number, hz: number, { length = 0.22, cutoff = 420, env = 900, decay = 0.09 } = {}) {
  const n = Math.round((length + 0.03) * sr);
  const out = new Float32Array(n);
  const osc = sawOsc(sr);
  const sub = { phase: 0 };
  const filter = svf(sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const gate = t < length ? 1 : Math.exp(-(t - length) / 0.008);
    const amp = Math.min(1, t / 0.003) * gate * (0.55 + 0.45 * Math.exp(-t / decay));
    sub.phase += (2 * Math.PI * hz) / sr;
    const raw = osc(hz) * 0.6 + Math.sin(sub.phase) * 0.7;
    const { low } = filter(raw, cutoff + env * Math.exp(-t / 0.05), 0.9);
    out[i] = low * amp;
  }
  return out;
}

/** Hi-hat: bright noise with a fast decay. */
function hat(sr: number, rand: () => number, { decay = 0.022, length = 0.12 } = {}) {
  const n = Math.round(length * sr);
  const out = new Float32Array(n);
  const filter = svf(sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const { high } = filter(rand() * 2 - 1, 7500, 0.8);
    out[i] = high * Math.exp(-t / decay);
  }
  return out;
}

/** Clap: three quick bursts of band-passed noise and a short tail. */
function clap(sr: number, rand: () => number) {
  const n = Math.round(0.3 * sr);
  const out = new Float32Array(n);
  const filter = svf(sr);
  const bursts = [0, 0.009, 0.018];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let env = 0;
    for (const b of bursts) if (t >= b) env = Math.max(env, Math.exp(-(t - b) / 0.004));
    const last = bursts[bursts.length - 1]!;
    if (t >= last) env = Math.max(env, 0.45 * Math.exp(-(t - last) / 0.09));
    const { band } = filter(rand() * 2 - 1, 1300, 1.4);
    out[i] = band * env * 2.2;
  }
  return out;
}

/** Chord stab: detuned saws through a closing low-pass filter. */
function stab(sr: number, notes: number[], { length = 0.32, cutoff = 2200 } = {}) {
  const n = Math.round((length + 0.2) * sr);
  const out = new Float32Array(n);
  const voices = notes.flatMap((note) =>
    [-0.07, 0.07].map((detune) => ({ hz: midiToHz(note + detune), osc: sawOsc(sr) })),
  );
  const filter = svf(sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    for (const voice of voices) v += voice.osc(voice.hz);
    const amp = Math.min(1, t / 0.004) * Math.exp(-t / (length * 0.6));
    const { low } = filter(v / voices.length, 400 + cutoff * Math.exp(-t / 0.12), 1.1);
    out[i] = low * amp;
  }
  return out;
}

interface TrackDesign {
  kick: Parameters<typeof kick>[1];
  /** MIDI notes for the bass, one per off-beat eighth (4 per bar), repeated. */
  bass: number[];
  bassCutoff: number;
  /** 16th-note grid positions (0–15) that get a hat, and their levels. */
  hats: Array<[step: number, level: number]>;
  /** Chord stabs: [16th step within the bar, MIDI notes]. */
  stabs: Array<[step: number, notes: number[]]>;
  seed: number;
  levels: { kick: number; bass: number; hats: number; clap: number; stab: number };
}

// Both tracks sit in A minor at the same tempo, so they blend musically.
const TRACKS: Record<TrackId, TrackDesign> = {
  a: {
    kick: { top: 150, bottom: 47, sweep: 0.034, decay: 0.15 },
    bass: [33, 33, 33, 31, 33, 33, 36, 31],
    bassCutoff: 380,
    hats: [
      [2, 1],
      [6, 1],
      [10, 1],
      [14, 1],
    ],
    stabs: [[14, [57, 60, 64, 67]]],
    seed: 11,
    levels: { kick: 1, bass: 0.6, hats: 0.16, clap: 0.42, stab: 0.42 },
  },
  b: {
    kick: { top: 170, bottom: 50, sweep: 0.028, decay: 0.18 },
    bass: [45, 33, 45, 33, 43, 31, 45, 33],
    bassCutoff: 520,
    hats: Array.from({ length: 16 }, (_, s): [number, number] => [s, s % 4 === 2 ? 1 : 0.45]),
    stabs: [
      [3, [64, 67, 72]],
      [11, [62, 65, 69]],
    ],
    seed: 29,
    levels: { kick: 0.95, bass: 0.55, hats: 0.13, clap: 0.36, stab: 0.34 },
  },
};

/** Render one loop as stems. Peaks are not normalised; see `normaliseLoop`. */
export function renderLoop({ sampleRate: sr, bpm = 124, bars = 2, track = 'a' }: LoopOptions): Loop {
  const design = TRACKS[track];
  const rand = prng(design.seed);
  const beat = (60 / bpm) * sr;
  const sixteenth = beat / 4;
  const length = Math.round(beat * 4 * bars);
  const low = new Float32Array(length);
  const mid = new Float32Array(length);
  const high = new Float32Array(length);

  const kickSound = kick(sr, design.kick, rand);
  const clapSound = clap(sr, rand);
  const bassSounds = new Map<number, Float32Array>();

  for (let bar = 0; bar < bars; bar++) {
    for (let b = 0; b < 4; b++) {
      const beatIndex = bar * 4 + b;
      const at = Math.round(beatIndex * beat);
      addWrapped(low, at, kickSound, design.levels.kick);
      if (b === 1 || b === 3) addWrapped(mid, at, clapSound, design.levels.clap);

      const note = design.bass[beatIndex % design.bass.length]!;
      let sound = bassSounds.get(note);
      if (!sound) {
        sound = bassNote(sr, midiToHz(note), { cutoff: design.bassCutoff });
        bassSounds.set(note, sound);
      }
      addWrapped(low, Math.round(at + beat / 2), sound, design.levels.bass);
    }
    for (const [step, level] of design.hats) {
      addWrapped(high, Math.round(bar * beat * 4 + step * sixteenth), hat(sr, rand), design.levels.hats * level);
    }
    for (const [step, notes] of design.stabs) {
      addWrapped(mid, Math.round(bar * beat * 4 + step * sixteenth), stab(sr, notes), design.levels.stab);
    }
  }

  return { low, mid, high, sampleRate: sr, bpm, bars, beatLength: beat, length };
}

/** Sum stems into a single track, with optional per-stem gains (linear). */
export function mixStems(stems: Stems, gains: { low?: number; mid?: number; high?: number } = {}): Float32Array {
  const { low = 1, mid = 1, high = 1 } = gains;
  const out = new Float32Array(stems.low.length);
  for (let i = 0; i < out.length; i++) out[i] = stems.low[i]! * low + stems.mid[i]! * mid + stems.high[i]! * high;
  return out;
}

/** Scale all stems together so the summed track peaks at `peakDbfs` (a mastered track sits near −1). */
export function normaliseLoop<T extends Stems>(loop: T, peakDbfs = -1): T {
  const p = peak(mixStems(loop));
  if (p === 0) return loop;
  const g = 10 ** (peakDbfs / 20) / p;
  for (const stem of [loop.low, loop.mid, loop.high]) for (let i = 0; i < stem.length; i++) stem[i] = stem[i]! * g;
  return loop;
}
