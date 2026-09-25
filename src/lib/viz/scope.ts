/** Geometry for the SVG oscilloscope and waveform views: turns samples into path strings. */

export interface ScopeGeometry {
  width: number;
  height: number;
  /** Signal value drawn at the top edge of the screen (and its negative at the bottom). */
  range: number;
}

export const DEFAULT_SCOPE: ScopeGeometry = { width: 330, height: 150, range: 1.6 };

/** Y coordinate for a sample value. */
export function scopeY(value: number, { height, range }: ScopeGeometry): number {
  const v = Math.max(-range, Math.min(range, value));
  return height / 2 - (v / range) * (height / 2 - 4);
}

const at = (data: ArrayLike<number>, i: number) => data[i % data.length]!;

/**
 * SVG line for `count` samples starting at `start` (wrapping round, since our signals loop),
 * stretched across the screen width. Windows longer than the screen is wide are decimated
 * min/max per column, in time order, so peaks and flat tops always survive.
 */
export function scopePath(
  data: ArrayLike<number>,
  geometry: ScopeGeometry = DEFAULT_SCOPE,
  start = 0,
  count = data.length,
): string {
  const { width } = geometry;
  const xs: number[] = [];
  const ys: number[] = [];
  if (count <= width * 2) {
    for (let i = 0; i < count; i++) {
      xs.push((i / Math.max(1, count - 1)) * width);
      ys.push(at(data, start + i));
    }
  } else {
    const columns = Math.round(width);
    for (let c = 0; c < columns; c++) {
      const from = start + Math.floor((c * count) / columns);
      const to = start + Math.floor(((c + 1) * count) / columns);
      let lo = from;
      let hi = from;
      for (let i = from; i < to; i++) {
        if (at(data, i) < at(data, lo)) lo = i;
        if (at(data, i) > at(data, hi)) hi = i;
      }
      const x = (c / (columns - 1)) * width;
      for (const i of lo <= hi ? [lo, hi] : [hi, lo]) {
        xs.push(x);
        ys.push(at(data, i));
      }
    }
  }
  let d = '';
  for (let p = 0; p < xs.length; p++) {
    d += `${p === 0 ? 'M' : 'L'}${xs[p]!.toFixed(1)} ${scopeY(ys[p]!, geometry).toFixed(1)}`;
  }
  return d;
}

/** A waveform drawn as a filled envelope, with its two edges as open lines for outlines. */
export interface Envelope {
  /** Closed shape between the edges, for fills. */
  area: string;
  /** Open line along the column maxima, left to right. */
  upper: string;
  /** Open line along the column minima, left to right. */
  lower: string;
}

/**
 * Each screen column's highest and lowest sample, for `count` samples starting at `start`
 * (wrapping round). Silence, or no data at all, reads as 0.
 */
export function envelopeColumns(
  data: ArrayLike<number>,
  geometry: ScopeGeometry = DEFAULT_SCOPE,
  start = 0,
  count = data.length,
): { hi: Float64Array; lo: Float64Array } {
  const columns = Math.round(geometry.width);
  const hi = new Float64Array(columns);
  const lo = new Float64Array(columns);
  if (data.length === 0) return { hi, lo };
  for (let c = 0; c < columns; c++) {
    const from = start + Math.floor((c * count) / columns);
    const to = Math.max(from + 1, start + Math.floor(((c + 1) * count) / columns));
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = from; i < to; i++) {
      const v = at(data, i);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    hi[c] = max;
    lo[c] = min;
  }
  return { hi, lo };
}

/** Draws one high and one low per column, spread across the screen width, as an envelope. */
export function envelopeEdges(
  hi: ArrayLike<number>,
  lo: ArrayLike<number>,
  geometry: ScopeGeometry = DEFAULT_SCOPE,
): Envelope {
  const columns = hi.length;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let c = 0; c < columns; c++) {
    const x = ((c / (columns - 1)) * geometry.width).toFixed(1);
    top.push(`${x} ${scopeY(hi[c]!, geometry).toFixed(1)}`);
    bottom.push(`${x} ${scopeY(lo[c]!, geometry).toFixed(1)}`);
  }
  const upper = `M${top.join('L')}`;
  return { area: `${upper}L${bottom.toReversed().join('L')}Z`, upper, lower: `M${bottom.join('L')}` };
}

/**
 * Filled min/max envelope, the way DJ software draws a track's waveform. Returns a closed path.
 */
export function envelopePath(
  data: ArrayLike<number>,
  geometry: ScopeGeometry = DEFAULT_SCOPE,
  start = 0,
  count = data.length,
): string {
  const { hi, lo } = envelopeColumns(data, geometry, start, count);
  return envelopeEdges(hi, lo, geometry).area;
}
