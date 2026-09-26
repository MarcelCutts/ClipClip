/**
 * Words for the blend lab. The reactive sentence is built from segments so the page can
 * emphasise the numbers and keep "+12 dB" on one line, and so tests can read it as plain text.
 * Every line states what the meters show, or what to do next, with a number where it helps.
 *
 * The lab always blends with the kicks lined up, as a beatmatched blend does. The model can land
 * deck 2 a 16th note late (`aligned: false`), but the lab has no control for it, so these words
 * describe lined-up kicks only.
 */
import { formatDb, speakDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { CEILING_DB, describeLevel, type Zone, zoneFor } from '../xdj';
import {
  type BlendAnalysis,
  type BlendSettings,
  type ChallengeStatus,
  CLIP_SLOW_RANGE_DB,
  displayDb,
  FADER,
  faderDb,
  hotDecks,
  LOW,
  type PresetGroup,
  preset,
  TRIM,
  topLit,
} from './model';

export interface Segment {
  text: string;
  /** 'value' is a result to emphasise, 'num' a number that must not wrap, 'zone' a colour word. */
  kind?: 'value' | 'num' | 'zone';
  zone?: Zone | null;
}

const t = (text: string): Segment => ({ text });
const value = (db: number): Segment => ({ text: formatDb(db), kind: 'value' });
const num = (db: number): Segment => ({ text: formatDb(db), kind: 'num' });

/** The most two equal peaks landing together can add: "6 dB". */
const BLEND_ADDS = formatDb(KICKS_TOGETHER_DB, { signed: false });

/**
 * Colour words for a displayed level, like the meter would show it. The top orange gets its own
 * words: the DJ box keeps it dark on the MASTER meters.
 */
export function zonePhrase(db: number): string {
  if (db > CEILING_DB) return `${formatDb(db - CEILING_DB, { signed: false })} over the red`;
  if (db === CEILING_DB) return 'in the red';
  if (db >= TARGET_PEAK_DB.top) return 'on the top orange';
  if (db >= 0) return 'in the orange';
  return 'in the green';
}

const zone = (db: number): Segment => ({ text: zonePhrase(db), kind: 'zone', zone: zoneFor(db) });
const peaksAt = (db: number) => (db > CEILING_DB ? 'would peak at' : 'peaks at');

/**
 * First sentence: what the two channel meters say. Past the red a track "would peak" there,
 * because its channel cuts it flat first.
 */
export function channelSentence(r: BlendAnalysis): Segment[] {
  const [c1, c2] = r.channel.map(displayDb) as [number, number];
  if (c1 === c2) return [t(`Each deck ${peaksAt(c1)} `), value(c1), t(' on its own.')];
  if (peaksAt(c1) === peaksAt(c2)) {
    return [t(`On its own, deck 1 ${peaksAt(c1)} `), value(c1), t(' and deck 2 at '), value(c2), t('.')];
  }
  return [t(`On its own, deck 1 ${peaksAt(c1)} `), value(c1), t(`, and deck 2 ${peaksAt(c2)} `), value(c2), t('.')];
}

/** Second sentence: what the blend does on the MASTER meters. */
export function mixSentence(s: BlendSettings, r: BlendAnalysis): Segment[] {
  const open1 = s.deck1.fader > FADER.min;
  const open2 = s.deck2.fader > FADER.min;
  const m = displayDb(r.mix);
  if (!open1 && !open2) return [t('Both faders are down. The mix is silent.')];
  if (!open1 || !open2) {
    const on = open1 ? 1 : 2;
    const off = open1 ? 2 : 1;
    return [
      t(`Deck ${off}’s fader is down. The mix is deck ${on} alone. It ${peaksAt(m)} `),
      value(m),
      t(', '),
      zone(m),
      t('.'),
    ];
  }
  const lowered1 = s.deck1.fader < FADER.max;
  const lowered2 = s.deck2.fader < FADER.max;
  const lead: Segment[] =
    lowered1 && lowered2
      ? [t('Together, with both faders lowered')]
      : lowered1 || lowered2
        ? [
            t(`Together, with deck ${lowered1 ? 1 : 2}’s fader at `),
            num(faderDb(lowered1 ? s.deck1.fader : s.deck2.fader)),
          ]
        : [t('Together')];
  return [...lead, t(`, the mix ${peaksAt(m)} `), value(m), t(', '), zone(m), t('.')];
}

/** The reactive sentence under the pads. */
export function blendSentence(s: BlendSettings, r: BlendAnalysis): Segment[] {
  return [...channelSentence(r), t(' '), ...mixSentence(s, r)];
}

export const plain = (segments: Segment[]): string => segments.map((x) => x.text).join('');

/**
 * A channel in the red: say so first, whatever the faders do, since its fader comes too late.
 * Name the LOW when it's boosted, as that's the likelier cause: back to flat takes the boost off.
 */
function hotChannel(s: BlendSettings, r: BlendAnalysis): string | null {
  const hot = hotDecks(r);
  if (hot.length === 0) return null;
  const decks = hot.map((n) => (n === 1 ? s.deck1 : s.deck2));
  const fix = decks.some((d) => d.low > 0) ? 'LOW or TRIM' : 'TRIM';
  if (hot.length === 2) return `Both decks hit the red before their faders. Turn the ${fix} down on each.`;
  return `Deck ${hot[0]} hits the red before its fader. Turn its ${fix} down.`;
}

/** One line on why the blend landed where it did, or what to do next. */
export function explainBlend(s: BlendSettings, r: BlendAnalysis): string {
  const open1 = s.deck1.fader > FADER.min;
  const open2 = s.deck2.fader > FADER.min;
  const channel = hotChannel(s, r);
  if (channel) return channel;
  if (!open1 && !open2) return 'Push a fader up to hear the mix.';
  if (!open2) return 'Bring deck 2’s fader up. Watch the MASTER meters.';
  if (!open1) return 'Bring deck 1’s fader up. Watch the MASTER meters.';

  // The top orange lights before CLIP and the red, so this covers all three.
  const red = displayDb(r.mix) >= CEILING_DB;
  const over = topLit(r);
  const boosts = [s.deck1.low, s.deck2.low].filter((low) => low > 0).length;
  const lowered = [s.deck1.fader, s.deck2.fader].filter((f) => f < FADER.max).length;
  const still = red ? 'Together they still reach the red.' : 'Together they still light the top orange.';

  if (over) {
    if (boosts === 2) return 'Both LOW boosts raise their decks’ peaks, and the blend rises with them.';
    if (boosts === 1) return 'The LOW boost raises its deck’s peak, and the blend rises with it.';
    if (lowered === 2) return `Both faders are down a little. ${still}`;
    if (lowered === 1 && s.deck2.fader < FADER.max) return 'The blend peaks higher as deck 2 comes in.';
    if (lowered === 1) return `Deck 1 is only a little lower. ${still}`;
    return `When both tracks peak at once, the peaks add. Two equal peaks can reach ${BLEND_ADDS} higher, two lights up the meter.`;
  }
  if (lowered === 1)
    return `Deck ${s.deck1.fader < FADER.max ? 1 : 2} sits lower in the mix. It adds less to the blend.`;
  if (lowered === 2) return 'Both decks sit lower in the mix. The blend peaks lower.';
  if (s.deck1.trim === TARGET_PEAK_DB.aim && s.deck2.trim === TARGET_PEAK_DB.aim)
    return `Tracks that peak on the first orange leave room for what a blend adds, up to ${BLEND_ADDS}.`;
  if (s.deck1.trim < TRIM.initial || s.deck2.trim < TRIM.initial)
    return 'Lower TRIMs leave room for what the blend adds.';
  return 'When both tracks peak at once, the peaks add. Watch the MASTER meters.';
}

/** The DJ box's line for the MASTER meters, as the lab's task (rules.ts: "top orange dark"). */
export const CHALLENGE_PROMPT = 'Bring deck 2 all the way up without lighting the top orange on the MASTER meters.';

export type StatusTone = 'todo' | 'near' | 'over' | 'done';

export interface StatusLine {
  /** The state in a word or three, set in bold: "Done.", "Top orange lit.". */
  state: string;
  /** What it means, or what to do. */
  detail: string;
  tone: StatusTone;
}

/** The fix for every state past the top orange: deck 2 stays up, the challenge says so. */
const BRING_DOWN = 'Bring the mix down another way.';

/**
 * How the challenge is going, in one line under the prompt in the panel's title strip: the state,
 * then what it means. Each fits two lines on the narrowest phone, where the strip keeps two lines'
 * room, so a slider never moves while the words change (BlendLab). The live region says the longer
 * challenge message instead, which names the MASTER meters.
 */
export function statusLine(status: ChallengeStatus): StatusLine {
  switch (status) {
    case 'done':
      return { state: 'Done.', detail: 'Deck 2 is up and the top orange is dark.', tone: 'done' };
    case 'red':
      return { state: 'In the red.', detail: BRING_DOWN, tone: 'over' };
    case 'clip':
      return { state: 'CLIP is lit.', detail: BRING_DOWN, tone: 'over' };
    case 'top':
      return { state: 'Top orange lit.', detail: BRING_DOWN, tone: 'over' };
    case 'hot1':
    case 'hot2':
      return {
        state: 'Nearly.',
        detail: `Deck ${status === 'hot1' ? 1 : 2}’s channel meter is in the red.`,
        tone: 'near',
      };
    case 'cut':
      return { state: 'Nearly.', detail: 'Deck 1 is almost silent. Keep it in the mix.', tone: 'near' };
    default:
      return { state: 'Not yet.', detail: 'Deck 2 is not all the way up.', tone: 'todo' };
  }
}

/** Beside the big readout's number. Our word, not a legend on the unit, so it's set in sentence case. */
export const READOUT_LABEL = 'Mix';

/**
 * The big readout by the MASTER meters: where the mix peaks, rounded as the meters show it, and
 * its colour in the words the sentence uses. Dark when no LED lights.
 */
export function mixReadout(r: BlendAnalysis): { value: string; zone: Zone | null; words: string } {
  const m = displayDb(r.mix);
  const zone = zoneFor(m);
  return { value: formatDb(m), zone, words: zone ? zonePhrase(m) : 'dark' };
}

/*
 * The guess. Before deck 2 comes up, the reader taps the MASTER LED where they think the blend
 * will peak. Their mark stays by the meter, and once deck 2 is all the way up it sits next to
 * the real peak.
 */

/** The guess radios' legend, for screen readers: a real question to the reader. */
export const GUESS_LEGEND = 'With deck 2 all the way up, where will MASTER peak?';

/** Above the meters while the guess is open and empty. */
export const GUESS_PROMPT = 'Before deck 2 comes up, tap MASTER where you think it will peak.';

/** One LED's radio, for screen readers: "plus 9 decibels, in the orange". */
export const guessSpot = (db: number): string => `${speakDb(db)}, ${describeLevel(db)}`;

/** Above the meters once the reader has guessed. While the guess is still open, say what's next. */
export const guessNote = (guess: number, open: boolean): string =>
  `You guessed ${formatDb(guess)}.${open ? ' Now bring deck 2 up.' : ''}`;

/** Deck 2 is all the way up: the guess beside the real peak, rounded as the meters show it. */
export const guessReveal = (guess: number, actual: number): string =>
  `You guessed ${formatDb(guess)}. MASTER ${actual > CEILING_DB ? 'would peak' : 'peaked'} at ${formatDb(actual)}.`;

/** The two sets of pads, named for what they are: blends that light the top orange, and fixes for them. */
export const PRESET_GROUPS: Record<PresetGroup, string> = { push: 'Blends that light the top orange', out: 'Fixes' };

/** Where the fixes wait until the reader has lit the top orange. */
export const WAYS_OUT_WAIT = 'They appear after you light the top orange.';
export const WAYS_OUT_SHOW = 'Show them now';

export const WAVEFORM_TOGGLE = 'Show the waveform';

/** Shown once the reader has been in the red a while: what to do next, in the DJ box's words. */
export const HINT = 'Pull deck 1’s fader down a little.';

export function challengeMessage(status: ChallengeStatus): string | null {
  switch (status) {
    // 'apart' needs kicks that miss each other, which the lab never plays.
    case 'waiting':
    case 'apart':
      return null;
    case 'red':
      return 'The MASTER meters are in the red. Keep deck 2 up and bring the mix down another way.';
    case 'clip':
      return 'The red light is dark and CLIP is lit. The mix is about to distort.';
    case 'top':
      return 'The MASTER meters light the top orange. Keep deck 2 up and bring the mix down another way.';
    case 'hot1':
    case 'hot2':
      return `The MASTER meters are clear, but deck ${status === 'hot1' ? 1 : 2}’s channel meter is in the red. That deck distorts before its fader.`;
    case 'cut':
      return 'Deck 1 is almost silent. Keep deck 1 in the mix.';
    case 'done':
      return 'Deck 2 is all the way up, and the top orange stays dark.';
  }
}

/**
 * What the lab's live region says once the reader pauses: the verdict in words, with no numbers,
 * so it only changes, and only speaks, when the state does. The sliders speak their own values.
 * With deck 2 fully up that's the challenge message, which already names the meters.
 */
export function verdictLine(r: BlendAnalysis, status: ChallengeStatus): string {
  const message = challengeMessage(status);
  if (message) return message;
  const zone = zoneFor(displayDb(r.mix));
  const meters = !zone
    ? 'The MASTER meters are dark.'
    : zone === 'orange' && topLit(r)
      ? 'The MASTER meters light the top orange.'
      : `The MASTER meters are in the ${zone}.`;
  const clip = r.clip === 'off' ? '' : ' CLIP is lit.';
  const hot = hotDecks(r);
  const channels =
    hot.length === 2
      ? ' Both channel meters are in the red.'
      : hot.length === 1
        ? ` Deck ${hot[0]}’s channel meter is in the red.`
        : '';
  return `${meters}${clip}${channels}`;
}

/**
 * What a preset pad says when pressed. A pad jumps the whole mixer, so it always speaks, numbers
 * included: the reactive sentence, then only what that doesn't already say. It names the red and
 * the top orange itself, so those pads add nothing, and a pad that solves the challenge says so
 * briefly.
 */
export function presetLine(s: BlendSettings, r: BlendAnalysis, status: ChallengeStatus): string {
  const verdict =
    status === 'done' ? 'Challenge done.' : status === 'red' || status === 'top' ? null : challengeMessage(status);
  return [plain(blendSentence(s, r)), verdict].filter(Boolean).join(' ');
}

/**
 * Under each TRIM: where that channel meter peaks now, LOW included. TRIM's own number is the same
 * reading with LOW flat (it isn't the knob's gain: RANGES.trim tops out at +9).
 */
export const trimHint = (n: 1 | 2, db: number): string => `CH${n} ${peaksAt(db)} ${formatDb(db)}`;

export const LISTEN_NOTE = 'It starts quietly. If you hear nothing, check your volume and silent switch.';

/**
 * By Listen while the loudest point only just reaches the red (model.ts `barelyOver`). The meters
 * say red but the loop still sounds clean, and that mustn't pass for "a bit of red is fine".
 */
export const BARELY_OVER_NOTE = `At the red, the mixer cuts only the tips of the kicks. On these loops that is too little to hear. To hear what more level does, press ${preset('hot').label}.`;

/** Shown under Listen when the browser can't make sound at all (the same words as every lab). */
export const NO_SOUND = 'This browser cannot play the sound. Everything else works. To hear it, try another browser.';

/** What the page-wide Stop bar calls this demo while it plays. */
export const PLAYER_LABEL = 'Blend lab';

/** The disclosure at the foot of the lab. */
export const MODEL_NOTES_TITLE = 'What the lab assumes';

/**
 * The two assumptions that change what a DJ does on the unit, each opening with the action, then
 * the controls the lab leaves out: the crossfader (Pioneer's THRU, manual p. 28), and most of the
 * EQ (model.ts, LOW, says why only the boost half is here). The rest are in the guide's section on
 * what the makers publish.
 */
export const MODEL_NOTES: readonly string[] = [
  'On the unit, watch the MASTER meters as you pull a fader down. Pioneer describes the XDJ-RX2’s three channel fader curves in words only, with no dB figures (pp. 27 and 32). The dB figures on these faders are a typical DJ mixer’s.',
  `If CLIP blinks, even slowly, pull a channel fader down a little. Pioneer does not say at what level CLIP starts to blink. In this lab it blinks slowly within ${formatDb(CLIP_SLOW_RANGE_DB, { decimals: 1, signed: false })} of the red light, and fast past it.`,
  'The lab has no crossfader. It plays like the unit with CROSS FADER CURVE on THRU, Pioneer’s setting for not using it (p. 28).',
  `The lab has one EQ knob, LOW, and only the half that turns it up. On the unit, HI, MID and LOW can each boost by as much as ${formatDb(LOW.max, { signed: false })}.`,
];

/** Plain words for a fader position, for screen readers. Rounds the way the display does. */
export function speakFader(position: number): string {
  if (position <= FADER.min) return 'closed, silent';
  if (position >= FADER.max) return 'fully up, 0 decibels';
  return `${position} of 10, ${speakDb(faderDb(position))}`;
}
