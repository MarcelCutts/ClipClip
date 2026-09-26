/**
 * The meter check (W7): five retrieval cards, and the rules for scoring them.
 *
 * Every wrong option is a real misconception (pedagogy-ux §5), and its feedback refutes that
 * misconception by name before saying what actually happens. Scenes are drawn from the same
 * model as the labs (src/lib/model.ts), so a reading on a card agrees with the rest of the site.
 */
import { KICKS_TOGETHER_DB, MIXER_CEILING_DB, TARGET_PEAK_DB } from '../model';
import { MONITOR_TAG, REC_TAG, type ShortTag } from '../tags';

export type Confidence = 'guessing' | 'fairly' | 'certain';

/** "How sure are you?" Asked before the answer is shown, so a confident miss can surprise. */
export const CONFIDENCE: ReadonlyArray<{ id: Confidence; label: string }> = [
  { id: 'guessing', label: 'Guessing' },
  { id: 'fairly', label: 'Fairly sure' },
  { id: 'certain', label: 'Certain' },
];

/** What a card shows beside its question. Levels are on the XDJ-RX2 meter's own dB scale. */
export type Scene =
  | {
      kind: 'meters';
      ch1: number;
      master: number;
      ch2: number;
      /** Keep the middle meters dark until the answer is in, then show them climbing to `master`. */
      hideMaster?: boolean;
      /** One short line under the meters, when the picture needs words to map it. */
      caption?: string;
    }
  | { kind: 'howler'; light: 'green' | 'red' }
  /** The BOOTH MONITOR knob, with the print kit's tag beside it. */
  | { kind: 'booth'; tag?: ShortTag };

export interface Choice {
  id: string;
  label: string;
  correct?: boolean;
  /** Shown after answering, when this was the choice. Wrong choices refute their misconception. */
  feedback: string;
}

export interface Card {
  id: string;
  /** The fieldset's legend: the scenario and the question. */
  question: string;
  scene?: Scene;
  choices: readonly Choice[];
  /** Where the guide teaches this. `path` is site-relative; pass it through href() to link it. */
  learn: { path: string; text: string };
}

