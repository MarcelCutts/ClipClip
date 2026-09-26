import { describe, expect, it } from 'vitest';
import { IN_UTILITY, LEVEL_FALLBACK } from '../checklists';
import { KICKS_TOGETHER_DB, TARGET, TARGET_PEAK_DB } from '../model';
import { CEILING_DB } from '../xdj';
import { ATT_SETTINGS, BLEND_MAX_DBFS, CONSEQUENCE, SAVE_NOTE, STEPS, TEST_DECK_DB } from './flow';

/** Every word on the card: the steps, their notes, and the sentences around them. */
const words = [
  CONSEQUENCE,
  SAVE_NOTE,
  ...STEPS.flatMap((s) => [s.before ?? '', s.challenge, s.response, s.note ?? '']),
].join('\n');
const step = (challenge: string) => STEPS.find((s) => s.challenge === challenge);

describe('S3, the recording level', () => {
  it('tests with a blend that reaches the red light, louder than a DJ should play', () => {
    expect(TEST_DECK_DB + KICKS_TOGETHER_DB).toBe(CEILING_DB);
    expect(TEST_DECK_DB).toBeGreaterThan(TARGET_PEAK_DB.second);
    expect(step('Loudest blend')?.response).toBe('both channel meters at +6, kicks lined up');
    // Red on purpose is a consequence, said before the steps.
    expect(CONSEQUENCE).toMatch(/^Step 3 puts the MASTER meters/);
    expect(STEPS[2]?.challenge).toBe('Loudest blend');
  });

  it('steps MASTER ATT down through its settings as values, with true minus signs', () => {
    expect(ATT_SETTINGS).toEqual([0, -6, -12]);
    expect(step('MASTER ATT, if red')?.response).toBe('−6 dB');
    expect(step('MASTER ATT, if still red')?.response).toBe('−12 dB');
    expect(words).not.toMatch(/\+12/);
  });

  it('says how to open UTILITY at the first step that needs it', () => {
    const first = STEPS.findIndex((s) => /UTILITY/.test(s.note ?? ''));
    expect(STEPS[first]?.note).toBe(IN_UTILITY);
    expect(STEPS.findIndex((s) => /ATT/.test(s.challenge))).toBe(first);
  });

  it('ends on the rule the night’s drill uses, in its words', () => {
    const fallback = STEPS.find((s) => s.challenge.startsWith(`${LEVEL_FALLBACK.challenge},`));
    expect(fallback?.response).toBe(`down ${LEVEL_FALLBACK.how}`);
    // Its consequence comes before the step, where it's read before it's done.
    expect(fallback?.before).toBe(LEVEL_FALLBACK.consequence);
    // It comes after both MASTER ATT settings.
    expect(STEPS.indexOf(fallback!)).toBeGreaterThan(STEPS.indexOf(step('MASTER ATT, if still red')!));
  });

  it('checks the file against the model’s target for the loudest blend', () => {
    expect(BLEND_MAX_DBFS).toBe(`−${Math.abs(TARGET.blendMax)} dBFS`);
    expect(STEPS.at(-1)?.response).toContain(BLEND_MAX_DBFS);
  });

  it('writes each line as a state, in the handbook’s words', () => {
    for (const s of STEPS) expect(s.response, s.challenge).not.toMatch(/^(check|set|as required|watch)\b/i);
    expect(words).not.toMatch(/n’t\b|n't\b/);
    expect(words).not.toMatch(/, so\b/);
    expect(words).not.toMatch(/record level|middle meters/i);
    expect(words).not.toMatch(/\d (?:dB|dBFS|seconds?|minutes?)\b/);
  });
});
