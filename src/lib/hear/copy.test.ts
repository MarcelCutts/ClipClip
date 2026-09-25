import { describe, expect, it } from 'vitest';
import * as copy from './copy';
import { DEVICES, type Summary } from './model';

const NBSP = ' ';

describe('copy', () => {
  it('writes the reveal the way the brief asks', () => {
    expect(copy.revealLine({ pushDb: 6, clipped: 'b' })).toBe(
      `B was pushed 6${NBSP}dB into the ceiling, then turned down to match.`,
    );
  });

  it('keeps numbers and units together and unsigned', () => {
    expect(copy.dbText(-8.26)).toBe(`8${NBSP}dB`);
    expect(copy.dbText(2.91)).toBe(`3${NBSP}dB`);
  });

  it('names the louder side when the loudness is not matched', () => {
    expect(copy.unmatchedNote({ pushDb: 12, clipped: 'a' }, -8.26)).toMatch(
      /^A now plays .* about 8 dB louder than B\./,
    );
  });

  it('says how much louder the unmatched one plays before you press for it', () => {
    expect(copy.unmatchedHint(-8.26)).toBe(
      `This plays the clipped one as loud as the mixer left it, about 8${NBSP}dB louder. On headphones, turn your volume down first.`,
    );
    // The same number as the note that replaces it once pressed.
    for (const db of [-8.26, -5.3, -2.9]) {
      expect(copy.unmatchedHint(db)).toContain(`about ${copy.dbText(db)} louder`);
      expect(copy.unmatchedNote({ pushDb: 6, clipped: 'b' }, db)).toContain(`about ${copy.dbText(db)} louder`);
    }
  });

  it('says how far each round pushes the clipped one, and never which one it is', () => {
    expect(copy.ROUND_INTROS).toEqual([
      `Play A and B. One was pushed 12${NBSP}dB into the mixer’s ceiling, so it clipped. Both play equally loud.`,
      `This time the clipped one was pushed 6${NBSP}dB into the ceiling.`,
      `In the last round, the clipped one was pushed only 3${NBSP}dB into the ceiling.`,
    ]);
    for (const intro of copy.ROUND_INTROS) expect(intro).not.toMatch(/\b(A|B) (was|is)\b/);
  });

  it('scores without points', () => {
    expect(copy.scoreLine({ spotted: 2, total: 3, confidentMisses: [] })).toBe('You spotted 2 of 3.');
  });

  it('only calls out confident mistakes', () => {
    const base: Summary = { spotted: 3, total: 3, confidentMisses: [] };
    expect(copy.hypercorrectionLine(base)).toBeNull();
    expect(copy.hypercorrectionLine({ ...base, spotted: 2, confidentMisses: [2] })).toMatch(
      /^You were certain about round 3, and it was the other one\./,
    );
    expect(copy.hypercorrectionLine({ ...base, spotted: 1, confidentMisses: [0, 2] })).toMatch(
      /^You were certain about rounds 1 and 3, and both times/,
    );
    expect(copy.hypercorrectionLine({ ...base, spotted: 0, confidentMisses: [0, 1, 2] })).toMatch(
      /^You were certain every time/,
    );
  });

  it('counts confident mistakes right however many rounds there are', () => {
    const four: Summary = { spotted: 1, total: 4, confidentMisses: [0, 1, 2] };
    expect(copy.hypercorrectionLine(four)).toMatch(
      /^You were certain about rounds 1, 2 and 3, and each time it was the other one\./,
    );
    expect(copy.hypercorrectionLine({ ...four, spotted: 2, confidentMisses: [1, 3] })).toMatch(
      /^You were certain about rounds 2 and 4, and both times it was the other one\./,
    );
    expect(copy.hypercorrectionLine({ ...four, spotted: 0, confidentMisses: [0, 1, 2, 3] })).toMatch(
      /^You were certain every time/,
    );
  });

  it('describes each waveform the way it is drawn, matched or not', () => {
    expect(copy.scopeLabel('a', false)).toMatch(/^Waveform of A, the clean one\./);
    expect(copy.scopeLabel('b', true)).toMatch(/turned down to match\. Smaller than the clean kick/);
    expect(copy.scopeLabel('b', true, true)).toMatch(/at the mixer’s level\. Fatter than the clean kick/);
  });

  it('places each waveform against the ceiling line, as the screens draw it', () => {
    expect(copy.scopeLabel('a', false)).toMatch(/just under the mixer’s ceiling\.$/);
    expect(copy.scopeLabel('b', true)).toMatch(/cut flat and now under the mixer’s ceiling\.$/);
    expect(copy.scopeLabel('b', true, true)).toMatch(/cut flat at the mixer’s ceiling\.$/);
    expect(copy.CEILING_KEY).toMatch(/mixer’s ceiling/);
  });

  it('never names a side on the page-wide Stop bar', () => {
    expect(copy.PLAYER_LABEL).not.toMatch(/\b[AB]\b/);
  });

  it('tells you what to listen for on every device', () => {
    for (const d of DEVICES) expect(copy.DEVICE_TIPS[d]).toMatch(/Listen/);
  });

  it('has a tip and an explanation for every device', () => {
    for (const d of DEVICES) {
      expect(copy.DEVICE_TIPS[d].length).toBeGreaterThan(10);
      expect(copy.DEVICE_EXPLANATIONS[d].length).toBeGreaterThan(10);
      expect(copy.DEVICE_LABELS[d].length).toBeGreaterThan(2);
    }
  });

  it('follows the house style: short sentences, no shouting, no dashes, no please', () => {
    const summary: Summary = { spotted: 1, total: 3, confidentMisses: [0, 1] };
    const texts = [
      ...Object.values(copy.LEGENDS),
      ...copy.ROUND_INTROS,
      ...Object.values(copy.DEVICE_TIPS),
      ...Object.values(copy.DEVICE_EXPLANATIONS),
      copy.HEADPHONE_WARNING,
      copy.TRANSPORT_NOTE,
      copy.MODEL_NOTE,
      copy.NO_AUDIO,
      copy.SCOPE_WAITING,
      copy.MISSING_PICK,
      copy.MISSING_SURE,
      copy.CHECK,
      copy.PLAYER_LABEL,
      copy.revealLine({ pushDb: 12, clipped: 'a' }),
      copy.scopeCaption(false),
      copy.scopeCaption(true),
      copy.scopeLabel('a', true),
      copy.scopeLabel('a', true, true),
      copy.scopeLabel('b', false),
      copy.FLAT_KEY,
      copy.CEILING_KEY,
      copy.UNMATCHED_LABEL,
      copy.unmatchedHint(-8.26),
      copy.unmatchedNote({ pushDb: 3, clipped: 'b' }, -2.9),
      copy.hypercorrectionLine(summary)!,
      copy.hypercorrectionLine({ spotted: 1, total: 4, confidentMisses: [0, 1, 2] })!,
      copy.FINAL_LINE,
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
      // Curly apostrophes, and numbers kept with their units.
      expect(text, text).not.toMatch(/['"]/);
      expect(text, text).not.toMatch(/\d[ \u2009\u202f]dB/);
    }
  });
});