export const CARDS: readonly Card[] = [
  {
    id: 'where',
    question: 'The recording crunches, but the Howler’s LEVEL light stayed green all night. Where did it clip?',
    scene: { kind: 'howler', light: 'green' },
    choices: [
      // "Most likely": Howler doesn't publish where its light turns red (gear-facts §2.2).
      {
        id: 'recorder',
        label: 'In the recorder',
        feedback:
          'A green light means the recorder most likely had room. The crunch was already in what the mixer sent it.',
      },
      {
        id: 'mixer',
        label: 'Inside the mixer, before the outputs',
        correct: true,
        feedback: 'A green light means the recorder most likely had room, so the crunch arrived with the signal.',
      },
      {
        id: 'speakers',
        label: 'In the PA speakers',
        feedback: 'The speakers aren’t on the recording’s path. The crunch came from inside the mixer.',
      },
    ],
    learn: { path: '/#two-ceilings', text: 'See both ceilings' },
  },
  {
    id: 'turn-down',
    // The crunch is given, not claimed: Pioneer only says red "may" distort, so the card asks
    // about the fix (misconception M3), not whether red crunched. "The recording" rather than a knob:
    // the crew would use MASTER ATT, which DJs never see.
    question:
      'The track crunches on the drop, with its channel meter in the red. The crew turn the recording down. Is it clean now?',
    scene: { kind: 'meters', ch1: MIXER_CEILING_DB, master: 9, ch2: Number.NEGATIVE_INFINITY },
    choices: [
      {
        id: 'yes',
        label: 'Yes, it’s clean now',
        feedback:
          'The crunch happens in the channel, before the record level. Turning down afterwards just makes it quieter.',
      },
      {
        id: 'no',
        label: 'No, it’s quieter but still crunchy',
        correct: true,
        feedback: 'The crunch happens in the channel, before the record level. Turning down keeps it, just quieter.',
      },
    ],
    learn: { path: '/#two-ceilings', text: 'Why turning it down doesn’t help' },
  },
  {
    id: 'blend',
    question:
      'Both tracks reach the top orange light on their own. You bring the second one in with the kicks lined up. Where do the middle meters go?',
    scene: {
      kind: 'meters',
      ch1: TARGET_PEAK_DB.top,
      master: TARGET_PEAK_DB.top + KICKS_TOGETHER_DB,
      ch2: TARGET_PEAK_DB.top,
      hideMaster: true,
    },
    choices: [
      {
        id: 'down',
        label: 'Goes down',
        feedback: 'A second track adds level. Kicks that land together push the middle meters up, into the red.',
      },
      {
        id: 'orange',
        label: 'Stays orange',
        feedback: 'Kicks that land together add up rather than average out, and red is one light above the top orange.',
      },
      {
        id: 'red',
        label: 'Into the red',
        correct: true,
        feedback:
          'Kicks that land together add up, by up to 6 dB. That’s two lights, and red is one light above the top orange.',
      },
    ],
    learn: { path: '/#blends', text: 'How blends add up' },
  },
  {
    id: 'which-meters',
    question: 'Which meters show a blend?',
    scene: {
      kind: 'meters',
      ch1: TARGET_PEAK_DB.first,
      master: TARGET_PEAK_DB.first + KICKS_TOGETHER_DB,
      ch2: TARGET_PEAK_DB.first,
      caption: 'Two tracks mid-blend. CH1 and CH2 sit at the sides, MASTER in the middle.',
    },
    choices: [
      {
        id: 'middle',
        label: 'The middle meters (MASTER)',
        correct: true,
        feedback: 'The channel meters show each track before its fader. The middle meters show the mix.',
      },
      {
        id: 'sides',
        label: 'The channel meters (CH1 and CH2)',
        feedback:
          'The channel meters show each track before its fader, so they can’t show a blend. Watch the middle meters.',
      },
    ],
    learn: { path: '/#meters', text: 'Which meters show what' },
  },
  {
    id: 'monitor',
    // The traps are habits (misconception M10): push the channels, or reach for MASTER LEVEL. The answer
    // is the knob the print kit tags "MONITOR · yours" (dj-culture §0.8, §7.4): BOOTH MONITOR sets only
    // the BOOTH output (Pioneer manual p.27), while MASTER LEVEL sets MASTER 1 and 2, the PA and the Howler.
    question: 'The booth monitors are too quiet. What do you do?',
    scene: { kind: 'booth', tag: MONITOR_TAG },
    choices: [
      {
        id: 'channels',
        label: 'Push the channels',
        feedback:
          'Pushing the channels drives the mix towards the red, and any crunch goes into the recording. Turn up BOOTH MONITOR instead.',
      },
      {
        id: 'master',
        label: 'Turn up MASTER LEVEL',
        feedback: `MASTER LEVEL is taped fully up and marked ${REC_TAG.name}. It sets the speakers and the recording, and the monitors have their own knob, so leave it to the crew.`,
      },
      {
        id: 'booth',
        label: 'Turn up BOOTH MONITOR',
        correct: true,
        feedback: `BOOTH MONITOR sets only the booth monitors, so it’s ${MONITOR_TAG.owner}: that’s the ${MONITOR_TAG.name} tag. It doesn’t touch the speakers or the recording.`,
      },
    ],
    learn: { path: '/#knobs', text: 'Which knobs are yours' },
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
  /** Cards answered wrongly with "Certain": the ones hypercorrection works best on. */
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

/** "You got 4 of 5." No points, no badges: just the count. */
export function scoreLine({ right, total }: Summary): string {
  return `You got ${right} of ${total}.`;
}

/**
 * Said only when something the reader was certain about turned out wrong. A confident miss that
 * gets corrected is the kind people remember best (hypercorrection, Brod 2021), so the line points
 * them back at it.
 */
export function sureLine({ sureButWrong }: Summary): string | null {
  if (sureButWrong.length === 0) return null;
  return sureButWrong.length === 1
    ? 'You were certain of one answer that was wrong. That one is worth reading about again.'
    : 'You were certain of some answers that were wrong. Those are worth reading about again.';
}

/** Where to go over the missed cards, one link per page section, in card order. */
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
