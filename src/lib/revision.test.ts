import { describe, expect, it } from 'vitest';
import { CHECKLISTS } from './checklists';
import { PRINTED, printedWords, REVISION, wordsCode } from './revision';

describe('the print kit’s revision', () => {
  it('changes its code whenever the printed words change', () => {
    const code = wordsCode(printedWords());
    expect(
      PRINTED.code,
      `The printed words changed. In revision.ts, set PRINTED.date to today and PRINTED.code to ${code}.`,
    ).toBe(code);
  });

  it('prints the date with the code after it', () => {
    expect(REVISION).toBe(`${PRINTED.date} (${PRINTED.code})`);
    expect(PRINTED.code).toMatch(/^[0-9A-F]{6}$/);
    expect(PRINTED.date).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  });

  it('reads every printed line, so a change to any of them moves the code', () => {
    const words = printedWords();
    const base = wordsCode(words);
    for (const list of ['doors', 'changeover', 'after'] as const)
      for (const item of CHECKLISTS[list].items) expect(words).toContain(item.target);
    expect(wordsCode([...words.slice(0, -1), `${words.at(-1)}.`])).not.toBe(base);
  });
});
