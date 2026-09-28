/**
 * The print kit's revision: the date its words last changed, and a short code made from those words.
 * Two pushes on one day can print different lines under the same date (26 September 2026 did), so
 * the code tells them apart: a laminated card in the booth shows it, and the web pages show the code
 * the cards should have.
 *
 * The code is a hash of every string the kit prints: the DJ box, the three printed checklists, the
 * tape tags, the captions of C1's drawings and the names on the booth card's drawing of the meters.
 * The labels inside C1's drawings are not in it. revision.test.ts fails when those words change and
 * PRINTED does not. Then set the date to the day, and the code to the one the test prints.
 */
import { CHECKLISTS, type ChecklistId, drillText } from './checklists';
import { CARD_METER_PLACES, FIGURE_ORDER, FIGURES } from './figures';
import { DJ_RULES } from './rules';
import { MASTER_TAG, SHORT_TAGS } from './tags';

/** The checklists the print kit carries (print.astro): C1, C2 and C3. */
export const PRINTED_LISTS: readonly ChecklistId[] = ['doors', 'changeover', 'after'];

/** Every string the print kit carries, in a fixed order. */
export function printedWords(): string[] {
  const rules = DJ_RULES.flatMap((r) => [r.challenge, r.response, r.note, r.text ?? '', r.label ?? '']);
  const lists = PRINTED_LISTS.flatMap((id) => {
    const list = CHECKLISTS[id];
    return [
      list.code,
      list.title,
      list.when,
      ...list.items.flatMap((i) => [
        i.group ?? '',
        i.check,
        i.target,
        i.before ?? '',
        i.note ?? '',
        i.help?.label ?? '',
        i.drill ? drillText(i.drill) : '',
      ]),
    ];
  });
  const tags = [
    ...SHORT_TAGS.flatMap((t) => [t.name, t.owner, t.rule ?? '', ...(t.blanks ?? [])]),
    MASTER_TAG.name,
    ...MASTER_TAG.lines,
  ];
  const drawings = FIGURE_ORDER.flatMap((id) => [FIGURES[id].title, FIGURES[id].note]);
  const meters = Object.values(CARD_METER_PLACES);
  return [...rules, ...lists, ...tags, 'Continue with C1, part 2.', ...drawings, ...meters];
}

/** FNV-1a over the words, 32 bits, as six hex digits: short enough to print and to read out. */
export function wordsCode(words: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const ch of words.join('\u0000')) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 8).toString(16).toUpperCase().padStart(6, '0');
}

/** The revision the cards carry. Change both when the test says the printed words changed. */
export const PRINTED = { date: '28 September 2026', code: '716B79' } as const;

/** As a card prints it after "Revised": "27 September 2026 (3F9A2C)". */
export const REVISION = `${PRINTED.date} (${PRINTED.code})`;
