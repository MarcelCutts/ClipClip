/**
 * The clip check's findings as plain text, in the guide's voice: a verdict first, then the
 * levels, then where to listen. It says what the file shows. What that means for the rig depends
 * on the file being as the Howler wrote it, so those lines start with the condition.
 */
import { TARGET } from '../model';
import { type ClipCheckResult, MUSIC_DBFS, type Pile } from './analyse';
import type { WavInfo } from './wav';

const MINUS = '−';
const NBSP = ' ';

/** −7.9 dBFS, with a real minus sign. */
export const dbfs = (db: number, decimals = 1): string =>
  Number.isFinite(db) ? `${db < 0 ? MINUS : ''}${Math.abs(db).toFixed(decimals)}${NBSP}dBFS` : 'silence';

/** 1:02:13 from an hour up, 12:40 below it. */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 3 h 12 min, 14 min, 45 s. */
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}${NBSP}h ${m}${NBSP}min`;
  if (m > 0) return `${m}${NBSP}min`;
  return `${Math.round(seconds)}${NBSP}s`;
}

const count = (n: number): string => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`): string => `${count(n)} ${n === 1 ? one : many}`;
/** Runs within this many dB of 0 dBFS sit at full scale: the file is as loud as the recorder wrote it. */
const FULL_SCALE_DB = 0.01;

/** Which sides of the wave a pile's flat tops are on. */
function polarity(p: Pile): string {
  if (p.bottoms === 0) return `Only the tops are flat (${count(p.tops)}).`;
  if (p.tops === 0) return `Only the bottoms are flat (${count(p.bottoms)}).`;
  return `Tops and bottoms are both flat (${count(p.tops)} and ${count(p.bottoms)}).`;
}

/** What flattens tops at the piles' levels: at the file's loudest level, below it, or both. */
function causes(piles: Pile[]): string {
  const top = piles.some((p) => p.atTop);
  const lower = piles.some((p) => !p.atTop);
  if (top && lower) {
    return 'That can be tracks with flat tops of their own, the mixer in the red, or a channel in the red with its fader down.';
  }
  if (top) return 'That can be a track with flat tops of its own, or the mixer in the red.';
  return 'That can be a track with flat tops of its own, or a channel in the red with its fader down.';
}

export interface ReportOptions {
  /** Print every minute, not just the worst. */
  allMinutes?: boolean;
}

