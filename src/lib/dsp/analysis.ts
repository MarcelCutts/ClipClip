/** Sample-level helpers the models share: peaks, the ceiling at ±1, and gain. */

/** Largest absolute sample value. */
export function peak(signal: ArrayLike<number>): number {
  let p = 0;
  for (let i = 0; i < signal.length; i++) {
    const v = Math.abs(signal[i]!);
    if (v > p) p = v;
  }
  return p;
}

/** Where the largest absolute sample sits: the first of any ties, and 0 for silence. */
export function peakIndex(signal: ArrayLike<number>): number {
  let at = 0;
  let p = 0;
  for (let i = 0; i < signal.length; i++) {
    const v = Math.abs(signal[i]!);
    if (v > p) {
      p = v;
      at = i;
    }
  }
  return at;
}

/** Number of samples sitting at (or beyond) the ceiling, the tell-tale of flat tops. */
export function countAtCeiling(signal: ArrayLike<number>, ceiling = 1, tolerance = 1e-9): number {
  let n = 0;
  for (let i = 0; i < signal.length; i++) if (Math.abs(signal[i]!) >= ceiling - tolerance) n++;
  return n;
}

export interface FlatRun {
  /** First sample of the run, counted from where the search started. */
  start: number;
  /** Last sample of the run, counted the same way. */
  end: number;
  /** +1 for a flat top, −1 for a flat bottom. */
  sign: 1 | -1;
}

/**
 * Runs of at least `minLength` samples sitting at (or beyond) the ceiling, in order. Reads `count`
 * samples from `start`, wrapping round (our signals loop), so a window may begin before sample 0.
 */
export function runsAtCeiling(
  signal: ArrayLike<number>,
  ceiling = 1,
  tolerance = 1e-9,
  { start = 0, count = signal.length, minLength = 1 }: { start?: number; count?: number; minLength?: number } = {},
): FlatRun[] {
  const runs: FlatRun[] = [];
  const n = signal.length;
  const level = ceiling - tolerance;
  let from = -1;
  let sign: 1 | -1 = 1;
  const close = (end: number) => {
    if (from >= 0 && end - from >= minLength) runs.push({ start: from, end: end - 1, sign });
    from = -1;
  };
  for (let i = 0; i < count; i++) {
    const v = signal[(((start + i) % n) + n) % n]!;
    const s: 0 | 1 | -1 = v >= level ? 1 : v <= -level ? -1 : 0;
    if (s === 0) {
      close(i);
    } else if (from < 0 || s !== sign) {
      close(i);
      from = i;
      sign = s;
    }
  }
  close(count);
  return runs;
}

/** Hard clip at ±1: the mixer's ceiling in the site's model (the red LED, see xdj.ts). */
export const clip = (v: number): number => (v > 1 ? 1 : v < -1 ? -1 : v);

/** `signal × gain`, hard-clipped at ±1 the way a digital mixer clips (no oversampling). */
export function hardClip(signal: ArrayLike<number>, gain: number): Float32Array {
  const out = new Float32Array(signal.length);
  for (let i = 0; i < out.length; i++) out[i] = clip(signal[i]! * gain);
  return out;
}

/** `signal × gain`, as a new buffer. */
export function scaled(signal: ArrayLike<number>, gain: number): Float32Array {
  const out = new Float32Array(signal.length);
  for (let i = 0; i < out.length; i++) out[i] = signal[i]! * gain;
  return out;
}
