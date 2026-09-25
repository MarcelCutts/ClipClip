/**
 * Every sentence "Can you hear it?" shows, in one place. UK English, short, second person, and
 * plain: what happened and why, with the number where it helps. Numbers carry a no-break space
 * before "dB" so they never split across lines.
 */
import { type Confidence, type Device, other, ROUND_PUSHES_DB, type Round, type Side, type Summary } from './model';

const NBSP = ' ';

/** "A" or "B". */
export const letter = (side: Side): string => side.toUpperCase();

/** A whole number of decibels, unsigned: "12 dB". */
export const dbText = (db: number): string => `${Math.round(Math.abs(db))}${NBSP}dB`;

export const LEGENDS = {
  device: 'Listening on',
  pick: 'Which one is clipped?',
  sure: 'How sure are you?',
} as const;

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  guessing: 'Guessing',
  fairly: 'Fairly sure',
  certain: 'Certain',
};

export const DEVICE_LABELS: Record<Device, string> = {
  phone: 'Phone speaker',
  laptop: 'Laptop',
  headphones: 'Headphones',
};

/** What's playing, for the page-wide Stop bar. Never names A or B: that could give the answer away. */
export const PLAYER_LABEL = 'Listening test';

/**
 * One line under each round's heading, with how far that round pushes the clipped copy (it never
 * says which one it is). The first also says what to do.
 */
export const ROUND_INTROS: readonly string[] = ROUND_PUSHES_DB.map((db, i) =>
  i === 0
    ? `Play A and B. One was pushed ${dbText(db)} into the mixer’s ceiling, so it clipped. Both play equally loud.`
    : i === ROUND_PUSHES_DB.length - 1
      ? `In the last round, the clipped one was pushed only ${dbText(db)} into the ceiling.`
      : `This time the clipped one was pushed ${dbText(db)} into the ceiling.`,
);

/** What to listen for, before you press play. Only the words change with the device. */
export const DEVICE_TIPS: Record<Device, string> = {
  phone: 'Phone speakers drop the deep bass. Listen higher up, to the edge of the kick and the hi-hats.',
  laptop: 'Laptop speakers drop most of the bass. Listen for a buzzy edge on the kick and grit on the hi-hats.',
  headphones:
    'Headphones play it all, the way people hear your recording at home. Listen for crunch on the kick and grit on the hi-hats.',
};

export const HEADPHONE_WARNING = 'Turn your device volume down before you press play.';

export const TRANSPORT_NOTE = 'Starts quietly. If you hear nothing, check your volume and silent switch.';

export const MODEL_NOTE =
  'This is a model. It plays one synth loop, clipped the way a digital mixer clips, then turned down until both measure equally loud.';

export const NO_AUDIO = 'Sound is blocked or missing in this browser. Try another one.';

export const CHECK = 'Check answer';
export const MISSING_PICK = 'Choose A or B first.';
export const MISSING_SURE = 'Choose how sure you are.';

export const roundHeading = (index: number, total: number): string => `Round ${index + 1} of ${total}`;

export const verdictLine = (spotted: boolean): string => (spotted ? 'You spotted it.' : 'It was the other one.');

/** The reveal: which one was clipped, and what was done to it. */
export const revealLine = (round: Round): string =>
  `${letter(round.clipped)} was pushed ${dbText(round.pushDb)} into the ceiling, then turned down to match.`;

export const scopeTitle = (clipped: boolean, unmatched: boolean): string =>
  !clipped ? 'Clean' : unmatched ? 'Clipped, as loud as the mixer left it' : 'Clipped, turned down to match';

/**
 * What each waveform shows, for screen readers, ceiling line included. It changes with the
 * loudness toggle, like the picture.
 */
export const scopeLabel = (side: Side, clipped: boolean, unmatched = false): string =>
  !clipped
    ? `Waveform of ${letter(side)}, the clean one. One kick with smooth, rounded peaks, just under the mixer’s ceiling.`
    : unmatched
      ? `Waveform of ${letter(side)}, the clipped one, at the mixer’s level. Fatter than the clean kick, with its peaks cut flat at the mixer’s ceiling.`
      : `Waveform of ${letter(side)}, the clipped one, turned down to match. Smaller than the clean kick, its peaks cut flat and now under the mixer’s ceiling.`;

export const scopeCaption = (unmatched: boolean): string =>
  unmatched
    ? 'At the mixer’s level the clipped kick is fatter than the clean one, so it sounds louder. The flat tops are still there.'
    : 'Both kicks measure equally loud, but their shapes differ. The thick red lines mark where the ceiling sliced the kick flat, which you hear as crunch.';

export const FLAT_KEY = 'Flat tops, cut by the ceiling';

/** The dashed line on both screens. */
export const CEILING_KEY = 'The mixer’s ceiling';

/** On the blank screens before the answer is in. */
export const SCOPE_WAITING = 'Shows after you answer';

/** A toggle: pressed, the clipped copy plays at the level the mixer left it. */
export const UNMATCHED_LABEL = 'Skip the loudness match';

/**
 * Under the toggle before it is pressed. Pressing it plays the clipped copy straight away, up to
 * 8 dB louder, so say how much louder first. `matchDb` is how far the test turned it down.
 */
export const unmatchedHint = (matchDb: number): string =>
  `This plays the clipped one as loud as the mixer left it, about ${dbText(matchDb)} louder. On headphones, turn your volume down first.`;

/** Shown while the clipped copy plays unmatched. `matchDb` is how far the test turned it down. */
export const unmatchedNote = (round: Round, matchDb: number): string =>
  `${letter(round.clipped)} now plays as loud as the mixer left it, about ${dbText(matchDb)} louder than ${letter(
    other(round.clipped),
  )}. Louder nearly always sounds better, so a fair test turns it down.`;

export const nextLabel = (index: number, total: number): string =>
  index < total - 1 ? 'Next round' : 'See how you did';

export const scoreLine = (summary: Summary): string => `You spotted ${summary.spotted} of ${summary.total}.`;

export const resultWord = (spotted: boolean): string => (spotted ? 'Spotted' : 'Missed');

function listRounds(indices: readonly number[]): string {
  const names = indices.map((i) => String(i + 1));
  if (names.length === 1) return `round ${names[0]}`;
  return `rounds ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Being sure and wrong is the moment people remember best, so when it happens we point at it
 * and hang the rule on it. Null when there is nothing to say.
 */
export function hypercorrectionLine(summary: Summary): string | null {
  const misses = summary.confidentMisses;
  if (misses.length === 0) return null;
  const opener =
    misses.length === summary.total
      ? 'You were certain every time, and every time it was the other one.'
      : misses.length === 1
        ? `You were certain about ${listRounds(misses)}, and it was the other one.`
        : `You were certain about ${listRounds(misses)}, and ${misses.length === 2 ? 'both times' : 'each time'} it was the other one.`;
  return `${opener} Clipping is easy to miss even when you feel sure. In the booth, go by the meter and keep the red light dark.`;
}

/** Why the result came out the way it did on this kind of speaker. */
export const DEVICE_EXPLANATIONS: Record<Device, string> = {
  phone:
    'Phone speakers drop the deep bass. The crunch from clipping sits higher up, where they play fine. Headphones make it easier to hear.',
  laptop:
    'Laptop speakers drop most of the bass. The crunch sits higher up, where they play fine. Headphones make it easier to hear.',
  headphones:
    'Headphones play the whole range, quietly and up close. That’s how people listen to a set recording, often more than once.',
};

export const FINAL_LINE =
  'Your recording gets played on headphones at home, where crunch like this is easiest to hear.';

export const TRY_AGAIN = 'Try again';
