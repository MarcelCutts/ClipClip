/**
 * Words for the blend lab. The reactive sentence is built from segments so the page can
 * emphasise the numbers and keep "+12 dB" on one line, and so tests can read it as plain text.
 * Everything is a plain statement: what the meters show, then why, with a number where it helps.
 */
import { formatDb, speakDb } from '../dsp/db';
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

/** Second sentence: what the blend does on the middle meter. */
export function mixSentence(s: BlendSettings, r: BlendAnalysis): Segment[] {
  const open1 = s.deck1.fader > FADER.min;
  const open2 = s.deck2.fader > FADER.min;
  const m = displayDb(r.mix);
  if (!open1 && !open2) return [t('Both faders are down, so the mix is silent.')];
  if (!open1 || !open2) {
    const on = open1 ? 1 : 2;
    const off = open1 ? 2 : 1;
    return [
      t(`Deck ${off}’s fader is down, so the mix is deck ${on} alone. It ${peaksAt(m)} `),
      value(m),
      t(', '),
      zone(m),
      t('.'),
    ];
  }
  const kicks = s.aligned ? 'the kicks lined up' : 'the kicks apart';
  const eased1 = s.deck1.fader < FADER.max;
  const eased2 = s.deck2.fader < FADER.max;
  const lead: Segment[] =
    eased1 && eased2
      ? [t(`Together, with both faders eased and ${kicks}`)]
      : eased1 || eased2
        ? [
            t(`Together, with deck ${eased1 ? 1 : 2}’s fader at `),
            num(faderDb(eased1 ? s.deck1.fader : s.deck2.fader)),
            t(` and ${kicks}`),
          ]
        : [t(`Together, with ${kicks}`)];
  return [...lead, t(`, the mix ${peaksAt(m)} `), value(m), t(', '), zone(m), t('.')];
}

/** The reactive sentence under the waveform. */
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
  if (hot.length === 2) return `Both decks hit the red before their faders. Bring the ${fix} down on each.`;
  return `Deck ${hot[0]} hits the red before its fader. Bring its ${fix} down.`;
}

/** One line saying why the blend landed where it did. */
export function explainBlend(s: BlendSettings, r: BlendAnalysis): string {
  const open1 = s.deck1.fader > FADER.min;
  const open2 = s.deck2.fader > FADER.min;
  const channel = hotChannel(s, r);
  if (channel) return channel;
  if (!open1 && !open2) return 'Push a fader up to hear the mix.';
  if (!open2) return 'Bring deck 2’s fader up and watch the middle meters.';
  if (!open1) return 'Bring deck 1’s fader up and watch the middle meters.';

  const red = displayDb(r.mix) >= CEILING_DB;
  const hot = red || r.clip !== 'off';
  const boosted = s.deck1.low > 0 || s.deck2.low > 0;
  const swapped = s.deck1.low <= -10 || s.deck2.low <= -10;
  const eased = [s.deck1.fader, s.deck2.fader].filter((f) => f < FADER.max).length;
  const still = red ? 'still stack into the red' : 'still stack close to the red';

  if (hot) {
    if (boosted) return 'The LOW boost adds level to the kick before the two meet, so the stack goes higher still.';
    if (!s.aligned) return 'Even with the kicks apart, two hot tracks add up. Bring a TRIM or a fader down.';
    if (eased === 2) return `Both faders are down a little, but the kicks ${still}.`;
    if (eased === 1 && s.deck2.fader < FADER.max) return 'The kicks stack higher as deck 2 comes in.';
    if (eased === 1) return `Deck 1 is only a little lower, so the kicks ${still}.`;
    return `The kicks land together, so their peaks add. Two equal kicks make a peak twice as tall, ${formatDb(6, { signed: false })} higher, which is two lights up the meter.`;
  }
  if (!s.aligned) return 'The kicks miss each other, so they add up less. In a real blend they line up.';
  if (swapped) return 'Only one bassline plays at full, so the kicks barely stack. DJs call this a bass swap.';
  if (eased === 1) return `Deck ${s.deck1.fader < FADER.max ? 1 : 2} sits lower in the mix, so its kicks add less.`;
  if (eased === 2) return 'Both decks sit lower in the mix, so the blend peaks lower.';
  if (s.deck1.trim <= 0 && s.deck2.trim <= 0)
    return `Tracks that peak at the first orange light sit ${formatDb(CEILING_DB, { signed: false })} under the red. That’s room for the ${formatDb(6, { signed: false })} a blend adds.`;
  if (s.deck1.trim < TRIM.initial || s.deck2.trim < TRIM.initial)
    return 'Lower TRIMs leave room for the blend to add up.';
  return 'Kicks that land together stack up, so keep an eye on the middle meters.';
}

export const CHALLENGE_PROMPT = 'Bring deck 2 all the way up without the middle meters going red.';

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
 * The big readout by the middle meters: where the mix peaks, rounded as the meters show it, and
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
 * the real peak. Predicting first is what makes the reveal stick.
 */

/** The guess radios' legend, for screen readers: a real question to the reader. */
export const GUESS_LEGEND = 'With deck 2 all the way up, where will MASTER peak?';

/** Under the meters while the guess is open and empty. */
export const GUESS_PROMPT = 'Before deck 2 comes up, tap MASTER where you think it will peak.';

/** One LED's radio, for screen readers: "plus 9 decibels, in the orange". */
export const guessSpot = (db: number): string => `${speakDb(db)}, ${describeLevel(db)}`;

/** Under the meters once the reader has guessed. While the guess is still open, say what's next. */
export const guessNote = (guess: number, open: boolean): string =>
  `You guessed ${formatDb(guess)}.${open ? ' Now bring deck 2 up.' : ''}`;

