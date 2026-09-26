/**
 * Every word the two-ceilings lab says, in one place so the house style can be tested:
 * UK English, second person, short sentences, no dashes for asides, no "please". Plain
 * statements with the reason in them: no question-and-answer lead-ins, no slogans.
 */
import { formatDb } from '../dsp/db';
import { describeLevel, METER_SEGMENTS, scaleLabel } from '../xdj';
import type { Ceiling, Confidence, Crunch, Fixer, Prediction, Reading, Stage, Step } from './ceilings';

/** The channel meter's top light, the red one. */
const METER_TOP_DB = METER_SEGMENTS[METER_SEGMENTS.length - 1]!.db;

const NBSP = ' ';

/* ------------------------------------------------------------------------------------------ */
/* The chain                                                                                    */

export const CHAIN = {
  label: 'The chain this lab follows',
  mixer: { name: 'Mixer', sub: `Ceiling${NBSP}1` },
  knob: { name: 'Record level', sub: 'MASTER LEVEL' },
  howler: { name: 'Howler', sub: `Ceiling${NBSP}2` },
  file: { name: 'File', sub: 'What you keep' },
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
    title: 'Predict',
    body: 'Before you touch anything, make a guess. Press Listen to hear the crunch first.',
  },
  2: {
    title: 'Fix it with the record level only',
    body: 'The channels are locked in the red. Turn the record level and try to get rid of the crunch.',
  },
  3: {
    title: 'Now fix it for real',
    body: 'The channels are unlocked. Get the crunch to Clean, with the meter’s red light dark and the Howler’s LEVEL light green.',
  },
  4: {
    title: 'Record level too high',
    body: 'This time the channels stay out of the red, but the LEVEL light is red. Fix it with the record level only.',
  },
  5: {
    title: 'Free play',
    body: 'Move anything you like. Each preset is a situation you might meet in the booth.',
  },
};

export const stepCounter = (step: Step, of: number): string => `Step ${step} of ${of}`;

export const NAV = {
  back: 'Back',
  next: 'Next',
  /** Step 2's way on: the challenge always ends in its lesson, so this shows it first. */
  reveal: 'Show me what happens',
  skip: 'Skip to free play',
  restart: 'Start the lab again',
  locked: 'Locked for this step',
} as const;

export const PREDICT = {
  question: 'The channels are in the red. You turn the record level down. What happens to the crunch?',
  options: {
    'goes-away': 'Goes away',
    'quieter-stays': 'Gets quieter but stays',
    'not-sure': 'Not sure',
  } satisfies Record<Prediction, string>,
  sure: 'How sure are you?',
  confidence: {
    guessing: 'Guessing',
    'fairly-sure': 'Fairly sure',
    certain: 'Certain',
  } satisfies Record<Confidence, string>,
  waiting: 'Pick an answer to carry on.',
} as const;

export interface Feedback {
  title: string;
  lines: string[];
  /** Label for the button that moves on. */
  next: string | null;
}

/** Challenge 1 has no solution. This is what the reader learns when it runs out. */
export function revealFeedback(r: Reading, prediction: Prediction | null, confidence: Confidence | null): Feedback {
  const lines = [
    'The damage happened in the mixer, before the record level. Turning it down only shrinks the flat tops. Turn the file up later and the crunch comes back.',
  ];
  if (r.howler === 'green') {
    lines.push(
      'The LEVEL light stayed green. It only checks the Howler’s own input, so it misses crunch made in the mixer.',
    );
  }
  const note = predictionNote(prediction, confidence);
  if (note) lines.push(note);
  return { title: 'Quieter, still crunchy', lines, next: 'Next: fix it for real' };
}

/** Feedback on the prediction, once the answer is in. Confident mistakes get their own line. */
export function predictionNote(prediction: Prediction | null, confidence: Confidence | null): string | null {
  if (prediction === 'quieter-stays') return 'You predicted this.';
  if (prediction !== 'goes-away') return null;
  if (confidence === 'certain')
    return 'You were certain it would go away. The record level can’t undo crunch made before it, so remember this one.';
  return 'You predicted it would go away. Turning down after the damage only makes it quieter.';
}

/**
 * How the crew turn the recording down on the night, with the Howler on MASTER 2. Pioneer doesn't say
 * whether MASTER ATT reaches MASTER 2, so the setup page tests it (T2), and this says so.
 */
