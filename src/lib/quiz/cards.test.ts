import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { DJ_RULES } from '../rules';
import { section } from '../sections';
import { MASTER_TAG, MONITOR_TAG, REC_TAG, SHORT_TAGS } from '../tags';
import { litCount, METER_SEGMENTS, zoneFor } from '../xdj';
import {
  type Answer,
  CARDS,
  type Card,
  CONFIDENCE,
  correctChoice,
  feedbackFor,
  isCorrect,
  REVIEW_LEAD,
  reviewLinks,
  scoreLine,
  summarise,
  sureLine,
  verdict,
} from './cards';

/**
 * Where a card may send the reader: the Part 2 sections, where a DJ's rules are taught. The check
 * sits at the end of Part 2, so every link is a jump back up the same page.
 */
const TAUGHT_AT = new Set(['/#trim', '/#meters', '/#knobs', '/#blends']);

/** The page source behind a site path, to check that a linked #section really exists. */
const pageSource = (path: string) =>
  readFileSync(new URL(`../../pages${path.replace(/#.*$/, '')}index.astro`, import.meta.url), 'utf8');

/** Every string a reader sees on the cards. */
const copyOf = (card: Card) => [card.question, card.learn.text, ...card.choices.flatMap((c) => [c.label, c.feedback])];

const sentences = (text: string) => text.split(/(?<=[.?])\s+/).filter(Boolean);
const words = (sentence: string) => sentence.split(/\s+/).filter(Boolean).length;
const card = (id: string) => {
  const found = CARDS.find((c) => c.id === id);
  if (!found) throw new Error(`No card ${id}`);
  return found;
};
const choice = (cardId: string, id: string) => card(cardId).choices.find((c) => c.id === id);

const answerAll = (picks: Array<[choice: string, confidence: Answer['confidence']] | undefined>) =>
  picks.map((p) => (p ? { choice: p[0], confidence: p[1] } : undefined));

