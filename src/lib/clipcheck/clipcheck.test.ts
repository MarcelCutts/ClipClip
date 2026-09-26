import { describe, expect, it } from 'vitest';
import { mixStems, normaliseLoop, prng, renderLoop } from '../dsp/synth';
import { ClipCheck } from './analyse';
import { clock, dbfs, formatReport } from './report';
import { decodeSamples, encodeWav24, readWavInfo } from './wav';

const SR = 48000;
const db = (d: number) => 10 ** (d / 20);

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

/**
 * What happens between the mixer and a file: AC coupling (a high-pass at `hz`), the converters'
 * low-pass filters, a little noise, and 24-bit samples that stop at full scale.
 */
function analogue(x: Float32Array, hz = 2): Float32Array {
  const a = Math.exp((-2 * Math.PI * hz) / SR);
  const hp = new Float32Array(x.length);
  for (let i = 0, px = 0, py = 0; i < x.length; i++) {
    py = a * (py + x[i]! - px);
    px = x[i]!;
    hp[i] = py;
  }
  const taps = 31;
  const h = Array.from({ length: taps }, (_, n) => {
    const m = n - (taps - 1) / 2;
    const sinc = m === 0 ? 2 * (20000 / SR) : Math.sin(2 * Math.PI * (20000 / SR) * m) / (Math.PI * m);
    return (
      sinc * (0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (taps - 1)))
    );
  });
  const sum = h.reduce((s, v) => s + v, 0);
  const rand = prng(9);
  return hp.map((_, i) => {
    let y = 0;
    for (let n = 0; n < taps && n <= i; n++) y += (h[n]! / sum) * hp[i - n]!;
    y += db(-95) * (rand() + rand() + rand() - 1.5);
    return Math.max(-8388608, Math.min(8388607, Math.round(y * 8388608))) / 8388608;
  });
}

function check(mono: Float32Array) {
  const stereo = new Float32Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) stereo[2 * i] = stereo[2 * i + 1] = mono[i]!;
  const c = new ClipCheck(SR, 2);
  for (let i = 0; i < stereo.length; i += 65536) c.push(stereo.subarray(i, i + 65536));
  return c.finish();
}

const peakOf = (x: Float32Array) => x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);

describe('the clip check', () => {
  const set = music();
  const top = peakOf(set);

  it('calls a clean recording clean', () => {
    const r = check(analogue(scaled(set, db(-12) / top)));
    expect(r.verdict).toBe('clean');
    expect(r.overloads.count).toBe(0);
    expect(r.ceiling).toBeUndefined();
    expect(r.levels.typicalDb).toBeGreaterThan(-13);
  });

  it('finds the recorder overloading: runs of samples at full scale', () => {
    const r = check(analogue(scaled(set, db(3) / top)));
    expect(r.verdict).toBe('recorder');
    expect(r.overloads.count).toBeGreaterThan(10);
    expect(r.peakDb).toBeGreaterThan(-0.1);
  });

  it('finds tops flattened before the recorder, and the level they were flattened at', () => {
    // The mix pushed 4 dB past the mixer's ceiling, then turned down so the ceiling lands at −8 dBFS.
    const r = check(analogue(scaled(scaled(set, db(4) / top, 1), db(-8)), 3.7));
    expect(r.verdict).toBe('before-recorder');
    expect(r.overloads.count).toBe(0);
    expect(r.ceiling?.levelDb).toBeCloseTo(-8, 0);
    expect(Math.abs((r.ceiling?.levelDb ?? 0) + 8)).toBeLessThan(0.3);
    expect(r.ceiling?.tops).toBeGreaterThan(0);
    expect(r.ceiling?.bottoms).toBeGreaterThan(0);
  });

  it('doesn’t call tracks clipped in their own mastering, at different levels, a ceiling', () => {
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
    expect(r.verdict).toBe('clean');
    expect(r.flatTops.count).toBeGreaterThan(0);
  });

  it('reports one track’s flat tops at the top of a short file, and says it could be the track', () => {
    const r = check(analogue(scaled(scaled(set.subarray(0, 10 * SR), db(3) / top, 1), db(-9))));
    expect(r.verdict).toBe('before-recorder');
    const text = formatReport(
      'one-track.wav',
      { sampleRate: SR, bits: 24, float: false, channels: 2, truncated: false },
      r,
    );
    expect(text).toContain('one track mastered with flat tops of its own');
  });

  it('doesn’t take a sine’s rounded top for a flat one', () => {
    const sine = new Float32Array(20 * SR).map((_, i) => db(-10) * Math.sin((2 * Math.PI * 25 * i) / SR));
    expect(check(analogue(sine)).flatTops.count).toBe(0);
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

  it('leads with the verdict', () => {
    const set = music(20);
    const r = check(analogue(scaled(scaled(set, db(4) / peakOf(set), 1), db(-8))));
    const text = formatReport('set.wav', { sampleRate: SR, bits: 24, float: false, channels: 2, truncated: false }, r);
    expect(text.split('\n').slice(0, 4).join('\n')).toContain('Verdict: clipped before the recorder.');
    expect(text).toMatch(/flat tops sit at −(7\.[89]|8\.[01]) dBFS/);
    expect(text).toContain('listen at');
  });
});
