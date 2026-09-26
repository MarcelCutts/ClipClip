/**
 * Every sentence "Can you hear it?" shows, in one place: what someone needs to take the test and
 * read the result. UK English, short, second person, facts first. Numbers carry a no-break space
 * before "dB" so they never split across lines.
 *
 * The test sits early in the guide, before "ceiling" is defined, so it says "the red": the point
 * where the mixer clips in this model, as the DJ box names it.
 */
import { type Confidence, type Device, ROUND_PUSHES_DB, type Round, type Side, type Summary } from './model';

const NBSP = '\u00a0';

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
 * One line under each round's heading, with how far that round pushed the clipped copy (it never
 * says which one it is). The first also says what to do, and that both play at the same loudness.
 */
export const ROUND_INTROS: readonly string[] = ROUND_PUSHES_DB.map((db, i) =>
  i === 0
    ? `Play A and B. One was pushed ${dbText(db)} past the red and clipped. Both play at the same loudness.`
    : `The clipped one was pushed ${dbText(db)} past the red.`,
);

/** What to listen for, before you press play: the action first, then why on this device. */
export const DEVICE_TIPS: Record<Device, string> = {
  phone: 'Listen for crunch on the edge of the kick and on the hi-hats. Phone speakers drop the deep bass.',
  laptop: 'Listen for crunch on the edge of the kick and on the hi-hats. Laptop speakers drop most of the bass.',
  headphones: 'Listen for crunch on the kick and the hi-hats.',
};

export const HEADPHONE_WARNING = 'Turn your device volume down before you press play.';

export const TRANSPORT_NOTE = 'It starts quietly. If you hear nothing, check your volume and silent switch.';

export const NO_AUDIO = 'This browser cannot play the sound. Everything else works. To hear it, try another browser.';

export const CHECK = 'Check answer';
export const MISSING_PICK = 'Choose A or B first.';
export const MISSING_SURE = 'Choose how sure you are.';

export const roundHeading = (index: number, total: number): string => `Round ${index + 1} of ${total}`;

export const verdictLine = (spotted: boolean): string => (spotted ? 'You spotted it.' : 'It was the other one.');

/** The reveal: which one was clipped, and what was done to it. */
export const revealLine = (round: Round): string =>
  `${letter(round.clipped)} was pushed ${dbText(round.pushDb)} past the red, then turned down to match.`;

export const scopeTitle = (clipped: boolean): string => (clipped ? 'Clipped, turned down to match' : 'Clean');

/** What each waveform shows, for screen readers, the clipping line included. */
export const scopeLabel = (side: Side, clipped: boolean): string =>
  clipped
    ? `Waveform of ${letter(side)}, the clipped one, turned down to match. Smaller than the clean kick, with its peaks cut flat, now under the line where the mixer clips.`
    : `Waveform of ${letter(side)}, the clean one. One kick with smooth, rounded peaks, just under the line where the mixer clips.`;

/** The key under the screens: the thick lines on the clipped kick. */
export const FLAT_KEY = 'Flat tops, heard as crunch';

/** The key under the screens: the dashed line on both. */
export const CEILING_KEY = 'Where the mixer clips';

/** On the blank screens before the answer is in. */
export const SCOPE_WAITING = 'Shows after you answer';

export const nextLabel = (index: number, total: number): string =>
  index < total - 1 ? 'Next round' : 'See your score';

export const scoreLine = (summary: Summary): string => `You spotted ${summary.spotted} of ${summary.total}.`;

export const resultWord = (spotted: boolean): string => (spotted ? 'Spotted' : 'Missed');

function listRounds(indices: readonly number[]): string {
  const names = indices.map((i) => String(i + 1));
  if (names.length === 1) return `round ${names[0]}`;
  return `rounds ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Said only when the reader was certain and wrong: which rounds, then what to do in the booth.
 * Null when there is nothing to say.
 */
export function hypercorrectionLine(summary: Summary): string | null {
  const misses = summary.confidentMisses;
  if (misses.length === 0) return null;
  const fact =
    misses.length === summary.total
      ? 'You chose the clean one in every round, and you were certain each time.'
      : misses.length === 1
        ? `You were certain in ${listRounds(misses)} and chose the clean one.`
        : `You were certain in ${listRounds(misses)} and chose the clean one ${misses.length === 2 ? 'both times' : 'each time'}.`;
  return `${fact} In the booth, trust the meters over your ears.`;
}

/** What the result means on the device you listened on. */
export const DEVICE_EXPLANATIONS: Record<Device, string> = {
  phone: 'The crunch sits above the bass, where phone speakers still play. Headphones make it easier to hear.',
  laptop: 'The crunch sits above the bass, where laptop speakers still play. Headphones make it easier to hear.',
  headphones: 'Headphones play the whole range, up close, with nothing to cover the crunch.',
};

export const TRY_AGAIN = 'Try again';
