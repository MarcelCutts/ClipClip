import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { CHECKLISTS, type ChecklistId, drillText, HOWLER_RED_FIRST_ACTION } from '../../lib/checklists';

// Loaded through Vite rather than a plain import, because svelte-check can't resolve .astro files.
type Component = Parameters<AstroContainer['renderToString']>[0];
const [ChecklistCard] = Object.values(
  import.meta.glob<Component>('./ChecklistCard.astro', { eager: true, import: 'default' }),
);
if (!ChecklistCard) throw new Error('ChecklistCard.astro not found');

const REVISED = '26 September 2026';
/** Any run of spaces as one space, no-break spaces included, as the card's text is compared. */
const norm = (s: string) => s.replace(/\s+/g, ' ');
const container = await AstroContainer.create();
const render = async (list: ChecklistId) => {
  const html = await container.renderToString(ChecklistCard, { props: { list, revised: REVISED } });
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#39;|&#x27;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
  return { html, text };
};

describe('printed checklist card', () => {
  it('prints every line of the list, with its note and its drill', async () => {
    for (const id of ['doors', 'changeover', 'after'] as const) {
      const { text } = await render(id);
      for (const item of CHECKLISTS[id].items) {
        expect(text, item.id).toContain(norm(item.check));
        expect(text, item.id).toContain(norm(item.target));
        if (item.note) expect(text, item.id).toContain(norm(item.note));
        if (item.drill) expect(text, item.id).toContain(norm(drillText(item.drill)));
      }
    }
  });

  it('prints the first action for a red LEVEL light on C1 and C2, not only a drill number', async () => {
    for (const id of ['doors', 'changeover'] as const)
      expect((await render(id)).text).toContain(HOWLER_RED_FIRST_ACTION);
  });

  it('is read-and-do for one person: no time budget, no call to say', async () => {
    for (const id of ['doors', 'changeover', 'after'] as const) {
      const { text } = await render(id);
      expect(text).not.toMatch(/Say: “[^”]*complete/i);
      expect(text).not.toMatch(/\b\d+\s+s\b|Under a minute|from memory/);
    }
  });

  it('labels the setup card by when it is done, and dates every card', async () => {
    expect((await render('doors')).text).toMatch(/C1 Before doors Every event/);
    for (const id of ['doors', 'changeover', 'after'] as const)
      expect((await render(id)).text).toContain(`Revised ${REVISED}`);
  });

  it('says a consequence before its line, never in a note', async () => {
    const { html } = await render('files');
    const before = CHECKLISTS.files.items.find((i) => i.before);
    expect(before).toBeDefined();
    const at = html.indexOf(before!.before!.replace(/’/g, '&#39;').slice(0, 20));
    const said = at >= 0 ? at : html.indexOf(before!.before!.slice(0, 20));
    expect(said).toBeGreaterThan(-1);
    expect(said).toBeLessThan(html.indexOf(before!.target));
  });
});
