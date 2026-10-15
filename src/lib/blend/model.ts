/**
 * The model behind the blend lab ("Blends add up").
 *
 *   track A ─► TRIM ─► LOW ─► CH1 meter ─► fader 1 ─┐
 *                                                     ├─► sum ─► MASTER meter + CLIP ─► ceiling (+12)
 *   track B ─► TRIM ─► LOW ─► CH2 meter ─► fader 2 ─┘
 *
 * - Samples use the site's meter scale (xdj.ts): a sample value of 1.0 reads +12 dB, the red LED,
 *   which is also the mixer's ceiling in our model. Anything past it is cut flat: on each channel
 *   before its fader (the red on a channel meter), and again on the sum (the red on MASTER).
 * - TRIM is expressed the way a DJ sets it: where the track peaks on its channel meter with the
 *   EQ flat. The synth loops are normalised to a peak of exactly 1.0, so the gain is simply
 *   `meterDbToSample(trim)`.
 * - LOW turns the synth's `low` stem (kick and bass line) up, from flat to +6 dB: the boost half
 *   of the EQ (LOW, below, says why the cut half is left out).
 * - The channel meters read after TRIM and EQ and before the fader, as we assume for the XDJ-RX2
 *   (the guide's section on what the makers publish). Only the master meter sees the sum.
 * - The crossfader is assumed to be on THRU, Pioneer's setting for not using it (manual p. 28), so
 *   only the channel faders count. The lab's notes say so (copy.ts, MODEL_NOTES).
 * - The DJ box's targets come from model.ts: a channel on the first orange (TARGET_PEAK_DB.aim),
 *   and the MASTER meters' top orange (TARGET_PEAK_DB.top) dark. The lab's four steps practise
 *   both (STEP_START).
 * - Every level is measured at one fixed rate (ANALYSIS_RATE), so the server render, the browser
 *   and the tests agree to the sample. Kicks stack by a slightly different amount at other rates.
 */
import { clip, peak } from '../dsp/analysis';
import { dbToGain } from '../dsp/db';
import { kWeightedPower } from '../dsp/loudness';
import { type Loop, normaliseLoop, renderLoop } from '../dsp/synth';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { CEILING_DB, METER_SEGMENTS, meterDbToSample, RANGES, sampleToMeterDb } from '../xdj';

/** Levels, meters and the waveform are all measured at this rate. */
export const ANALYSIS_RATE = 48_000;

export interface DeckSettings {
  /** Where the track peaks on its channel meter with the EQ flat, in meter dB. */
  trim: number;
  /** LOW EQ in dB: 0 (flat, the knob's 12 o'clock) to +6. */
  low: number;
  /** Channel fader position: 0 is closed, 10 is fully up. */
  fader: number;
}

export interface BlendSettings {
  deck1: DeckSettings;
  deck2: DeckSettings;
  /**
   * Kicks lined up (beatmatched), or deck 2 landing a 16th note late. The lab always lines them
   * up; the tests use the late case to measure how much less misaligned kicks add.
   */
  aligned: boolean;
}

export type ClipState = 'off' | 'slow' | 'fast';

/**
 * TRIM range, as the channel meter reading it produces with the EQ flat. It starts on the second
 * orange, one light over the DJ box's aim: the highest level from which a blend with the kicks
 * lined up reaches the MASTER meters' top orange (+3, and 6 dB more is +9).
 */
export const TRIM = { min: -6, max: 12, step: 1, initial: TARGET_PEAK_DB.top - KICKS_TOGETHER_DB } as const;

/**
 * The LOW knob's boost half, 1 dB a step: flat (12 o'clock) to fully right, the panel's +6
 * (xdj.ts). It shows what a boost adds. The cut half is left out on purpose. These loops peak on
 * their kick, so here a LOW cut would take a blend well down. On released tracks it did not: on 9
 * of 10 we measured, taking the lows out raised the track's own peak, and a minute's blend with
 * one LOW cut peaked no lower, at the median, than with both flat. A fader brought it down
 * (guide 2.4).
 */
export const LOW = { min: 0, max: RANGES.eq.max, step: 1 } as const;

/**
 * Channel fader travel. One step is one printed mark, so a −/+ press moves the cap a whole mark:
 * from the red, one press on deck 1 lights CLIP and a second clears it.
 */
export const FADER = { min: 0, max: 10, step: 1 } as const;

