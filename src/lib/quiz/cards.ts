/**
 * The meter check: four questions on the DJ's lines to know by heart, one card each, and the
 * rules for scoring them. In the box's order: where a channel peaks, which meters show a blend,
 * a louder room, louder monitors.
 *
 * Every wrong option is a real habit, and its feedback states what happens instead. Scenes are
 * drawn from the same model as the labs (src/lib/model.ts), so a reading on a card agrees with
 * the rest of the site. Each card links to the guide section that covers it, named as the index
 * names it (src/lib/sections.ts).
 */
import { formatDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { section } from '../sections';
import { MONITOR_TAG, REC_TAG, type ShortTag } from '../tags';

export type Confidence = 'guessing' | 'fairly' | 'certain';

/** "How sure are you?" Asked before the answer is shown; pressing one commits the answer. */
export const CONFIDENCE: ReadonlyArray<{ id: Confidence; label: string }> = [
  { id: 'guessing', label: 'Guessing' },
  { id: 'fairly', label: 'Fairly sure' },
  { id: 'certain', label: 'Certain' },
];

/** What a card shows beside its question. Levels are on the XDJ-RX2 meter's own dB scale. */
export type Scene =
  | { kind: 'meters'; ch1: number; master: number; ch2: number }
  /** The BOOTH MONITOR knob, with the print kit's tag beside it. */
  | { kind: 'booth'; tag?: ShortTag };

export interface Choice {
  id: string;
  label: string;
  correct?: boolean;
  /** Shown after answering, when this was the choice: what happens, as a fact. */
  feedback: string;
}

export interface Card {
  id: string;
  /** The fieldset's legend: the question. */
  question: string;
  scene?: Scene;
  choices: readonly Choice[];
  /** The guide section that covers this. `path` is site-relative; pass it through href() to link it. */
  learn: { path: string; text: string };
}

/** A guide section as a link: "2.1 Set TRIM …". */
function learnAt(id: string): Card['learn'] {
  const { number, title } = section(id);
  return { path: `/#${id}`, text: `${number} ${title}` };
}

/** What two equal kicks landing together add: "6 dB, two lights". */
const BLEND_ADDS = `${formatDb(KICKS_TOGETHER_DB, { signed: false })}, two lights`;

/** The same two facts on both volume cards, in the same words. */
const PUSH_CHANNELS = 'Louder channels drive the MASTER meters towards the red.';
const MASTER_LEVEL = `MASTER LEVEL is taped fully up, marked ${REC_TAG.name}. It sets the speakers and the recording together.`;

export const CARDS: readonly Card[] = [
  {
    id: 'peak',
    question: 'Where should the loudest part of a track peak on its channel meter?',
    choices: [
      {
        id: 'red',
        label: 'A flash of red on the loudest hits',
        // Pioneer's own words, p. 31: "Make sure that the red indicator does not light up, or the sound may be distorted."
        feedback: 'Pioneer says to keep the red light dark, or the sound may be distorted (p. 31).',
      },
      {
        id: 'top',
        label: 'The top orange, just under the red',
        feedback: `A blend can add ${BLEND_ADDS}. From the top orange, that is past the red.`,
      },
      {
        id: 'first',
        label: 'The first or second orange',
        correct: true,
        feedback: 'That leaves room for the two lights a blend adds.',
      },
    ],
    learn: learnAt('trim'),
  },
  {
    id: 'meters',
    question: 'Which meters show a blend?',
    // The house rule working: both channels on the first orange, the blend two lights higher.
    scene: {
      kind: 'meters',
      ch1: TARGET_PEAK_DB.first,
      master: TARGET_PEAK_DB.first + KICKS_TOGETHER_DB,
      ch2: TARGET_PEAK_DB.first,
    },
    choices: [
      {
        id: 'channels',
        label: 'The channel meters (CH1 and CH2)',
        feedback: 'The channel meters show each track before its fader. Only the MASTER meters show the mix.',
      },
      {
        id: 'master',
        label: 'The MASTER meters (the pair in the middle)',
        correct: true,
        feedback: 'The MASTER meters show the mix. The channel meters show each track before its fader.',
      },
    ],
    learn: learnAt('meters'),
  },
  {
    id: 'room',
    // The traps are habits: push the channels, or reach for MASTER LEVEL, which sets MASTER 1 and 2
    // together (the PA and the Howler). The room's volume comes from the amps, which are the crew's.
    question: 'The room needs to be louder. What do you do?',
    choices: [
      {
        id: 'channels',
        label: 'Push the channels',
        feedback: `${PUSH_CHANNELS} The room’s volume comes from the amps.`,
      },
      { id: 'master', label: 'Turn up MASTER LEVEL', feedback: MASTER_LEVEL },
      {
        id: 'crew',
        label: 'Ask the crew',
        correct: true,
        feedback: 'The crew turn the amps up. The amps change the room’s volume, not the recording.',
      },
    ],
    learn: learnAt('knobs'),
  },
  {
    id: 'monitor',
    // BOOTH MONITOR sets only the BOOTH output (Pioneer manual p. 27), so it's the DJ's: the print
    // kit tags it MONITOR, yours.
    question: 'The booth monitors are too quiet. What do you do?',
    scene: { kind: 'booth', tag: MONITOR_TAG },
    choices: [
      {
        id: 'booth',
        label: 'Turn up BOOTH MONITOR',
        correct: true,
        feedback: `BOOTH MONITOR sets the booth monitors only. The ${MONITOR_TAG.name} tag marks it as yours.`,
      },
      { id: 'master', label: 'Turn up MASTER LEVEL', feedback: MASTER_LEVEL },
      {
        id: 'channels',
        label: 'Push the channels',
        feedback: `${PUSH_CHANNELS} BOOTH MONITOR sets the booth monitors.`,
      },
    ],
    learn: learnAt('knobs'),
  },
];

export interface Answer {
  choice: string;
  confidence: Confidence;
}

/** The right choice on a card. Every card has exactly one (the tests hold us to it). */
export function correctChoice(card: Card): Choice {
  const right = card.choices.find((c) => c.correct);
  if (!right) throw new Error(`Card ${card.id} has no correct choice`);
  return right;
}

export function isCorrect(card: Card, choiceId: string): boolean {
  return correctChoice(card).id === choiceId;
}

/** "Right." or "Not quite.": the verdict, in words, that leads the feedback. */
export function verdict(card: Card, choiceId: string): string {
  return isCorrect(card, choiceId) ? 'Right.' : 'Not quite.';
}

/** The feedback for a choice: the verdict, then the one-line why. */
export function feedbackFor(card: Card, choiceId: string): string {
  const choice = card.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Card ${card.id} has no choice ${choiceId}`);
  return `${verdict(card, choiceId)} ${choice.feedback}`;
}

export interface Summary {
  right: number;
  total: number;
  /** Cards answered wrongly with "Certain". */
  sureButWrong: string[];
  /** Cards answered wrongly (or not at all), in card order. */
  missed: string[];
}

export function summarise(cards: readonly Card[], answers: ReadonlyArray<Answer | undefined>): Summary {
  let right = 0;
  const sureButWrong: string[] = [];
  const missed: string[] = [];
  cards.forEach((card, i) => {
    const answer = answers[i];
    if (answer && isCorrect(card, answer.choice)) {
      right++;
      return;
    }
    missed.push(card.id);
    if (answer?.confidence === 'certain') sureButWrong.push(card.id);
  });
  return { right, total: cards.length, sureButWrong, missed };
}

/** "You got 3 of 4." No points, no badges: just the count. */
export function scoreLine({ right, total }: Summary): string {
  return `You got ${right} of ${total}.`;
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

/** Said only when an answer the reader was certain of was wrong: how many. */
export function sureLine({ sureButWrong }: Summary): string | null {
  const n = sureButWrong.length;
  if (n === 0) return null;
  return n === 1
    ? 'You were certain of one wrong answer.'
    : `You were certain of ${COUNT_WORDS[n] ?? n} wrong answers.`;
}

/** Over the list of sections behind the wrong answers. */
export const REVIEW_LEAD = 'Read these again';

/** Where to go over the missed cards, one link per guide section, in card order. */
export function reviewLinks(cards: readonly Card[], summary: Summary): Array<{ path: string; text: string }> {
  const seen = new Set<string>();
  const links: Array<{ path: string; text: string }> = [];
  for (const card of cards) {
    if (!summary.missed.includes(card.id) || seen.has(card.learn.path)) continue;
    seen.add(card.learn.path);
    links.push(card.learn);
  }
  return links;
}
