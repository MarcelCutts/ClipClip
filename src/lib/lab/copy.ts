/**
 * Every word the two-ceilings lab says, in one place so the house style can be tested. The
 * register is a reference guide's (docs/DESIGN.md, Voice): the condition or the command first,
 * one claim per sentence, and feedback that says what happened, never how the lab teaches.
 *
 * The lab's hardest fact is that the Howler's light can be green over a crunchy recording. Shown
 * as two verdicts side by side, it read as a fault in the lab. So every reading here says what it
 * measures and where:
 *
 * - the light is a distance from the Howler's ceiling ("Input 3 dB under its ceiling"), never "OK";
 * - the crunch says where it was made ("Made in the mixer") and how much was cut, in dB;
 * - crunch is named and never graded: nothing published says how much of it is "heavy".
 *
 * Feedback follows what is known of correcting a belief: what the reader said, what is so, then
 * the cause in the order it happens, in three lines at most.
 */
import { formatDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, MIXER_CEILING_DB, TARGET_PEAK_DB } from '../model';
import { section } from '../sections';
import { describeLevel } from '../xdj';
import { type Crunch, type Expect, type Guess, howlerMarginDb, type Reading, STEP_SETUP, type Step } from './ceilings';

const NBSP = '\u00a0';

/** A whole number of decibels, unsigned, as a distance: "3 dB". */
const dbApart = (db: number): string => `${Math.round(Math.abs(db))}${NBSP}dB`;

/* ------------------------------------------------------------------------------------------ */
/* The chain                                                                                    */

/**
 * The three places the lab follows the sound through, in the order it travels. Each of the first
 * two has a ceiling, a control before it and a light that watches it.
 */
