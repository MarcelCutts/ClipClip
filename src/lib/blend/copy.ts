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
import { KICKS_TOGETHER_DB } from '../model';
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
  type PresetGroup,
  preset,
  TRIM,
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

/** What two equal kicks landing together add: "6 dB". */
const BLEND_ADDS = formatDb(KICKS_TOGETHER_DB, { signed: false });

/** Colour words for a displayed level, like the meter would show it. */
export function zonePhrase(db: number): string {
  if (db > CEILING_DB) return `${formatDb(db - CEILING_DB, { signed: false })} over the red`;
  if (db === CEILING_DB) return 'in the red';
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
 * Name the LOW when it's boosted, as that's the likelier cause.
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

  const red = displayDb(r.mix) >= CEILING_DB;
  const hot = red || r.clip !== 'off';
  const boosted = s.deck1.low > 0 || s.deck2.low > 0;
  const swapped = s.deck1.low <= -10 || s.deck2.low <= -10;
  const lowered = [s.deck1.fader, s.deck2.fader].filter((f) => f < FADER.max).length;
  const still = red ? 'into the red' : 'close to the red';

  if (hot) {
    if (boosted) return 'The LOW boost makes one kick louder before the two stack.';
    if (lowered === 2) return `Both faders are down a little. The kicks still stack ${still}.`;
    if (lowered === 1 && s.deck2.fader < FADER.max) return 'The kicks stack higher as deck 2 comes in.';
    if (lowered === 1) return `Deck 1 is only a little lower. The kicks still stack ${still}.`;
    return `When the kicks land together, their peaks add. Two equal kicks make a peak ${BLEND_ADDS} higher, two lights up the meter.`;
  }
  if (swapped) return 'Only one bassline plays at full. The kicks barely stack.';
  if (lowered === 1) return `Deck ${s.deck1.fader < FADER.max ? 1 : 2} sits lower in the mix. Its kicks add less.`;
  if (lowered === 2) return 'Both decks sit lower in the mix. The blend peaks lower.';
  if (s.deck1.trim <= 0 && s.deck2.trim <= 0)
    return `Tracks that peak on the first orange light sit ${formatDb(CEILING_DB, { signed: false })} under the red. That leaves room for the ${BLEND_ADDS} a blend adds.`;
  if (s.deck1.trim < TRIM.initial || s.deck2.trim < TRIM.initial)
    return 'Lower TRIMs leave room for what the blend adds.';
  return 'When kicks land together, their peaks add. Watch the MASTER meters.';
}

export const CHALLENGE_PROMPT = 'Bring deck 2 all the way up without the MASTER meters going red.';

export type LampTone = 'todo' | 'near' | 'red' | 'done';

/** How the challenge is going, in a word or two: the legend printed by the lamp beside the prompt. */
export function statusLamp(status: ChallengeStatus): { label: string; tone: LampTone } {
  switch (status) {
    case 'done':
      return { label: 'Done', tone: 'done' };
    case 'red':
      return { label: 'In the red', tone: 'red' };
    case 'clip':
    case 'hot1':
    case 'hot2':
      return { label: 'Nearly', tone: 'near' };
    default:
      return { label: 'Not yet', tone: 'todo' };
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

/** The two sets of pads, named for what they are: blends that go red, and fixes for them. */
export const PRESET_GROUPS: Record<PresetGroup, string> = { push: 'Blends that hit the red', out: 'Fixes' };

/** Where the fixes wait until the reader has hit the red. */
export const WAYS_OUT_WAIT = 'They appear after you hit the red.';
export const WAYS_OUT_SHOW = 'Show them now';

export const WAVEFORM_TOGGLE = 'Show the waveform';

/** Shown once the reader has been in the red a while: what to do next. */
export const HINT = 'Turn deck 1’s LOW down to take its kick out of the stack.';

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
    case 'hot1':
    case 'hot2':
      return `The MASTER meters are clear, but deck ${status === 'hot1' ? 1 : 2}’s channel meter is in the red. That deck distorts before its fader.`;
    case 'cut':
      return 'Deck 1 is almost silent. Keep deck 1 in the mix.';
    case 'done':
      return 'Deck 2 is all the way up, and the red light stays dark.';
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
  const meters = zone ? `The MASTER meters are in the ${zone}.` : 'The MASTER meters are dark.';
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
 * included: the reactive sentence, then only what that doesn't already say. It names the red
 * itself, so a red pad adds nothing, and a pad that solves the challenge says so briefly.
 */
export function presetLine(s: BlendSettings, r: BlendAnalysis, status: ChallengeStatus): string {
  const verdict = status === 'done' ? 'Challenge done.' : status === 'red' ? null : challengeMessage(status);
  return [plain(blendSentence(s, r)), verdict].filter(Boolean).join(' ');
}

/** Under each TRIM: its number is a channel meter reading, not the knob's gain (RANGES.trim tops out at +9). */
export const trimHint = (n: 1 | 2): string => `Peak on CH${n}`;

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
 * Only the two assumptions that change what a DJ does on the unit. The rest are in the guide's
 * section on what the makers publish.
 */
export const MODEL_NOTES: readonly string[] = [
  'On the unit, watch the MASTER meters as you pull a fader down. Pioneer does not publish the XDJ-RX2’s fader curve. The dB figures on these faders are a typical DJ mixer’s.',
  `If CLIP blinks, even slowly, pull a channel fader down a little. Pioneer does not say at what level CLIP starts to blink. In this lab it blinks slowly within ${formatDb(CLIP_SLOW_RANGE_DB, { decimals: 1, signed: false })} of the red light, and fast past it.`,
];

/** Plain words for a fader position, for screen readers. Rounds the way the display does. */
export function speakFader(position: number): string {
  if (position <= FADER.min) return 'closed, silent';
  if (position >= FADER.max) return 'fully up, 0 decibels';
  return `${position} of 10, ${speakDb(faderDb(position))}`;
}