export const ON_THE_NIGHT =
  'On the night, MASTER LEVEL stays fully up, taped REC. The crew turn the recording down with MASTER ATT in UTILITY, if the setup test shows it reaches MASTER 2.';

export function successFeedback(step: Step, r: Reading): Feedback | null {
  if (step === 3) {
    // The lab has one track. Two tracks that each stay out of the red can still go red together.
    const lines = [
      'With the track out of the red, nothing gets cut in the mixer. The LEVEL light is green too.',
      r.channels > 3
        ? `Aim for the first orange light (${scaleLabel(0)}) or the second (${scaleLabel(3)}). A blend can add two more${NBSP}lights.`
        : `That leaves room for a blend, which can add two more${NBSP}lights.`,
    ];
    return { title: 'Fixed for real', lines, next: 'Next: record level too high' };
  }
  if (step === 4) {
    const lines = [
      'The mix was clean, so the only damage was at the Howler’s input. The record level can fix that one.',
    ];
    if (r.recordingPeakDbfs > -6)
      lines.push('It’s close to the top, though, so the crew set it lower to leave room for blends.');
    // Our wiring: the Howler on MASTER 2, so the crew's way down is MASTER ATT, not MASTER LEVEL.
    lines.push(ON_THE_NIGHT);
    return { title: 'Fixed with the record level alone', lines, next: 'Next: free play' };
  }
  return null;
}

/**
 * The check after step 4: for crunch made in each place, which controls can fix it? The answers
 * come from canFix (ceilings.ts). Each row gets its reason, whatever was picked.
 */
