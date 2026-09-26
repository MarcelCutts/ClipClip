/**
 * The file ladder's words and label layout (record-level/FileLadder.svelte): what a test recording
 * would show, said as a finding, and where the phone strip's labels go so none overlap.
 */
import { formatDb } from '../dsp/db';
import { type MaterialId, material, TARGET } from './model';

export interface FilePeak {
  id: MaterialId;
  /** Where it peaks in the file, dBFS. −∞ when nothing reaches the file. */
  dbfs: number;
}

/** "Blend", "Loud and Blend", "All three": quietest first, as the ladder runs. */
function names(peaks: readonly FilePeak[], all: number): string {
  if (peaks.length === all && all > 2) return 'All three';
  const words = [...peaks].sort((a, b) => a.dbfs - b.dbfs).map((p) => material(p.id).short);
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '');
}

/**
 * The ladder's finding, worst first: anything at or over the top of the file clips; anything above
 * the target band sits close to the top; anything below it is quieter than it needs to be.
 */
export function fileFinding(peaks: readonly FilePeak[]): string {
  const heard = peaks.filter((p) => Number.isFinite(p.dbfs));
  if (heard.length === 0) return 'Nothing reaches the file.';
  const n = heard.length;
  const over = heard.filter((p) => p.dbfs >= 0);
  if (over.length === 1) {
    const [p] = over as [FilePeak];
    const where = p.dbfs === 0 ? 'right at the top' : `${formatDb(p.dbfs, { signed: false })} over the top`;
    return `${names(over, n)} is ${where}, so it clips.`;
  }
  if (over.length > 1) return `${names(over, n)} reach the top, so they clip.`;
  const high = heard.filter((p) => p.dbfs > TARGET.band.top);
  if (high.length > 0)
    return `${names(high, n)} ${high.length > 1 ? 'are' : 'is'} above the target band, close to the top.`;
  const low = heard.filter((p) => p.dbfs < TARGET.band.bottom);
  if (low.length > 0) return `${names(low, n)} ${low.length > 1 ? 'are' : 'is'} below the target band.`;
  return n > 1 ? `${names(heard, n)} are inside the target band.` : `${names(heard, n)} is inside the target band.`;
}

/**
 * Places labels along a line, each as near its mark as the others allow: none overlap, and none
 * spill past `start` or `end`. Labels keep the marks' order. Overlapping labels are pushed apart as
 * a group centred on their marks, then the group is moved inside the ends. Returns each label's
 * centre, in the marks' units (pixels, in the strip).
 */
export function spreadLabels(
  marks: readonly number[],
  widths: readonly number[],
  start: number,
  end: number,
  gap = 4,
): number[] {
  interface Group {
    first: number;
    last: number;
    /** Where the group's left edge would sit if nothing were in the way. */
    want: number;
    left: number;
    width: number;
  }
  const n = Math.min(marks.length, widths.length);
  // Offsets of each label's left edge within its group, and the group's best left edge: the one that
  // keeps its labels closest to their marks on average.
  const place = (g: Group): Group => {
    let offset = 0;
    let sum = 0;
    for (let i = g.first; i <= g.last; i++) {
      sum += marks[i]! - offset - widths[i]! / 2;
      offset += widths[i]! + gap;
    }
    const width = offset - gap;
    const want = sum / (g.last - g.first + 1);
    const left = Math.max(start, Math.min(want, end - width));
    return { ...g, want, left, width };
  };
  let groups: Group[] = [];
  for (let i = 0; i < n; i++) {
    groups.push(place({ first: i, last: i, want: 0, left: 0, width: 0 }));
    // Merge back while this group runs into the one before it.
    while (groups.length > 1) {
      const b = groups.at(-1)!;
      const a = groups.at(-2)!;
      if (a.left + a.width + gap <= b.left) break;
      groups = [...groups.slice(0, -2), place({ first: a.first, last: b.last, want: 0, left: 0, width: 0 })];
    }
  }
  const centres: number[] = [];
  for (const g of groups) {
    let x = g.left;
    for (let i = g.first; i <= g.last; i++) {
      centres.push(x + widths[i]! / 2);
      x += widths[i]! + gap;
    }
  }
  return centres;
}
