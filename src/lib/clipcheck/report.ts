/**
 * The clip check's findings as plain text, in the guide's voice: a verdict first, then the
 * levels, then where to listen.
 */
import { TARGET } from '../model';
import { section } from '../sections';
import type { ClipCheckResult } from './analyse';
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
/** A DJ plays a track for a few minutes, so flat tops spread wider than this span more than one. */
const ONE_TRACK_SECONDS = 6 * 60;
const plural = (n: number, one: string, many = `${one}s`): string => `${count(n)} ${n === 1 ? one : many}`;

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
    lines.push('The file never had its length written, as when a recording is cut off; read to its end.');
  }
  lines.push('');

  // The verdict.
  const recordLevel = section('record-level');
  const c = r.ceiling;
  if (r.verdict === 'recorder') {
    const longestMs = (r.overloads.longest / r.sampleRate) * 1000;
    lines.push(
      'Verdict: the recorder overloaded.',
      `  ${plural(r.overloads.count, 'time')} its input ran past full scale (the longest for ${longestMs.toFixed(1)}${NBSP}ms).`,
      `  Turn the record level down: see ${recordLevel.number} ${recordLevel.title} in the guide.`,
    );
    if (c) lines.push(`  Flat tops also pile up at ${dbfs(c.levelDb)}, below full scale: see below.`);
  } else if (c) {
    const span = (c.lastAt - c.firstAt) / r.sampleRate;
    const where =
      c.stretches > 1
        ? `in ${plural(c.stretches, 'separate stretch', 'separate stretches')} of the file`
        : `between ${at(c.firstAt)} and ${at(c.lastAt)}`;
    lines.push(
      'Verdict: clipped before the recorder.',
      `  ${plural(c.count, 'flat top')} sit at ${dbfs(c.levelDb)}, the top of the file, ${where}.`,
      `  Both sides of the wave are flattened (${count(c.tops)} tops, ${count(c.bottoms)} bottoms). The recorder itself never overloaded.`,
    );
    if (c.stretches > 1 || span > ONE_TRACK_SECONDS) {
      lines.push(
        '  One level that keeps coming back, track after track, is a ceiling in the rig: most likely the mixer.',
      );
    } else {
      lines.push(
        '  That’s short enough to be one track mastered with flat tops of its own, or the mixer during one',
        '  blend. Listen there, and ask who was playing.',
      );
    }
  } else {
    lines.push('Verdict: clean. The recorder never overloaded, and no flat tops pile up at one level.');
    if (r.flatTops.count > 0) {
      lines.push(
        `  ${plural(r.flatTops.count, 'flat top')} turn up scattered over many levels. Tracks mastered with flat tops`,
        '  do that on their own, so this isn’t the rig.',
      );
    }
  }
  if (r.overs > 0) lines.push(`  ${plural(r.overs, 'sample')} go past full scale, which only a float file can hold.`);
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
    lines.push(`  No music: every second peaks below ${dbfs(-45, 0)}.`);
  }

  // Where to listen.
  const flagged = r.minutes.filter((m) => m.overloads > 0 || m.atCeiling > 0);
  if (flagged.length > 0) {
    const worst = [...flagged].sort((a, b) => b.overloads + b.atCeiling - (a.overloads + a.atCeiling));
    const shown = allMinutes ? flagged : worst.slice(0, 8).sort((a, b) => a.minute - b.minute);
    lines.push('', allMinutes ? 'Every minute with a mark' : 'Worst minutes, and where to listen');
    for (const m of shown) {
      const marks = [
        m.overloads > 0 ? plural(m.overloads, 'overload') : '',
        m.atCeiling > 0 ? plural(m.atCeiling, 'flat top') : '',
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
