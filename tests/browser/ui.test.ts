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

test('a pressed pad lights: a white one lights all over, a level preset only lights its LED', async () => {
  const white = await render(Pad, { pressed: true, children: words('Normalise') });
  const red = await render(Pad, { pressed: true, tone: 'red', children: words('Channels in the red') });
  const off = await render(Pad, { pressed: false, tone: 'red', children: words('Record level too high') });
  const face = (l: Locator) => getComputedStyle(l.element()).backgroundColor;
  const whiteKey = white.getByRole('button', { name: 'Normalise' });
  const redKey = red.getByRole('button', { name: 'Channels in the red' });
  const offKey = off.getByRole('button', { name: 'Record level too high' });
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
