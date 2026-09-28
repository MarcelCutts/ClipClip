import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { CARD_METER_PLACES } from '../../lib/figures';
import { CARD_PATH, GUIDE_PATH } from '../../lib/messages';
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

  it('names each meter’s own light on the drawing, by position and not just colour', () => {
    // Top down, one name per bracket: 12 May distort, 9 MASTER: dark, 6 and 3 Blend room, 0 CH1, CH2: aim.
    const names = ['May distort', 'MASTER: dark', 'Blend room', 'CH1, CH2: aim'];
    expect(Object.values(CARD_METER_PLACES)).toEqual(names);
    const at = names.map((n) => text.indexOf(` ${n} `));
    for (const [i, n] of names.entries()) expect(at[i], n).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).not.toMatch(/Too hot|Loudest bits|Fader down/);
    expect(meterLabel).toContain(
      'Channel meters, CH1 and CH2: aim for the first orange light, 0, at a track’s loudest part.',
    );
    expect(meterLabel).toContain('MASTER meters: keep the top orange light, 9, dark.');
    expect(meterLabel).toContain(' 3 and 6 are room for a blend');
    expect(meterLabel).toContain('The red light at 12 may distort.');
  });

  it('draws a blend at its loudest, with a ring round each meter’s own light', () => {
    // Twelve rows of four lights. Lit: the channels up to 0 (eight lights each), the MASTER pair up to 6 (ten each).
    const lights = [...html.matchAll(/<rect([^>]*)\sx="([\d.]+)"[^>]*height="2"/g)];
    const lit = (x: string) =>
      lights.filter(([, before, at]) => at === x && /class="[^"]*\bon\b/.test(before ?? '')).length;
    expect(lights).toHaveLength(48);
    expect([lit('2.5'), lit('12.4'), lit('15.4'), lit('24.5')]).toEqual([8, 10, 10, 8]);
    // Three rings: CH1 and CH2 at the first orange, and one round the MASTER pair at the top orange.
    const rings = [...html.matchAll(/class="ring"[^>]*\sx="([\d.]+)"[^>]*\sy="([\d.]+)"[^>]*width="([\d.]+)"/g)].map(
      ([, x, y, w]) => ({ x: Number(x), y: Number(y), w: Number(w) }),
    );
    expect(rings).toHaveLength(3);
    const [ch1, ch2, master] = rings as [(typeof rings)[0], (typeof rings)[0], (typeof rings)[0]];
    expect(ch1.y).toBe(ch2.y);
    expect(master.y).toBeLessThan(ch1.y);
    expect(master.x).toBeGreaterThan(ch1.x);
    expect(master.x + master.w).toBeLessThan(ch2.x);
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

  it('prints the scale as the panel does: no plus sign, a true minus, and 0 in bold', () => {
    // Pioneer's panel drawing (manual p. 27) prints 12, 9, 6, 3, 0, −3 … −24. Only the knobs print a plus.
    for (const mark of ['12', '9', '6', '3', '0', '−3', '−24']) expect(text).toContain(` ${mark} `);
    expect(text).not.toMatch(/\+\d/);
    expect(html).toMatch(/class="tick zero"/);
  });

  it('sends the QR code to setting TRIM, the first thing on Playing that the card does not carry', () => {
    expect(CARD_PATH).toBe('/#trim');
    expect(qrLabel.endsWith(CARD_PATH)).toBe(true);
    // The chat's link goes to the top of Playing, for the drawing the chat cannot carry.
    expect(GUIDE_PATH).toBe('/');
    expect(text).toMatch(/Scan for the guide/);
    expect(html).not.toMatch(/\/dj\//);
  });
});
