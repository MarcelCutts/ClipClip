import { expect, type Locator, type Page, test } from '@playwright/test';

// The blend lab, on Learn at #blends: a small mixer in four steps. Every control is on the panel and
// live in every step, in the unit's order: each deck's TRIM and LOW, its fader, and the meters between
// the faders. The reader can push it into the red, and hear it. Nothing moves while a control is in
// use: the step's result appears once, when its goal is met, and only below every control.

async function openLab(page: Page): Promise<Locator> {
  await page.goto('learn/#blends');
  const lab = page.locator('.blend');
  await lab.scrollIntoViewIfNeeded();
  // Islands hydrate as they scroll into view, and Astro drops `ssr` once this one has.
  await expect(page.locator('astro-island:has(.blend)')).not.toHaveAttribute('ssr');
  return lab;
}

/** Move a slider by key presses: one printed mark, or one dB, a press. */
async function press(
  lab: Locator,
  name: string,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  times: number,
) {
  const slider = lab.getByRole('slider', { name, exact: true });
  for (let i = 0; i < times; i++) await slider.press(key);
}

const meter = (lab: Locator, name: 'CH1' | 'MASTER' | 'CH2') => lab.getByRole('meter', { name: `${name} level` });

/** Where each part of the panel sits on the page, to the pixel, however far the page has scrolled. */
async function boxes(lab: Locator) {
  return lab.evaluate((el) => {
    const at = (sel: string) => {
      const box = el.querySelector(sel)?.getBoundingClientRect();
      return box
        ? `${Math.round(box.left + window.scrollX)},${Math.round(box.top + window.scrollY)} ${Math.round(box.width)}x${Math.round(box.height)}`
        : 'none';
    };
    return {
      coach: at('.coach'),
      readout: at('.readout'),
      meters: at('.centre'),
      fader1: at('.strip[data-deck="1"]'),
      fader2: at('.strip[data-deck="2"]'),
      knobs1: at('.knobs[data-deck="1"]'),
      knobs2: at('.knobs[data-deck="2"]'),
      trim1: at('.knobs[data-deck="1"] .trim input'),
      trim2: at('.knobs[data-deck="2"] .trim input'),
      low1: at('.knobs[data-deck="1"] .low input'),
      low2: at('.knobs[data-deck="2"] .low input'),
    };
  });
}

test('every control is on the panel and live, in the unit’s order', async ({ page }) => {
  const lab = await openLab(page);
  for (const deck of [1, 2]) {
    for (const control of ['Fader', 'TRIM', 'LOW']) {
      await expect(lab.getByRole('slider', { name: `Deck ${deck} ${control}`, exact: true })).toBeVisible();
      await expect(lab.getByRole('slider', { name: `Deck ${deck} ${control}`, exact: true })).toBeEnabled();
    }
  }
  // Nothing folded away, and no pad that jumps the mixer for you.
  await expect(lab.locator('summary', { hasText: 'TRIM and EQ' })).toHaveCount(0);
  await expect(lab.getByRole('button', { name: /Both decks on top orange|Boost the LOW|First orange/ })).toHaveCount(0);
  // The meters come first on a phone, with the knobs under them; on a wide panel the knobs flank the faders.
  const [metersBox, knobsBox] = [
    await lab.locator('.centre').boundingBox(),
    await lab.locator('.knobs').first().boundingBox(),
  ];
  expect(metersBox && knobsBox).toBeTruthy();
  if (metersBox && knobsBox) {
    if ((page.viewportSize()?.width ?? 0) >= 1000) expect(knobsBox.x + knobsBox.width).toBeLessThan(metersBox.x);
    else expect(knobsBox.y).toBeGreaterThan(metersBox.y + metersBox.height);
  }
});