/**
 * Channel fader curve, position → dB. Modelled on a typical DJ mixer's default curve, which
 * loses little in the top half and falls away fast near the bottom:
 *
 *   10 → 0 dB · 8 → −6 dB · 6 → −12 dB · 4 → −20 dB · 2 → −35 dB · 0 → off
 *
 * Between those points the curve is a straight line in dB. Below 2 it fades linearly in gain to
 * silence. Pioneer describes the XDJ-RX2's three channel fader curves only in words (manual pp. 27
 * and 32: CURVE1, CURVE2, the factory setting, and CURVE3), with no dB figures, so this is a model.
 */
export const FADER_CURVE: ReadonlyArray<readonly [position: number, db: number]> = [
  [2, -35],
  [4, -20],
  [6, -12],
  [8, -6],
  [10, 0],
];

/** The fader's gain in dB at a position (−Infinity when closed). */
export function faderDb(position: number): number {
  const p = Math.min(FADER.max, Math.max(FADER.min, position));
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  const first = FADER_CURVE[0]!;
  if (p < first[0]) return 20 * Math.log10((dbToGain(first[1]) * p) / first[0]);
  for (let k = 1; k < FADER_CURVE.length; k++) {
    const [x0, y0] = FADER_CURVE[k - 1]!;
    const [x1, y1] = FADER_CURVE[k]!;
    if (p <= x1) return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0;
}

/** The fader's linear gain at a position. */
export const faderGain = (position: number): number => {
  const db = faderDb(position);
  return Number.isFinite(db) ? dbToGain(db) : 0;
};

/**
 * CLIP blinks slowly within this many dB below the red LED, and fast once the sum is past it.
 * Pioneer says what the two blinks mean but not the levels where they start, so this is a model.
 */
export const CLIP_SLOW_RANGE_DB = 1.5;

export function clipState(mixDb: number): ClipState {
  if (mixDb > CEILING_DB) return 'fast';
  if (mixDb >= CEILING_DB - CLIP_SLOW_RANGE_DB) return 'slow';
  return 'off';
}

/**
 * How close to a light's mark counts as reaching it. A TRIM of +6 can measure 5.999999…: rounding
 * noise, not a level under the light.
 */
const MARK_TOLERANCE_DB = 1e-6;

/**
 * A level rounded to whole dB for display, without ever rounding up to a light that is still dark.
 * So "+12 dB" always means the red light is on, "+9 dB" the top orange, "0 dB" the first orange,
 * and a number never contradicts the colour words or the LEDs next to it.
 */
export function displayDb(db: number): number {
  if (!Number.isFinite(db)) return db;
  let r = Math.round(db);
  for (const { db: mark } of METER_SEGMENTS) if (db < mark - MARK_TOLERANCE_DB && r >= mark) r = mark - 1;
  return r === 0 ? 0 : r;
}

// ---------------------------------------------------------------------------------------------
// The two tracks

export interface Tracks {
  a: Loop;
  b: Loop;
  sampleRate: number;
  length: number;
  beatLength: number;
  /** A 16th note in samples: how late deck 2 lands when the kicks are apart. */
  sixteenth: number;
}

const cache = new Map<number, Tracks>();

/** Both synth tracks at a sample rate, each normalised so its full mix peaks at exactly 1.0. */
export function tracksAt(sampleRate: number): Tracks {
  let t = cache.get(sampleRate);
  if (!t) {
    const a = normaliseLoop(renderLoop({ sampleRate, track: 'a' }), 0);
    const b = normaliseLoop(renderLoop({ sampleRate, track: 'b' }), 0);
    t = { a, b, sampleRate, length: a.length, beatLength: a.beatLength, sixteenth: Math.round(a.beatLength / 4) };
    cache.set(sampleRate, t);
  }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Analysis

/** The stretch the waveform strip shows: two beats, from half a beat before a kick. */
export const VIEW = { startBeat: 3.5, beats: 2 } as const;

export interface BlendView {
  /** Post-fader samples for the two beats on screen. */
  deck1: Float32Array;
  deck2: Float32Array;
  /** Their sum before the ceiling. The part past ±1 is what the ceiling cuts off. */
  mix: Float32Array;
  /** Samples per beat, for the beat lines. */
  beatLength: number;
}

export interface BlendAnalysis {
  /**
   * Peak on each channel meter: after TRIM and LOW, before the fader. Meter dB. Past +12 this is
   * where the track would peak: the channel's own ceiling cuts it flat before the fader.
   */
  channel: [number, number];
  /** Peak of the sum before the ceiling, in meter dB. Past +12, the ceiling cuts it flat. */
  mix: number;
  clip: ClipState;
  view: BlendView;
}

/** Deck gains for one set of settings. */
function gains(s: BlendSettings) {
  return {
    t1: meterDbToSample(s.deck1.trim),
    t2: meterDbToSample(s.deck2.trim),
    l1: dbToGain(s.deck1.low),
    l2: dbToGain(s.deck2.low),
    f1: faderGain(s.deck1.fader),
    f2: faderGain(s.deck2.fader),
  };
}

/** Measure a blend: both channel meters, the master meter and the two beats on screen. */
export function analyseBlend(s: BlendSettings, tracks: Tracks = tracksAt(ANALYSIS_RATE)): BlendAnalysis {
  const { a, b, length: n, beatLength } = tracks;
  const { t1, t2, l1, l2, f1, f2 } = gains(s);
  const shift = s.aligned ? 0 : tracks.sixteenth;
  const viewStart = Math.round(VIEW.startBeat * beatLength);
  const viewCount = Math.round(VIEW.beats * beatLength);
  const v1 = new Float32Array(viewCount);
  const v2 = new Float32Array(viewCount);
  const vm = new Float32Array(viewCount);
  let p1 = 0;
  let p2 = 0;
  let pm = 0;
  for (let i = 0; i < n; i++) {
    const j = (i - shift + n) % n;
    const d1 = t1 * (l1 * a.low[i]! + a.mid[i]! + a.high[i]!);
    const d2 = t2 * (l2 * b.low[j]! + b.mid[j]! + b.high[j]!);
    // Each channel hits its own ceiling before its fader, so a fader can't undo a red channel.
    const o1 = f1 * clip(d1);
    const o2 = f2 * clip(d2);
    const m = o1 + o2;
    const ad1 = Math.abs(d1);
    const ad2 = Math.abs(d2);
    const am = Math.abs(m);
    if (ad1 > p1) p1 = ad1;
    if (ad2 > p2) p2 = ad2;
    if (am > pm) pm = am;
    const k = i - viewStart;
    if (k >= 0 && k < viewCount) {
      v1[k] = o1;
      v2[k] = o2;
      vm[k] = m;
    }
  }
  const mix = sampleToMeterDb(pm);
  return {
    channel: [sampleToMeterDb(p1), sampleToMeterDb(p2)],
    mix,
    clip: clipState(mix),
    view: { deck1: v1, deck2: v2, mix: vm, beatLength },
  };
}

/**
 * One loop of the blend as the mixer outputs it: each channel through its own ceiling, then its
 * fader, then the sum through the mixer's ceiling (±1). `clean` leaves every ceiling out: the same
 * blend as it would be with nothing cut, to hear beside it.
 */
export function renderMix(s: BlendSettings, tracks: Tracks, clean = false): Float32Array {
  const { a, b, length: n } = tracks;
  const { t1, t2, l1, l2, f1, f2 } = gains(s);
  const shift = s.aligned ? 0 : tracks.sixteenth;
  const cut = clean ? (v: number) => v : clip;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i - shift + n) % n;
    const d1 = t1 * (l1 * a.low[i]! + a.mid[i]! + a.high[i]!);
    const d2 = t2 * (l2 * b.low[j]! + b.mid[j]! + b.high[j]!);
    out[i] = cut(f1 * cut(d1) + f2 * cut(d2));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The steps

const deck = (trim: number, low: number, fader: number): DeckSettings => ({ trim, low, fader });

/**
 * Four steps, each opening on a mixer set for it, with every control live throughout: it is a
 * mixer, and anything a DJ can do to one, the reader can do here, the red included.
 *
 *   1. Bring deck 2 in: both tracks on the second orange, deck 1 playing, deck 2's fader down.
 *      Up it comes, and the MASTER meters light the top orange: the peaks add.
 *   2. Fix it with a fader: the same blend, deck 2 up. Pull deck 1's fader down until the top
 *      orange goes dark, the DJ box's line for the MASTER meters.
 *   3. Push it into the red: both faders up, both TRIMs turned up until each channel shows the
 *      top orange. Neither channel is in the red, and the mix is 3 dB past it: the crunch to hear.
 *   4. Leave room with TRIM: deck 1 on the first orange, deck 2 cued on the second. Set deck 2's
 *      TRIM to the first orange and bring it in: the top orange stays dark. The DJ box's line for
 *      the channel meters.
 */
export type Step = 1 | 2 | 3 | 4;
export const STEP_COUNT = 4;

export const STEP_START: Record<Step, BlendSettings> = {
  1: { deck1: deck(TRIM.initial, 0, FADER.max), deck2: deck(TRIM.initial, 0, FADER.min), aligned: true },
  2: { deck1: deck(TRIM.initial, 0, FADER.max), deck2: deck(TRIM.initial, 0, FADER.max), aligned: true },
  3: { deck1: deck(TRIM.initial, 0, FADER.max), deck2: deck(TRIM.initial, 0, FADER.max), aligned: true },
  4: { deck1: deck(TARGET_PEAK_DB.aim, 0, FADER.max), deck2: deck(TRIM.initial, 0, FADER.min), aligned: true },
};

/** Where the lab starts: step 1. */
export const START: BlendSettings = STEP_START[1];

/** The controls each step asks for, printed in the action colour until the reader moves one. */
export type Control = 'fader1' | 'fader2' | 'trim1' | 'trim2';
export const STEP_CONTROLS: Record<Step, readonly Control[]> = {
  1: ['fader2'],
  2: ['fader1'],
  3: ['trim1', 'trim2'],
  4: ['trim2', 'fader2'],
};

export function cloneSettings(s: BlendSettings): BlendSettings {
  return { deck1: { ...s.deck1 }, deck2: { ...s.deck2 }, aligned: s.aligned };
}

const sameDeck = (x: DeckSettings, y: DeckSettings) => x.trim === y.trim && x.low === y.low && x.fader === y.fader;

export function sameSettings(x: BlendSettings, y: BlendSettings): boolean {
  return x.aligned === y.aligned && sameDeck(x.deck1, y.deck1) && sameDeck(x.deck2, y.deck2);
}

/** The mark of the highest light a level lights on a meter, as the meter shows it, or null if none. */
export function topLight(db: number): number | null {
  const shown = displayDb(db);
  let top: number | null = null;
  for (const { db: mark } of METER_SEGMENTS) if (shown >= mark) top = mark;
  return top;
}

/**
 * "Deck 2 all the way up, and the top orange dark on the MASTER meters": the DJ box's line for
 * them, and the goal of steps 2 and 4. It only counts as a blend if the kicks are lined up and
 * deck 1 is still audibly in the mix (fader at 4, about −20 dB, or higher). Red and CLIP fail it
 * too. The channel meters have to stay out of the red as well: a red channel is cut flat before
 * its fader, so easing that fader after it can't make the blend clean.
 */
export const CHALLENGE = { deck1MinFader: 4 } as const;

export type ChallengeStatus = 'waiting' | 'red' | 'clip' | 'top' | 'hot1' | 'hot2' | 'apart' | 'cut' | 'done';

/** The MASTER meters light the top orange (or more): the DJ box's line for them says keep it dark. */
export const topLit = (r: BlendAnalysis): boolean => displayDb(r.mix) >= TARGET_PEAK_DB.top;

/** Which decks light the red LED on their own channel meter. */
export function hotDecks(r: BlendAnalysis): Array<1 | 2> {
  const hot: Array<1 | 2> = [];
  if (displayDb(r.channel[0]) >= CEILING_DB) hot.push(1);
  if (displayDb(r.channel[1]) >= CEILING_DB) hot.push(2);
  return hot;
}

export function challengeStatus(s: BlendSettings, r: BlendAnalysis): ChallengeStatus {
  if (s.deck2.fader < FADER.max) return 'waiting';
  if (displayDb(r.mix) >= CEILING_DB) return 'red';
  if (r.clip !== 'off') return 'clip';
  if (topLit(r)) return 'top';
  const [hot] = hotDecks(r);
  if (hot) return hot === 1 ? 'hot1' : 'hot2';
  if (!s.aligned) return 'apart';
  if (s.deck1.fader < CHALLENGE.deck1MinFader) return 'cut';
  return 'done';
}

/** Both channel meters light the same light at the top: the first orange, say, or the top orange. */
const bothOn = (r: BlendAnalysis, mark: number) => topLight(r.channel[0]) === mark && topLight(r.channel[1]) === mark;

/**
 * Has the reader done what the step asks?
 *
 * Step 1 asks only for deck 2 all the way up: what the meters then show is the lesson, whatever
 * it is. Step 3 asks for both channels on the top orange with both faders up, where the mix is 3 dB
 * past the red, far enough to hear: passing through the red on the way (two tracks on the third
 * orange) only shaves the tips (barelyOver). Step 4 asks for the blend done with both channels on
 * the first orange.
 */
export function stepDone(step: Step, s: BlendSettings, r: BlendAnalysis): boolean {
  switch (step) {
    case 1:
      return s.deck2.fader === FADER.max;
    case 2:
      return challengeStatus(s, r) === 'done';
    case 3:
      return s.deck1.fader === FADER.max && s.deck2.fader === FADER.max && bothOn(r, TARGET_PEAK_DB.top);
    case 4:
      return challengeStatus(s, r) === 'done' && bothOn(r, TARGET_PEAK_DB.aim);
  }
}

/**
 * How far past the red the ceiling only shaves the tips of the kicks: every level the lab shows
 * as "+12 dB". Up to here it cuts away at most about 0.3% of these loops (RMS, at 44.1 or 48 kHz,
 * even when a channel and the mix both touch), too little to hear. By +13.5 a cut on a channel
 * and again on the mix can reach 2.3%, close to Top orange (2.1 to 2.5%). Two tracks on the third
 * orange (+6), blended, land here. The two-ceilings lab names the same cut "Tips cut"
 * (lab/ceilings.ts, CRUNCH_LIMITS).
 */
export const BARELY_OVER_DB = 0.5;

/**
 * The loudest point, on the MASTER meters or on a channel before its fader, lights the red but
 * is less than BARELY_OVER_DB past it. The meters say red while Listen still sounds clean, and
 * the lab says why, so the red never passes for fine.
 */
export function barelyOver(r: BlendAnalysis): boolean {
  const top = Math.max(r.mix, r.channel[0], r.channel[1]);
  return displayDb(top) >= CEILING_DB && top < CEILING_DB + BARELY_OVER_DB;
}

// ---------------------------------------------------------------------------------------------
// Listening

/**
 * Every setting plays at the loudness of a blend of two tracks on the first orange, both faders
 * up, so a setting that clips never sounds better just by being louder (the site's
 * loudness-matching rule), and a clean setting never sounds worse by being quieter. Silence stays
 * silent. The clean version of a blend plays at the same loudness, so only the crunch changes.
 */
export const LISTEN_REFERENCE: BlendSettings = {
  deck1: deck(TARGET_PEAK_DB.aim, 0, FADER.max),
  deck2: deck(TARGET_PEAK_DB.aim, 0, FADER.max),
  aligned: true,
};
/**
 * Lifts the reference blend from −6 dBFS (its peak at meter +6) to −4 dBFS. At this makeup every
 * setting the lab can reach plays at the reference loudness inside the peak limit, at 44.1, 48,
 * 88.2 and 96 kHz. The spikiest is the reference itself, at a peak of 0.63: two equal decks with
 * LOW flat, their kicks stacked.
 */
export const LISTEN_MAKEUP_DB = 2;
/** Buffers stay inside ±1, the audio engine's contract. */
const LISTEN_PEAK_LIMIT = 0.98;

const referencePower = new Map<number, number>();

/**
 * One loop of the blend at the current settings, for LoopPlayer: through the ceilings, or with
 * none (`clean`), loudness-matched either way.
 */
export function listenBuffer(s: BlendSettings, sampleRate: number, clean = false): Float32Array {
  const tracks = tracksAt(sampleRate);
  const mix = renderMix(s, tracks, clean);
  let ref = referencePower.get(sampleRate);
  if (ref === undefined) {
    ref = kWeightedPower(renderMix(LISTEN_REFERENCE, tracks), sampleRate);
    referencePower.set(sampleRate, ref);
  }
  const power = kWeightedPower(mix, sampleRate);
  const p = peak(mix);
  if (power === 0 || p === 0) return mix;
  let g = Math.sqrt(ref / power) * dbToGain(LISTEN_MAKEUP_DB);
  if (p * g > LISTEN_PEAK_LIMIT) g = LISTEN_PEAK_LIMIT / p;
  for (let i = 0; i < mix.length; i++) mix[i] = mix[i]! * g;
  return mix;
}