export function formatReport(
  name: string,
  info: Pick<WavInfo, 'sampleRate' | 'bits' | 'float' | 'channels' | 'truncated'>,
  r: ClipCheckResult,
  { allMinutes = false }: ReportOptions = {},
): string {
  const at = (frame: number) => clock(frame / r.sampleRate);
  const lines: string[] = [];
  const kind = info.float ? `${info.bits}-bit float` : `${info.bits}-bit`;
  const layout = info.channels === 2 ? 'stereo' : info.channels === 1 ? 'mono' : `${info.channels} channels`;
  lines.push(name, `${duration(r.seconds)}, ${info.sampleRate / 1000}${NBSP}kHz, ${kind}, ${layout}`);
  if (info.truncated) {
    lines.push('Its length was never written, as happens when a recording is cut off. It was read to its end.');
  }
  lines.push('');

  // The verdict.
  const fullScale = (r.runs.levelDb ?? 0) > -FULL_SCALE_DB;
  const piles = r.piles;
  if (r.verdict === 'too-quiet') {
    lines.push(
      'Verdict: too quiet to check.',
      `  Every second peaks below ${dbfs(r.gateDb, 0)}.`,
      '  If a set was playing, the recording level was far too low, or the Howler had no input.',
    );
  } else if (r.verdict === 'runs') {
    const times = r.runs.count === 1 ? 'Once' : `${count(r.runs.count)} times`;
    const where = fullScale ? 'full scale' : `the file’s peak, ${dbfs(r.runs.levelDb ?? 0)}`;
    const longestMs = (r.runs.longest / r.sampleRate) * 1000;
    lines.push(
      fullScale ? 'Verdict: clipped at full scale.' : 'Verdict: clipped at the file’s peak.',
      `  ${times}, ${r.runs.minSamples} or more samples in a row sit at ${where}. The longest run is ${longestMs.toFixed(1)}${NBSP}ms.`,
      fullScale
        ? '  If this is the file as the Howler wrote it, the Howler’s input clipped.'
        : '  If this is a normalised copy of the Howler’s file, the Howler’s input clipped.',
      '  Set the recording level again with S3 on the Setting up page before the next event.',
    );
    if (piles.length > 0) {
      const levels = piles.map((p) => dbfs(p.levelDb)).join(' and ');
      lines.push(`  Flat tops also pile up at ${levels}, below full scale. The minutes are below.`);
    }
  } else if (r.verdict === 'pile') {
    lines.push(`Verdict: flat tops at ${piles.length === 1 ? 'one level' : 'two levels'}, below full scale.`);
    for (const p of piles) {
      const where = p.atTop
        ? 'at the top of the file'
        : `${(r.peakDb - p.levelDb).toFixed(1)}${NBSP}dB below the top of the file`;
      const when =
        p.stretches > 1
          ? `in ${p.stretches} stretches from ${at(p.firstAt)} to ${at(p.lastAt)}`
          : `from ${at(p.firstAt)} to ${at(p.lastAt)}`;
      lines.push(
        `  ${plural(p.count, 'flat top')} pile up at ${dbfs(p.levelDb)}, ${where}, ${when}.`,
        `  ${polarity(p)}`,
      );
    }
    lines.push(
      '  If this is the file as the Howler wrote it, the tops were flattened before the Howler.',
      `  ${causes(piles)}`,
      '  To find which, go to F9 on the Crew page.',
      '  If the same level comes back in other DJs’ sets, the ceiling is in the rig, most likely the mixer.',
      '  The changeover times noted at C2 show where each set starts.',
    );
  } else {
    lines.push('Verdict: no clipping found.');
    const n = r.flatTops.count;
    const densest = r.flatTops.densest;
    if (n > 0 && densest) {
      const share = densest.count / n;
      const where = r.flatTops.spread
        ? `${count(n)} flat tops are spread over many levels.`
        : share > 0.995
          ? `${plural(n, 'flat top')}, all near ${dbfs(densest.levelDb)}.`
          : `${plural(n, 'flat top')}, ${Math.round(share * 100)}% of them near ${dbfs(densest.levelDb)}.`;
      lines.push(`  ${where} Tracks with flat tops of their own can do that.`);
    }
    lines.push(
      '  This check can miss light clipping, and clipping that rounds the tops off.',
      '  If you hear crunch, go to F9 on the Crew page.',
    );
  }
  if (r.overs > 0) lines.push(`  ${plural(r.overs, 'sample')} go past full scale. Only a float file can hold them.`);
  lines.push('');

  // The levels, against the guide's target.
  const l = r.levels;
  const row = (label: string, value: string) => `  ${label.padEnd(18)}${value}`;
  lines.push('Levels');
  lines.push(row('Loudest peak', `${dbfs(r.peakDb)} at ${at(r.peakAt)}`));
  if (l.musicSeconds > 0) {
    lines.push(row('Second by second', `half peak above ${dbfs(l.typicalDb)}, one in twenty above ${dbfs(l.loudDb)}`));
    lines.push(
      row(
        'The guide’s aim',
        `normal peaks around ${dbfs(TARGET.normal, 0)}, the loudest blend no higher than ${dbfs(TARGET.blendMax, 0)}`,
      ),
    );
    if (l.secondsAboveLimit > 0) lines.push(row(`Above ${dbfs(TARGET.blendMax, 0)}`, duration(l.secondsAboveLimit)));
  } else {
    lines.push(row('Second by second', `every second peaks below ${dbfs(MUSIC_DBFS, 0)}`));
  }

  // Where to listen.
  const flagged = r.minutes.filter((m) => m.runs > 0 || m.atPile > 0);
  if (flagged.length > 0) {
    const worst = [...flagged].sort((a, b) => b.runs + b.atPile - (a.runs + a.atPile));
    const shown = allMinutes ? flagged : worst.slice(0, 8).sort((a, b) => a.minute - b.minute);
    lines.push('', allMinutes ? 'Every minute with a mark' : 'Worst minutes, and where to listen');
    for (const m of shown) {
      const marks = [
        m.runs > 0 ? `${plural(m.runs, 'run')} at ${fullScale ? 'full scale' : 'the peak'}` : '',
        m.atPile > 0 ? plural(m.atPile, 'flat top') : '',
      ].filter(Boolean);
      const listen = m.firstAt !== undefined ? `listen at ${at(m.firstAt)}` : '';
      lines.push(`  ${clock(m.minute * 60).padStart(7)}   ${marks.join(', ').padEnd(28)} ${listen}`);
    }
    if (!allMinutes && flagged.length > shown.length) {
      lines.push(`  and ${plural(flagged.length - shown.length, 'more minute')} (--minutes lists them all)`);
    }
  }
  return lines.join('\n');
}