export const CHECK = {
  title: 'Quick check',
  question: 'For each crunch, pick every control that can fix it.',
  rows: {
    mixer: 'Crunch made in the mixer',
    recorder: 'Crunch made at the recorder',
  } satisfies Record<Ceiling, string>,
  /** The same places, shorter, to start each answer. */
  short: { mixer: 'In the mixer', recorder: 'At the recorder' } satisfies Record<Ceiling, string>,
  controls: { channels: 'Channel', knob: 'Record level' } satisfies Record<Fixer, string>,
  check: 'Check',
  right: 'Right.',
  wrong: 'Not quite.',
  why: {
    mixer: 'Only the channel. The record level comes after the damage, so it only makes the crunch quieter.',
    recorder:
      'Both. Anything before the Howler turns its input down. The crew use MASTER ATT, so your channels stay put.',
  } satisfies Record<Ceiling, string>,
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Readouts                                                                                     */

/** The result strip's labels: CH1 as printed on the mixer, then the two outcomes. */
export const READOUTS = {
  ch1: 'CH1',
  crunch: 'Crunch',
  howler: 'Howler’s LEVEL light',
  peak: 'Recording peak',
} as const;

/**
 * What an outcome says before the reader has committed a guess, the way the listening test's
 * screens say "Shows after you answer". Once a guess is picked, the way on is Next.
 */
export const WAITING = { before: 'Guess first', after: 'Press Next' } as const;

/** The channel meter in words, beside its lights: "In the red". */
export function levelWords(level: number): string {
  const words = describeLevel(level);
  return `${words[0]!.toUpperCase()}${words.slice(1)}`;
}

export const CRUNCH_WORDS: Record<Crunch, string> = {
  clean: 'Clean',
  some: 'Some crunch',
  heavy: 'Heavy crunch',
};

export const HOWLER_WORDS = {
  green: { state: 'Blinking green', meaning: 'Level OK' },
  red: { state: 'Blinking red', meaning: 'Level too high' },
} as const;

/** The recording's loudest peak, in words a DJ can use. dBFS stays in the details. */
export function peakWords(dbfs: number): string {
  if (dbfs >= -1e-6) return 'Hitting the top';
  if (dbfs > -6) return 'Close to the top';
  if (dbfs >= -15) return 'Comfortable';
  if (dbfs >= -24) return 'Low, that’s fine';
  return 'Very low';
}

/**
 * The one sentence that says what is happening. Until challenge 1 is over (`teach` false),
 * it describes mixer clipping without giving away what the knob will do.
 */
export function stateSentence(r: Reading, teach = true): string {
  if (r.mixer === 'over' && r.recorder === 'over') {
    return 'Clipped twice. The mixer cut the peaks, then the Howler’s input cut them again.';
  }
  if (r.mixer === 'over' && r.recorder === 'at')
    return 'Clipped inside the mixer, and right at the Howler’s limit too.';
  if (r.mixer === 'over') {
    return teach
      ? 'Clipped inside the mixer. Turning the record level down only makes the crunch quieter.'
      : 'Clipped inside the mixer. The channels are in the red.';
  }
  if (r.recorder === 'over') {
    return 'Clipped at the Howler’s input only. The mix is clean, so turning the record level down fixes it.';
  }
  if (r.recorder === 'at')
    return 'Right at the Howler’s limit, so its light shows red. Turn the record level down a notch.';
  if (r.mixer === 'at') return 'Touching the red. Nothing is cut yet, but there’s no room left for a blend.';
  return 'Clean all the way through. Both ceilings have room to spare.';
}

/**
 * What to notice on each screen, printed under it. Like the state sentence, the recording's line
 * keeps back where its flat tops came from until challenge 1 is over (`teach` false).
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
    hint: 'How loud the track peaks after TRIM and EQ. A blend adds more on top, which shows on the middle meters.',
  },
  knob: {
    label: 'Record level (MASTER LEVEL)',
    // On the night the knob itself stays taped fully up (copy review 52), so the hint says what it stands for first.
    hint: `On the night, MASTER LEVEL stays taped fully up. Here the knob stands for the record level. Fully up is ${formatDb(0)}, and like every output knob it only turns down.`,
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
  legend: { music: 'Your music', tones: 'Test tones', cut: 'What a ceiling cut off' },
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Sound                                                                                        */

export const SOUND = {
  listen: 'Listen',
  stop: 'Stop',
  quiet: 'Starts quietly. If you hear nothing, check your volume and silent switch.',
  steady: 'You hear the recording turned up to one steady loudness, as you would at home.',
  clean: 'Hear the clean version',
  matched: 'The clean version is matched for loudness, so only the crunch changes.',
  unavailable: 'This browser can’t play the sound. Everything else works; try another browser to hear it.',
  playing: 'Two ceilings lab',
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Presets, numbers and the honesty note                                                        */

export const PRESETS_LABEL = 'Presets';

export const NO_SCRIPT = 'The lab needs JavaScript to move. For now it shows the channels in the red.';

export const DETAILS = {
  summary: 'The numbers, for the curious',
  distortion: 'Added distortion',
  distortionNote: `What the ceilings changed, as a share of the clean signal (RMS). Clean is under 0.1%. Heavy crunch starts at${NBSP}5%.`,
  peak: 'Recording peak',
  peakNote: `The file’s 0${NBSP}dBFS is ceiling 2 in this model.`,
  mixer: 'Loudest peak in the mixer',
  mixerNote: `On the channel meter’s scale. The meter stops at ${scaleLabel(METER_TOP_DB)}, its red light, so anything louder shows as red.`,
  engineer: 'Engineer view: two test tones',
  engineerNote: `A 58.6${NBSP}Hz bass tone and a 2${NBSP}kHz tone, the lab’s original signal. Harder to hear on phone speakers.`,
} as const;

/** The added-distortion ratio as a percentage: "15.0%", "0.40%", "0%". */
export function percentText(ratio: number): string {
  const pct = ratio * 100;
  if (pct < 0.005) return '0%';
  return `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}

export const dbfsText = (dbfs: number): string => formatDb(dbfs, { decimals: 1, unit: 'dBFS' });

/**
 * "+18 dB, 6 dB past ceiling 1" and friends. Not "on the meter": its top light is +12, so the
 * level it can't show is only a number here (DETAILS.mixerNote says so).
 */
export function mixerPeakText(r: Reading): string {
  const level = formatDb(r.channels);
  const over = Math.round(r.mixerOverDb);
  if (over > 0) return `${level}, ${over}${NBSP}dB past ceiling 1`;
  if (over === 0) return `${level}, right at ceiling 1`;
  return `${level}, ${-over}${NBSP}dB under ceiling 1`;
}

/**
 * The model's caveat, said once, pointing to "About the demos" on the same page (#model), which
 * gives the detail. Howler publishes no maximum input level, so ceiling 2 is an assumption
 * (model.ts): this is the one sentence in the lab that says so.
 */
export const MODEL_NOTE = {
  text: 'This lab is a model. Howler publishes no input limit, so we assume one.',
  link: 'About the demos',
  href: '#model',
} as const;
