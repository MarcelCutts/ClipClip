import { describe, expect, it } from 'vitest';
import { mixStems, normaliseLoop, renderLoop } from '../dsp/synth';
import { analogue } from './analogue';
import { ClipCheck, type ClipCheckOptions, type ClipCheckResult } from './analyse';
import { clock, dbfs, duration, formatReport } from './report';
import { decodeSamples, encodeWav24, readWavInfo } from './wav';

const SR = 48000;
const db = (d: number) => 10 ** (d / 20);
const INFO = { sampleRate: SR, bits: 24, float: false, channels: 2, truncated: false };

/** Half a minute of the site's two synth tracks, taking turns, peaking at full scale. */
function music(seconds = 30): Float32Array {
  const tracks = (['a', 'b'] as const).map((track) =>
    mixStems(normaliseLoop(renderLoop({ sampleRate: SR, bars: 4, track }), 0)),
  );
  const out = new Float32Array(seconds * SR);
  for (let i = 0; i < out.length; i++) {
    const t = tracks[Math.floor(i / (10 * SR)) % 2]!;
    out[i] = t[i % t.length]!;
  }
  return out;
}

const scaled = (x: Float32Array, gain: number, ceiling = Number.POSITIVE_INFINITY) =>
  x.map((v) => Math.max(-ceiling, Math.min(ceiling, v * gain)));

const sine = (hz: number, dbfs: number, seconds: number) =>
  Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => db(dbfs) * Math.sin((2 * Math.PI * hz * i) / SR));

/** A 100 Hz sine driven 3 times past a ceiling, turned down so the ceiling sits at `dbfs`. */
const clippedSine = (dbfs: number, seconds: number) =>
  sine(100, 0, seconds).map((v) => Math.max(-1, Math.min(1, 3 * v)) * db(dbfs));

/**
 * A sawtooth bass note through a synth's low-pass filter (one or two poles at `cutoff`), peaking at
 * `dbfs`. It is summed from its harmonics, so its ramp is an exact straight line. Nothing in it is clipped.
 */
function saw(hz: number, cutoff: number, poles: 1 | 2, dbfs: number, seconds: number): Float32Array {
  const out = new Float64Array(Math.round(seconds * SR));
  for (let k = 1; k * hz < 20000; k++) {
    const w = (k * hz) / cutoff;
    const re = poles === 1 ? 1 : 1 - w * w;
    const im = poles === 1 ? w : w * Math.SQRT2;
    const gain = 1 / (k * Math.hypot(re, im));
    const phase = -Math.atan2(im, re);
    const step = (2 * Math.PI * k * hz) / SR;
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + gain * Math.sin(step * i + phase);
  }
  const top = out.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
  return Float32Array.from(out, (v) => (v / top) * db(dbfs));
}

/** The same samples in 16 bits, as a 16-bit file holds them. */
const in16Bits = (x: Float32Array) => x.map((v) => Math.max(-32768, Math.min(32767, Math.round(v * 32768))) / 32768);

function join(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function check(mono: Float32Array, options: ClipCheckOptions = {}) {
  const stereo = new Float32Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) stereo[2 * i] = stereo[2 * i + 1] = mono[i]!;
  const c = new ClipCheck(SR, 2, options);
  for (let i = 0; i < stereo.length; i += 65536) c.push(stereo.subarray(i, i + 65536));
  return c.finish();
}

const report = (r: ClipCheckResult) => formatReport('set.wav', INFO, r);
const peakOf = (x: Float32Array) => x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);

