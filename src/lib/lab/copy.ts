/**
 * Every word the two-ceilings lab says, in one place so the house style can be tested. The
 * register is a reference guide's (docs/DESIGN.md, Voice): the condition or the command first,
 * one claim per sentence, and feedback that says what happened, never how the lab teaches.
 */
import { formatDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, MIXER_CEILING_DB, TARGET_PEAK_DB } from '../model';
import { section } from '../sections';
import { describeLevel } from '../xdj';
import type { Crunch, Reading, Stage, Step } from './ceilings';

const NBSP = '\u00a0';

/* ------------------------------------------------------------------------------------------ */
/* The chain                                                                                    */

export const CHAIN = {
  label: 'The chain this lab follows',
  mixer: { name: 'Mixer', sub: `Ceiling${NBSP}1` },
  knob: { name: 'Recording level' },
  howler: { name: 'Howler', sub: `Ceiling${NBSP}2` },
  file: { name: 'File' },
} as const;

/** A word under each ceiling in the chain, so it's clear where the cut happens. Short enough for a phone. */
export const STAGE_WORDS: Record<Stage, string> = {
  clear: 'Clear',
  at: 'Touching',
  over: 'Cutting',
};

/* ------------------------------------------------------------------------------------------ */
/* Steps                                                                                        */

export const STEPS: Record<Step, { title: string; body: string }> = {
  1: {
    title: 'Channel in the red',
    body: 'The channel is locked in the red. Try to remove the crunch with the recording level.',
  },
  2: {
    title: 'Turn the channel down',
    body: 'Stop when the crunch reads Clean, CH1’s red light is dark and the LEVEL light is green.',
  },
  // The step opens with CH1 on the top orange (ceilings.ts), loud enough to overload the Howler
  // with the recording level fully up. The words name what matters here, the mixer's ceiling,
  // and never hold the top orange up as a level to play at.
  3: {
    title: 'Recording level too high',
    body: 'The mixer is clean. The Howler’s LEVEL light is red. Turn the recording level down until the light is green.',
  },
};

export const stepCounter = (step: Step, of: number): string => `Step ${step} of ${of}`;

export const NAV = {
  back: 'Back',
  next: 'Next',
  /** Step 1's way on: the step always ends in its result, so this shows it first. */
  reveal: 'Show the result',
  locked: 'Locked for this step',
} as const;

export interface Feedback {
  title: string;
  lines: string[];
  /** Label for the button that moves on. */
  next: string | null;
}

/** Step 1 has no solution. This is what happened, once the tries run out. */
export function revealFeedback(r: Reading): Feedback {
  const lines = [
    'The recording level comes after the mixer’s ceiling. If you turn it down, the flat tops get smaller. They stay flat.',
  ];
  if (r.howler === 'green') lines.push('The LEVEL light stayed green. It does not show crunch made in the mixer.');
  return { title: 'The crunch is still there', lines, next: 'Next: turn the channel down' };
}

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
  if (step === 2) {
    const blend = blendReaches(r, MIXER_CEILING_DB)
      ? `A blend can add up to two more lights and reach the red. ${KEEP_CH1}`
      : blendReaches(r, TARGET_PEAK_DB.top)
        ? `A blend can add up to two more lights and reach the top orange on the MASTER meters. ${KEEP_CH1}`
        : `A blend can add up to two more lights and leave the top orange on the MASTER meters${NBSP}dark.`;
    return {
      title: 'Fixed at the channel',
      lines: ['The channel comes before the mixer’s ceiling.', blend],
      next: 'Next: recording level too high',
    };
  }
  if (step === 3) {
    const lines = ['The recording level comes before the Howler’s input.'];
    if (blendClipsRecording(r)) lines.push('The recording peaks close to the top. A blend would clip it again.');
    return { title: 'Fixed with the recording level', lines, next: null };
  }
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* Readouts                                                                                     */

/** The result strip's labels: CH1 as printed on the mixer, then the two outcomes. */
export const READOUTS = {
  ch1: 'CH1',
  crunch: 'Crunch',
  howler: 'Howler’s LEVEL light',
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
  some: 'Some crunch',
  heavy: 'Heavy crunch',
};

export const HOWLER_WORDS = {
  green: { state: 'Blinking green', meaning: 'Level OK' },
  red: { state: 'Blinking red', meaning: 'Level too high' },
} as const;

/** Where it clipped, in a few words: the verdict under the step, and what screen readers hear. */
export function stateSentence(r: Reading): string {
  if (r.mixer === 'over' && r.recorder === 'over') return 'Clipped in the mixer and at the Howler’s input.';
  if (r.mixer === 'over' && r.recorder === 'at') return 'Clipped in the mixer. The flat tops touch the Howler’s limit.';
  if (r.mixer === 'over') return 'Clipped in the mixer.';
  if (r.recorder === 'over') return 'Clipped at the Howler’s input.';
  if (r.recorder === 'at') return 'Touching the Howler’s limit. Nothing is cut yet.';
  if (r.mixer === 'at') return 'Touching the red. Nothing is cut yet. A blend would clip.';
  return 'Clean at both ceilings.';
}

/**
 * What to notice on each screen, printed under it. Until step 1 is over (`teach` false), the
 * recording's line keeps back where its flat tops came from.
 */
export function scopeClaims(r: Reading, teach = true): { mixer: string; recording: string } {
  const mixer =
    r.mixer === 'over'
      ? 'The loudest peaks go past ceiling 1 and are cut flat.'
      : r.mixer === 'at'
        ? 'The loudest peaks just touch ceiling 1.'
        : 'The whole wave fits under ceiling 1.';
  let recording: string;
  if (r.mixer === 'over' && r.recorder === 'over')
    recording = 'The mixer cut the peaks, then ceiling 2 cut them again.';
  else if (r.mixer === 'over' && r.recorder === 'at') recording = 'The flat tops from the mixer just touch ceiling 2.';
  else if (r.mixer === 'over') {
    recording = teach
      ? 'The flat tops sit below ceiling 2. They were cut in the mixer.'
      : 'The flat tops sit below ceiling 2.';
  } else if (r.recorder === 'over') recording = 'The peaks are cut flat at ceiling 2.';
  else if (r.recorder === 'at') recording = 'The loudest peaks just touch ceiling 2.';
  else recording = 'The whole wave fits under ceiling 2.';
  return { mixer, recording };
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
  recording: 'In the recording',
  ceiling1: 'Ceiling 1',
  ceiling2: 'Ceiling 2',
  zoom: 'Zoomed in to about 30 thousandths of a second',
  legend: { music: 'The music', cut: 'What a ceiling cut off' },
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Sound                                                                                        */

export const SOUND = {
  listen: 'Listen',
  stop: 'Stop',
  quiet: 'It starts quietly. If you hear nothing, check your volume and silent switch.',
  steady: 'You hear the recording turned up to one steady loudness, as you would at home.',
  clean: 'Hear the clean version',
  matched: 'The clean version is matched for loudness. Only the crunch changes.',
  unavailable: 'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
  playing: 'Two ceilings lab',
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Without JavaScript, and the model's caveat                                                   */

export const NO_SCRIPT = 'The lab needs JavaScript to move.';

/**
 * Howler publishes no maximum input level, so ceiling 2 is an assumption (model.ts). The gap is
 * stated once, in the guide's section on what the makers publish; this line points there.
 */
const MAKERS = section('red-top');

export const MODEL_NOTE = {
  text: 'Ceiling 2 is an assumption.',
  link: `See ${MAKERS.number}`,
  href: `#${MAKERS.id}`,
} as const;
