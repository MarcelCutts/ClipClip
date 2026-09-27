import { describe, expect, it } from 'vitest';
import { ATT_NOTE, IN_UTILITY, LEVEL_FALLBACK, OPEN_UTILITY, STORE_CHANGE } from '../checklists';
import { KICKS_TOGETHER_DB, TARGET, TARGET_PEAK_DB } from '../model';
import { CEILING_DB } from '../xdj';
import {
  ATT_SETTINGS,
  BLEND_MAX_DBFS,
  CONSEQUENCE,
  SAVE_NOTE,
  STEPS,
  type Step,
  T2_FINDINGS,
  T2_INTRO,
  T2_STEPS,
  T2_UNCLEAR,
  T3_INTRO,
  T3_STEPS,
  TEST_DECK_DB,
} from './flow';

/** Every word on a card: its steps, their notes, and the sentences around them. */
const wordsOf = (steps: readonly Step[], ...around: string[]) =>
  [...around, ...steps.flatMap((s) => [s.before ?? '', s.challenge, s.response, s.note ?? ''])].join('\n');
const words = wordsOf(STEPS, CONSEQUENCE, SAVE_NOTE);
const findings = T2_FINDINGS.flatMap((f) => [f.look, ...f.readings.flatMap((r) => [r.seen, r.means])]);
const testWords = [wordsOf(T2_STEPS, T2_INTRO, ...findings), wordsOf(T3_STEPS, T3_INTRO)].join('\n');
const step = (challenge: string) => STEPS.find((s) => s.challenge === challenge);
/** A card's text with its no-break spaces as plain ones, to compare with what a test spells out. */
const plain = (text?: string) => text?.replace(/\u00a0/g, ' ');

