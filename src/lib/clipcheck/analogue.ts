/**
 * What happens between the mixer and a file, as the clip check's tests and its calibration model
 * it: AC coupling (a high-pass at `hz`), the converters' low-pass filters, a little noise, and
 * 24-bit samples that stop at full scale. Samples are interleaved, `channels` to a frame.
 */
import { prng } from '../dsp/synth';

export interface AnalogueOptions {
  sampleRate?: number;
  channels?: number;
  /** The AC coupling's corner, in Hz. */
  hz?: number;
  /** Seeds the noise, so a run can be repeated exactly. */
  seed?: number;
}

/** The converters' low-pass: a 31-tap Blackman-windowed sinc at 20 kHz, summing to 1. */
function lowPass(sampleRate: number): Float64Array {
  const taps = 31;
  const fc = 20000 / sampleRate;
  const h = Array.from({ length: taps }, (_, n) => {
    const m = n - (taps - 1) / 2;
    const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    return (
      sinc * (0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (taps - 1)))
    );
  });
  const sum = h.reduce((s, v) => s + v, 0);
  return Float64Array.from(h, (v) => v / sum);
}

export function analogue(
  x: Float32Array,
  { sampleRate = 48000, channels = 1, hz = 2, seed = 9 }: AnalogueOptions = {},
): Float32Array {
  const a = Math.exp((-2 * Math.PI * hz) / sampleRate);
  const hp = new Float32Array(x.length);
  for (let ch = 0; ch < channels; ch++) {
    for (let i = ch, px = 0, py = 0; i < x.length; i += channels) {
      py = a * (py + x[i]! - px);
      px = x[i]!;
      hp[i] = py;
    }
  }
  const h = lowPass(sampleRate);
  const noise = 10 ** (-95 / 20);
  const rand = prng(seed);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    // The filter reaches back over the samples there are: all its taps once the file is under way.
    const taps = Math.min(h.length, Math.floor(i / channels) + 1);
    let y = 0;
    for (let n = 0; n < taps; n++) y += h[n]! * hp[i - n * channels]!;
    y += noise * (rand() + rand() + rand() - 1.5);
    out[i] = Math.max(-8388608, Math.min(8388607, Math.round(y * 8388608))) / 8388608;
  }
  return out;
}