describe('the cards', () => {
  it('are four DJ questions, in the order of the box to know by heart', () => {
    expect(CARDS.map((c) => c.id)).toEqual(['peak', 'meters', 'room', 'monitor']);
  });

  it('each have two or three choices and exactly one right answer', () => {
    for (const c of CARDS) {
      expect(c.choices.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.choices.length, c.id).toBeLessThanOrEqual(3);
      expect(
        c.choices.filter((x) => x.correct),
        c.id,
      ).toHaveLength(1);
      expect(new Set(c.choices.map((x) => x.id)).size, c.id).toBe(c.choices.length);
    }
  });

  it('keep the right answer out of a fixed slot, so position gives nothing away', () => {
    const slots = CARDS.map((c) => c.choices.findIndex((x) => x.correct));
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it('never ask the crew’s questions: no Howler, no recording level', () => {
    for (const text of CARDS.flatMap((c) => [c.question, ...c.choices.map((x) => x.label)])) {
      expect(text, text).not.toMatch(/Howler|LEVEL light|MASTER ATT|recording level|turn the recording down/i);
    }
  });

  it('link only to the Part 2 sections that teach the idea, named as the index names them', () => {
    for (const c of CARDS) {
      expect(TAUGHT_AT.has(c.learn.path), c.learn.path).toBe(true);
      const { number, title } = section(c.learn.path.split('#')[1] ?? '');
      expect(c.learn.text).toBe(`${number} ${title}`);
    }
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
  const all = [...CARDS.flatMap(copyOf), REVIEW_LEAD];

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

  it('writes the knob names as printed on the unit, and the pair in the middle as the MASTER meters', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/\b(Booth|Master) (knob|level|meter)/);
      expect(text, text).not.toMatch(/middle meters?/i);
    }
  });

  it('states facts: no negative contractions, no ", so" chains, no idioms', () => {
    // The link texts are the guide's section titles (sections.ts), worded there.
    const own = all.filter((text) => !CARDS.some((c) => c.learn.text === text));
    for (const text of own) {
      expect(text, text).not.toMatch(/n’t\b|n't\b/);
      expect(text, text).not.toMatch(/, so\b/);
      expect(text, text).not.toMatch(/\b(go over|keep an eye|ease|a notch|on cue)\b/i);
    }
  });
});

describe('where a channel peaks', () => {
  /** The orange lights' marks, bottom up: 0, +3, +6, +9. */
  const orange = METER_SEGMENTS.filter((s) => s.zone === 'orange').map((s) => s.db);
  const plainSpaces = (text?: string) => text?.replaceAll('\u00a0', ' ');

  it('asks for the first orange, in the box’s words, with its note as a trap', () => {
    const [channelMeters] = DJ_RULES;
    expect(correctChoice(card('peak')).label).toBe('The first orange (0)');
    expect(channelMeters?.response).toMatch(/^first orange \(0\)/);
    expect(orange[0]).toBe(TARGET_PEAK_DB.aim);
    expect(choice('peak', 'second')?.label).toBe('The second orange, on every kick');
    expect(channelMeters?.note).toMatch(/second orange lights on every kick/);
  });

  it('answers with what a blend can add against the top orange, and red with Pioneer’s page', () => {
    // A blend can add up to two lights (6 dB). From the first orange it stays under the top orange
    // (+9), which the MASTER meters keep dark; from the second orange (+3) it reaches it.
    expect(TARGET_PEAK_DB.aim + KICKS_TOGETHER_DB).toBeLessThan(TARGET_PEAK_DB.top);
    expect(orange[1]! + KICKS_TOGETHER_DB).toBeGreaterThanOrEqual(TARGET_PEAK_DB.top);
    expect(orange.at(-1)).toBe(TARGET_PEAK_DB.top);
    expect(plainSpaces(correctChoice(card('peak')).feedback)).toBe(
      'A blend can add up to 6 dB, two lights. From the first orange, the top orange on the MASTER meters stays dark.',
    );
    expect(plainSpaces(choice('peak', 'second')?.feedback)).toBe(
      'A blend can add up to 6 dB, two lights. From the second orange, that lights the top orange on the MASTER meters.',
    );
    expect(choice('peak', 'red')?.feedback).toMatch(/or the sound may be distorted \(p\.\s31\)\.$/);
  });
});

describe('which meters show a blend', () => {
  const scene = card('meters').scene;

  it('shows the house rule working: channels on the first orange, the blend two lights up, the top orange dark', () => {
    if (scene?.kind !== 'meters') throw new Error('No meters');
    expect(litCount(scene.ch1)).toBe(8);
    expect(scene.master).toBe(scene.ch1 + KICKS_TOGETHER_DB);
    expect(zoneFor(scene.master)).toBe('orange');
    expect(scene.master).toBeLessThan(TARGET_PEAK_DB.top);
  });

  it('names the pair in the middle as the box does', () => {
    expect(correctChoice(card('meters')).label).toBe('The MASTER meters (the pair in the middle)');
  });
});

describe('the volume cards agree with the knob tags', () => {
  it('send a louder room to the crew, and louder monitors to BOOTH MONITOR', () => {
    expect(correctChoice(card('room')).label).toBe('Ask the crew');
    expect(correctChoice(card('monitor')).label).toBe('Turn up BOOTH MONITOR');
  });

  it('keep pushing the channels and touching MASTER LEVEL as the traps, in the same words on both', () => {
    for (const id of ['room', 'monitor']) {
      expect(isCorrect(card(id), 'channels')).toBe(false);
      expect(isCorrect(card(id), 'master')).toBe(false);
      expect(choice(id, 'channels')?.feedback).toMatch(/^Louder channels drive the MASTER meters towards the red\. /);
    }
    expect(choice('room', 'master')?.feedback).toBe(choice('monitor', 'master')?.feedback);
    // MASTER LEVEL carries the REC tag: it sets the speakers and the recording.
    expect(choice('room', 'master')?.feedback).toContain(`marked ${REC_TAG.name}`);
    expect(choice('room', 'master')?.feedback).toMatch(/speakers and the recording/);
  });

  it('shows BOOTH MONITOR with the tag the print kit puts beside it', () => {
    const monitor = card('monitor');
    expect(MONITOR_TAG.owner).toBe('yours');
    expect(MONITOR_TAG.where).toMatch(/BOOTH MONITOR/);
    expect(correctChoice(monitor).feedback).toContain(`${MONITOR_TAG.name} tag`);
    expect(monitor.scene).toEqual({ kind: 'booth', tag: MONITOR_TAG });
  });

  it('says what the MASTER LEVEL tag printed on the same sheet says', () => {
    expect(SHORT_TAGS).toContain(REC_TAG);
    expect(REC_TAG.where).toMatch(/MASTER LEVEL/);
    expect(MASTER_TAG.lines.at(-1)).toMatch(/ask the crew\.$/i);
  });
});

describe('answering', () => {
  const peak = CARDS[0]!;

  it('says right or wrong in words before the why', () => {
    expect(correctChoice(peak).id).toBe('first');
    expect(isCorrect(peak, 'first')).toBe(true);
    expect(verdict(peak, 'first')).toBe('Right.');
    expect(verdict(peak, 'red')).toBe('Not quite.');
    expect(feedbackFor(peak, 'second')).toMatch(/^Not quite\. A blend can add up to/);
    expect(feedbackFor(peak, 'first')).toMatch(/^Right\. /);
  });

  it('refuses a choice the card doesn’t have', () => {
    expect(() => feedbackFor(peak, 'nowhere')).toThrow();
  });
});

describe('the summary', () => {
  const right = CARDS.map((c) => correctChoice(c).id);

  it('counts right answers and stays quiet when nothing sure was wrong', () => {
    const summary = summarise(CARDS, answerAll(right.map((id) => [id, 'certain'])));
    expect(scoreLine(summary)).toBe('You got 4 of 4.');
    expect(sureLine(summary)).toBeNull();
    expect(reviewLinks(CARDS, summary)).toEqual([]);
  });

  it('says how many wrong answers were certain', () => {
    const picks = right.map((id): [string, Answer['confidence']] => [id, 'fairly']);
    picks[1] = ['channels', 'certain'];
    picks[3] = ['master', 'guessing'];
    const summary = summarise(CARDS, answerAll(picks));
    expect(scoreLine(summary)).toBe('You got 2 of 4.');
    expect(summary.sureButWrong).toEqual(['meters']);
    expect(sureLine(summary)).toBe('You were certain of one wrong answer.');
    picks[0] = ['second', 'certain'];
    expect(sureLine(summarise(CARDS, answerAll(picks)))).toBe('You were certain of two wrong answers.');
  });

  it('counts an unanswered card as missed, never as sure', () => {
    const summary = summarise(CARDS, answerAll([[right[0]!, 'certain']]));
    expect(summary.right).toBe(1);
    expect(summary.missed).toHaveLength(3);
    expect(summary.sureButWrong).toEqual([]);
  });

  it('lists each section to read again once, in card order', () => {
    const picks = right.map((id): [string, Answer['confidence']] => [id, 'certain']);
    picks[0] = ['red', 'guessing'];
    picks[2] = ['master', 'guessing'];
    picks[3] = ['channels', 'guessing'];
    const links = reviewLinks(CARDS, summarise(CARDS, answerAll(picks)));
    expect(links.map((l) => l.path)).toEqual(['/#trim', '/#knobs']);
    expect(REVIEW_LEAD).toBe('Read these again');
  });
});
