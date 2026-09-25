/**
 * ISO 226:2023, normal equal-loudness-level contours for pure tones.
 *
 * Two formulas from the standard:
 * - Formula (1), `splForPhon`: the sound pressure level a tone needs to sound as loud as a
 *   1 kHz tone at a given loudness level (phon).
 * - Formula (2), `phonForSpl`: the loudness level of a tone played at a given sound pressure level.
 *
 * Parameters come from the standard's Table 1, at the preferred one-third-octave frequencies
 * from 20 Hz to 12.5 kHz. Between those frequencies we interpolate the parameters linearly in
 * log frequency. That is our approximation, not part of the standard.
 *
 * Valid range: from 20 phon up to 90 phon (20 Hz to 4 kHz) or 80 phon (5 kHz to 12.5 kHz). The
 * standard calls results outside that "informative" only, because the data run out. The functions
 * still compute them; use `inValidRange` before presenting a number as the standard's.
 *
 * Conditions: frontal free-field listening, otologically normal listeners aged 18 to 25. Pure
 * tones only: the loudness of music needs other models (ISO 532), so anything built on this is a
 * pure-tone model and should say so.
 */

export interface Iso226Parameters {
  /** Exponent for loudness perception, αf. */
  alpha: number;
  /** Magnitude of the linear transfer function normalised at 1 kHz, LU, in dB. */
  lu: number;
  /** Threshold of hearing, Tf, in dB SPL. */
  tf: number;
}

export interface Iso226Row extends Iso226Parameters {
  hz: number;
}

/** ISO 226:2023 Table 1. */
export const ISO226_TABLE: readonly Iso226Row[] = [
  { hz: 20, alpha: 0.635, lu: -31.5, tf: 78.1 },
  { hz: 25, alpha: 0.602, lu: -27.2, tf: 68.7 },
  { hz: 31.5, alpha: 0.569, lu: -23.1, tf: 59.5 },
  { hz: 40, alpha: 0.537, lu: -19.3, tf: 51.1 },
  { hz: 50, alpha: 0.509, lu: -16.1, tf: 44.0 },
  { hz: 63, alpha: 0.482, lu: -13.1, tf: 37.5 },
  { hz: 80, alpha: 0.456, lu: -10.4, tf: 31.5 },
  { hz: 100, alpha: 0.433, lu: -8.2, tf: 26.5 },
  { hz: 125, alpha: 0.412, lu: -6.3, tf: 22.1 },
  { hz: 160, alpha: 0.391, lu: -4.6, tf: 17.9 },
  { hz: 200, alpha: 0.373, lu: -3.2, tf: 14.4 },
  { hz: 250, alpha: 0.357, lu: -2.1, tf: 11.4 },
  { hz: 315, alpha: 0.343, lu: -1.2, tf: 8.6 },
  { hz: 400, alpha: 0.33, lu: -0.5, tf: 6.2 },
  { hz: 500, alpha: 0.32, lu: 0.0, tf: 4.4 },
  { hz: 630, alpha: 0.311, lu: 0.4, tf: 3.0 },
  { hz: 800, alpha: 0.303, lu: 0.5, tf: 2.2 },
  { hz: 1000, alpha: 0.3, lu: 0.0, tf: 2.4 },
  { hz: 1250, alpha: 0.295, lu: -2.7, tf: 3.5 },
  { hz: 1600, alpha: 0.292, lu: -4.2, tf: 1.7 },
  { hz: 2000, alpha: 0.29, lu: -1.2, tf: -1.3 },
  { hz: 2500, alpha: 0.29, lu: 1.4, tf: -4.2 },
  { hz: 3150, alpha: 0.289, lu: 2.3, tf: -6.0 },
  { hz: 4000, alpha: 0.289, lu: 1.0, tf: -5.4 },
  { hz: 5000, alpha: 0.289, lu: -2.3, tf: -1.5 },
  { hz: 6300, alpha: 0.293, lu: -7.2, tf: 6.0 },
  { hz: 8000, alpha: 0.303, lu: -11.2, tf: 12.6 },
  { hz: 10000, alpha: 0.323, lu: -10.9, tf: 13.9 },
  { hz: 12500, alpha: 0.354, lu: -3.5, tf: 12.3 },
];

export const ISO226_MIN_HZ = 20;
export const ISO226_MAX_HZ = 12500;

