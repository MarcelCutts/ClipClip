import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KICKS_TOGETHER_DB } from '../model';
import { MASTER_TAG, MONITOR_TAG, REC_TAG, SHORT_TAGS } from '../tags';
import { CEILING_DB, litCount, zoneFor } from '../xdj';
import {
  type Answer,
  CARDS,
  type Card,
  CONFIDENCE,
  correctChoice,
  feedbackFor,
  isCorrect,
  reviewLinks,
  scoreLine,
  summarise,
  sureLine,
  verdict,
} from './cards';

/**
 * Where a card may send the reader: the guide's sections that teach these ideas. The quiz sits in
 * the guide itself (/#check), so every link is a jump within the page.
 */
const TAUGHT_AT = new Set(['/#trim', '/#meters', '/#blends', '/#knobs', '/#myths', '/#two-ceilings', '/#record-level']);

/** The page source behind a site path, to check that a linked #section really exists. */
const pageSource = (path: string) =>
  readFileSync(new URL(`../../pages${path.replace(/#.*$/, '')}index.astro`, import.meta.url), 'utf8');

/** Every string a reader sees on the cards. */
const copyOf = (card: Card) => [
  card.question,
  card.learn.text,
  ...(card.scene?.kind === 'meters' && card.scene.caption ? [card.scene.caption] : []),
  ...card.choices.flatMap((c) => [c.label, c.feedback]),
];

const sentences = (text: string) => text.split(/(?<=[.?])\s+/).filter(Boolean);
const words = (sentence: string) => sentence.split(/\s+/).filter(Boolean).length;

const scene = (id: string) => {
  const card = CARDS.find((c) => c.id === id);
  if (card?.scene?.kind !== 'meters') throw new Error(`${id} has no meters`);
  return card.scene;
};

const answerAll = (picks: Array<[choice: string, confidence: Answer['confidence']] | undefined>) =>
  picks.map((p) => (p ? { choice: p[0], confidence: p[1] } : undefined));

