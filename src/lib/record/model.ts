/**
 * The record-level walkthrough: how the XDJ-RX2's MASTER 2 feed lands in the Howler's file, and
 * how each step of setting it is judged.
 *
 * The Howler records from MASTER 2, so MASTER LEVEL is the record level. It also sets the speakers,
 * and the middle meters read after it, so it stays fully up: turned down, it hides a hot blend from
 * the DJs. MASTER ATT, in UTILITY, trims the feed instead.
 *
 * Levels come in two scales. Mix peaks are on the XDJ meter's own dB scale (the red LED is +12),
 * as the middle meters show them with MASTER LEVEL fully up. File peaks are in dBFS, where 0 is the
 * top of the Howler's file. The Howler's real input limit is unpublished, so the link between the
 * two is the site-wide assumption in `../model.ts`: with the feed fully up, a meter peak of +6 lands
 * at 0 dBFS. Every function that depends on it takes it as `limit`, so a test can try another
 * Howler; the walkthrough itself only ever uses the site's.
 */
import { formatDb, speakDb } from '../dsp/db';
import { HOWLER_CEILING_AT_FULL_KNOB_DB, KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { RANGES } from '../xdj';

export { TARGET } from '../model';

/** The Howler's limit, as a meter reading with MASTER LEVEL fully up and MASTER ATT at 0 dB. */
export const HOWLER_LIMIT = HOWLER_CEILING_AT_FULL_KNOB_DB;

export type MaterialId = 'quiet' | 'loud' | 'blend';

export interface Material {
  id: MaterialId;
  /** What the crew hears asked for, as a choice. */
  name: string;
  /** Its pad's words. */
  pad: string;
  /** Short name for chart labels. */
  short: string;
  /** Peak on the middle meters with MASTER LEVEL fully up: the mix itself, on the XDJ's scale. */
  mixDb: number;
}

/** A loud track peaks in the upper orange. Two of them, kicks lined up, make the test blend. */
const LOUD_DB = 6;
const BLEND_DB = LOUD_DB + KICKS_TOGETHER_DB;
/** A reading on the XDJ's meter scale, as printed: "0", "+6". */
const meterWords = (v: number) => formatDb(v, { unit: '' });

export const MATERIALS: readonly Material[] = [
  { id: 'quiet', name: 'A quiet track', pad: 'Quiet track', short: 'Quiet', mixDb: TARGET_PEAK_DB.first },
  { id: 'loud', name: 'A loud track', pad: 'Loud track', short: 'Loud', mixDb: LOUD_DB },
  { id: 'blend', name: 'The loudest blend', pad: 'Loudest blend', short: 'Blend', mixDb: BLEND_DB },
];

export const MATERIAL_IDS: readonly MaterialId[] = MATERIALS.map((m) => m.id);

export function material(id: MaterialId): Material {
  return MATERIALS.find((m) => m.id === id)!;
}

/** Where each choice peaks on the middle meters, for the note over the choices. */
export const MATERIALS_NOTE = `With MASTER LEVEL fully up, the middle meters show a quiet track at ${meterWords(TARGET_PEAK_DB.first)}, a loud one at ${meterWords(LOUD_DB)} and the blend at ${meterWords(BLEND_DB)}.`;

/**
 * MASTER LEVEL. Fully up is 0 dB: it can only turn things down, and fully down is off. The model
 * moves it in notches of 3 dB, so "a notch" is one step, down to −24 dB and then off.
 */
export const LEVEL = { max: RANGES.masterLevel.max, lowest: -24, step: 3 } as const;
export const NOTCH_DB = LEVEL.step;
/** Every position the knob can sit at, off first. Off is −∞ dB. */
export const LEVEL_NOTCHES: readonly number[] = [
  Number.NEGATIVE_INFINITY,
  ...Array.from({ length: (LEVEL.max - LEVEL.lowest) / NOTCH_DB + 1 }, (_, i) => LEVEL.lowest + i * NOTCH_DB),
];

/** The nearest position on the knob to a level, in dB. */
export function nearestNotch(db: number): number {
  if (!Number.isFinite(db)) return db > 0 ? LEVEL.max : Number.NEGATIVE_INFINITY;
  if (db < LEVEL.lowest - NOTCH_DB / 2) return Number.NEGATIVE_INFINITY;
  const n = Math.round((Math.min(LEVEL.max, db) - LEVEL.lowest) / NOTCH_DB);
  return LEVEL.lowest + Math.max(0, n) * NOTCH_DB;
}

/**
 * MASTER ATT (UTILITY → MASTER ATTENUATOR.), in the order you step through it. Pioneer's Operating
 * Instructions (p. 32) list 0 dB, as purchased, and −6 dB, and print the third as "+12 dB"; their
 * fix for distorted sound (p. 34) says "+12" too. The Quick Start Guide's fix (p. 17) prints
 * "−12 dB", and an attenuator only turns down, so it's −12.
 */
export const ATT_VALUES = [0, -6, -12] as const;
export type AttDb = (typeof ATT_VALUES)[number];
export const ATT_LOWEST: AttDb = ATT_VALUES[ATT_VALUES.length - 1]!;

export interface Rig {
  /** What's playing, or null before anything has been picked. */
  material: MaterialId | null;
  /** MASTER LEVEL, dB: 0 is fully up, −∞ is off. */
  level: number;
  /** MASTER ATT, dB. */
  att: AttDb;
}

export type Feed = Pick<Rig, 'level' | 'att'>;

/** Total gain between the mix and MASTER 2. */
export const feedDb = (feed: Feed): number => feed.level + feed.att;

/** Where a mix peak (meter dB) lands in the file (dBFS). −∞ with MASTER LEVEL off. */
export function filePeakDbfs(mixDb: number, feed: Feed, limit = HOWLER_LIMIT): number {
  return mixDb - limit + feedDb(feed);
}

/** What the middle meters show for a mix peak: they read after MASTER LEVEL, not after MASTER ATT. */
export const middleMeterDb = (mixDb: number, level: number): number => mixDb + level;

/** File peak for each material at this setting, in the order given. */
export function peaksFor(feed: Feed, order: readonly MaterialId[] = MATERIAL_IDS, limit = HOWLER_LIMIT) {
  return order.map((id) => ({ id, dbfs: filePeakDbfs(material(id).mixDb, feed, limit) }));
}

export type Light = 'off' | 'green' | 'red';

/**
 * The Howler's LEVEL light: blinking green below its limit and blinking red at or over it. In the
 * file, its limit is 0 dBFS. Howler doesn't say what it does with no sound at all, so the model
 * leaves it dark then: nothing playing, or MASTER LEVEL off.
 */
export function lightFor(rig: Rig, limit = HOWLER_LIMIT): Light {
  if (!rig.material || !Number.isFinite(rig.level)) return 'off';
  return filePeakDbfs(material(rig.material).mixDb, rig, limit) >= 0 ? 'red' : 'green';
}

const blendLight = (feed: Feed, limit: number) => lightFor({ material: 'blend', ...feed }, limit);

/* ---------------------------------------------------------------------------------------------
 * Where each step should leave the rig, found the only way the booth can show it: by the light.
 * ------------------------------------------------------------------------------------------- */

/** Step 3: with MASTER LEVEL fully up, the first MASTER ATT step where the blend stays green. */
export function targetAtt(limit = HOWLER_LIMIT): { att: AttDb; green: boolean } {
  const att = ATT_VALUES.find((a) => blendLight({ level: LEVEL.max, att: a }, limit) === 'green');
  return att === undefined ? { att: ATT_LOWEST, green: false } : { att, green: true };
}

/** With the loudest blend playing, the highest notch where the light stays green: the first steady green. */
export function firstGreen(att: AttDb, limit = HOWLER_LIMIT): number | null {
  for (let level = LEVEL.max; level >= LEVEL.lowest; level -= NOTCH_DB) {
    if (blendLight({ level, att }, limit) === 'green') return level;
  }
  return null;
}

/**
 * Step 4: where MASTER LEVEL ends up. Fully up if MASTER ATT got the light green. Still red with
 * MASTER ATT at its lowest? First steady green, then two notches down.
 */
export function targetLevel(limit = HOWLER_LIMIT): { level: number; fullyUp: boolean } {
  const { att, green } = targetAtt(limit);
  if (green) return { level: LEVEL.max, fullyUp: true };
  const first = firstGreen(att, limit);
  return { level: first === null ? LEVEL.lowest : Math.max(LEVEL.lowest, first - 2 * NOTCH_DB), fullyUp: false };
}

/* ---------------------------------------------------------------------------------------------
 * Judging each step. Verdicts are plain data so the reducer and the tests share them; the words
 * come from the message functions below.
 * ------------------------------------------------------------------------------------------- */

export type UpVerdict = { kind: 'taped' } | { kind: 'not-up'; level: number };

/** Step 1: MASTER LEVEL fully up, ready to tape. */
export function judgeUp(rig: Rig): UpVerdict {
  return rig.level === LEVEL.max ? { kind: 'taped' } : { kind: 'not-up', level: rig.level };
}

export type PlayVerdict =
  | { kind: 'nothing' }
  | { kind: 'off-tape'; tape: number }
  | { kind: 'wrong-material'; material: 'quiet' | 'loud' }
  | { kind: 'seen'; light: 'green' | 'red' };

/** Step 2: the loudest blend playing, with MASTER LEVEL still on its tape. */
export function judgePlay(rig: Rig, tape: number, limit = HOWLER_LIMIT): PlayVerdict {
  if (!rig.material) return { kind: 'nothing' };
  if (rig.level !== tape) return { kind: 'off-tape', tape };
  if (rig.material !== 'blend') return { kind: 'wrong-material', material: rig.material };
  return { kind: 'seen', light: lightFor(rig, limit) === 'red' ? 'red' : 'green' };
}

export type AttVerdict =
  | { kind: 'not-blend' }
  | { kind: 'level-moved'; tape: number }
  | { kind: 'still-red'; att: AttDb }
  /** Red even at MASTER ATT's lowest step: step 4's job. */
  | { kind: 'lowest-red' }
  | { kind: 'set'; att: AttDb; blendDbfs: number; loudDbfs: number }
  | { kind: 'too-low'; att: AttDb };

/** Step 3: MASTER ATT down a step at a time while the light is red, with MASTER LEVEL left on its tape. */
export function judgeAtt(rig: Rig, tape: number, limit = HOWLER_LIMIT): AttVerdict {
  if (rig.material !== 'blend') return { kind: 'not-blend' };
  if (rig.level !== tape) return { kind: 'level-moved', tape };
  const target = targetAtt(limit);
  if (lightFor(rig, limit) === 'red')
    return rig.att === ATT_LOWEST ? { kind: 'lowest-red' } : { kind: 'still-red', att: rig.att };
  if (rig.att < target.att) return { kind: 'too-low', att: target.att };
  return {
    kind: 'set',
    att: rig.att,
    blendDbfs: filePeakDbfs(material('blend').mixDb, rig, limit),
    loudDbfs: filePeakDbfs(material('loud').mixDb, rig, limit),
  };
}

export type LevelVerdict =
  | { kind: 'not-blend' }
  | { kind: 'att-changed'; att: AttDb }
  /** MASTER ATT got it green: MASTER LEVEL stays fully up, on its tape. */
  | { kind: 'stays-up' }
  | { kind: 'put-back-up' }
  | { kind: 'off' }
  | { kind: 'still-red' }
  | { kind: 'edge' }
  | { kind: 'too-low' }
  | { kind: 'set'; level: number; blendDbfs: number; metersLowDb: number };

/** Step 4: only if still red at MASTER ATT's lowest step, first steady green, then two notches down. */
export function judgeLevel(rig: Rig, att: AttDb, limit = HOWLER_LIMIT): LevelVerdict {
  if (rig.material !== 'blend') return { kind: 'not-blend' };
  if (rig.att !== att) return { kind: 'att-changed', att };
  const target = targetLevel(limit);
  if (target.fullyUp) return rig.level === LEVEL.max ? { kind: 'stays-up' } : { kind: 'put-back-up' };
  if (!Number.isFinite(rig.level)) return { kind: 'off' };
  if (lightFor(rig, limit) === 'red') return { kind: 'still-red' };
  if (rig.level > target.level) return { kind: 'edge' };
  if (rig.level < target.level) return { kind: 'too-low' };
  return {
    kind: 'set',
    level: rig.level,
    blendDbfs: filePeakDbfs(material('blend').mixDb, rig, limit),
    metersLowDb: LEVEL.max - rig.level,
  };
}

export type HoldVerdict =
  | { kind: 'held' }
  | { kind: 'level-moved'; tape: number }
  | { kind: 'att-changed'; att: AttDb };

/** Step 5: are MASTER LEVEL and MASTER ATT still where the tape says? */
export function judgeHold(rig: Rig, tape: number, att: AttDb): HoldVerdict {
  if (rig.level !== tape) return { kind: 'level-moved', tape };
  if (rig.att !== att) return { kind: 'att-changed', att };
  return { kind: 'held' };
}

/* ---------------------------------------------------------------------------------------------
 * Words. UK English, short, in what the booth shows. The file's numbers only come once a level is
 * set, as a test recording would show it: nobody can aim for them in the booth.
 * ------------------------------------------------------------------------------------------- */

const dbfs = (v: number) => formatDb(v, { unit: 'dBFS', signed: false });
const bare = (v: number) => formatDb(v, { unit: '', signed: false });
const db = (v: number) => formatDb(v, { signed: false });

/** The safety margin, worded the same everywhere. */
export const MARGIN = 'first steady green, then two notches down';

/** Where MASTER LEVEL is, in words: "at −9 dB", "off". */
export const levelWords = (level: number) => (Number.isFinite(level) ? `at ${db(level)}` : 'off');

/** Where a file peak sits, in words: "at −6 dBFS", "right at the top", "3 dB over the top". */
function peakPlace(peak: number): string {
  if (!Number.isFinite(peak)) return 'nowhere: nothing reaches the file';
  if (peak > 0) return `${db(peak)} over the top`;
  if (peak === 0) return 'right at the top';
  return `at ${dbfs(peak)}`;
}

const NOT_BLEND = 'Play the loudest blend. The light only shows what’s playing now.';

export function upMessage(v: UpVerdict): string {
  if (v.kind === 'taped') return 'Taped fully up and marked REC. The middle meters now show the mix itself.';
  return `Turn MASTER LEVEL fully up first. It’s ${levelWords(v.level)}.`;
}

export function playMessage(v: PlayVerdict): string {
  switch (v.kind) {
    case 'nothing':
      return 'Pick something to play first.';
    case 'off-tape':
      return `MASTER LEVEL is off its REC tape. Put it back ${v.tape === LEVEL.max ? 'fully up' : `on ${db(v.tape)}`}.`;
    case 'wrong-material':
      return v.material === 'quiet'
        ? 'That’s a quiet track, and the light only shows what’s playing now. Play the loudest blend.'
        : 'That’s one track. Two with their kicks lined up peak higher, so play the loudest blend.';
    case 'seen':
      return v.light === 'red'
        ? 'The light blinks red on the loudest blend, so the feed is too hot for the Howler.'
        : 'The light stays green, even on the loudest blend.';
  }
}

export function attMessage(v: AttVerdict): string {
  switch (v.kind) {
    case 'not-blend':
      return NOT_BLEND;
    case 'level-moved':
      return 'Leave MASTER LEVEL fully up, on its tape. Turned down, it hides a hot blend from the DJs, so trim with MASTER ATT.';
    case 'still-red':
      return v.att === ATT_VALUES[0]
        ? 'The light is red, so set MASTER ATT down a step.'
        : 'The light is still red, so set MASTER ATT down another step.';
    case 'lowest-red':
      return `Still red with MASTER ATT at ${db(ATT_LOWEST)}, its lowest step. MASTER LEVEL is next.`;
    case 'too-low':
      return `The light is green, but lower than it needs to be. Set MASTER ATT back up to ${db(v.att)}, the first step that stays green.`;
    case 'set':
      return v.att === ATT_VALUES[0]
        ? `Green with MASTER ATT at ${db(v.att)}, so leave it there. In the file, the blend peaks at ${dbfs(v.blendDbfs)}.`
        : `The light stays green through the loudest blend. In the file it peaks at ${dbfs(v.blendDbfs)}, and a loud track at ${bare(v.loudDbfs)}. Bring the room back up at the amps.`;
  }
}

export function levelMessage(v: LevelVerdict): string {
  switch (v.kind) {
    case 'not-blend':
      return NOT_BLEND;
    case 'att-changed':
      return `MASTER ATT has changed. Set it back to ${db(v.att)}.`;
    case 'stays-up':
      return 'The light is green with MASTER LEVEL fully up, so MASTER LEVEL stays there, on its REC tape.';
    case 'put-back-up':
      return 'The light is green with MASTER LEVEL fully up, so put it back there, on its tape. Turned down, the middle meters read low.';
    case 'off':
      return `MASTER LEVEL is off, so nothing reaches the Howler. Turn it up until the light blinks red, then back down to the ${MARGIN}.`;
    case 'still-red':
      return `Still red. Keep turning it down to the ${MARGIN}.`;
    case 'edge':
      return `The light is green, but only just. Aim for the ${MARGIN}.`;
    case 'too-low':
      return `Lower than it needs to be. Turn it up until the light blinks red, then back down to the ${MARGIN}.`;
    case 'set':
      return `Marked REC at ${db(v.level)}. In the file, the blend peaks at ${dbfs(v.blendDbfs)}. The middle meters now read ${db(v.metersLowDb)} low, so a blend can clip before they go red. Bring the room back up at the amps.`;
  }
}

export function holdMessage(v: HoldVerdict): string {
  switch (v.kind) {
    case 'held':
      return '';
    case 'level-moved':
      return `MASTER LEVEL is off its REC tape. Put it back ${v.tape === LEVEL.max ? 'fully up' : `on ${db(v.tape)}`}, then record.`;
    case 'att-changed':
      return `MASTER ATT has changed. Set it back to ${db(v.att)}, then record.`;
  }
}

/** The test clip, as a test recording would show it. */
export function recordedMessage(feed: Feed, limit = HOWLER_LIMIT): string {
  const blend = filePeakDbfs(material('blend').mixDb, feed, limit);
  return `Test clip recorded. The loudest blend peaks at ${dbfs(blend)}, and the light stayed green.`;
}

export const DONE_MESSAGE = 'Done. The record level is set, taped and tested.';

/**
 * What a DJ's MY SETTINGS can undo: MASTER ATT back at 0 dB, with the level as taped. Worked out
 * from the model rather than assumed.
 */
export function settingsMessage(tape: number, att: AttDb, limit = HOWLER_LIMIT): string {
  const reset: Feed = { level: tape, att: ATT_VALUES[0] };
  if (att === reset.att || blendLight(reset, limit) === 'green') {
    return 'If a DJ loads MY SETTINGS from USB, check UTILITY again, because it can change MASTER ATT.';
  }
  const blend = filePeakDbfs(material('blend').mixDb, reset, limit);
  const over =
    blend === 0 ? `the loudest blend would reach ${dbfs(0)}` : `the loudest blend would land ${db(blend)} over the top`;
  return `If a DJ loads MY SETTINGS from USB, MASTER ATT can change. Back at ${db(reset.att)}, ${over}. Check it at every changeover.`;
}

/** Words for the LEVEL light, shown with the drawing. */
export const LIGHT_WORDS: Record<Light, string> = {
  off: 'dark, no sound reaching it',
  green: 'blinking green',
  red: 'blinking red, too hot',
};

/** The sentence a screen reader hears when something new starts playing. */
export function statusSentence(rig: Rig, limit = HOWLER_LIMIT): string {
  if (!rig.material) return 'Nothing playing. The Howler light is dark.';
  const m = material(rig.material);
  if (!Number.isFinite(rig.level)) return `${m.name} playing, but MASTER LEVEL is off. The Howler light is dark.`;
  const peak = filePeakDbfs(m.mixDb, rig, limit);
  return `${m.name} playing. The Howler light blinks ${lightFor(rig, limit)}. It peaks ${peakPlace(peak)} in the file.`;
}

/** The parts of the rig the live region reports on. MASTER LEVEL's position is spoken by its slider. */
export interface RigNews {
  material: MaterialId | null;
  light: Light;
  att: AttDb;
}

export const rigNews = (rig: Rig, limit = HOWLER_LIMIT): RigNews => ({
  material: rig.material,
  light: lightFor(rig, limit),
  att: rig.att,
});

/**
 * What a screen reader hears once the rig settles: only what changed since `before`. Something new
 * playing gets the whole status sentence, and a new light or MASTER ATT setting a short one.
 * MASTER LEVEL moving within the same light gets nothing here, because its slider already says
 * where the peak lands (`spokenLevel`). `att` is the MASTER ATT step the walkthrough has set, once
 * there is one.
 */
export function newsSince(before: RigNews, rig: Rig, att: AttDb | null = null, limit = HOWLER_LIMIT): string | null {
  if (rig.material !== before.material) return statusSentence(rig, limit);
  if (!rig.material) return null;
  const light = lightFor(rig, limit);
  const attMoved = rig.att !== before.att;
  if (!attMoved && light === before.light) return null;
  const lightWords = `The Howler light is ${light === before.light ? 'still' : 'now'} ${LIGHT_WORDS[light]}.`;
  if (!attMoved) return lightWords;
  const m = material(rig.material);
  const peak = filePeakDbfs(m.mixDb, rig, limit);
  const set = att === null ? '' : rig.att === att ? ' That’s where you set it.' : ' That’s not where you set it.';
  return `MASTER ATT at ${db(rig.att)}. ${lightWords} ${m.name} now peaks ${peakPlace(peak)} in the file.${set}`;
}

/**
 * MASTER LEVEL's spoken value: its position, whether that's off the tape, and where what's playing
 * lands in the file, spelled out ("minus 9 decibels. The loudest blend peaks at minus 3 dBFS").
 */
export function spokenLevel(rig: Rig, tape: number | null, limit = HOWLER_LIMIT): string {
  const where = !Number.isFinite(rig.level)
    ? 'off'
    : rig.level === LEVEL.max
      ? `${speakDb(rig.level)}, fully up`
      : speakDb(rig.level);
  const off =
    tape === null || rig.level === tape
      ? ''
      : Number.isFinite(rig.level)
        ? ', off the REC tape'
        : ', not on the REC tape';
  return `${where}${off}${rig.material ? `. ${spokenPeak(rig, limit)}` : ''}`;
}

/** Where what's playing lands in the file, in words. Null with nothing playing. */
export function spokenPeak(rig: Rig, limit = HOWLER_LIMIT): string | null {
  if (!rig.material) return null;
  const m = material(rig.material);
  if (!Number.isFinite(rig.level)) return 'Nothing reaches the Howler';
  const peak = filePeakDbfs(m.mixDb, rig, limit);
  if (peak > 0) return `${m.name} peaks ${formatDb(peak, { unit: 'decibels', signed: false })} over the top, clipped`;
  if (peak === 0) return `${m.name} peaks right at the top, clipped`;
  return `${m.name} peaks at ${speakDb(peak, { unit: 'dBFS' })}`;
}

/* ---------------------------------------------------------------------------------------------
 * The practice round: a fresh, shuffled start.
 * ------------------------------------------------------------------------------------------- */

/** A random order for the choices that never puts them in the worked example's order. */
export function shuffledOrder(rand: () => number): MaterialId[] {
  for (;;) {
    const order = [...MATERIAL_IDS];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (order.some((id, i) => id !== MATERIAL_IDS[i])) return order;
  }
}

/**
 * The rig "as found": MASTER LEVEL somewhere below fully up (a DJ turned the room down with it),
 * never off, and MASTER ATT on any step (a DJ's MY SETTINGS can change it). Step 1 always has work.
 */
export function randomFound(rand: () => number): Feed {
  const levels = LEVEL_NOTCHES.filter((n) => Number.isFinite(n) && n < LEVEL.max);
  return {
    level: levels[Math.floor(rand() * levels.length)]!,
    att: ATT_VALUES[Math.floor(rand() * ATT_VALUES.length)]!,
  };
}
