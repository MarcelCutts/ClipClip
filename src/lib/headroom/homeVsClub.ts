/**
 * W10 "Why it sounds worse at home": the model and chart geometry behind the HomeVsClub island.
 *
 * A pure-tone model from ISO 226:2023 (see dsp/iso226.ts). The file holds a 50 Hz bass and, 30 dB
 * under it, one clipping product at 3.15 kHz, where hearing is sharpest. The x axis is how loud the
 * bass plays in the room (dB SPL); the y axis is how loud each tone sounds (phon). The research's
 * worked example puts a club at 100 dB SPL and home listening 30 dB quieter.
 */
import { formatDb } from '../dsp/db';
import { equalLoudnessCrossing, phonForSpl } from '../dsp/iso226';
import { CLUB_BASS_DB_SPL, HOME_BELOW_CLUB_DB } from '../model';
import { placeReadout, type ReadoutPlacement, type Rect } from './readout';

export const BASS_HZ = 50;
export const CRUNCH_HZ = 3150;
export const CRUNCH_BELOW_DB = 30;

/** Bass level in the room, dB SPL. Both tones stay inside ISO 226's valid 20–90 phon here. */
export const LEVEL_RANGE = { min: 65, max: 105 } as const;

export const STOPS = [
  { id: 'home', name: 'Home, headphones', db: CLUB_BASS_DB_SPL - HOME_BELOW_CLUB_DB },
  /** Our estimate: a loud car sits between the two. */
  { id: 'car', name: 'Loud car', db: 85 },
  { id: 'club', name: 'Club', db: CLUB_BASS_DB_SPL },
] as const;

/** Where the widget starts: club level, the state DJs know. */
export const START_DB = CLUB_BASS_DB_SPL;

/** The x axis's title, printed under the ticks: what the dB figures along the bottom measure. */
export const X_TITLE = 'Bass level in the room (dB SPL)';

export const bassPhon = (db: number): number => phonForSpl(BASS_HZ, db);
export const crunchPhon = (db: number): number => phonForSpl(CRUNCH_HZ, db - CRUNCH_BELOW_DB);

/** The bass level at which bass and crunch sound equally loud (about 94.7 dB). */
export const CROSSING_DB =
  equalLoudnessCrossing(BASS_HZ, CRUNCH_HZ, CRUNCH_BELOW_DB, LEVEL_RANGE.min, LEVEL_RANGE.max) ?? 94.7;

/** How loud each tone sounds at a listening level, rounded as the chart shows them. */
export const shownPhon = (db: number) => ({ bass: Math.round(bassPhon(db)), crunch: Math.round(crunchPhon(db)) });

/** Which sounds louder at a listening level, by the rounded numbers the chart shows. */
export function louder(db: number): 'bass' | 'crunch' | 'even' {
  const { bass, crunch } = shownPhon(db);
  if (bass === crunch) return 'even';
  return bass > crunch ? 'bass' : 'crunch';
}

/**
 * The slider's spoken value: the level, the stop's name if it's on one, and how loud both tones
 * sound there, so a screen reader hears each step's numbers from the slider itself.
 */
export function speakLevel(db: number): string {
  const stop = STOPS.find((s) => s.db === db);
  const { bass, crunch } = shownPhon(db);
  return `bass at ${db} decibels${stop ? `, ${stop.name.toLowerCase()}` : ''}. Bass ${bass} phon, crunch ${crunch} phon`;
}

/**
 * Whether settling on a new level is news for the live region. The slider already speaks the
 * numbers, so the takeaway is announced only on arriving at a named stop, or when the louder of
 * the two changes over.
 */
export const worthAnnouncing = (from: number, to: number): boolean =>
  to !== from && (STOPS.some((s) => s.db === to) || louder(to) !== louder(from));

/**
 * The takeaway for a listening level. It compares the rounded numbers the chart shows, so the
 * sentence never says "1 phon louder" beside two labels that both read 67.
 */
export function sentenceFor(db: number): string {
  const stop = STOPS.find((s) => s.db === db);
  const where =
    stop?.id === 'home'
      ? 'At home on headphones'
      : stop?.id === 'car'
        ? 'In a loud car'
        : stop?.id === 'club'
          ? 'At club level'
          : `With the bass at ${formatDb(db, { signed: false })}`;
  const { bass, crunch } = shownPhon(db);
  if (bass === crunch) return `${where}, the bass and the crunch sound about as loud as each other.`;
  if (bass > crunch) return `${where}, the bass sounds ${bass - crunch} phon louder than the crunch.`;
  return `${where}, the crunch sounds ${crunch - bass} phon louder than the bass.`;
}

