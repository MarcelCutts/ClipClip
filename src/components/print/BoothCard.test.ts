import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { DJ_RULES } from '../../lib/rules';
import { MONITOR_TAG } from '../../lib/tags';

// Loaded through Vite rather than a plain import, because svelte-check can't resolve .astro files.
type Component = Parameters<AstroContainer['renderToString']>[0];
const [BoothCard] = Object.values(import.meta.glob<Component>('./BoothCard.astro', { eager: true, import: 'default' }));
if (!BoothCard) throw new Error('BoothCard.astro not found');

const container = await AstroContainer.create();
const html = await container.renderToString(BoothCard);
/** The card's words, tags stripped, with the entities a renderer might escape put back. */
const text = html
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#39;|&#x27;/g, '’')
  .replace(/\s+/g, ' ');
const meterLabel = /aria-label="(The meters[^"]*)"/.exec(html)?.[1] ?? '';
const qrLabel = /aria-label="(QR code: [^"]*)"/.exec(html)?.[1] ?? '';

describe('booth card', () => {
  it('sets every DJ rule as the “Know by heart” boxes do: what to look at, what it should be, what if not', () => {
    expect(text).toMatch(/Know by heart when you’re playing/);
    for (const rule of DJ_RULES) {
      expect(text, rule.challenge).toContain(rule.challenge);
      expect(text, rule.challenge).toContain(rule.response);
      if (rule.note) expect(text, rule.challenge).toContain(rule.note);
    }
    // In the rules’ order, numbered by the list.
    const at = DJ_RULES.map((r) => text.indexOf(r.challenge));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('tells DJs the one knob that’s theirs, as its tag does', () => {
    expect(MONITOR_TAG.owner).toBe('yours');
    expect(text).toMatch(/If the booth monitors are too quiet, turn up BOOTH MONITOR\. It’s yours\./);
    // The Howler records from MASTER 2, so no knob on the card is "your recording level".
    expect(text).not.toMatch(/knob marked REC|recording level|BOOTH = /i);
  });

  it('says why in a plain statement, not a slogan', () => {
    expect(text).toMatch(/We record every set, and crunch from the red stays in the recording for good\./);
    expect(text).not.toMatch(/Why:/);
    // No question-and-answer lead-ins on the card.
    expect(text).not.toMatch(/\?\s+\p{Lu}/u);
  });

  it('marks the target on the meter drawing by position, not just colour', () => {
    expect(text).toMatch(/Loudest bits/);
    expect(text).toMatch(/Blend room/);
    expect(text).toMatch(/Too hot/);
    expect(meterLabel).toContain('Loudest bits: the first two orange lights, 0 and +3.');
    expect(meterLabel).toContain('Blend room: +6 and +9');
    expect(meterLabel).toContain('Too hot: the red light at +12.');
  });

  it('sends the QR code to the guide, where playing a set starts', () => {
    expect(qrLabel).toMatch(/\/#trim$/);
    expect(text).toMatch(/Scan for the guide/);
    expect(html).not.toMatch(/\/dj\//);
  });
});
