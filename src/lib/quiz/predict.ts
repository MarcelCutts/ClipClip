/**
 * The home page's prediction hook (W7b): one question, then a before/after pair of scopes.
 *
 *   before: a channel pushed past the mixer's ceiling. The tops are cut flat.
 *   after:  the same signal with the record level turned down 12 dB. Smaller, still flat.
 *
 * The picture is drawn from the site's model: the ceiling is a hard clip at ±1 (the red LED),
 * and an output knob can only scale what reaches it (src/lib/model.ts, BUILD-SPEC §3).
 */
import { clip, type FlatRun, runsAtCeiling } from '../dsp/analysis';
import { dbToGain } from '../dsp/db';
import { testSignal } from '../dsp/twoCeilings';
import { type ScopeGeometry, scopePath, scopeY } from '../viz/scope';
import type { Confidence } from './cards';

export { clip, type FlatRun, runsAtCeiling as flatRuns } from '../dsp/analysis';

export const PREDICT = {
  lead: 'Quick question.',
  question:
    'A track is crunching because its channel is in the red. You turn the record level down. What happens to the crunch?',
  // The same answers as the lab's prediction (src/lib/lab/copy.ts), short enough for one line each.
  choices: [
    { id: 'away', label: 'Goes away' },
    { id: 'quieter', label: 'Gets quieter, stays' },
    { id: 'unsure', label: 'Not sure' },
  ],
  correct: 'quieter',
  /** The misconception (M3): turning down afterwards removes the crunch. */
  wrong: 'away',
  /** Picking this one skips "How sure are you?": the reader has already told us. */
  unsure: 'unsure',
  reveal: 'It gets quieter and the flat tops stay, because the channel clipped before the record level.',
  learn: { path: '/#two-ceilings', text: 'Try it yourself in the two-ceilings lab' },
} as const;

/**
 * Said after the reveal when the reader bet on the misconception and was sure of it. A confident
 * miss is the surprise people remember (hypercorrection, Brod 2021), so name it plainly.
 */
export function surpriseLine(choice: string | undefined, confidence: Confidence | undefined): string | null {
  if (choice !== PREDICT.wrong) return null;
  const sure = confidence === 'certain' ? 'certain' : confidence === 'fairly' ? 'fairly sure' : null;
  return sure
    ? `You were ${sure} it would go away. A confident wrong guess is the kind people remember once it’s put right.`
    : null;
}

/** How far past the mixer's ceiling the channel is pushed in the picture. */
export const DRIVE_DB = 3;
/** How far the record level comes down. */
export const TURN_DOWN_DB = -12;

/**
 * A small scope, wider than tall so the flat tops read as long runs. The range just clears the
 * cut-off peaks (drive +3 dB puts them at ×1.41), so the ghost fits on the screen.
 */
export const PREDICT_SCOPE: ScopeGeometry = { width: 300, height: 120, range: 1.45 };

export interface Drawing {
  /** The signal as it leaves the ceiling: what the recording gets. */
  signal: string;
  /** What the ceiling cut off: the outline of the missing peaks, drawn as a dashed ghost. */
  ghost: string;
  /** The same missing peaks as closed shapes, for a faint wash between the ceiling and the ghost. */
  cap: string;
  /** The flat tops themselves, to mark them as damage. */
  flats: string;
  /** Where to hang the "still flat" label: the middle of the widest flat top. */
  label: { x: number; value: number };
}

/**
 * The window of signal the picture shows: two cycles of the two-tone test signal (a bass tone
 * with a quieter high tone riding on it), peaking at exactly 1 before the drive. At thumbnail
 * size it reads far more clearly than a drum loop: the high tone's wiggle vanishes on the flat
 * tops. The sounds on the site stay the synth loops; this is only the picture.
 */
export function pictureSource(): Float64Array {
  const cycle = testSignal.length / 5;
  return testSignal.slice(0, Math.round(cycle * 2));
}

/** Join runs of the same sign separated by fewer than `gap` samples (the wiggle at a run's edges). */
export function mergeRuns(runs: readonly FlatRun[], gap: number): FlatRun[] {
  const merged: FlatRun[] = [];
  for (const run of runs) {
    const last = merged.at(-1);
    if (last && last.sign === run.sign && run.start - last.end <= gap) last.end = run.end;
    else merged.push({ ...run });
  }
  return merged;
}

/**
 * Draw a signal pushed `driveDb` past the ceiling and clipped, scaled by `gainDb` afterwards
 * (0 for the mixer's view, TURN_DOWN_DB for what reaches the recorder).
 */
export function drawClipped(
  source: ArrayLike<number>,
  {
    driveDb = DRIVE_DB,
    gainDb = 0,
    geometry = PREDICT_SCOPE,
  }: { driveDb?: number; gainDb?: number; geometry?: ScopeGeometry } = {},
): Drawing {
  const drive = dbToGain(driveDb);
  const after = dbToGain(gainDb);
  const n = source.length;
  const wanted = new Float64Array(n);
  const clipped = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    wanted[i] = source[i]! * drive;
    clipped[i] = clip(wanted[i]!) * after;
  }
  const x = (i: number) => (i / Math.max(1, n - 1)) * geometry.width;
  const y = (v: number) => scopeY(v, geometry);
  const px = (i: number, v: number) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  const runs = runsAtCeiling(clipped, after);

  let flats = '';
  for (const run of runs) flats += `M${px(run.start, run.sign * after)}L${px(run.end, run.sign * after)}`;

  // The missing peaks follow the signal's envelope, not every wiggle of its high tone: a running
  // peak over about two screen pixels either side keeps the ghost a clean arc.
  const reach = Math.max(1, Math.round((2 * n) / geometry.width));
  const step = Math.max(1, Math.floor(n / geometry.width));
  let ghost = '';
  let cap = '';
  const peaks = mergeRuns(runs, reach * 2);
  for (const run of peaks) {
    const points: string[] = [];
    for (let i = run.start; ; i = Math.min(run.end, i + step)) {
      let most = 1;
      for (let j = Math.max(0, i - reach); j <= Math.min(n - 1, i + reach); j++)
        most = Math.max(most, run.sign * wanted[j]!);
      points.push(px(i, run.sign * most * after));
      if (i === run.end) break;
    }
    ghost += `M${points.join('L')}`;
    cap += `M${px(run.start, run.sign * after)}L${points.join('L')}L${px(run.end, run.sign * after)}Z`;
  }

  const widest = peaks.filter((r) => r.sign === 1).sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const label = { x: widest ? x((widest.start + widest.end) / 2) : geometry.width / 2, value: after };

  return { signal: scopePath(clipped, geometry), ghost, cap, flats, label };
}
