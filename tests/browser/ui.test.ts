import { createRawSnippet } from 'svelte';
import { expect, test } from 'vitest';
import { type Locator, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../src/styles/tokens.css';
import Fader from '../../src/islands/ui/Fader.svelte';
import HowlerTop from '../../src/islands/ui/HowlerTop.svelte';
import LedMeter from '../../src/islands/ui/LedMeter.svelte';
import Pad from '../../src/islands/ui/Pad.svelte';
import { formatDb } from '../../src/lib/dsp/db';

const words = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

/**
 * Reads a slider's slot from a screenshot, since the browser draws it out of reach of
 * getComputedStyle. Returns the slot's colour at a fraction of its length.
 */
async function slotColour(slider: Locator) {
  const png = await slider.screenshot({ save: false });
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
  const context = new OffscreenCanvas(image.width, image.height).getContext('2d');
  if (!context) throw new Error('No 2D canvas');
  context.drawImage(image, 0, 0);
  const middle = Math.round(image.height / 2);
  return (f: number) => {
    const [r = 0, g = 0, b = 0] = context.getImageData(Math.round(f * image.width), middle, 1, 1).data;
    return { r, g, b };
  };
}

test('the fader is a labelled slider that speaks its value in words', async () => {
  const screen = await render(Fader, {
    id: 'trim',
    label: 'TRIM',
    value: -6,
    min: -12,
    max: 12,
    format: (v: number) => `${v} dB`,
    speak: (v: number) => (v < 0 ? `minus ${-v} decibels` : `${v} decibels`),
  });
  const slider = screen.getByRole('slider', { name: 'TRIM' });
  await expect.element(slider).toBeVisible();
  await expect.element(slider).toHaveAttribute('aria-valuetext', 'minus 6 decibels');
  // The visible readout is not a second live region.
  expect(document.querySelector('output')).toBeNull();
});

test('fader steppers move one step and stop at the ends', async () => {
  const screen = await render(Fader, { id: 'low', label: 'LOW', value: 5, min: -26, max: 6, steppers: true });
  const up = screen.getByRole('button', { name: 'LOW up' });
  await up.click();
  await expect.element(screen.getByRole('slider', { name: 'LOW' })).toHaveValue('6');
  await up.click();
  await expect.element(screen.getByRole('slider', { name: 'LOW' })).toHaveValue('6');
});

test('fader ticks sit where the cap lands on their values, under the slot and clear of the focus ring', async () => {
  const values = [-24, -12, 0, 6];
  for (const steppers of [false, true]) {
    const screen = await render(Fader, {
      id: `peak-${steppers}`,
      label: steppers ? 'Stepped' : 'Bare',
      value: 3,
      min: -24,
      max: 6,
      // Fine steps, so a tick that sits even a few pixels off its value lands the cap on another.
      step: 0.25,
      steppers,
      ticks: values.map((at) => ({ at, label: formatDb(at, { unit: '' }) })),
    });
    screen.container.style.width = '400px';
    const slider = screen.getByRole('slider', { name: steppers ? 'Stepped' : 'Bare', exact: true });
    const input = slider.element().getBoundingClientRect();
    const ticks = screen.container.querySelector('.ticks')!;
    expect(ticks.getAttribute('aria-hidden')).toBe('true');
    // The focus ring is 3px wide and 2px out from the input.
    expect(ticks.getBoundingClientRect().top - input.bottom).toBeGreaterThanOrEqual(5);
    const labels = [...ticks.querySelectorAll('span')];
    expect(labels.map((l) => l.textContent)).toEqual(['−24', '−12', '0', '+6']);
    for (const [i, label] of labels.entries()) {
      const { left, right } = label.getBoundingClientRect();
      await slider.click({ position: { x: (left + right) / 2 - input.left, y: input.height / 2 } });
      await expect.element(slider).toHaveValue(String(values[i]));
    }
  }
});

test('an inset lines the fader’s travel up with a chart axis, and the label keeps the full width', async () => {
  const screen = await render(Fader, {
    id: 'level',
    label: 'Level',
    plain: true,
    value: 105,
    min: 65,
    max: 105,
    inset: ['40px', '16px'],
  });
  screen.container.style.width = '400px';
  const slider = screen.getByRole('slider', { name: 'Level' });
  const box = screen.container.getBoundingClientRect();
  const input = slider.element().getBoundingClientRect();
  // The chart's axis runs from 40px in on the left (65) to 16px in on the right (105).
  const axis = (v: number) => 40 + ((v - 65) / 40) * (400 - 40 - 16);
  for (const v of [70, 85, 100]) {
    await slider.click({ position: { x: box.left + axis(v) - input.left, y: input.height / 2 } });
    await expect.element(slider).toHaveValue(String(v));
  }
  const head = screen.container.querySelector('.fader-head')!.getBoundingClientRect();
  expect([head.left, head.right]).toEqual([box.left, box.right]);
});

test('fader zones tint their stretches of the slot in place of the lit travel', async () => {
  const lit = await render(Fader, { id: 'lit', label: 'Lit', value: 0, min: -24, max: 6 });
  const plain = await render(Fader, { id: 'plain', label: 'Plain', value: 0, min: -24, max: 6, zones: [] });
  const zoned = await render(Fader, {
    id: 'zoned',
    label: 'Zoned',
    value: -24,
    min: -24,
    max: 6,
    zones: [
      { from: -18, to: -12, tone: 'sig' },
      { from: 0, to: 6, tone: 'dmg' },
    ],
  });
  for (const { container } of [lit, plain, zoned]) container.style.width = '400px';
  // By default the slot is lit up to the cap. An empty list of zones leaves it plain.
  const litAt = await slotColour(lit.getByRole('slider', { name: 'Lit' }));
  expect(litAt(0.3).g).toBeGreaterThan(litAt(0.95).g + 30);
  const plainAt = await slotColour(plain.getByRole('slider', { name: 'Plain' }));
  expect(plainAt(0.3)).toEqual(plainAt(0.95));
  // In the blue zone, between the zones, in the red zone.
  const zonedAt = await slotColour(zoned.getByRole('slider', { name: 'Zoned' }));
  const [sig, between, dmg] = [zonedAt(0.3), zonedAt(0.6), zonedAt(0.9)] as const;
  expect(sig.b).toBeGreaterThan(Math.max(sig.r, between.b + 20));
  expect(dmg.r).toBeGreaterThan(Math.max(dmg.b, between.r + 20));
});

test('a fader with a marked scale still steps with the keyboard and speaks each step', async () => {
  const screen = await render(Fader, {
    id: 'scale',
    label: 'Scale',
    plain: true,
    value: -12,
    min: -24,
    max: 6,
    speak: (v: number) => (v < 0 ? `minus ${-v} decibels` : `${v} decibels`),
    zones: [{ from: -18, to: -12, tone: 'sig' }],
    ticks: [{ at: -12, label: '−12' }],
    inset: ['20px', '20px'],
  });
  const slider = screen.getByRole('slider', { name: 'Scale' });
  (slider.element() as HTMLInputElement).focus();
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(slider).toHaveValue('-11');
  await expect.element(slider).toHaveAttribute('aria-valuetext', 'minus 11 decibels');
  await userEvent.keyboard('{End}');
  await expect.element(slider).toHaveValue('6');
  await expect.element(slider).toHaveAttribute('aria-valuetext', '6 decibels');
});

test('the meter lights LEDs up to the level and names the zone', async () => {
  const screen = await render(LedMeter, { label: 'CH1', level: 3 });
  const meter = screen.getByRole('meter', { name: 'CH1 level' });
  await expect.element(meter).toBeVisible();
  expect(meter.element().getAttribute('aria-valuetext')).toMatch(/in the orange/);
  // −24 to +3 is nine LEDs: seven green and two orange.
  expect(document.querySelectorAll('.led[data-on="true"]')).toHaveLength(9);
  expect(document.querySelectorAll('.led[data-on="true"][data-zone="red"]')).toHaveLength(0);
});

test('the meter shows red at the ceiling', async () => {
  const screen = await render(LedMeter, { label: 'MASTER', level: 13, stereo: true, clip: 'fast' });
  const meter = screen.getByRole('meter', { name: 'MASTER level' });
  await expect.element(meter).toBeVisible();
  expect(meter.element().getAttribute('aria-valuetext')).toMatch(/in the red/);
  expect(document.querySelectorAll('.led[data-on="true"][data-zone="red"]')).toHaveLength(2);
});

test('the meter prints its scale like the panel, with 0 in bold and a break between colour zones', async () => {
  const screen = await render(LedMeter, { label: 'CH1', level: 3 });
  const ticks = [...screen.container.querySelectorAll('.tick')];
  expect(ticks.map((t) => t.textContent)).toEqual([
    '+12',
    '+9',
    '+6',
    '+3',
    '0',
    '−3',
    '−6',
    '−9',
    '−12',
    '−15',
    '−18',
    '−24',
  ]);
  const weight = (t: Element) => Number(getComputedStyle(t).fontWeight);
  const zero = ticks.find((t) => t.textContent === '0')!;
  expect(ticks.filter((t) => t !== zero).every((t) => weight(t) < weight(zero))).toBe(true);
  // The gap under the red light and under the 0 light is wider than between lights of one colour.
  const rows = [...screen.container.querySelectorAll('.row')].map((r) => r.getBoundingClientRect());
  const gaps = rows.slice(1).map((r, i) => r.top - rows[i]!.bottom);
  // Top down: +12 over +9 is red over orange, 0 over −3 is orange over green, −3 over −6 is green over green.
  const [redToOrange, orangeToGreen, greenToGreen] = [gaps[0]!, gaps[4]!, gaps[5]!];
  expect(redToOrange).toBeGreaterThanOrEqual(greenToGreen + 2);
  expect(orangeToGreen).toBeGreaterThanOrEqual(greenToGreen + 2);
});

test('the meter’s name and CLIP legend are big enough to read as names', async () => {
  const screen = await render(LedMeter, { label: 'MASTER', level: 0, stereo: true, clip: 'off' });
  for (const el of screen.container.querySelectorAll('.name, .clip')) {
    expect(Number.parseFloat(getComputedStyle(el).fontSize), el.textContent ?? '').toBeGreaterThanOrEqual(14);
  }
});

test('a fader prints a hardware name at 14px or more', async () => {
  const screen = await render(Fader, { id: 'trim-size', label: 'TRIM', value: 0, min: -12, max: 9 });
  const label = screen.container.querySelector('label')!;
  expect(Number.parseFloat(getComputedStyle(label).fontSize)).toBeGreaterThanOrEqual(14);
});

test('a neutral fader zone is printed in the panel’s grey, not a chart colour', async () => {
  const screen = await render(Fader, {
    id: 'neutral',
    label: 'Neutral',
    value: -24,
    min: -24,
    max: 6,
    zones: [{ from: -18, to: -12, tone: 'neutral' }],
  });
  screen.container.style.width = '400px';
  const at = await slotColour(screen.getByRole('slider', { name: 'Neutral' }));
  const band = at(0.3);
  const plain = at(0.6);
  // Lighter than the bare slot, and grey: no channel stands out the way blue or red would.
  expect(band.r + band.g + band.b).toBeGreaterThan(plain.r + plain.g + plain.b + 30);
  expect(Math.max(band.r, band.g, band.b) - Math.min(band.r, band.g, band.b)).toBeLessThan(20);
});

test('a pressed pad lights: a white one lights all over, a level preset only lights its LED', async () => {
  const white = await render(Pad, { pressed: true, children: words('Normalise') });
  const red = await render(Pad, { pressed: true, tone: 'red', children: words('Channels in the red') });
  const off = await render(Pad, { pressed: false, tone: 'red', children: words('Recording level too high') });
  const face = (l: Locator) => getComputedStyle(l.element()).backgroundColor;
  const whiteKey = white.getByRole('button', { name: 'Normalise' });
  const redKey = red.getByRole('button', { name: 'Channels in the red' });
  const offKey = off.getByRole('button', { name: 'Recording level too high' });
  await expect.element(redKey).toHaveAttribute('aria-pressed', 'true');
  // No LED on a plain pad: the pad is the light.
  expect(white.container.querySelector('.led')).toBeNull();
  expect(face(whiteKey)).not.toBe(face(offKey));
  // A red preset keeps the dark face of an unlit pad, so it never reads as an alarm; its LED lights red.
  expect(face(redKey)).toBe(face(offKey));
  const led = (c: HTMLElement) => getComputedStyle(c.querySelector('.led')!).backgroundColor;
  expect(led(red.container)).toBe('rgb(255, 59, 48)');
  expect(led(off.container)).not.toBe('rgb(255, 59, 48)');
});

test('the Howler drawing lights its LEVEL light only, and says nothing to screen readers', async () => {
  const screen = await render(HowlerTop, { light: 'red' });
  const svg = screen.container.querySelector('svg')!;
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.querySelector('.level')?.getAttribute('data-light')).toBe('red');
  expect([...svg.querySelectorAll('text')].map((t) => t.textContent)).toEqual(['HOWLER', 'BATTERY', 'LEVEL']);
});