describe('the clip check', () => {
  const set = music();
  const top = peakOf(set);

  it('finds no clipping in a clean recording', () => {
    const r = check(analogue(scaled(set, db(-12) / top)));
    expect(r.verdict).toBe('none');
    expect(r.runs.count).toBe(0);
    expect(r.piles).toEqual([]);
    expect(r.levels.typicalDb).toBeGreaterThan(-13);
  });

  it('finds the recorder clipping: runs of samples at full scale', () => {
    const r = check(analogue(scaled(set, db(3) / top)));
    expect(r.verdict).toBe('runs');
    expect(r.runs.count).toBeGreaterThan(10);
    expect(r.peakDb).toBeGreaterThan(-0.1);
    expect(report(r)).toContain('Verdict: clipped at full scale.');
  });

  it('finds tops flattened before the recorder, and the level they were flattened at', () => {
    // The mix pushed 4 dB past the mixer's ceiling, then turned down so the ceiling lands at −8 dBFS.
    const r = check(analogue(scaled(scaled(set, db(4) / top, 1), db(-8)), { hz: 3.7 }));
    expect(r.verdict).toBe('pile');
    expect(r.runs.count).toBe(0);
    const [pile] = r.piles;
    expect(pile?.atTop).toBe(true);
    expect(Math.abs((pile?.levelDb ?? 0) + 8)).toBeLessThan(0.3);
    expect(pile?.tops).toBeGreaterThan(0);
    expect(pile?.bottoms).toBeGreaterThan(0);
  });

  it('doesn’t call tracks clipped in their own mastering, at different levels, a pile', () => {
    // Five tracks mastered with flat tops, played at different levels, and a clean one played
    // louder, as the loudest moments of a night usually are.
    const gains = [-14, -11, -15, -12, -13];
    const segment = set.length / (gains.length + 1);
    const clipped = scaled(set, db(3) / top, 1);
    const night = set.map((v, i) => {
      const k = Math.floor(i / segment);
      return k < gains.length ? clipped[i]! * db(gains[k]!) : (v / top) * db(-8);
    });
    const r = check(analogue(night));
    expect(r.verdict).toBe('none');
    expect(r.flatTops.count).toBeGreaterThan(0);
    expect(report(r)).toContain('spread over many levels');
  });

  it('reports one track’s flat tops at the top of a short file, and says it could be the track', () => {
    const r = check(analogue(scaled(scaled(set.subarray(0, 10 * SR), db(3) / top, 1), db(-9))));
    expect(r.verdict).toBe('pile');
    expect(report(r)).toContain('a track with flat tops of its own');
  });

  it('doesn’t take a sine’s rounded top for a flat one', () => {
    const sine = new Float32Array(20 * SR).map((_, i) => db(-10) * Math.sin((2 * Math.PI * 25 * i) / SR));
    expect(check(analogue(sine)).flatTops.count).toBe(0);
  });

  it('does not take a sawtooth’s ramp for a flat top', () => {
    // A bass note alone, as a breakdown has it: a straight ramp up to every peak, and nothing clipped.
    const notes = [
      [41.2, 1000, 2],
      [55, 2000, 2],
      [82.4, 4000, 1],
      [110, 1000, 2],
    ] as const;
    for (const [hz, cutoff, poles] of notes) {
      const r = check(analogue(saw(hz, cutoff, poles, -8, 2)));
      expect(r.verdict).toBe('none');
      expect(r.piles).toEqual([]);
    }
    // The same note backwards: its ramp now falls away from each peak, as a sagging top does, only far faster.
    expect(check(analogue(saw(55, 2000, 2, -8, 2).reverse())).verdict).toBe('none');
  });

  it('finds no clipping in a clean set with a bass-only breakdown', () => {
    const clean = scaled(set.subarray(0, 10 * SR), db(-12) / top);
    const r = check(analogue(join(clean, saw(55, 2000, 2, -18, 4), clean)));
    expect(r.verdict).toBe('none');
    expect(report(r)).toContain('Verdict: no clipping found.');
  });

  it('still finds flattened tops whatever the corner of the analogue stages’ coupling', () => {
    // The corner sets how fast a flat top sags: 2, 10 and 20 Hz, with 3.7 Hz above.
    for (const hz of [2, 10, 20]) {
      const r = check(analogue(scaled(scaled(set, db(4) / top, 1), db(-8)), { hz }));
      expect(r.verdict).toBe('pile');
      const [pile] = r.piles;
      expect(pile?.atTop).toBe(true);
      expect(Math.abs((pile?.levelDb ?? 0) + 8)).toBeLessThan(0.75);
    }
  });

  it('does not take the rounding in a 16-bit file for clipping', () => {
    // In 16 bits a clean bass note's top rounds to one value for several samples in a row, more of them the
    // lower the note and the lower its level.
    const tones = [
      [30, -0.05],
      [30, -12],
      [20, -6],
    ] as const;
    for (const [hz, level] of tones) {
      const r = check(in16Bits(sine(hz, level, 2)));
      expect(r.verdict).toBe('none');
      expect(r.runs.count).toBe(0);
    }
  });

  it('still finds a 16-bit file that clipped, and says how long a run it looked for', () => {
    // A converter that clipped holds its value far longer than rounding can.
    const r = check(in16Bits(sine(100, 0, 2).map((v) => Math.max(-1, Math.min(1, 3 * v)))));
    expect(r.verdict).toBe('runs');
    expect(r.runs.minSamples).toBe(7);
    expect(report(r)).toContain('7 or more samples in a row sit at full scale');
    // A 24-bit file's steps are 256 times finer: three in a row is still a run.
    expect(check(analogue(scaled(set, db(3) / top))).runs.minSamples).toBe(3);
  });

  it('finds no clipping in a clean sine just under full scale', () => {
    // A 50 Hz sine peaking at −0.05 dBFS, in 24-bit samples, stays within 0.09 dB of full scale for
    // several samples at every peak, and no sample repeats.
    const r = check(sine(50, -0.05, 2).map((v) => Math.round(v * 8388608) / 8388608));
    expect(r.verdict).toBe('none');
    expect(r.runs.count).toBe(0);
  });

  it('finds the recorder’s clipping in a copy normalised to −1 dBFS', () => {
    const recorded = analogue(scaled(set, db(3) / top));
    const gain = db(-1) / peakOf(recorded);
    const copy = recorded.map((v) => Math.round(v * gain * 8388608) / 8388608);
    const r = check(copy);
    expect(r.verdict).toBe('runs');
    expect(r.runs.count).toBe(check(recorded).runs.count);
    expect(r.runs.levelDb).toBeCloseTo(-1, 2);
    const text = report(r);
    expect(text).toContain('Verdict: clipped at the file’s peak.');
    expect(text).toContain('sit at the file’s peak, −1.0 dBFS');
    expect(text).toContain('If this is a normalised copy of the Howler’s file, the Howler’s input clipped.');
  });

  it('finds a pile of flat tops below a louder, clean ending', () => {
    // A sine clipped and turned down to −12 dBFS, then a clean one at −4 dBFS: as built, and on
    // its way through the analogue stages.
    const built = join(clippedSine(-12, 10), sine(100, -4, 1));
    for (const x of [built, analogue(built)]) {
      const r = check(x);
      expect(r.verdict).toBe('pile');
      const [pile] = r.piles;
      expect(pile?.atTop).toBe(false);
      expect(Math.abs((pile?.levelDb ?? 0) + 12)).toBeLessThan(0.3);
      const text = report(r);
      expect(text).toContain('Verdict: flat tops at one level, below full scale.');
      expect(text).toMatch(/pile up at −1[12]\.\d dBFS, [78]\.\d dB below the top of the file, from 0:00 to 0:09\./);
      expect(text).toContain('or a channel in the red with its fader down');
      expect(text).not.toContain('no clipping found');
    }
  });

  it('names only the tops when only the tops are flat', () => {
    const r = check(analogue(sine(100, 0, 2).map((v) => (v > 0 ? Math.min(2 * v, 0.4) : 0.1 * v))));
    expect(r.verdict).toBe('pile');
    expect(r.piles[0]?.bottoms).toBe(0);
    const text = report(r);
    expect(text).toMatch(/Only the tops are flat \(\d+\)\./);
    expect(text).not.toContain('bottoms');
  });

  it('counts past the examples it keeps, and comes to the same answer', () => {
    // A long stretch clipped at −12 dBFS, then the same 6 dB louder: more flat tops than the cap.
    const x = analogue(join(clippedSine(-12, 20), clippedSine(-6, 5)));
    const full = check(x);
    const capped = check(x, { maxEvents: 100 });
    expect(full.flatTops.count).toBeGreaterThan(1000);
    expect(capped.flatTops.events).toHaveLength(100);
    const counts = (r: ClipCheckResult) => ({
      ...r,
      runs: { ...r.runs, events: [] },
      flatTops: { ...r.flatTops, events: [] },
    });
    expect(counts(capped)).toEqual(counts(full));
    expect(full.piles.map((p) => Math.round(p.levelDb))).toEqual([-6, -12]);
  });

  it('keeps the evidence it found as the file goes on', () => {
    // The review found the verdict flip to clean once a long clipped stretch filled the store.
    let before = 0;
    for (const seconds of [10, 20, 40]) {
      const r = check(analogue(join(clippedSine(-12, seconds), clippedSine(-6, 5))), { maxEvents: 100 });
      expect(r.verdict).toBe('pile');
      const pile = r.piles.find((p) => Math.round(p.levelDb) === -12);
      expect(pile?.count).toBeGreaterThan(before);
      before = pile?.count ?? 0;
      expect(r.minutes.reduce((n, m) => n + m.atPile, 0)).toBe(r.piles.reduce((n, p) => n + p.count, 0));
    }
  });

  it('gives the times of a long pile, and leaves the cause to the listener', () => {
    // One sound flattened at one level, on and off for 7.5 minutes: one long track can do that.
    const burst = analogue(clippedSine(-9, 2));
    const gap = (seconds: number) => new Float32Array(seconds * SR);
    const c = new ClipCheck(SR, 1);
    for (const part of [burst, gap(118), burst, gap(118), burst, gap(118), burst, gap(86), burst]) c.push(part);
    const r = c.finish();
    expect(r.verdict).toBe('pile');
    expect(r.piles[0]).toMatchObject({ atTop: true, stretches: 1 });
    const text = report(r);
    expect(text).toContain('from 0:00 to 7:29');
    expect(text).toContain('That can be a track with flat tops of its own, or the mixer in the red.');
    expect(text).toContain('If the same level comes back in other DJs’ sets, the ceiling is in the rig');
    expect(text).not.toContain('track after track');
  });

  it('says a very quiet file is too quiet to check', () => {
    const r = check(analogue(scaled(set, db(-50) / top)));
    expect(r.verdict).toBe('too-quiet');
    const text = report(r);
    expect(text).toContain('Verdict: too quiet to check.');
    expect(text).toContain('Every second peaks below −30 dBFS.');
    expect(text).not.toContain('No music');
  });
});