describe('the cards', () => {
  it('are five, each with two or three choices and exactly one right answer', () => {
    expect(CARDS).toHaveLength(5);
    for (const card of CARDS) {
      expect(card.choices.length, card.id).toBeGreaterThanOrEqual(2);
      expect(card.choices.length, card.id).toBeLessThanOrEqual(3);
      expect(
        card.choices.filter((c) => c.correct),
        card.id,
      ).toHaveLength(1);
      expect(new Set(card.choices.map((c) => c.id)).size, card.id).toBe(card.choices.length);
    }
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('keep the right answer out of a fixed slot, so position gives nothing away', () => {
    const slots = CARDS.map((card) => card.choices.findIndex((c) => c.correct));
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it('link only to where the site teaches the idea', () => {
    for (const card of CARDS) expect(TAUGHT_AT.has(card.learn.path), card.learn.path).toBe(true);
  });

  it('link to sections that exist on their pages', () => {
    for (const { learn } of CARDS) {
      const anchor = learn.path.split('#')[1];
      if (anchor) expect(pageSource(learn.path), learn.path).toMatch(new RegExp(`id="${anchor}"`));
    }
  });

  it('ask how sure you are in three steps, least sure first', () => {
    expect(CONFIDENCE.map((c) => c.label)).toEqual(['Guessing', 'Fairly sure', 'Certain']);
  });
});

describe('card copy follows the house style', () => {
  const all = CARDS.flatMap(copyOf);

  it('keeps every sentence to 20 words or fewer', () => {
    for (const text of all) for (const s of sentences(text)) expect(words(s), s).toBeLessThanOrEqual(20);
  });

  it('has no exclamation marks, em-dash asides, "please" or emoji', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/[!—]|\bplease\b/i);
      expect(text, text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('uses UK spelling, Pioneer’s colour words and DJ words for distortion', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/\b(color|center|normaliz|analyz)/i);
      expect(text, text).not.toMatch(/\byellow\b/i);
      expect(text, text).not.toMatch(/\bTHD\b|dBFS/);
    }
  });

  it('writes the knob names as printed on the unit', () => {
    for (const text of all) expect(text, text).not.toMatch(/\b(Booth|Master) (knob|level|meter)/);
  });
});

describe('card scenes agree with the model', () => {
  it('shows the red channel on the turn-down card', () => {
    expect(zoneFor(scene('turn-down').ch1)).toBe('red');
  });

  it('puts two top-orange tracks into the red once their kicks line up', () => {
    const blend = scene('blend');
    expect(litCount(blend.ch1)).toBe(11);
    expect(zoneFor(blend.ch1)).toBe('orange');
    expect(blend.master).toBe(blend.ch1 + KICKS_TOGETHER_DB);
    expect(blend.master).toBeGreaterThanOrEqual(CEILING_DB);
    expect(blend.hideMaster).toBe(true);
  });

  it('shows the house rule working: channels at the first orange, a blend still out of the red', () => {
    const which = scene('which-meters');
    expect(litCount(which.ch1)).toBe(8);
    expect(which.master).toBe(which.ch1 + KICKS_TOGETHER_DB);
    expect(zoneFor(which.master)).toBe('orange');
  });
});

describe('the monitor card agrees with the knob tags', () => {
  const monitor = CARDS.find((c) => c.id === 'monitor');
  if (!monitor) throw new Error('No monitor card');
  const choice = (id: string) => monitor.choices.find((c) => c.id === id);

  it('sends DJs to BOOTH MONITOR, the knob the print kit tags as theirs', () => {
    expect(MONITOR_TAG.owner).toBe('yours');
    expect(MONITOR_TAG.where).toMatch(/BOOTH MONITOR/);
    expect(correctChoice(monitor).label).toBe('Turn up BOOTH MONITOR');
    expect(correctChoice(monitor).feedback).toContain(`${MONITOR_TAG.name} tag`);
    // The picture shows the knob with that tag beside it.
    expect(monitor.scene).toEqual({ kind: 'booth', tag: MONITOR_TAG });
  });

  it('keeps pushing the channels and touching MASTER LEVEL as the traps', () => {
    expect(isCorrect(monitor, 'channels')).toBe(false);
    expect(isCorrect(monitor, 'master')).toBe(false);
    expect(choice('channels')?.feedback).toMatch(/Turn up BOOTH MONITOR instead\.$/);
    // MASTER LEVEL carries the REC tag: it sets the speakers and the recording.
    expect(choice('master')?.feedback).toContain(`marked ${REC_TAG.name}`);
    expect(choice('master')?.feedback).toMatch(/speakers and the recording/);
  });

  it('says what the MASTER LEVEL tag printed on the same sheet says', () => {
    expect(SHORT_TAGS).toContain(REC_TAG);
    expect(REC_TAG.where).toMatch(/MASTER LEVEL/);
    expect(MASTER_TAG.name).toBe('SPEAKERS + RECORDING');
    expect(MASTER_TAG.lines.at(-1)).toBe('Want it louder? Ask the crew.');
  });
});

describe('answering', () => {
  const where = CARDS[0]!;

  it('says right or wrong in words before the why', () => {
    expect(correctChoice(where).id).toBe('mixer');
    expect(isCorrect(where, 'mixer')).toBe(true);
    expect(verdict(where, 'mixer')).toBe('Right.');
    expect(verdict(where, 'speakers')).toBe('Not quite.');
    expect(feedbackFor(where, 'recorder')).toMatch(/^Not quite\. A green light/);
    expect(feedbackFor(where, 'mixer')).toMatch(/^Right\. /);
  });

  it('refuses a choice the card doesn’t have', () => {
    expect(() => feedbackFor(where, 'nowhere')).toThrow();
  });
});

describe('the summary', () => {
  const right = CARDS.map((c) => correctChoice(c).id);

  it('counts right answers and stays quiet when nothing sure was wrong', () => {
    const summary = summarise(CARDS, answerAll(right.map((id) => [id, 'certain'])));
    expect(scoreLine(summary)).toBe('You got 5 of 5.');
    expect(sureLine(summary)).toBeNull();
    expect(reviewLinks(CARDS, summary)).toEqual([]);
  });

  it('singles out one confident miss', () => {
    const picks = right.map((id): [string, Answer['confidence']] => [id, 'fairly']);
    picks[1] = ['yes', 'certain'];
    picks[3] = ['sides', 'guessing'];
    const summary = summarise(CARDS, answerAll(picks));
    expect(scoreLine(summary)).toBe('You got 3 of 5.');
    expect(summary.sureButWrong).toEqual(['turn-down']);
    expect(sureLine(summary)).toBe(
      'You were certain of one answer that was wrong. That one is worth reading about again.',
    );
  });

  it('speaks in the plural for more than one confident miss', () => {
    const picks = right.map((id): [string, Answer['confidence']] => [id, 'certain']);
    picks[0] = ['recorder', 'certain'];
    picks[4] = ['channels', 'certain'];
    expect(sureLine(summarise(CARDS, answerAll(picks)))).toBe(
      'You were certain of some answers that were wrong. Those are worth reading about again.',
    );
  });

  it('counts an unanswered card as missed, never as sure', () => {
    const summary = summarise(CARDS, answerAll([[right[0]!, 'certain']]));
    expect(summary.right).toBe(1);
    expect(summary.missed).toHaveLength(4);
    expect(summary.sureButWrong).toEqual([]);
  });

  it('lists each page to go over once, in card order', () => {
    const picks = right.map((id): [string, Answer['confidence']] => [id, 'certain']);
    picks[0] = ['speakers', 'guessing'];
    picks[1] = ['yes', 'guessing'];
    picks[3] = ['sides', 'guessing'];
    const links = reviewLinks(CARDS, summarise(CARDS, answerAll(picks)));
    expect(links.map((l) => l.path)).toEqual(['/#two-ceilings', '/#meters']);
  });
});