/**
 * The chart's title: what it finds, with the numbers. The same file played at home level, the
 * research's 30 dB under the club, turns the crunch louder than the bass.
 */
export function finding(): string {
  const home = STOPS.find((s) => s.id === 'home')!;
  const { bass, crunch } = shownPhon(home.db);
  return `Played ${HOME_BELOW_CLUB_DB} dB quieter, as at home, the same file’s crunch sounds ${crunch - bass} phon louder than its bass.`;
}

// ---------------------------------------------------------------------------------------------
// Chart geometry, in CSS px

export const CHART = {
  /** The plot's insets inside the chart box: room for the y ticks on the left. */
  inset: { left: 40, right: 16 },
  /** The plot's top edge and height inside the chart box. */
  plot: { top: 38, height: 196 },
  /** Room under the plot for the x ticks, their names and the axis title under them. */
  axisHeight: 84,
  phon: { min: 20, max: 90 },
  grid: [20, 40, 60, 80],
  /** The y axis title's top-left corner. */
  title: { x: 12, y: 10 },
  /** The "Equal at" label: this far right of the divider, and up from the plot's bottom edge. */
  equal: { dx: 6, up: 4 },
} as const;

/** 0–100 across the plot. */
export const xFrac = (db: number): number => ((db - LEVEL_RANGE.min) / (LEVEL_RANGE.max - LEVEL_RANGE.min)) * 100;

/** px down from the plot's top edge. */
export const yPx = (phon: number): number =>
  ((CHART.phon.max - phon) / (CHART.phon.max - CHART.phon.min)) * CHART.plot.height;

/** Measured sizes the readout has to work around, px. */
export interface ChartSizes {
  /** The chart box's width. */
  width: number;
  readout: { w: number; h: number };
  title: { w: number; h: number };
  equal: { w: number; h: number };
}

/** Sizes to lay out with before anything has been measured (server render): a phone. */
export const DEFAULT_SIZES: ChartSizes = {
  width: 330,
  readout: { w: 96, h: 40 },
  title: { w: 170, h: 15 },
  equal: { w: 56, h: 30 },
};

/** Where the "Equal at" label sits, as a box in chart px. */
export function equalLabelRect(s: ChartSizes): Rect {
  const plotW = s.width - CHART.inset.left - CHART.inset.right;
  const bottom = CHART.plot.top + CHART.plot.height - CHART.equal.up;
  return {
    x: CHART.inset.left + (xFrac(CROSSING_DB) / 100) * plotW + CHART.equal.dx,
    y: bottom - s.equal.h,
    w: s.equal.w,
    h: s.equal.h,
  };
}

/**
 * Where the crosshair readout goes at a listening level: clear of both lines, the axis title and
 * the "Equal at" label, inside the plot's height.
 */
export function readoutFor(level: number, s: ChartSizes): ReadoutPlacement {
  const plotW = Math.max(1, s.width - CHART.inset.left - CHART.inset.right);
  const span = LEVEL_RANGE.max - LEVEL_RANGE.min;
  const xOf = (db: number) => CHART.inset.left + ((db - LEVEL_RANGE.min) / span) * plotW;
  const dbAt = (x: number) =>
    Math.max(LEVEL_RANGE.min, Math.min(LEVEL_RANGE.max, LEVEL_RANGE.min + ((x - CHART.inset.left) / plotW) * span));
  const yOf = (phon: number) => CHART.plot.top + yPx(phon);
  // Both lines rise with level, so over any x range they are highest at its right end and lowest
  // at its left end.
  const lines = (x0: number, x1: number) => {
    const hi = dbAt(x1);
    const lo = dbAt(x0);
    return {
      top: yOf(Math.max(bassPhon(hi), crunchPhon(hi))),
      bottom: yOf(Math.min(bassPhon(lo), crunchPhon(lo))),
    };
  };
  return placeReadout({
    cursorX: xOf(level),
    box: s.readout,
    bounds: { left: CHART.inset.left, right: s.width - 2, top: 2, bottom: CHART.plot.top + CHART.plot.height },
    lines,
    obstacles: [{ x: CHART.title.x, y: CHART.title.y, w: s.title.w, h: s.title.h }, equalLabelRect(s)],
  });
}
