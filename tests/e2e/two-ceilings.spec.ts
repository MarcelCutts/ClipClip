import { expect, type Locator, type Page, test } from '@playwright/test';

// The two-ceilings lab, in the guide at #two-ceilings. The prediction step keeps its outcome back
// until the guess is in, the knob challenge can't be skipped past its lesson and only starts its
// clock once the knob moves, and the Howler light never blinks for longer than WCAG 2.2.2 allows.

async function openLab(page: Page, query = ''): Promise<Locator> {
  await page.goto(`${query}#two-ceilings`);
  const lab = page.locator('.two-ceilings');
  await lab.scrollIntoViewIfNeeded();
  // Islands hydrate as they scroll into view, and Astro drops `ssr` once this one has.
  await expect(page.locator('astro-island:has(.two-ceilings)')).not.toHaveAttribute('ssr');
  return lab;
}

/** Answer the prediction and move on to the knob challenge. */
async function toChallenge(lab: Locator): Promise<void> {
  await lab.getByLabel('Goes away').check();
  await lab.getByLabel('Certain').check();
  await lab.locator('.nav').getByRole('button', { name: 'Next', exact: true }).click();
  // The step titles sit one level under the guide's "Two ceilings".
  await expect(lab.getByRole('heading', { level: 4 })).toContainText('Step 2 of 5');
}

test('the prediction keeps its outcome back, with the Listen key where it asks you to listen', async ({ page }) => {
  const lab = await openLab(page);
  const strip = lab.locator('.strip');

  // The channel's red is the question, so it shows. The crunch and the Howler light wait.
  await expect(strip.getByRole('meter', { name: 'CH1 level' })).toHaveAttribute('aria-valuetext', /in the red/);
  await expect(strip.getByText('Guess first')).toHaveCount(2);
  await expect(lab.locator('[data-crunch], .howler')).toHaveCount(0);
  // Only the mixer's screen: the recording's comes in when it first matters.
  await expect(lab.getByText('In the recording', { exact: true })).toHaveCount(0);
  await expect(lab.locator('.head').getByRole('button', { name: 'Listen' })).toBeVisible();

  // Picking an answer doesn't show the outcome either: it could still be changed.
  await lab.getByLabel('Goes away').check();
  await expect(strip.getByText('Press Next')).toHaveCount(2);
  await expect(lab.locator('[data-crunch]')).toHaveCount(0);
});

test('the knob challenge shows its lesson before moving on', async ({ page }) => {
  const lab = await openLab(page);
  const step = lab.getByRole('heading', { level: 4 });
  // The way forward in the nav. It lights once the knob has been tried, and goes dark when the
  // feedback box offers its own Next.
  const key = lab.locator('.nav').getByRole('button', { name: /^(Next|Show me what happens)$/ });

  await toChallenge(lab);
  // The knob is the thing to do: the reveal key waits unlit, and only the knob carries its hint.
  await expect(key).toHaveText('Show me what happens');
  await expect(key).not.toHaveClass(/primary/);
  // MASTER LEVEL stays taped on the night, so the knob's hint first says it stands for the record level.
  await expect(lab.getByText(/^On the night, MASTER LEVEL stays taped fully up\./)).toBeVisible();
  await expect(lab.getByText(/^How loud the track peaks/)).toHaveCount(0);
  await expect(lab.locator('[data-crunch]')).toHaveText('Heavy crunch');

  // Moving on without trying the knob still ends the challenge in its reveal, in view on a phone.
  await key.click();
  // Exact: the live region repeats the whole reveal a moment later.
  await expect(lab.getByText('Quieter, still crunchy', { exact: true })).toBeInViewport();
  await expect(lab.getByText(/^You were certain it would go away\./)).toBeVisible();
  await expect(step).toContainText('Step 2 of 5');
  await expect(key).toHaveText('Next');
  // Only one lit key at a time: the feedback box's.
  await expect(lab.locator('.key.primary')).toHaveCount(1);
  await expect(lab.getByRole('button', { name: 'Next: fix it for real' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(step).toContainText('Now fix it for real');
  await expect(step).toBeFocused();
});

test('the knob challenge starts its clock on the first knob move', async ({ page }) => {
  await page.clock.install();
  const lab = await openLab(page);
  await toChallenge(lab);
  const reveal = lab.getByText('Quieter, still crunchy', { exact: true });

  // Reading the step takes as long as it takes.
  await page.clock.runFor(60_000);
  await expect(reveal).toHaveCount(0);

  // One move lights the reveal key and starts the clock.
  await lab.getByRole('slider', { name: 'Record level (MASTER LEVEL)' }).press('ArrowLeft');
  await expect(lab.locator('.nav').getByRole('button', { name: 'Show me what happens' })).toHaveClass(/primary/);
  await page.clock.runFor(21_000);
  await expect(reveal).toBeVisible();
});

test('after the last fix, a quick check puts the two ceilings side by side', async ({ page }) => {
  // Free play's Back leads to step 4, with the record level fully up and the Howler red.
  const lab = await openLab(page, '?lab=sandbox');
  await lab.locator('.nav').getByRole('button', { name: 'Back' }).click();
  await expect(lab.getByRole('heading', { level: 4 })).toContainText('Record level too high');
  const knob = lab.getByRole('slider', { name: 'Record level (MASTER LEVEL)' });
  for (let i = 0; i < 4; i++) await knob.press('ArrowLeft');
  await expect(lab.getByText('Fixed with the record level alone', { exact: true })).toBeVisible();

  // Until it's answered, Check is the one lit key.
  await expect(lab.locator('.key.primary')).toHaveText('Check');
  const row = (name: string) => lab.getByRole('group', { name });
  await row('Crunch made in the mixer').getByRole('button', { name: 'Channel', exact: true }).click();
  await row('Crunch made at the recorder').getByRole('button', { name: 'Channel', exact: true }).click();
  await row('Crunch made at the recorder').getByRole('button', { name: 'Record level', exact: true }).click();
  await lab.getByRole('button', { name: 'Check', exact: true }).click();

  // Focus goes to the answers, so they're read out once.
  const answers = lab.locator('.answers');
  await expect(answers).toBeFocused();
  await expect(answers).toContainText('In the mixer: Right.');
  await expect(answers).toContainText('At the recorder: Right.');
  await expect(lab.locator('.key.primary')).toHaveText('Next: free play');
});

test('the Howler light stops blinking within 5 seconds', async ({ page }) => {
  // Infinity for a light that never stops, 0 once it has stopped or with reduced motion.
  const blinkEnds = (lab: Locator) =>
    lab
      .locator('.howler .led')
      .evaluate((led) => Math.max(0, ...led.getAnimations().map((a) => Number(a.effect?.getComputedTiming().endTime))));

  const lab = await openLab(page, '?lab=sandbox&preset=channels-red');
  expect(await blinkEnds(lab)).toBeLessThanOrEqual(5000);
  // Turning the light red starts a fresh blink, just as short.
  await lab.getByRole('button', { name: 'Record level too high' }).click();
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'red');
  expect(await blinkEnds(lab)).toBeLessThanOrEqual(5000);
});
