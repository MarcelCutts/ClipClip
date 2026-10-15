/**
 * Words for the blend lab. The register is a reference guide's (docs/DESIGN.md, Voice): the
 * condition or the command first, one claim per sentence, and feedback that says what happened.
 *
 * The lab runs in four steps (model.ts, STEP_START). Each step says what to do in its head. While
 * the reader works, one line under the meters says how it is going (`coach`): it keeps two lines'
 * room whatever it says, so no word changing ever moves a control. At the step's goal, the result
 * says what happened and why, in three lines at most.
 *
 * The lab always blends with the kicks lined up, as a beatmatched blend does. The model can land
 * deck 2 a 16th note late (`aligned: false`), but the lab has no control for it, so these words
 * describe lined-up kicks only.
 */
import { formatDb, speakDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { DJ_RULES } from '../rules';
import { CEILING_DB, describeLevel, litCount, type Zone, zoneFor } from '../xdj';
import {
  type BlendAnalysis,
  type BlendSettings,
  barelyOver,
  CLIP_SLOW_RANGE_DB,
  challengeStatus,
  displayDb,
  FADER,
  faderDb,
  hotDecks,
  LOW,
  STEP_START,
  type Step,
  topLight,
  topLit,
} from './model';

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

/** Past the red a track or a mix "would peak" there: the ceiling cuts it flat first. */
const peaksAt = (db: number) => (db > CEILING_DB ? 'would peak at' : 'peaks at');
/** The same, for two tracks together: "they peak at", "they would peak at". */
const peakAt = (db: number) => (db > CEILING_DB ? 'would peak at' : 'peak at');

/** The light a level reaches, by name, as the DJ box names the orange ones: "on the second orange". */
export function lightPhrase(db: number): string {
  const top = topLight(db);
  if (top === null) return 'dark';
  if (top >= CEILING_DB) return 'in the red';
  const orange = ['first', 'second', 'third', 'top'][(top - TARGET_PEAK_DB.aim) / 3];
  return top >= TARGET_PEAK_DB.aim && orange ? `on the ${orange} orange` : 'in the green';
}

/* ------------------------------------------------------------------------------------------ */
/* Steps                                                                                        */

export const STEPS: Record<Step, { title: string; body: string }> = {
  1: {
    title: 'Bring deck 2 in',
    body: 'Deck 1 is playing. Both tracks peak on the second orange. Bring deck 2’s fader all the way up, and watch the MASTER meters.',
  },
  2: {
    title: 'Fix it with a fader',
    body: 'The top orange is lit. Keep deck 2 all the way up. Pull deck 1’s fader down until the top orange goes dark.',
  },
  3: {
    title: 'Push it into the red',
    body: 'Both faders are up. Turn both TRIMs up until each channel meter shows the top orange. Then press Listen.',
  },
  4: {
    title: 'Leave room with TRIM',
    body: 'Deck 1 peaks on the first orange. Deck 2 is cued and peaks on the second. Turn deck 2’s TRIM down until CH2 peaks on the first orange. Then bring deck 2 in.',
  },
};

export const stepCounter = (step: Step, of: number): string => `Step ${step} of ${of}`;

export const NAV = { back: 'Back', next: 'Next' } as const;

/** The first completed result stays visible while the reader keeps trying the controls. */
export const RESULT_CONTEXT = 'When you completed this step';

export interface Feedback {
  title: string;
  lines: string[];
  /** Label for the key that moves on, or null on the last step. */
  next: string | null;
}

/** "Next: leave room with TRIM": the step's title, lower case where it is not a printed name. */
const nextTo = (step: Step) => `Next: ${STEPS[step].title[0]!.toLowerCase()}${STEPS[step].title.slice(1)}`;

/* ------------------------------------------------------------------------------------------ */
/* How it is going: the line under the meters                                                   */

/** A channel in the red is cut flat before its fader: its fader can never make it clean. */
const hotLine = (n: 1 | 2) => `CH${n} is in the red. Its fader comes after the cut: turn its TRIM down.`;

/** In the red, but only just: the meters say red, and the sound is still clean. */
export const BARELY_OVER_NOTE = 'At the red, only the tips are cut: too little to hear. Keep going.';

/**
 * One line, under the meters, while the reader works towards the step's goal. It says what is in
 * the way, or what to watch. Each fits two lines on the narrowest phone.
 */
export function coach(step: Step, s: BlendSettings, r: BlendAnalysis): string {
  const status = challengeStatus(s, r);
  const [hot] = hotDecks(r);
  switch (step) {
    case 1:
      return 'Watch the MASTER meters as deck 2 comes up.';
    case 2:
      if (s.deck2.fader < FADER.max) return 'Keep deck 2 all the way up.';
      if (hot) return hotLine(hot);
      if (status === 'cut') return 'Deck 1 is almost silent. Keep it in the mix.';
      if (status === 'done') return '';
      return s.deck1.fader < FADER.max
        ? 'The top orange is still lit. A little further.'
        : 'The top orange is lit. Pull deck 1’s fader down.';
    case 3: {
      if (s.deck1.fader < FADER.max || s.deck2.fader < FADER.max) return 'Keep both faders all the way up.';
      if (hot) return `CH${hot} is past the top orange, in the red. Turn its TRIM down one light.`;
      if (barelyOver(r)) return BARELY_OVER_NOTE;
      if (displayDb(r.mix) >= CEILING_DB) return 'MASTER is in the red, and neither channel is. Keep going.';
      return 'Turn both TRIMs up until each channel meter shows the top orange.';
    }
    case 4: {
      const aim = TARGET_PEAK_DB.aim;
      if (topLight(r.channel[0]) !== aim) return 'Leave deck 1 on the first orange.';
      const ch2 = topLight(r.channel[1]);
      if (ch2 !== null && ch2 > aim) return `CH2 peaks ${lightPhrase(r.channel[1])}. Turn deck 2’s TRIM down a little.`;
      if (ch2 === null || ch2 < aim) return 'CH2 is lower than it needs to be. The first orange is the aim.';
      if (s.deck2.fader < FADER.max) return 'CH2 peaks on the first orange. Bring deck 2’s fader all the way up.';
      if (status === 'cut') return 'Deck 1 is almost silent. Keep it in the mix.';
      return '';
    }
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Results                                                                                      */

/** What the two channel meters say, in a sentence. */
function channels(r: BlendAnalysis): string {
  const [c1, c2] = r.channel.map(displayDb) as [number, number];
  if (c1 === c2) return `Each track ${peaksAt(c1)} ${formatDb(c1)} on its own.`;
  return `On its own, deck 1 ${peaksAt(c1)} ${formatDb(c1)} and deck 2 ${peaksAt(c2)} ${formatDb(c2)}.`;
}

/** How many lights higher the mix reaches than the louder channel: "two lights". */
/**
 * What the blend did to the MASTER meters, against the louder track on its own: the peaks add,
 * up to two lights. A fader pulled well down adds too little to light another.
 */
function sumLine(r: BlendAnalysis): string {
  const n = litCount(displayDb(r.mix)) - litCount(displayDb(Math.max(r.channel[0], r.channel[1])));
  if (n <= 0) return 'The MASTER meters show the sum. Here it lights no more than the louder track.';
  const lights = n === 1 ? 'one light' : `${['no', 'one', 'two', 'three', 'four'][n] ?? n} lights`;
  return `When both tracks peak at once, the peaks add. The MASTER meters show the sum, ${lights} higher.`;
}

/** The channel meters as the step opened them: nothing but a fader has moved. */
const sameChannels = (s: BlendSettings, step: Step) => {
  const start = STEP_START[step];
  return (
    s.deck1.trim === start.deck1.trim &&
    s.deck1.low === start.deck1.low &&
    s.deck2.trim === start.deck2.trim &&
    s.deck2.low === start.deck2.low
  );
};

/** The DJ box's line for the MASTER meters, in its own words (rules.ts). */
const MIX_NOTE = DJ_RULES.find((rule) => rule.label === 'MIX')!.note;

/**
 * What happened, once the step's goal is met: a title, then why, in three lines at most. Step 1
 * says back the reader's guess, when there was one, beside where MASTER peaked.
 */
export function stepResult(step: Step, s: BlendSettings, r: BlendAnalysis, guess: number | null = null): Feedback {
  const m = displayDb(r.mix);
  switch (step) {
    case 1: {
      const peak = `MASTER ${peaksAt(m)} ${formatDb(m)}`;
      const title = guess === null ? peak : `You guessed ${formatDb(guess)}. ${peak}`;
      if (s.deck1.fader === FADER.min) {
        return { title, lines: ['Deck 1’s fader is down. The mix is deck 2 alone.'], next: nextTo(2) };
      }
      return {
        title,
        lines: [channels(r), sumLine(r), 'The channel meters did not move with the fader. They read before it.'],
        next: nextTo(2),
      };
    }
    case 2: {
      const byFader = sameChannels(s, 2) && s.deck1.fader < FADER.max;
      return {
        title: 'The top orange is dark',
        lines: byFader
          ? [
              'Deck 1’s fader takes it down in the mix, and the blend comes down with it.',
              'CH1 did not move. It reads before the fader.',
              MIX_NOTE,
            ]
          : ['Deck 2 is all the way up, and the MASTER meters are under the top orange.', MIX_NOTE],
        next: nextTo(3),
      };
    }
    case 3:
      return {
        title: `The mix is ${zonePhrase(m)}`,
        lines: [
          `Each channel is under the red. Together they ${peakAt(m)} ${formatDb(m)}.`,
          'Past the red, the mixer cuts the peaks flat. The room and the recording both get the crunch.',
          'Press Listen, then Hear the clean version.',
        ],
        next: nextTo(4),
      };
    case 4:
      return {
        title: 'The top orange stays dark',
        lines: [
          `Both tracks peak on the first orange. Together they ${peakAt(m)} ${formatDb(m)}.`,
          `The first orange leaves room for what a blend adds, up to ${BLEND_ADDS}: two lights.`,
        ],
        next: null,
      };
  }
}

/** After the last step: the two lines the DJ box holds for the meters, as practised. */
export const SUMMARY = {
  title: 'What the meters should show',
  lines: [
    'Set TRIM so each channel meter peaks on the first orange at the loudest part.',
    `Watch the MASTER meters in a blend. ${MIX_NOTE}`,
  ],
} as const;

/* ------------------------------------------------------------------------------------------ */
/* The readout by the MASTER meters                                                             */

/** Beside the big readout's number. Our word, not a legend on the unit, so it's set in sentence case. */
export const READOUT_LABEL = 'Mix';

/**
 * The big readout by the MASTER meters: where the mix peaks, rounded as the meters show it, and
 * its colour in words. Dark when no LED lights.
 */
export function mixReadout(r: BlendAnalysis): { value: string; zone: Zone | null; words: string } {
  const m = displayDb(r.mix);
  const zone = zoneFor(m);
  return { value: formatDb(m), zone, words: zone ? zonePhrase(m) : 'dark' };
}

/* ------------------------------------------------------------------------------------------ */
/* The guess, in step 1                                                                         */

/** The guess radios' legend, for screen readers: a real question to the reader. */
export const GUESS_LEGEND = 'With deck 2 all the way up, where will MASTER peak?';

/** Above the meters while the guess is open and empty. */
export const GUESS_PROMPT = 'Before deck 2 comes up, tap MASTER where you think it will peak.';

/** One LED's radio, for screen readers: "plus 9 decibels, in the orange". */
export const guessSpot = (db: number): string => `${speakDb(db)}, ${describeLevel(db)}`;

/** Above the meters once the reader has guessed. While the guess is still open, say what's next. */
export const guessNote = (guess: number, open: boolean): string =>
  `You guessed ${formatDb(guess)}.${open ? ' Now bring deck 2 up.' : ''}`;

/* ------------------------------------------------------------------------------------------ */
/* Controls                                                                                     */

/**
 * Under each TRIM: where that channel meter peaks now, LOW included. TRIM's own number is the same
 * reading with LOW flat (it isn't the knob's gain: RANGES.trim tops out at +9).
 */
export const trimHint = (n: 1 | 2, db: number): string => `CH${n} ${peaksAt(db)} ${formatDb(db)}`;

/** Plain words for a fader position, for screen readers. Rounds the way the display does. */
export function speakFader(position: number): string {
  if (position <= FADER.min) return 'closed, silent';
  if (position >= FADER.max) return 'fully up, 0 decibels';
  return `${position} of 10, ${speakDb(faderDb(position))}`;
}

/* ------------------------------------------------------------------------------------------ */
/* The live region                                                                              */

/**
 * What the live region says of the meters once the reader pauses, when nothing else is to be
 * said: the meters in words, with no numbers, so it only changes, and only speaks, when their
 * state does. The sliders speak their own values.
 */
export function verdictLine(r: BlendAnalysis): string {
  const zone = zoneFor(displayDb(r.mix));
  const meters = !zone
    ? 'The MASTER meters are dark.'
    : zone === 'orange' && topLit(r)
      ? 'The MASTER meters light the top orange.'
      : `The MASTER meters are in the ${zone}.`;
  const clip = r.clip === 'off' ? '' : ' CLIP is lit.';
  const hot = hotDecks(r);
  const hotWords =
    hot.length === 2 ? ' Both channel meters are in the red.' : hot.length === 1 ? ` CH${hot[0]} is in the red.` : '';
  return `${meters}${clip}${hotWords}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Sound                                                                                        */

export const SOUND = {
  listen: 'Listen',
  stop: 'Stop',
  quiet: 'It starts quietly. If you hear nothing, check your volume and silent switch.',
  steady: 'You hear the blend at one steady loudness.',
  clean: 'Hear the clean version',
  /** While the clean version plays. */
  matched: 'The clean version is matched to it. Only the crunch changes.',
  unavailable: 'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
  playing: 'Blend lab',
} as const;

export const WAVEFORM_TOGGLE = 'Show the waveform';

/** Without JavaScript nothing moves, so the first step's lesson is said here. */
export const NO_SCRIPT =
  'The lab needs JavaScript to move. Two tracks that each peak on the second orange reach the top orange together.';

/* ------------------------------------------------------------------------------------------ */
/* What the lab assumes                                                                         */

/** The disclosure at the foot of the lab. */
export const MODEL_NOTES_TITLE = 'What the lab assumes';

/**
 * The two assumptions that change what a DJ does on the unit, each opening with the action, then
 * the controls the lab leaves out: the crossfader (Pioneer's THRU, manual p. 28), and most of the
 * EQ (model.ts, LOW, says why only the boost half is here). Then the lab's own two shortcuts: it
 * clips flat at the red light, which Pioneer does not say, and its loops add the full 6 dB, where
 * released tracks add about 5 (model.ts, KICKS_TOGETHER_DB). The rest are in the guide's section on
 * what the makers publish.
 */
export const MODEL_NOTES: readonly string[] = [
  'On the unit, watch the MASTER meters as you pull a fader down. Pioneer describes the XDJ-RX2’s three channel fader curves in words only, with no dB figures (pp. 27 and 32). The dB figures on these faders are a typical DJ mixer’s.',
  `If CLIP blinks, even slowly, pull a channel fader down a little. Pioneer does not say at what level CLIP starts to blink. In this lab it blinks slowly within ${formatDb(CLIP_SLOW_RANGE_DB, { decimals: 1, signed: false })} of the red light, and fast past it.`,
  'The lab has no crossfader. It plays like the unit with CROSS FADER CURVE on THRU, Pioneer’s setting for not using it (p. 28).',
  `The lab has one EQ knob, LOW, and only the half that turns it up. On the unit, HI, MID and LOW can each boost by as much as ${formatDb(LOW.max, { signed: false })}.`,
  'The lab cuts the peaks flat at the red light. Pioneer says only that the sound “may be distorted” there (p. 31).',
  `The two tracks are loops made for the lab, with their kicks in step. A blend of them adds the full ${BLEND_ADDS}, the worst case.`,
];