describe('S3, the recording level', () => {
  it('tests with a blend that reaches the red light, louder than a DJ should play', () => {
    expect(TEST_DECK_DB + KICKS_TOGETHER_DB).toBe(CEILING_DB);
    // Each deck is above the DJ's aim, and the blend above the top orange the MASTER meters keep dark.
    expect(TEST_DECK_DB).toBeGreaterThan(TARGET_PEAK_DB.aim);
    expect(TEST_DECK_DB + KICKS_TOGETHER_DB).toBeGreaterThan(TARGET_PEAK_DB.top);
    // The light itself, not a sum: released tracks add about 5 dB, not always the full 6 (model.ts).
    expect(step('Loudest blend')?.response).toBe('MASTER meters red on the loudest peaks');
    expect(plain(step('Loudest blend')?.note)).toMatch(
      /^Two tracks with both channel meters at \+6 usually get there\./,
    );
    // Red on purpose is a consequence, said before the steps.
    expect(CONSEQUENCE).toMatch(/^Step 3 puts the MASTER meters/);
    expect(STEPS[2]?.challenge).toBe('Loudest blend');
  });

  it('steps MASTER ATT down through its settings as values, with true minus signs', () => {
    expect(ATT_SETTINGS).toEqual([0, -6, -12]);
    expect(plain(step('MASTER ATT, if red')?.response)).toBe('−6 dB');
    expect(plain(step('MASTER ATT, if still red')?.response)).toBe('−12 dB');
    expect(words).not.toMatch(/\+12/);
  });

  it('says how to open UTILITY, and how a change is stored, at the first step that needs it', () => {
    const first = STEPS.findIndex((s) => /UTILITY/.test(s.note ?? ''));
    // The crew's note for both attenuators (checklists.ts): where they are, then how a change is kept.
    expect(STEPS[first]?.note).toBe(ATT_NOTE);
    expect(ATT_NOTE).toBe(`${IN_UTILITY} ${STORE_CHANGE}`);
    expect(STEPS.findIndex((s) => /ATT/.test(s.challenge))).toBe(first);
    // Pioneer's own words, with the page, and a space (plain or no-break) before its number.
    expect(STORE_CHANGE).toMatch(/“Press the rotary selector\. The changed settings are stored\.” \(p\.\s31\)$/);
  });

  it('ends on the rule the night’s drill uses, in its words', () => {
    const fallback = STEPS.find((s) => s.challenge.startsWith(`${LEVEL_FALLBACK.challenge},`));
    expect(fallback?.response).toBe(`down ${LEVEL_FALLBACK.how}`);
    // Its consequence comes before the step, where it's read before it's done.
    expect(fallback?.before).toBe(LEVEL_FALLBACK.consequence);
    // It comes after both MASTER ATT settings.
    expect(STEPS.indexOf(fallback!)).toBeGreaterThan(STEPS.indexOf(step('MASTER ATT, if still red')!));
    // The in-line attenuator is offered as what it is: our inference, not a maker's procedure.
    expect(fallback?.note).toMatch(/^If MASTER ATT is not used \(T2\), a fixed in-line RCA attenuator/);
    expect(fallback?.note).toMatch(/That is our inference, not a maker’s procedure\.$/);
    // Step 7 is the one the REC tape's note refers to.
    expect(STEPS[6]).toBe(fallback);
    expect(step('REC tape')?.note).toMatch(/^If step 7 moved MASTER LEVEL, /);
  });

  it('checks the file against the model’s target for the loudest blend, read in Audacity’s Amplify', () => {
    expect(plain(BLEND_MAX_DBFS)).toBe(`−${Math.abs(TARGET.blendMax)} dBFS`);
    const peak = STEPS.find((s) => /Amplify/.test(s.challenge));
    expect(peak?.response).toContain(BLEND_MAX_DBFS);
    // Audacity: the negative of the Amplification box is the selection's peak.
    expect(peak?.challenge).toMatch(/Amplify/);
    expect(plain(peak?.note)).toContain(`${Math.abs(TARGET.blendMax)} dB means ${plain(BLEND_MAX_DBFS)}`);
    // Show Clipping marks only full scale, and is off unless someone turns it on.
    expect(peak?.note).toMatch(/Show Clipping .*off by default/);
    // Measured every time, the first included, and a high peak loops back: record and read again.
    expect(step('Test recording')?.response).toMatch(/the first time and after any change$/);
    expect(STEPS.at(-1)).toMatchObject({
      challenge: 'Recording level, if the peak is higher',
      response: 'one MASTER ATT setting lower, then steps 8 to 10 again',
    });
    expect(STEPS[7]?.challenge).toBe('REC tape');
    expect(STEPS[9]).toBe(peak);
  });

  it('says when the mixer keeps a change, as Pioneer does (p. 35)', () => {
    expect(plain(SAVE_NOTE)).toMatch(/within 10 seconds/);
    expect(SAVE_NOTE).toMatch(/own power switch \(Pioneer, p\. 35\)\.$/);
  });

  it('writes each line as a state, in the handbook’s words', () => {
    for (const s of [...STEPS, ...T2_STEPS, ...T3_STEPS])
      expect(s.response, s.challenge).not.toMatch(/^(check|set|as required|watch)\b/i);
    for (const text of [words, testWords]) {
      expect(text).not.toMatch(/n’t\b|n't\b/);
      expect(text).not.toMatch(/, so\b/);
      expect(text).not.toMatch(/record level|middle meters/i);
      expect(text).not.toMatch(/\d (?:dB|dBFS|dBu|seconds?|minutes?)\b/);
      // Straight quotes and hyphen-minus signs belong in code, not on a card.
      expect(text).not.toMatch(/["']|(^|[\s(])-\d/m);
    }
  });
});

describe('T2, what MASTER ATT turns down', () => {
  it('names MASTER ATT as Pioneer does at its first mention, with the page', () => {
    expect(T2_INTRO).toMatch(/^Pioneer says only that MASTER ATT \(MASTER ATTENUATOR in UTILITY\) “sets the master/);
    expect(T2_INTRO).toContain('(p. 32)');
    expect(T2_INTRO).toContain('the MASTER meters, the pair in the middle,');
  });

  it('steps MASTER ATT through all three settings and back, stops the recording, and writes the result down', () => {
    const att = T2_STEPS.filter((s) => s.challenge.startsWith('MASTER ATT')).map((s) => plain(s.response));
    expect(att).toEqual(['0 dB', '−6 dB', '−12 dB', 'back to 0 dB']);
    expect(T2_STEPS.at(-2)).toEqual({ challenge: 'Howler recording', response: 'stopped with RECORD' });
    // The night's F1 asks whether MASTER ATT reaches the Howler: the REC tape answers it.
    expect(T2_STEPS.at(-1)).toEqual({ challenge: 'REC tape', response: 'says whether MASTER ATT is used' });
    // A steady tone, not music: the change shows as a step, not lost in a breakdown.
    expect(T2_STEPS[0]).toMatchObject({ challenge: 'Test tone', response: 'on a USB stick' });
    expect(plain(T2_STEPS[0]?.note)).toMatch(/Generate, Tone, 1000 Hz, amplitude 0\.25/);
  });

  it('says how to reach UTILITY and store the change where MASTER ATT is first set', () => {
    const first = T2_STEPS.find((s) => s.challenge === 'MASTER ATT');
    expect(first?.note).toContain(OPEN_UTILITY);
    expect(first?.note).toContain(STORE_CHANGE);
    // The Operating Instructions print −12 as +12 (p. 32); the Quick Start Guide has it right (p. 17).
    expect(plain(first?.note)).toMatch(/misprint the last as \+12 dB/);
  });

  it('points at the two changes by their numbers, where it says what to look at', () => {
    const [a, b] = [...T2_INTRO.matchAll(/steps (\d) and (\d)/g)][0]!.slice(1).map(Number);
    expect(plain(T2_STEPS[a! - 1]?.response)).toBe('−6 dB');
    expect(plain(T2_STEPS[b! - 1]?.response)).toBe('−12 dB');
    for (const thing of ['the MASTER meters', 'the DriveRack’s INPUT meters']) expect(T2_INTRO).toContain(thing);
  });

  it('says what each result means, for each thing it looks at', () => {
    expect(T2_FINDINGS.map((f) => f.look)).toEqual([
      'The Howler’s file, in Audacity',
      'The DriveRack’s INPUT meters',
      'The MASTER meters',
    ]);
    for (const f of T2_FINDINGS) expect(f.readings, f.look).toHaveLength(2);
    const [file, pa, meters] = T2_FINDINGS;
    expect(file?.readings[0]?.means).toMatch(/reaches MASTER 2/);
    // If it does not, S3 skips MASTER ATT, and the attenuator is labelled as our inference.
    expect(plain(file?.readings[1]?.means)).toMatch(
      /does not reach MASTER 2\. Leave it at 0 dB, and write “not used” beside MASTER ATT on the REC tape\./,
    );
    expect(file?.readings[1]?.means).toMatch(
      /in-line RCA attenuator .*That is our inference, not a maker’s procedure\.$/,
    );
    expect(pa?.readings.map((r) => r.means).join(' ')).toMatch(/reaches MASTER 1.*does not reach MASTER 1/);
    expect(meters?.readings.map((r) => r.means).join(' ')).toMatch(/read before MASTER ATT.*read after MASTER ATT/);
    // Meters that read after MASTER ATT would read low with it down: it is not used then either.
    expect(meters?.readings[1]?.means).toMatch(/“not used”/);
    expect(T2_UNCLEAR).toBe('If a result is not clear, do the test again.');
  });
});

describe('T3, whether MASTER LEVEL fully up adds gain', () => {
  it('compares the MASTER meters with one channel, with the crossfader out of the way', () => {
    const by = (challenge: string) => T3_STEPS.find((s) => s.challenge === challenge)?.response;
    expect(by('CROSS FADER CURVE')).toBe('THRU');
    expect(by('HI, MID and LOW')).toBe('12 o’clock, effects off');
    expect(by('Test tone')).toMatch(/fader fully up/);
    expect(by('MASTER LEVEL')).toBe('fully up');
    expect(plain(by('MASTER ATT'))).toBe('0 dB');
    // A steady tone: the two +3 lights come on together, or the MASTER meters' first.
    expect(by('TRIM')).toBe('up slowly until the channel meter’s +3 light just comes on');
    expect(by('MASTER meters')).toBe('+3 light on at the same moment');
  });

  it('moves the REC mark to where they match, if fully up reads higher', () => {
    expect(T3_STEPS.at(-2)).toEqual({
      challenge: 'MASTER LEVEL, if the MASTER meters’ +3 light came on first',
      response: 'down until that light only just stays on',
    });
    expect(T3_STEPS.at(-1)).toMatchObject({ challenge: 'REC mark', response: 'drawn where MASTER LEVEL sits' });
    // The mark means where the knob sits: no card redefines "fully up".
    expect(testWords).not.toMatch(/stands for fully up/);
    // The panel prints only "0" at the top (p. 27): no ∞ either, which the site's fonts lack.
    expect(T3_INTRO).toMatch(/\(Pioneer, p\. 27\)/);
    expect(testWords).not.toMatch(/∞/);
  });
});