test('step 1: the guess, then deck 2 in, and the MASTER meters climb while the channel meters stay', async ({
  page,
}) => {
  const lab = await openLab(page);
  const step = lab.getByRole('heading', { level: 4 });
  await expect(step).toContainText('Step 1 of 4');
  await expect(step).toContainText('Bring deck 2 in');
  // The fader the step asks for is printed in the action colour until it moves.
  await expect(lab.locator('.strip[data-deck="2"] .channel')).toHaveClass(/lit/);

  // The guess: MASTER's LEDs are radios until deck 2 moves.
  const guess = lab.getByRole('radiogroup', { name: 'With deck 2 all the way up, where will MASTER peak?' });
  await guess.getByRole('radio', { name: /^plus 6 decibels/ }).check({ force: true });
  const ch1 = await meter(lab, 'CH1').getAttribute('aria-valuetext');
  const ch2 = await meter(lab, 'CH2').getAttribute('aria-valuetext');

  await press(lab, 'Deck 2 Fader', 'ArrowUp', 10);
  await expect(lab.locator('.strip[data-deck="2"] .channel')).not.toHaveClass(/lit/);
  // The result says the guess back beside where MASTER peaked, and why.
  await expect(lab.locator('.goal-title')).toHaveText(/^You guessed \+6\sdB\. MASTER peaks at \+9\sdB$/);
  await expect(lab.getByText('The channel meters did not move with the fader. They read before it.')).toBeVisible();
  await expect(meter(lab, 'MASTER')).toHaveAttribute('aria-valuetext', /peaks at \+9\sdB/);
  // The channel meters read before the fader: deck 2 coming up did not move them.
  await expect(meter(lab, 'CH1')).toHaveAttribute('aria-valuetext', ch1 ?? '');
  await expect(meter(lab, 'CH2')).toHaveAttribute('aria-valuetext', ch2 ?? '');

  await lab.getByRole('button', { name: 'Next: fix it with a fader' }).click();
  await expect(step).toContainText('Step 2 of 4');
  await expect(step).toBeFocused();
});

test('step 2: one mark down on deck 1 takes the top orange dark', async ({ page }) => {
  const lab = await openLab(page);
  await lab.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(lab.locator('.coach')).toHaveText('The top orange is lit. Pull deck 1’s fader down.');
  await press(lab, 'Deck 1 Fader', 'ArrowDown', 1);
  await expect(lab.locator('.goal-title')).toHaveText('The top orange is dark');
  await expect(lab.getByText('If the top orange lights, pull a channel fader down a little.')).toBeVisible();
});

test('step 3: each channel under the red, the mix past it, and the crunch to hear', async ({ page }) => {
  const lab = await openLab(page);
  for (let i = 0; i < 2; i++) await lab.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(lab.getByRole('heading', { level: 4 })).toContainText('Push it into the red');
  // Both TRIMs are the controls to move.
  await expect(lab.locator('.knobs .trim.lit')).toHaveCount(2);

  // Both on the third orange: the red, but only just.
  await press(lab, 'Deck 1 TRIM', 'ArrowRight', 3);
  await press(lab, 'Deck 2 TRIM', 'ArrowRight', 3);
  await expect(lab.locator('.coach')).toHaveText('At the red, only the tips are cut: too little to hear. Keep going.');
  // Both on the top orange: 3 dB past the red, CLIP lit.
  await press(lab, 'Deck 1 TRIM', 'ArrowRight', 3);
  await press(lab, 'Deck 2 TRIM', 'ArrowRight', 3);
  await expect(meter(lab, 'CH1')).toHaveAttribute('aria-valuetext', /in the orange/);
  await expect(meter(lab, 'CH2')).toHaveAttribute('aria-valuetext', /in the orange/);
  await expect(meter(lab, 'MASTER')).toHaveAttribute('aria-valuetext', /in the red/);
  await expect(lab.locator('.goal-title')).toHaveText(/^The mix is 3\sdB over the red$/);
  await expect(lab.getByText('Press Listen, then Hear the clean version.')).toBeVisible();
  await expect(lab.getByRole('button', { name: /^Listen/ })).toBeVisible();
  await expect(lab.getByRole('button', { name: 'Hear the clean version' })).toBeVisible();
});

test('step 4: set deck 2’s TRIM before it comes in, and the top orange stays dark', async ({ page }) => {
  const lab = await openLab(page);
  for (let i = 0; i < 3; i++) await lab.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(lab.getByRole('heading', { level: 4 })).toContainText('Leave room with TRIM');
  await expect(lab.locator('.coach')).toHaveText('CH2 peaks on the second orange. Turn deck 2’s TRIM down a little.');
  await press(lab, 'Deck 2 TRIM', 'ArrowLeft', 3);
  await expect(lab.locator('.coach')).toHaveText('CH2 peaks on the first orange. Bring deck 2’s fader all the way up.');
  await press(lab, 'Deck 2 Fader', 'ArrowUp', 10);
  await expect(lab.locator('.goal-title')).toHaveText('The top orange stays dark');
  await expect(lab.getByText('What the meters should show', { exact: true })).toBeVisible();
  // The last step: only the way back.
  await expect(lab.locator('.nav').getByRole('button')).toHaveText(['Back']);
});

