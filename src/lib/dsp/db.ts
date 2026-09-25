/** Decibel helpers. All levels in this project are amplitude ratios, so 6 dB ≈ ×2. */

const MINUS = '−';

/** Convert decibels to a linear amplitude ratio. */
export const dbToGain = (db: number): number => 10 ** (db / 20);

/** Convert a linear amplitude ratio to decibels. Returns -Infinity for silence. */
export const gainToDb = (gain: number): number => 20 * Math.log10(Math.abs(gain));

interface FormatOptions {
  /** Digits after the decimal point. */
  decimals?: number;
  /** Unit appended after a no-break space (U+00A0, which the site's fonts carry), so a value never wraps away from its unit. Pass '' for none. */
  unit?: string;
  /** Prefix positive values with '+'. */
  signed?: boolean;
}

/**
 * Format a level for display with a typographic minus: "+6 dB", "−12.5 dBFS", "0 dB".
 * Values that round to zero never show a sign. Silence reads "off" (the site's fonts have no ∞,
 * and "off" is what a knob turned fully down means anyway).
 */
export function formatDb(db: number, { decimals = 0, unit = 'dB', signed = true }: FormatOptions = {}): string {
  const suffix = unit ? ` ${unit}` : '';
  if (!Number.isFinite(db)) return 'off';
  const rounded = Number(db.toFixed(decimals));
  if (rounded === 0) return `${(0).toFixed(decimals)}${suffix}`;
  const body = Math.abs(rounded).toFixed(decimals);
  if (rounded < 0) return `${MINUS}${body}${suffix}`;
  return `${signed ? '+' : ''}${body}${suffix}`;
}

/** The same value spelled out for screen readers: "minus 6 decibels". */
export function speakDb(db: number, { decimals = 0, unit = 'decibels' } = {}): string {
  if (!Number.isFinite(db)) return `silent`;
  const rounded = Number(db.toFixed(decimals));
  if (rounded === 0) return `0 ${unit}`;
  const body = Math.abs(rounded).toFixed(decimals);
  return `${rounded < 0 ? 'minus' : 'plus'} ${body} ${unit}`;
}
