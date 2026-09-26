import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { GUIDE_PATH } from '../../lib/messages';
import { DJ_RULES } from '../../lib/rules';

// Loaded through Vite rather than a plain import, because svelte-check can't resolve .astro files.
type Component = Parameters<AstroContainer['renderToString']>[0];
const [BoothCard] = Object.values(import.meta.glob<Component>('./BoothCard.astro', { eager: true, import: 'default' }));
if (!BoothCard) throw new Error('BoothCard.astro not found');

const REVISED = '26 September 2026';
const container = await AstroContainer.create();
const html = await container.renderToString(BoothCard, { props: { revised: REVISED } });
/** The card's words, tags stripped, with the entities a renderer might escape put back. */
const text = html
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#39;|&#x27;/g, '’')
  .replace(/\s+/g, ' ');
const meterLabel = /aria-label="(The meters[^"]*)"/.exec(html)?.[1] ?? '';
const qrLabel = /aria-label="(QR code: [^"]*)"/.exec(html)?.[1] ?? '';

describe('booth card', () => {
  it('sets the three DJ lines as the “Know by heart” box does: what to look at, what it should be, what if not', () => {
    expect(text).toMatch(/Know by heart when you’re playing/);
    expect(DJ_RULES).toHaveLength(3);
    for (const rule of DJ_RULES) {
      expect(text, rule.challenge).toContain(rule.challenge);
      expect(text, rule.challenge).toContain(rule.response);
      expect(text, rule.challenge).toContain(rule.note);
    }
    // In the rules' order, numbered by the list.
    const at = DJ_RULES.map((r) => text.indexOf(r.challenge));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('names the DJ’s own knob once, in the MASTER LEVEL line’s note', () => {
    expect(text.match(/BOOTH MONITOR/g)).toHaveLength(1);
    // The Howler records from MASTER 2, so no knob on the card is "your recording level".
    expect(text).not.toMatch(/knob marked REC|recording level|BOOTH = /i);
  });

  it('says every set is recorded, and promises nothing more', () => {
    expect(text).toMatch(/Every set here is recorded\./);
    expect(text).not.toMatch(/for good|for ever|stays in the recording|sent your set/i);
    // No question-and-answer lead-ins on the card.
    expect(text).not.toMatch(/\?\s+\p{Lu}/u);
  });

  it('has a line to write in who is on crew tonight', () => {
    expect(text).toMatch(/Crew tonight:/);
    expect(html).toMatch(/class="blank"/);
  });

  it('carries the date its words last changed', () => {
    expect(text).toContain(`Revised ${REVISED}`);
  });

  it('marks the target on the meter drawing by position, not just colour, in the guide’s words', () => {
    // Top down, one name per bracket: +12 May distort, +9 Fader down, +6 and +3 Blend room, 0 Aim.
    const names = ['May distort', 'Fader down', 'Blend room', 'Aim'];
    const at = names.map((n) => text.indexOf(` ${n} `));
    for (const [i, n] of names.entries()) expect(at[i], n).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).not.toMatch(/Too hot|Loudest bits/);
    expect(meterLabel).toContain('Aim for the first orange light, 0, at a track’s loudest part.');
    expect(meterLabel).toContain('+3 and +6 are room for a blend');
    expect(meterLabel).toContain('At +9, pull a channel fader down.');
    expect(meterLabel).toContain('The red light at +12 may distort.');
  });

  it('brackets one light for the aim, two for a blend, and one each for the top orange and the red', () => {
    // Each bracket is a path "M… y1 h0.8 V y2 h-0.8": its height says how many lights it spans.
    const spans = [...html.matchAll(/class="bracket" d="M[\d.]+ ([\d.]+)h0\.8V([\d.]+)h-0\.8"/g)].map(
      ([, y1, y2]) => Number(y2) - Number(y1),
    );
    expect(spans).toHaveLength(4);
    const [red, fader, blend, aim] = spans as [number, number, number, number];
    expect(fader).toBeCloseTo(red);
    expect(aim).toBeCloseTo(red);
    // Two lights: one more light's pitch than a single one.
    expect(blend).toBeGreaterThan(aim + 3);
  });

  it('prints the scale as the panel does, with a plus sign above 0', () => {
    for (const mark of ['+12', '+9', '+6', '+3', '0', '−3', '−24']) expect(text).toContain(` ${mark} `);
    expect(html).toMatch(/class="tick zero"/);
  });

  it('sends the QR code to the guide, where playing a set starts, as the DJ briefing does', () => {
    expect(qrLabel.endsWith(GUIDE_PATH)).toBe(true);
    expect(text).toMatch(/Scan for the guide/);
    expect(html).not.toMatch(/\/dj\//);
  });
});