/** 4 × 10⁻¹⁰, the constant in Formulas (1) and (2). */
const K = 4e-10;
/** 10^0.072, the 1 kHz threshold term (Tr = 2.4 dB, αr = 0.3). */
const TR_TERM = 10 ** 0.072;

/**
 * Table 1 parameters for a frequency. Exact at the table's frequencies; in between, each parameter
 * is interpolated linearly in log frequency. Throws outside 20 Hz to 12.5 kHz.
 */
export function iso226Parameters(freqHz: number): Iso226Parameters {
  if (!(freqHz >= ISO226_MIN_HZ && freqHz <= ISO226_MAX_HZ)) {
    throw new RangeError(`ISO 226 covers ${ISO226_MIN_HZ} Hz to ${ISO226_MAX_HZ} Hz, not ${freqHz} Hz`);
  }
  const index = ISO226_TABLE.findIndex((row) => row.hz >= freqHz);
  const upper = ISO226_TABLE[index]!;
  if (upper.hz === freqHz || index === 0) return { alpha: upper.alpha, lu: upper.lu, tf: upper.tf };
  const lower = ISO226_TABLE[index - 1]!;
  const t = Math.log(freqHz / lower.hz) / Math.log(upper.hz / lower.hz);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { alpha: mix(lower.alpha, upper.alpha), lu: mix(lower.lu, upper.lu), tf: mix(lower.tf, upper.tf) };
}

/** Threshold of hearing at a frequency, dB SPL (Tf). */
export const hearingThreshold = (freqHz: number): number => iso226Parameters(freqHz).tf;

/**
 * Formula (1): the sound pressure level (dB) a pure tone of `freqHz` needs to have a loudness
 * level of `phon`. At 1 kHz the answer equals the phon value, by definition.
 */
export function splForPhon(freqHz: number, phon: number): number {
  const { alpha, lu, tf } = iso226Parameters(freqHz);
  const x = K ** (0.3 - alpha) * (10 ** (0.03 * phon) - TR_TERM) + 10 ** ((alpha * (tf + lu)) / 10);
  return (10 / alpha) * Math.log10(x) - lu;
}

/**
 * Formula (2): the loudness level (phon) of a pure tone of `freqHz` at `dbSpl`. At the threshold
 * of hearing this gives 2.4 phon (the 1 kHz threshold); below it the formula flattens out a few
 * phon lower, which is far outside the valid range, so check `inValidRange`. The NaN guard is
 * only for parameters outside Table 1's, where the log could go negative.
 */
export function phonForSpl(freqHz: number, dbSpl: number): number {
  const { alpha, lu, tf } = iso226Parameters(freqHz);
  const excess = 10 ** ((alpha * (dbSpl + lu)) / 10) - 10 ** ((alpha * (tf + lu)) / 10);
  const x = excess / K ** (0.3 - alpha) + TR_TERM;
  return x > 0 ? (100 / 3) * Math.log10(x) : Number.NaN;
}

/** The loudness levels at which the standard's formula is valid at this frequency. */
export function validPhonRange(freqHz: number): { min: number; max: number } {
  iso226Parameters(freqHz);
  return { min: 20, max: freqHz <= 4000 ? 90 : 80 };
}

/** True if `phon` at `freqHz` is inside the standard's valid range (not just informative). */
export function inValidRange(freqHz: number, phon: number): boolean {
  const { min, max } = validPhonRange(freqHz);
  return phon >= min && phon <= max;
}

/**
 * Two tones in fixed proportion: one at `lowHz`, the other at `highHz` and `gapDb` quieter. Find
 * the level of the first tone (dB SPL) at which both have the same loudness level, searching
 * `fromDb` to `toDb`. Returns null if they never cross there.
 *
 * This is the turning point in "why it sounds worse at home": above it the bass sounds louder
 * than the distortion product riding on it, below it the distortion does.
 */
export function equalLoudnessCrossing(
  lowHz: number,
  highHz: number,
  gapDb: number,
  fromDb = 40,
  toDb = 120,
): number | null {
  const diff = (db: number) => phonForSpl(lowHz, db) - phonForSpl(highHz, db - gapDb);
  let lo = fromDb;
  let hi = toDb;
  const dLo = diff(lo);
  const dHi = diff(hi);
  if (!Number.isFinite(dLo) || !Number.isFinite(dHi) || Math.sign(dLo) === Math.sign(dHi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(diff(mid)) === Math.sign(dLo)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