export const STAGES = {
  label: 'The chain this lab follows',
  mixer: { name: 'Mixer', ceiling: 'Mixer’s ceiling' },
  howler: { name: 'Howler', ceiling: 'Howler’s ceiling' },
  file: { name: 'File', note: 'What the Howler wrote, as you hear it the next day.' },
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Steps                                                                                        */

const START = STEP_SETUP[1].start;

export const STEPS: Record<Step, { title: string; body: string }> = {
  1: {
    title: 'Channel in the red',
    body: `CH1 peaks ${dbApart(START.channels - MIXER_CEILING_DB)} past the red, and the mixer cuts its tops flat. The recording level is ${dbApart(START.knob)} down.`,
  },
  2: {
    title: 'Try the recording level',
    body: 'The crunch was made in the mixer. Say what you expect of the recording level, then try it.',
  },
  // What to stop at is what can be seen beside the control: CH1's light and the mixer's screen.
  3: {
    title: 'Turn the channel down',
    body: 'Turn the channel down until CH1’s red light is dark and the flat tops are gone.',
  },
  // The step opens with CH1 on the top orange (ceilings.ts), loud enough to overload the Howler
  // with the recording level fully up. The words name what matters here, the mixer's ceiling,
  // and never hold the top orange up as a level to play at. Howler says the mixer distorts first
  // (FAQ), and the step says so: it shows the other case.
  4: {
    title: 'Recording level too high',
    body: 'The mixer is clean. The Howler’s LEVEL light is red. Turn the recording level down until the light is green. Howler says the mixer distorts first. Here the Howler does.',
  },
};

export const stepCounter = (step: Step, of: number): string => `Step ${step} of ${of}`;

export const NAV = {
  back: 'Back',
  next: 'Next',
} as const;

export interface Feedback {
  title: string;
  lines: string[];
  /** Label for the button that moves on. */
  next: string | null;
}

/* ------------------------------------------------------------------------------------------ */
/* The two questions                                                                            */

/**
 * The lab asks before it shows, twice: the light's colour in step 1, and what the recording level
 * can do in step 2. Each sits where its subject is, and takes its place until it is answered. A
 * prediction helps only with the thing asked, so each of the lab's two lessons has its own.
 */
export const QUESTIONS = {
  light: {
    legend: 'What colour is the Howler’s LEVEL light?',
    choices: { green: 'Green', red: 'Red' } satisfies Record<Guess, string>,
  },
  knob: {
    legend: 'Can the recording level remove the crunch?',
    choices: { yes: 'Yes', no: 'No' } satisfies Record<Expect, string>,
  },
  /** A way to the answer without giving one. */
  skip: 'Show the answer',
  /** On the Howler's screen until the first question is answered. */
  covered: 'Answer, and the screen shows what reaches the Howler.',
} as const;

/** What the reader said, said back: the belief a correction starts from has to be their own. */
const saidBack = (said: string | null): string => (said === null ? '' : `You said ${said.toLowerCase()}. `);

/**
 * Step 1's answer. The light is right, and the feedback says so first: a reader who takes the
 * light for a verdict on the recording otherwise takes the lab for broken. Then the cause in the
 * order it happens, with the one light that did show the crunch, and the rule.
 */
export function answerFeedback(guess: Guess | null, r: Reading): Feedback {
  const light = QUESTIONS.light.choices[r.howler].toLowerCase();
  return {
    title: `${saidBack(guess === null ? null : QUESTIONS.light.choices[guess])}It is ${light}`,
    lines: [
      `The light is right. The level into the Howler is ${dbApart(howlerMarginDb(r))} under its ceiling.`,
      'The mixer cut the tops flat, and CH1’s red light showed it. The recording level then made the wave smaller.',
      'A green light does not mean a clean recording.',
    ],
    next: 'Next: try the recording level',
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Step 2: the recording level cannot remove the crunch                                         */

/** Step 2, once its question is answered and before the first try. */
export const TRY = 'Try it. Turn the recording level down, then up.';

/**
 * In step 2, after each try: what the reader did, and what it did to the wave. Said at once and
 * tied to the move, so the step teaches while it is tried and not only when it ends.
 */
export function moveSentence(byDb: number, r: Reading): string {
  const did = `You turned it ${byDb < 0 ? 'down' : 'up'} ${dbApart(byDb)}.`;
  if (r.recorder === 'over') {
    return `${did} The flat tops pass the Howler’s ceiling as well, and the LEVEL light is red.`;
  }
  if (r.recorder === 'at') return `${did} The flat tops touch the Howler’s ceiling, and the LEVEL light is red.`;
  return `${did} The flat tops are ${byDb < 0 ? 'smaller' : 'bigger'}. They are still flat.`;
}

/**
 * Step 2's result. It holds wherever the recording level was left, so it does not change while
 * the reader goes on trying: the try's own sentence says what the last move did.
 */
export function revealFeedback(guess: Expect | null): Feedback {
  return {
    title: guess === null ? 'It cannot remove the crunch' : `${saidBack(QUESTIONS.knob.choices[guess])}It cannot`,
    lines: [
      'The recording level comes after the mixer’s ceiling. It makes the flat tops smaller or bigger. They stay flat.',
      'The LEVEL light follows the recording level. The crunch does not.',
    ],
    next: 'Next: turn the channel down',
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Steps 3 and 4: the control that comes before each ceiling                                    */

/**
 * The lab plays one track. A blend can land two tracks' peaks together, up to KICKS_TOGETHER_DB
 * higher (model.ts): two more lights on the meter, and that much nearer each ceiling. The DJ box
 * keeps the MASTER meters' top orange dark, and a channel on the first orange leaves room for it.
 */
const blendReaches = (r: Reading, db: number) => r.channels + KICKS_TOGETHER_DB >= db;
const blendClipsRecording = (r: Reading) => r.recordingPeakDbfs + KICKS_TOGETHER_DB > 0;

/** The DJ box's line for a channel, in its own words (rules.ts). */
const KEEP_CH1 = `Keep CH1 on the first orange (0) at the loudest${NBSP}part.`;

export function successFeedback(step: Step, r: Reading): Feedback | null {
  if (step === 3) {
    const lines = ['The channel comes before the mixer’s ceiling. Crunch made in the mixer is fixed only there.'];
    // Said only where the channel was left too high for a blend: the lab must not teach that a
    // channel just under the red is where to play.
    if (blendReaches(r, MIXER_CEILING_DB)) {
      lines.push(`A blend can add up to two more lights and reach the red. ${KEEP_CH1}`);
    } else if (blendReaches(r, TARGET_PEAK_DB.top)) {
      lines.push(`A blend can add up to two more lights and reach the top orange on the MASTER meters. ${KEEP_CH1}`);
    }
    return { title: 'Fixed at the channel', lines, next: 'Next: recording level too high' };
  }
  if (step === 4) {
    const lines = [
      'The recording level comes before the Howler’s ceiling. Crunch made at the Howler is fixed with it.',
      'The LEVEL light showed this crunch. In Howler’s manual, red “means your volume is too high”.',
    ];
    // A green light is not yet room for a blend: until there is, the title says only what stopped.
    const close = blendClipsRecording(r);
    if (close) lines.push('The recording peaks close to the top. A blend would clip it again.');
    return { title: close ? 'Overload stopped' : 'Fixed with the recording level', lines, next: null };
  }
  return null;
}

/** After the last step: the two ceilings side by side, in a sentence each, and what to do with them. */
export const SUMMARY = {
  title: 'Each light watches its own ceiling',
  lines: [
    'CH1’s red light shows crunch made in the mixer. Only the channel fixes it.',
    'The Howler’s LEVEL light shows crunch made at the Howler. The recording level fixes it.',
    'For a clean recording, check both.',
  ],
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Readouts                                                                                     */

/** The readouts' labels: CH1 as printed on the mixer, the Howler's light as printed on it, and the file's crunch. */
export const READOUTS = {
  ch1: 'CH1',
  crunch: 'Crunch',
  howler: 'LEVEL light',
} as const;

/** The channel meter in words, beside its lights: "In the red". */
export function levelWords(level: number): string {
  const words = describeLevel(level);
  return `${words[0]!.toUpperCase()}${words.slice(1)}`;
}

/** The first dB over only cuts the tips, as the blend lab says of its red (ceilings.ts, CRUNCH_LIMITS). */
export const CRUNCH_WORDS: Record<Crunch, string> = {
  clean: 'Clean',
  tips: 'Tips cut',
  crunch: 'Crunchy',
};

/**
 * Under the file's crunch: where it was made, and how much was cut. The light and the crunch are
 * measured in different places, and each says where.
 */
export function fileOrigin(r: Reading): string {
  const cut = `Tops cut by ${dbApart(r.cutDb)}`;
  if (r.mixer === 'over' && r.recorder === 'over') return `Made in the mixer and at the Howler. ${cut} in all.`;
  if (r.mixer === 'over') return `Made in the mixer. ${cut}.`;
  if (r.recorder === 'over') return `Made at the Howler. ${cut}.`;
  return 'Nothing was cut.';
}

/** The light's state as the recorder shows it. What it means is a distance from its ceiling (howlerMeaning). */
export const HOWLER_WORDS = {
  green: { state: 'Blinking green' },
  red: { state: 'Blinking red' },
} as const;

/**
 * What the light's colour means: the level at the Howler's input, as a distance from its ceiling.
 * That is what the light goes by, named in its own reading. It follows the recording level a
 * decibel at a time, and never the crunch.
 */
export function howlerMeaning(r: Reading): string {
  const margin = howlerMarginDb(r);
  if (r.recorder === 'at') return 'Input at its ceiling';
  return `Input ${dbApart(margin)} ${margin < 0 ? 'under' : 'over'} its ceiling`;
}

/** Under the light while the mixer is cutting: what the light leaves out. */
export const LIGHT_NOTE = 'It does not show crunch made before it.';

/** Where it clipped, in a few words: the verdict under the step, and what screen readers hear. */
export function stateSentence(r: Reading): string {
  if (r.mixer === 'over' && r.recorder === 'over') return 'Clipped in the mixer and at the Howler’s input.';
  if (r.mixer === 'over' && r.recorder === 'at')
    return 'Clipped in the mixer. The flat tops touch the Howler’s ceiling.';
  if (r.mixer === 'over') return 'Clipped in the mixer.';
  if (r.recorder === 'over') return 'Clipped at the Howler’s input.';
  if (r.recorder === 'at') return 'Touching the Howler’s ceiling. Nothing is cut yet.';
  if (r.mixer === 'at') return 'Touching the red. Nothing is cut yet. A blend would clip.';
  return 'Clean at both ceilings.';
}

/** What to notice on each screen, printed under it. */
export function scopeClaims(r: Reading): { mixer: string; howler: string } {
  const mixer =
    r.mixer === 'over'
      ? 'The loudest peaks pass the mixer’s ceiling and are cut flat.'
      : r.mixer === 'at'
        ? 'The loudest peaks just touch the mixer’s ceiling.'
        : 'The whole wave fits under the mixer’s ceiling.';
  let howler: string;
  if (r.mixer === 'over' && r.recorder === 'over')
    howler = 'The mixer cut the peaks. The Howler’s ceiling cut them again.';
  else if (r.mixer === 'over' && r.recorder === 'at')
    howler = 'The flat tops from the mixer just touch the Howler’s ceiling.';
  else if (r.mixer === 'over') howler = 'The same flat tops, made smaller. They fit under the Howler’s ceiling.';
  else if (r.recorder === 'over') howler = 'The loudest peaks pass the Howler’s ceiling and are cut flat.';
  else if (r.recorder === 'at') howler = 'The loudest peaks just touch the Howler’s ceiling.';
  else howler = 'The whole wave fits under the Howler’s ceiling.';
  return { mixer, howler };
}

/* ------------------------------------------------------------------------------------------ */
/* Controls                                                                                     */

export const CONTROLS = {
  channels: {
    label: 'Channel (TRIM and EQ)',
    hint: 'How loud the track peaks after TRIM and EQ.',
  },
  knob: {
    label: 'Recording level',
    hint: `How loud the mix goes into the Howler. Fully up is ${formatDb(0)}.`,
  },
} as const;

export const knobText = (knob: number): string => formatDb(knob);

/* ------------------------------------------------------------------------------------------ */
/* Scopes                                                                                       */

export const SCOPES = {
  mixer: 'Inside the mixer',
  howler: 'Into the Howler',
  /** The Howler's screen also draws the wave as it left the mixer, behind its own. */
  before: 'What left the mixer',
  zoom: 'Zoomed in to about 30 thousandths of a second',
  scale: 'Both screens share one scale.',
  legend: { music: 'The music', flat: 'A flat top', cut: 'What this ceiling cut off' },
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Sound                                                                                        */

export const SOUND = {
  listen: 'Listen',
  stop: 'Stop',
  quiet: 'It starts quietly. If you hear nothing, check your volume and silent switch.',
  steady: 'You hear the file turned up to one steady loudness.',
  clean: 'Hear the clean version',
  /** While the clean version plays. */
  matched: 'The clean version is matched to it. Only the crunch changes.',
  unavailable: 'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
  playing: 'Two ceilings lab',
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Without JavaScript, and the model's caveat                                                   */

/**
 * Without JavaScript the questions cannot be answered, so the first answer is said here, with the
 * two things the lab teaches.
 */
export const NO_SCRIPT =
  'The lab needs JavaScript to move. The light is green, and the file is crunchy. The light shows the level into the Howler. It does not show crunch made in the mixer.';

/**
 * Where each ceiling sits is an assumption: Pioneer says only that red "may" distort (p. 31), and
 * Howler publishes no maximum input level (model.ts). The gaps are stated once, in the guide's
 * section on what the makers publish, with what each says of its light; this line points there.
 */
const MAKERS = section('red-top');

export const MODEL_NOTE = {
  text: 'Where each ceiling sits is an assumption.',
  link: `See ${MAKERS.number}`,
  href: `#${MAKERS.id}`,
} as const;
