import { describe, expect, it } from 'vitest';
import * as copy from './copy';
import { DEVICES, type Summary } from './model';

const NBSP = ' ';

describe('copy', () => {
  it('writes the reveal the way the brief asks', () => {
    expect(copy.revealLine({ pushDb: 6, clipped: 'b' })).toBe(
      `B was pushed 6${NBSP}dB past the red, then turned down to match.`,
    );
  });

  it('keeps numbers and units together and unsigned', () => {
    expect(copy.dbText(-8.26)).toBe(`8${NBSP}dB`);
    expect(copy.dbText(2.91)).toBe(`3${NBSP}dB`);
  });

  it('offers no way to hear the clipped one unmatched: every comparison is loudness-matched', () => {
    for (const name of [
      'UNMATCHED_LABEL',
      'unmatchedHint',
      'unmatchedNote',
      'scopeCaption',
      'MODEL_NOTE',
      'FINAL_LINE',
    ])
      expect(copy, name).not.toHaveProperty(name);
    expect(copy.ROUND_INTROS[0]).toMatch(/Both play at the same measured loudness\.$/);
    expect(copy.scopeTitle(true)).toBe('Clipped, turned down to match');
    expect(copy.scopeTitle(false)).toBe('Clean');
  });

  it('says how far each round pushes the clipped one, and never which one it is', () => {
    expect(copy.ROUND_INTROS).toEqual([
      `Play A and B. One was pushed 12${NBSP}dB past the red and clipped. Both play at the same measured loudness.`,
      `The clipped one was pushed 6${NBSP}dB past the red.`,
      `The clipped one was pushed 3${NBSP}dB past the red.`,
    ]);
    for (const intro of copy.ROUND_INTROS) expect(intro).not.toMatch(/\b(A|B) (was|is)\b/);
  });

  it('scores without points', () => {
    expect(copy.scoreLine({ spotted: 2, total: 3, confidentMisses: [] })).toBe('You spotted 2 of 3.');
  });

  it('only calls out confident mistakes, then says what to do in the booth', () => {
    const base: Summary = { spotted: 3, total: 3, confidentMisses: [] };
    expect(copy.hypercorrectionLine(base)).toBeNull();
    expect(copy.hypercorrectionLine({ ...base, spotted: 2, confidentMisses: [2] })).toBe(
      'You were certain in round 3 and chose the clean one. In the booth, trust the meters over your ears.',
    );
    expect(copy.hypercorrectionLine({ ...base, spotted: 1, confidentMisses: [0, 2] })).toMatch(
      /^You were certain in rounds 1 and 3 and chose the clean one both times\. /,
    );
    expect(copy.hypercorrectionLine({ ...base, spotted: 0, confidentMisses: [0, 1, 2] })).toMatch(
      /^You chose the clean one in every round, and you were certain each time\. /,
    );
  });

  it('counts confident mistakes right however many rounds there are', () => {
    const four: Summary = { spotted: 1, total: 4, confidentMisses: [0, 1, 2] };
    expect(copy.hypercorrectionLine(four)).toMatch(
      /^You were certain in rounds 1, 2 and 3 and chose the clean one each time\./,
    );
    expect(copy.hypercorrectionLine({ ...four, spotted: 2, confidentMisses: [1, 3] })).toMatch(
      /^You were certain in rounds 2 and 4 and chose the clean one both times\./,
    );
    expect(copy.hypercorrectionLine({ ...four, spotted: 0, confidentMisses: [0, 1, 2, 3] })).toMatch(
      /^You chose the clean one in every round/,
    );
  });

  it('describes each waveform the way it is drawn', () => {
    expect(copy.scopeLabel('a', false)).toMatch(/^Waveform of A, the clean one\./);
    expect(copy.scopeLabel('b', true)).toMatch(/turned down to match\. Smaller than the clean kick/);
  });

  it('places each waveform against the line where the mixer clips, as the screens draw it', () => {
    expect(copy.scopeLabel('a', false)).toMatch(/just under the line where the mixer clips\.$/);
    expect(copy.scopeLabel('b', true)).toMatch(/cut flat, now under the line where the mixer clips\.$/);
    expect(copy.CEILING_KEY).toBe('Where the mixer clips');
    expect(copy.FLAT_KEY).toBe('Flat tops, heard as crunch');
  });

  it('says the sound is missing in the words every lab uses', () => {
    expect(copy.NO_AUDIO).toBe(
      'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
    );
  });

  it('never names a side on the page-wide Stop bar', () => {
    expect(copy.PLAYER_LABEL).not.toMatch(/\b[AB]\b/);
  });

  it('tells you what to listen for on every device, the action first', () => {
    for (const d of DEVICES) expect(copy.DEVICE_TIPS[d]).toMatch(/^Listen for crunch/);
  });

  it('recommends headphones where small speakers upset the loudness match, without saying which side is louder', () => {
    // Without the bass, round 1's clipped copy measures about 1.5 LU louder (fact-check, science B5).
    for (const d of ['phone', 'laptop'] as const) {
      expect(copy.DEVICE_TIPS[d]).toMatch(/differ a little in loudness\. Headphones keep them matched\.$/);
      expect(copy.DEVICE_TIPS[d]).not.toMatch(/clipped|clean|louder/i);
    }
    expect(copy.DEVICE_TIPS.headphones).not.toMatch(/headphones|loudness/i);
  });

  it('has a tip and an explanation for every device', () => {
    for (const d of DEVICES) {
      expect(copy.DEVICE_TIPS[d].length).toBeGreaterThan(10);
      expect(copy.DEVICE_EXPLANATIONS[d].length).toBeGreaterThan(10);
      expect(copy.DEVICE_LABELS[d].length).toBeGreaterThan(2);
    }
  });

  it('follows the house style: short sentences, facts first, no shouting, no dashes, no please', () => {
    const summary: Summary = { spotted: 1, total: 3, confidentMisses: [0, 1] };
    const texts = [
      ...Object.values(copy.LEGENDS),
      ...copy.ROUND_INTROS,
      ...Object.values(copy.DEVICE_TIPS),
      ...Object.values(copy.DEVICE_EXPLANATIONS),
      copy.HEADPHONE_WARNING,
      copy.TRANSPORT_NOTE,
      copy.NO_AUDIO,
      copy.SCOPE_WAITING,
      copy.MISSING_PICK,
      copy.MISSING_SURE,
      copy.CHECK,
      copy.PLAYER_LABEL,
      copy.revealLine({ pushDb: 12, clipped: 'a' }),
      copy.scopeTitle(true),
      copy.scopeLabel('a', true),
      copy.scopeLabel('b', false),
      copy.FLAT_KEY,
      copy.CEILING_KEY,
      copy.verdictLine(true),
      copy.verdictLine(false),
      copy.nextLabel(2, 3),
      copy.hypercorrectionLine(summary)!,
      copy.hypercorrectionLine({ spotted: 0, total: 3, confidentMisses: [0, 1, 2] })!,
      copy.hypercorrectionLine({ spotted: 1, total: 4, confidentMisses: [0, 1, 2] })!,
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/[!—]|please/i);
      for (const sentence of text.split(/(?<=[.?])\s+/)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20);
      }
      // Plain statements: no "No sound? Check…" lead-ins, no "X. Not Y.", no "A model: …".
      expect(text, text).not.toMatch(/(^|\. )[^.?]{1,40}\? [A-Z]/);
      expect(text, text).not.toMatch(/\. Not [a-z]/);
      expect(text, text).not.toMatch(/^[^:.]{1,16}: [a-z]/);
      // The reference register: no negative contractions, no ", so" chains, no idioms.
      expect(text, text).not.toMatch(/n’t\b|n't\b/);
      expect(text, text).not.toMatch(/, so\b/);
      expect(text, text).not.toMatch(/\b(go by|go over|keep an eye)\b/i);
      // Curly apostrophes, and numbers kept with their units.
      expect(text, text).not.toMatch(/['"]/);
      expect(text, text).not.toMatch(/\d[   ]dB/);
    }
  });
});