describe('reading WAV files', () => {
  const bytesReader = (bytes: Uint8Array) => async (offset: number, length: number) =>
    bytes.subarray(offset, Math.min(bytes.length, offset + length));

  it('reads back 24-bit samples to within one step', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 0.25, -1, 8388607 / 8388608]);
    const file = encodeWav24(samples, 2, SR);
    const info = await readWavInfo(bytesReader(file), file.length);
    expect(info).toMatchObject({ sampleRate: SR, channels: 2, bits: 24, float: false, frames: 3, truncated: false });
    const decoded = decodeSamples(file.subarray(info.dataOffset, info.dataOffset + info.dataBytes), info);
    for (const [i, v] of decoded.entries()) expect(Math.abs(v - samples[i]!)).toBeLessThanOrEqual(1 / 8388608);
  });

  it('reads a recording cut off before its length was written, to the end of the file', async () => {
    const file = encodeWav24(new Float32Array(SR * 2), 2, SR);
    new DataView(file.buffer).setUint32(40, 0, true);
    const info = await readWavInfo(bytesReader(file), file.length);
    expect(info.truncated).toBe(true);
    expect(info.frames).toBe(SR);
  });

  it('says plainly when a file isn’t a WAV', async () => {
    const text = new TextEncoder().encode('ID3 this is an mp3 file, honest');
    await expect(readWavInfo(bytesReader(text), text.length)).rejects.toThrow('Not a WAV file');
  });
});