/** Deck 2 is all the way up: the guess beside the real peak, rounded as the meters show it. */
export function guessReveal(guess: number, actual: number): string {
  if (guess === actual) return `You guessed ${formatDb(guess)}, and that’s where it peaked.`;
  return `You guessed ${formatDb(guess)}. It ${actual > CEILING_DB ? 'would peak' : 'peaked'} at ${formatDb(actual)}.`;
}

/** The Kicks switch: lined up (a beatmatched blend) or apart (deck 2 a 16th note late). */
export const KICKS = { legend: 'Kicks', lined: 'Lined up', apart: 'Apart', apartDetail: 'not beatmatched' } as const;

/** The two sets of pads: ways into the red, and ways out of it. */
export const PRESET_GROUPS: Record<PresetGroup, string> = { push: 'Push it', out: 'Ways out' };

/** Where the ways out wait until the reader has hit the red. */
export const WAYS_OUT_WAIT = 'They show up once you’ve hit the red.';
export const WAYS_OUT_SHOW = 'Show them now';

export const WAVEFORM_TOGGLE = 'Show the waveform';

/** Shown once the reader has been in the red a while: what to do, and why it works. */
export const HINT = 'Try turning deck 1’s LOW down, so its kick adds less to the stack.';

export function challengeMessage(status: ChallengeStatus): string | null {
  switch (status) {
    case 'waiting':
      return null;
    case 'red':
      return 'The middle meters are in the red. Keep deck 2 up and make room another way.';
    case 'clip':
      return 'The red light is dark, but CLIP is lit, so in this model the mix is about to distort.';
    case 'hot1':
    case 'hot2':
      return `The middle meters are clear, but deck ${status === 'hot1' ? 1 : 2}’s own meter is in the red, so it distorts before its fader.`;
    case 'apart':
      return 'Out of the red, but only because the kicks are apart. Line them up and try again.';
    case 'cut':
      return 'Out of the red, but only because deck 1 is almost silent. Keep deck 1 in the mix.';
    case 'done':
      return 'Deck 2 is all the way up and the red light stays dark, so the challenge is done.';
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
  const meters = zone ? `The middle meters are in the ${zone}.` : 'The middle meters are dark.';
  const clip = r.clip === 'off' ? '' : ' CLIP is lit.';
  const hot = hotDecks(r);
  const channels =
    hot.length === 2
      ? ' Both decks’ own meters are in the red.'
      : hot.length === 1
        ? ` Deck ${hot[0]}’s own meter is in the red.`
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

export const TEACHING_NOTE =
  'The side meters read each track before its fader, so they don’t move when you move a fader. Only the middle meters show the blend.';

/** Under each TRIM: its number is a channel meter reading, not the knob's gain (RANGES.trim tops out at +9). */
export const trimHint = (n: 1 | 2): string => `Peak on CH${n}`;

export const CAPTION = `The crossfader is on THRU, so only the channel faders count. Real kicks rarely line up perfectly, so plan for up to ${formatDb(6)}.`;

export const LISTEN_NOTE = 'Starts quietly. If you hear nothing, check your volume and silent switch.';

/**
 * By Listen while the loudest point only just reaches the red (model.ts `barelyOver`). The meters
 * say red but the loop still sounds clean, and that mustn't pass for "a bit of red is fine".
 */
export const BARELY_OVER_NOTE =
  'At the red, the ceiling only shaves the tips of the kicks, too little to hear on these loops. There’s no room left for anything louder. Press Both tracks hot to hear what going past it does.';

/** Shown under Listen when the browser can't make sound at all (same words as the listening test). */
export const NO_SOUND = 'Sound is blocked or missing in this browser. Try another one.';

/** What the page-wide Stop bar calls this demo while it plays. */
export const PLAYER_LABEL = 'Blend lab';

export const MODEL_NOTES: readonly string[] = [
  'TRIM here sets where each track peaks on its channel meter with the EQ flat. On the unit you turn TRIM until the meter says so.',
  `The faders follow a typical DJ mixer curve: 10 is ${formatDb(0)}, 8 is about ${formatDb(-6)}, 6 about ${formatDb(-12)}, 4 about ${formatDb(-20)}, 2 about ${formatDb(-35)}, and 0 is off. Pioneer doesn’t publish the XDJ-RX2’s curves.`,
  `The red light (${formatDb(CEILING_DB)}) is treated as a ceiling on each channel and on the mix, so anything past it is cut flat. Pioneer only says red may distort. This is the cautious reading.`,
  `Pioneer doesn’t say at what level CLIP starts blinking. Here it blinks slowly within ${formatDb(CLIP_SLOW_RANGE_DB, { decimals: 1, signed: false })} of the red light, and fast past it.`,
  'Pioneer doesn’t say whether the XDJ-RX2’s channel meters read after the EQ. This model assumes they do.',
  'MASTER LEVEL is fully up here, so the middle meters show the blend itself. On the unit those meters read after the knob.',
  'Kicks apart lands deck 2 a 16th note late, which a beatmatched blend never would.',
  'Listen plays the mix through that ceiling. Every setting, quiet or loud, is matched to one loudness, so the red never wins by sounding louder.',
  'Both tracks are made up here, so the numbers are exact for these two loops. Real tracks vary.',
];

/** Plain words for a fader position, for screen readers. Rounds the way the display does. */
export function speakFader(position: number): string {
  if (position <= FADER.min) return 'closed, silent';
  if (position >= FADER.max) return 'fully up, 0 decibels';
  return `${position} of 10, ${speakDb(faderDb(position))}`;
}