test('feedback follows the live mixer after a step is completed', async ({ page }) => {
  const lab = await openLab(page);
  await lab.getByRole('button', { name: 'Next', exact: true }).click();
  await press(lab, 'Deck 1 Fader', 'ArrowDown', 1);
  await expect(lab.locator('.coach')).toHaveText('The top orange is dark');
  await expect(lab.locator('p[aria-live="polite"]')).toContainText('The top orange is dark');
  const before = await boxes(lab);

  // Continuing to explore must not leave a success message beside a hot mixer, or silence
  // subsequent meter announcements. The completed result stays below the controls as history.
  await press(lab, 'Deck 1 TRIM', 'ArrowRight', 9);
  await expect(lab.locator('.coach')).toContainText('CH1 is in the red');
  await expect(lab.locator('p[aria-live="polite"]')).toContainText('CH1 is in the red');
  await expect(lab.getByText('When you completed this step', { exact: true })).toBeVisible();
  const after = await boxes(lab);
  for (const part of ['meters', 'fader1', 'fader2', 'knobs1', 'knobs2'] as const) {
    expect(after[part], part).toBe(before[part]);
  }
  // Returning to the target gives current success feedback again.
  await press(lab, 'Deck 1 TRIM', 'ArrowLeft', 9);
  await expect(lab.locator('.coach')).toHaveText('The top orange is dark');
});

test('each step starts with the actual mix selected for listening', async ({ page }) => {
  const lab = await openLab(page);
  const clean = lab.getByRole('button', { name: 'Hear the clean version', exact: true });
  await clean.click();
  await expect(clean).toHaveAttribute('aria-pressed', 'true');
  await lab.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(clean).toHaveAttribute('aria-pressed', 'false');
  await clean.click();
  await expect(clean).toHaveAttribute('aria-pressed', 'true');
  await lab.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(clean).toHaveAttribute('aria-pressed', 'false');
});

test('long feedback and channel readings do not move phone controls', async ({ page }) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('about:blank');
    const lab = await openLab(page);
    await lab.getByRole('button', { name: 'Next', exact: true }).click();
    const before = await boxes(lab);
    await press(lab, 'Deck 1 TRIM', 'ArrowRight', 9);
    await press(lab, 'Deck 1 LOW', 'ArrowRight', 6);
    await expect(lab.locator('.coach')).toContainText('CH1 is in the red');
    const after = await boxes(lab);
    expect(after, `${width}px`).toEqual(before);
    expect(
      await lab.locator('.readout').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `${width}px readout`,
    ).toBe(true);
  }
});

test('nothing moves while a control is in use, and the result appears under every control', async ({ page }) => {
  const lab = await openLab(page);
  // Deck 2 all the way up but the last mark: nothing on the panel moves.
  const before = await boxes(lab);
  await press(lab, 'Deck 2 Fader', 'ArrowUp', 9);
  expect(await boxes(lab)).toEqual(before);
  // The last mark meets the goal: the controls, the meters and the line stay where they were.
  await press(lab, 'Deck 2 Fader', 'ArrowUp', 1);
  await expect(lab.locator('.goal')).toBeVisible();
  const after = await boxes(lab);
  for (const part of ['readout', 'meters', 'fader1', 'fader2', 'knobs1', 'knobs2'] as const) {
    expect(after[part], part).toBe(before[part]);
  }
  // Step 3's goal is met with a TRIM in hand: its result comes after the knobs too.
  for (let i = 0; i < 2; i++) await lab.getByRole('button', { name: /^Next/ }).first().click();
  const start = await boxes(lab);
  await press(lab, 'Deck 1 TRIM', 'ArrowRight', 6);
  await press(lab, 'Deck 2 TRIM', 'ArrowRight', 6);
  await expect(lab.locator('.goal')).toBeVisible();
  const done = await boxes(lab);
  for (const part of ['readout', 'meters', 'fader1', 'fader2', 'knobs1', 'knobs2'] as const) {
    expect(done[part], part).toBe(start[part]);
  }
  const [goal, knobs] = [await lab.locator('.goal').boundingBox(), await lab.locator('.knobs').last().boundingBox()];
  expect(goal && knobs).toBeTruthy();
  if (goal && knobs) expect(goal.y).toBeGreaterThanOrEqual(knobs.y + knobs.height);
});