describe('the report', () => {
  it('writes levels and times the way the guide does', () => {
    expect(dbfs(-7.94)).toBe('−7.9 dBFS');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(754)).toBe('12:34');
  });

  it('rounds a length to whole minutes, and never writes 60 of them', () => {
    expect(duration(45)).toBe('45 s');
    expect(duration(59)).toBe('59 s');
    expect(duration(59.7)).toBe('1 min');
    expect(duration(89)).toBe('1 min');
    expect(duration(3569)).toBe('59 min');
    expect(duration(3599)).toBe('1 h 0 min');
    expect(duration(7199)).toBe('2 h 0 min');
    expect(duration(11_520)).toBe('3 h 12 min');
    expect(duration(14_913)).toBe('4 h 9 min');
  });

  it('does not call a sample past every level silence', () => {
    // Only a float file can hold an infinite sample.
    expect(dbfs(Number.POSITIVE_INFINITY)).toBe('infinite');
    expect(dbfs(Number.NEGATIVE_INFINITY)).toBe('silence');
  });

  it('leads with the verdict', () => {
    const set = music(20);
    const r = check(analogue(scaled(scaled(set, db(4) / peakOf(set), 1), db(-8))));
    const text = report(r);
    expect(text.split('\n').slice(0, 4).join('\n')).toContain('Verdict: flat tops at one level, below full scale.');
    expect(text).toMatch(/flat tops pile up at −(7\.[89]|8\.[01]) dBFS/);
    expect(text).toContain('listen at');
  });
});
