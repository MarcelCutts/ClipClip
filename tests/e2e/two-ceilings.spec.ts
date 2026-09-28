import { expect, type Locator, type Page, test } from '@playwright/test';

// The two-ceilings lab, in the guide at #two-ceilings: three steps, each with one live control.
// Step 1 cannot be won and always ends in its result, in view on a phone; its clock only starts
// once the recording level moves. The arrow keys move the live control a decibel at a time, and
// the Howler light never blinks for longer than WCAG 2.2.2 allows.

async function openLab(page: Page): Promise<Locator> {
  await page.goto('learn/#two-ceilings');
  const lab = page.locator('.two-ceilings');
  await lab.scrollIntoViewIfNeeded();
  // Islands hydrate as they scroll into view, and Astro drops `ssr` once this one has.
  await expect(page.locator('astro-island:has(.two-ceilings)')).not.toHaveAttribute('ssr');
  return lab;
}

test('step 1 shows its result before moving on, in view on a phone', async ({ page }) => {
  const lab = await openLab(page);
  // The step titles sit one level under the guide's "Two ceilings".
  const step = lab.getByRole('heading', { level: 4 });
  // The way forward in the nav. It lights once the recording level has been tried, and goes dark
  // when the feedback box offers its own Next.
  const key = lab.locator('.nav').getByRole('button', { name: /^(Next|Show the result)$/ });

  await expect(step).toContainText('Step 1 of 3');
  // The recording level is the thing to do: the key waits unlit, and only the live control has a hint.
  await expect(key).toHaveText('Show the result');
  await expect(key).not.toHaveClass(/primary/);
  await expect(lab.getByText(/^How loud the mix goes into the Howler\./)).toBeVisible();
  await expect(lab.getByText(/^How loud the track peaks/)).toHaveCount(0);
  await expect(lab.locator('[data-crunch]')).toHaveText('Heavy crunch');
  // The model's caveat points to the one place the guide says what the makers leave out.
  const model = lab.locator('.model a');
  await expect(page.locator((await model.getAttribute('href')) ?? 'nowhere')).toHaveCount(1);

  // Moving on without trying the recording level still ends the step in its result.
  await key.click();
  // Exact: the live region repeats the whole result a moment later.
  await expect(lab.getByText('The crunch is still there', { exact: true })).toBeInViewport();
  await expect(lab.getByText(/^The LEVEL light stayed green\./)).toBeVisible();
  await expect(step).toContainText('Step 1 of 3');
  await expect(key).toHaveCount(0);
  // Only one lit key at a time: the feedback box's.
  await expect(lab.locator('.key.primary')).toHaveCount(1);
  await expect(lab.getByRole('button', { name: 'Next: turn the channel down' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(step).toContainText('Turn the channel down');
  await expect(step).toBeFocused();
});

test('step 1 starts its clock on the first move of the recording level', async ({ page }) => {
  await page.clock.install();
  const lab = await openLab(page);
  const result = lab.getByText('The crunch is still there', { exact: true });

  // Reading the step takes as long as it takes.
  await page.clock.runFor(60_000);
  await expect(result).toHaveCount(0);

  // One move lights the key and starts the clock.
  await lab.getByRole('slider', { name: 'Recording level' }).press('ArrowLeft');
  await expect(lab.locator('.nav').getByRole('button', { name: 'Show the result' })).toHaveClass(/primary/);
  await page.clock.runFor(21_000);
  await expect(result).toBeVisible();
});

test('the channel fixes crunch made in the mixer, and the recording level fixes crunch at the Howler', async ({
  page,
}) => {
  const lab = await openLab(page);
  const step = lab.getByRole('heading', { level: 4 });
  await lab.locator('.nav').getByRole('button', { name: 'Show the result' }).click();
  await lab.getByRole('button', { name: 'Next: turn the channel down' }).click();
  await expect(step).toContainText('Step 2 of 3');

  // The arrow keys move the one live control. +18 down to +11: out of the red, but high.
  const channel = lab.getByRole('slider', { name: 'Channel (TRIM and EQ)' });
  for (let i = 0; i < 7; i++) await channel.press('ArrowLeft');
  await expect(lab.getByText('Fixed at the channel', { exact: true })).toBeVisible();
  // Anchored: the live region repeats the whole feedback a moment later.
  await expect(
    lab.getByText(/^A blend can add up to two more lights and reach the red\. Keep CH1 on the first orange/),
  ).toBeVisible();

  await lab.getByRole('button', { name: 'Next: recording level too high' }).click();
  await expect(step).toContainText('Step 3 of 3');
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'red');
  const knob = lab.getByRole('slider', { name: 'Recording level' });
  // Green at −4 dB stops the overload, but leaves no room for a blend: the title says only that.
  for (let i = 0; i < 4; i++) await knob.press('ArrowLeft');
  await expect(lab.getByText('Overload stopped', { exact: true })).toBeVisible();
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'green');
  // With room for a blend, it is fixed.
  for (let i = 0; i < 5; i++) await knob.press('ArrowLeft');
  await expect(lab.getByText('Fixed with the recording level', { exact: true })).toBeVisible();
  // The last step: only the way back.
  await expect(lab.locator('.nav').getByRole('button')).toHaveText(['Back']);
});

test('the Howler light stops blinking within 5 seconds', async ({ page }) => {
  // Infinity for a light that never stops, 0 once it has stopped or with reduced motion.
  const blinkEnds = (lab: Locator) =>
    lab
      .locator('.howler .led')
      .evaluate((led) => Math.max(0, ...led.getAnimations().map((a) => Number(a.effect?.getComputedTiming().endTime))));

  const lab = await openLab(page);
  expect(await blinkEnds(lab)).toBeLessThanOrEqual(5000);
  // Up to the Howler's limit, the light turns red and starts a fresh blink, just as short.
  const knob = lab.getByRole('slider', { name: 'Recording level' });
  for (let i = 0; i < 6; i++) await knob.press('ArrowRight');
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'red');
  expect(await blinkEnds(lab)).toBeLessThanOrEqual(5000);
});
