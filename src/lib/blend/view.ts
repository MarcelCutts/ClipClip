/**
 * Waveform geometry for the blend lab's screen, drawn the way DJ software draws a waveform: an
 * amplitude envelope, not the individual cycles. Two beats span a few hundred columns, so each
 * column is shorter than one cycle of a kick; taking each column's min and max over a short
 * window either side (`hold`) turns the wiggle into the envelope, so heights can be compared.
 *
 * The columns and the drawing are the shared scope helpers, so the fill and both edges share
 * every point, and an envelope with no hold or smoothing is exactly `envelopePath`.
 */
import { type Envelope, envelopeColumns, envelopeEdges, type ScopeGeometry } from '../viz/scope';

export type { Envelope };

/** Average each value with `radius` neighbours either side. A plateau at least 2·radius + 1 wide keeps its value in the middle. */
function smoothed(values: Float64Array, radius: number): Float64Array {
  if (radius <= 0) return values;
  const out = new Float64Array(values.length);
  for (let c = 0; c < values.length; c++) {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, c - radius); k <= Math.min(values.length - 1, c + radius); k++) {
      sum += values[k]!;
      count++;
    }
    out[c] = sum / count;
  }
  return out;
}

/**
 * @param hold Samples either side of each column to take the min and max over. About half the
 *   period of the lowest note (a 47 Hz kick needs ~11 ms) gives a smooth envelope. It is
 *   rounded up to whole columns, so each sample is read once however wide the hold.
 * @param smooth Columns either side to average over afterwards, which softens the steps the
 *   hold leaves. Keep it at most the hold's width in columns and every peak keeps its height.
 */
export function envelope(data: ArrayLike<number>, geometry: ScopeGeometry, hold = 0, smooth = 0): Envelope {
  const { hi: colHi, lo: colLo } = envelopeColumns(data, geometry);
  const columns = colHi.length;
  const n = data.length;
  const reach = hold > 0 && n > 0 ? Math.ceil(hold / (n / columns)) : 0;
  const his = new Float64Array(columns);
  const los = new Float64Array(columns);
  for (let c = 0; c < columns; c++) {
    let hi = colHi[c]!;
    let lo = colLo[c]!;
    for (let k = Math.max(0, c - reach); k <= Math.min(columns - 1, c + reach); k++) {
      if (colHi[k]! > hi) hi = colHi[k]!;
      if (colLo[k]! < lo) lo = colLo[k]!;
    }
    his[c] = hi;
    los[c] = lo;
  }
  return envelopeEdges(smoothed(his, smooth), smoothed(los, smooth), geometry);
}
