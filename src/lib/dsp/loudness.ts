/**
 * Loudness in LUFS, ITU-R BS.1770 style, for loudness-matching demos.
 *
 * Clipping makes a track denser, so a clipped version can sound "better" just because it is
 * louder. Before any clean/clipped comparison we match their loudness with this measure.
 * The loops here are short and continuous, so the measure is ungated.
 */

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** The two K-weighting stages for any sample rate (coefficients as derived for libebur128). */
function kWeighting(sampleRate: number): [Biquad, Biquad] {
  // Stage 1: high shelf, +4 dB above ~1.7 kHz, modelling the head.
  let f0 = 1681.974450955533;
  const gainDb = 3.999843853973347;
  let q = 0.7071752369554196;
  let k = Math.tan((Math.PI * f0) / sampleRate);
  const vh = 10 ** (gainDb / 20);
  const vb = vh ** 0.4996667741545416;
  let a0 = 1 + k / q + k * k;
  const shelf: Biquad = {
    b0: (vh + (vb * k) / q + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / q + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  };

  // Stage 2: high pass around 38 Hz ("RLB" weighting).
  f0 = 38.13547087602444;
  q = 0.5003270373238773;
  k = Math.tan((Math.PI * f0) / sampleRate);
  a0 = 1 + k / q + k * k;
  const highPass: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  };
  return [shelf, highPass];
}

/**
 * Mean-square of the K-weighted signal. The signal is treated as a loop: the filters run over it
 * twice and only the second pass is measured, so start-up transients don't count.
 */
export function kWeightedPower(signal: ArrayLike<number>, sampleRate: number): number {
  const stages = kWeighting(sampleRate);
  const n = signal.length;
  if (n === 0) return 0;
  const state = stages.map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0 }));
  let sum = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      let v = signal[i]!;
      for (let s = 0; s < stages.length; s++) {
        const c = stages[s]!;
        const z = state[s]!;
        const y = c.b0 * v + c.b1 * z.x1 + c.b2 * z.x2 - c.a1 * z.y1 - c.a2 * z.y2;
        z.x2 = z.x1;
        z.x1 = v;
        z.y2 = z.y1;
        z.y1 = y;
        v = y;
      }
      if (pass === 1) sum += v * v;
    }
  }
  return sum / n;
}

/** Ungated loudness of a mono loop in LUFS. */
export function loudnessLufs(signal: ArrayLike<number>, sampleRate: number): number {
  return -0.691 + 10 * Math.log10(kWeightedPower(signal, sampleRate) + 1e-20);
}

/** Linear gain that makes `target` as loud as `reference`. */
export function loudnessMatchGain(reference: ArrayLike<number>, target: ArrayLike<number>, sampleRate: number): number {
  const ref = kWeightedPower(reference, sampleRate);
  const tgt = kWeightedPower(target, sampleRate);
  return tgt > 0 ? Math.sqrt(ref / tgt) : 1;
}
