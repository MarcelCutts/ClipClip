import { expect, type Locator, type Page, test } from '@playwright/test';

// The two-ceilings lab, on Learn at #two-ceilings. It is laid out in the order the sound travels:
// the mixer, the Howler, the file. Each of the first two holds its own control, its own light and
// its own screen. Four steps. Two ask before they show: what colour is the Howler's light, and can
// the recording level remove the crunch. Then one live control a step; the other shows as a
// reading, never as a dead fader. Step 2 cannot be won and always ends in its answer; its clock
// only starts once the recording level moves. The arrow keys move the live control a decibel at a
// time, and the Howler light never blinks for longer than WCAG 2.2.2 allows.

async function openLab(page: Page): Promise<Locator> {
  await page.goto('learn/#two-ceilings');
  const lab = page.locator('.two-ceilings');
  await lab.scrollIntoViewIfNeeded();
  // Islands hydrate as they scroll into view, and Astro drops `ssr` once this one has.
  await expect(page.locator('astro-island:has(.two-ceilings)')).not.toHaveAttribute('ssr');
  return lab;
}

/** Past the first question, to step 2, which opens on its own. */
async function toStep2(lab: Locator) {
  await lab.getByRole('button', { name: 'Show the answer' }).click();
  await lab.getByRole('button', { name: 'Next: try the recording level' }).click();
  await expect(lab.getByRole('heading', { level: 4 })).toContainText('Step 2 of 4');
}

/** Step 2's question answered: the recording level is the reader's to try. */
async function toTry(lab: Locator, said: 'Yes' | 'No' = 'Yes'): Promise<Locator> {
  await toStep2(lab);
  await lab.getByRole('button', { name: said, exact: true }).click();
  const knob = lab.getByRole('slider', { name: 'Recording level' });
  await expect(knob).toBeFocused();
  return knob;
}

test('each reading sits in the stage it measures, in the order the sound travels', async ({ page }) => {
  const lab = await openLab(page);
  await lab.getByRole('button', { name: 'Show the answer' }).click();
  const stages = lab.getByRole('list', { name: 'The chain this lab follows' }).locator('> li');
  await expect(stages).toHaveCount(3);
  const [mixer, howler, file] = [stages.nth(0), stages.nth(1), stages.nth(2)];
  // The stages' names sit one level under the step's title, numbered in the order the sound reaches them.
  await expect(mixer.getByRole('heading', { level: 5 })).toHaveAccessibleName('1. Mixer');
  await expect(howler.getByRole('heading', { level: 5 })).toHaveAccessibleName('2. Howler');
  await expect(file.getByRole('heading', { level: 5 })).toHaveAccessibleName('3. File');
  // The mixer: the channel, CH1's lights, the wave inside the mixer.
  await expect(mixer.locator('.reading')).toContainText('Channel (TRIM and EQ)');
  await expect(mixer.getByRole('meter', { name: 'CH1 level' })).toHaveCount(1);
  await expect(mixer.locator('figure')).toContainText('Inside the mixer');
  // The Howler: the recording level, its LEVEL light, the wave at its input.
  await expect(howler.locator('.reading')).toContainText('Recording level');
  await expect(howler.locator('.howler .led')).toHaveCount(1);
  await expect(howler.locator('figure')).toContainText('Into the Howler');
  // The file: the crunch, where it was made, and the sound.
  await expect(file.locator('[data-crunch]')).toHaveText('Crunchy');
  await expect(file.getByText(/^Made in the mixer\. Tops cut by 6\sdB\.$/)).toBeVisible();
  await expect(file.getByRole('button', { name: 'Listen' })).toHaveCount(1);
  // No reading sits in another stage.
  await expect(mixer.locator('span.howler, [data-crunch]')).toHaveCount(0);
  await expect(howler.getByRole('meter')).toHaveCount(0);

  // Side by side where there is room, with screen beside screen; one under the other on a phone.
  const [a, b] = [await mixer.locator('figure svg').boundingBox(), await howler.locator('figure svg').boundingBox()];
  expect(a && b).toBeTruthy();
  if (a && b) {
    if ((page.viewportSize()?.width ?? 0) >= 1000) {
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
      expect(a.x + a.width).toBeLessThan(b.x);
    } else {
      expect(a.y + a.height).toBeLessThan(b.y);
    }
  }
});

test('the lab asks what colour the light is before it shows it', async ({ page }) => {
  const lab = await openLab(page);
  const step = lab.getByRole('heading', { level: 4 });
  const howler = lab.locator('[data-stage="howler"]');

  await expect(step).toContainText('Step 1 of 4');
  await expect(howler.getByRole('group', { name: 'What colour is the Howler’s LEVEL light?' })).toBeVisible();
  // The file is crunchy, and the reader can see it and hear it before answering.
  await expect(lab.locator('[data-crunch]')).toHaveText('Crunchy');
  // Nothing gives the answer away: no light, no wave at the Howler, no word on its ceiling.
  await expect(howler.locator('.howler .led')).toHaveCount(0);
  await expect(howler.locator('figure .trace')).toHaveCount(0);
  await expect(howler.locator('figure')).toContainText('Answer, and the screen shows what reaches the Howler.');
  await expect(howler.getByText(/under its ceiling|at its ceiling/i)).toHaveCount(0);
  // The step is its question: both controls show where they are set, and neither is a dead fader.
  await expect(lab.getByRole('slider')).toHaveCount(0);
  await expect(lab.locator('[data-stage="mixer"] .reading')).toContainText(/\+18\sdB/);
  await expect(howler.locator('.reading')).toContainText(/−9\sdB/);
  // The model's caveat points to the one place the guide says what the makers leave out.
  const model = lab.locator('.model a');
  await expect(page.locator((await model.getAttribute('href')) ?? 'nowhere')).toHaveCount(1);

  await howler.getByRole('button', { name: 'Red', exact: true }).click();
  // The answer, where the question was: the light, what it measures, and what it leaves out.
  await expect(howler.locator('.howler .led')).toHaveAttribute('data-light', 'green');
  await expect(howler.locator('span.howler')).toContainText('Blinking green');
  await expect(howler.locator('span.howler')).toContainText(/Input 3\sdB under its ceiling/);
  await expect(howler.getByText('It does not show crunch made before it.')).toBeVisible();
  await expect(howler).not.toContainText(/Level OK/);
  // The wave it goes by, with what left the mixer behind it: the same flat tops, made smaller.
  await expect(howler.locator('figure .trace')).toHaveCount(1);
  await expect(howler.locator('figure .before')).toHaveCount(1);
  await expect(howler.locator('figcaption')).toContainText('What left the mixer');
  // Then what was said, what is so and why, under the screen that shows it. Exact: the live region
  // repeats it a moment later.
  await expect(howler.getByText('You said red. It is green', { exact: true })).toBeInViewport();
  await expect(howler.getByText(/^The light is right\./)).toBeVisible();
  await expect(howler.getByText('A green light does not mean a clean recording.', { exact: true })).toBeVisible();
  // Only one lit key at a time: the way on.
  await expect(lab.locator('.key.primary')).toHaveCount(1);
  await expect(lab.getByRole('button', { name: 'Next: try the recording level' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(step).toContainText('Try the recording level');
  await expect(step).toBeFocused();
  // Going back shows the light: the question is asked once.
  await lab.getByRole('button', { name: 'Back' }).click();
  await expect(howler.locator('.howler .led')).toHaveAttribute('data-light', 'green');
});

test('an answer can be asked for without giving one', async ({ page }) => {
  const lab = await openLab(page);
  await lab.getByRole('button', { name: 'Show the answer' }).click();
  await expect(lab.locator('.goal-title')).toHaveText('It is green');
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'green');
});

test('a right answer is said back, with the same reason', async ({ page }) => {
  const lab = await openLab(page);
  await lab.getByRole('button', { name: 'Green', exact: true }).click();
  await expect(lab.locator('.goal-title')).toHaveText('You said green. It is green');
  await expect(lab.getByText(/^The light is right\./)).toBeVisible();
});

test('step 2 asks what the recording level can do, then hands it over to try', async ({ page }) => {
  const lab = await openLab(page);
  await toStep2(lab);
  const step = lab.getByRole('heading', { level: 4 });
  const howler = lab.locator('[data-stage="howler"]');
  // The way on in the nav. It lights once the recording level has been tried, and goes when the
  // answer offers its own Next.
  const key = lab.locator('.nav').getByRole('button', { name: /^(Next|Show the answer)$/ });

  // The question sits with the recording level, which waits for it.
  await expect(howler.getByRole('group', { name: 'Can the recording level remove the crunch?' })).toBeVisible();
  await expect(lab.getByRole('slider')).toHaveCount(0);
  await expect(key).toHaveText('Show the answer');
  await expect(key).not.toHaveClass(/primary/);

  await howler.getByRole('button', { name: 'No', exact: true }).click();
  // Now it is live, and only it: the channel shows as a reading, with no hint.
  const knob = lab.getByRole('slider', { name: 'Recording level' });
  await expect(knob).toBeFocused();
  await expect(lab.getByRole('slider')).toHaveCount(1);
  await expect(lab.getByText(/^How loud the mix goes into the Howler\./)).toBeVisible();
  await expect(lab.getByText(/^How loud the track peaks/)).toHaveCount(0);
  await expect(howler.getByText('Try it. Turn the recording level down, then up.', { exact: true })).toBeVisible();

  // Each try is answered at once, with what it did.
  for (let i = 0; i < 3; i++) await knob.press('ArrowLeft');
  await expect(
    howler.getByText(/^You turned it down 3\sdB\. The flat tops are smaller\. They are still flat\.$/),
  ).toBeVisible();
  await expect(key).toHaveClass(/primary/);

  // Moving on ends the step in its answer, said back.
  await key.click();
  // Exact: the live region repeats the whole answer a moment later.
  await expect(lab.getByText('You said no. It cannot', { exact: true })).toBeInViewport();
  await expect(lab.getByText(/^The LEVEL light follows the recording level\. The crunch does not\.$/)).toBeVisible();
  await expect(step).toContainText('Step 2 of 4');
  await expect(key).toHaveCount(0);
  await expect(lab.locator('.key.primary')).toHaveCount(1);
  await expect(lab.getByRole('button', { name: 'Next: turn the channel down' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(step).toContainText('Turn the channel down');
  await expect(step).toBeFocused();
});

test('step 2’s answer can be asked for without trying', async ({ page }) => {
  const lab = await openLab(page);
  await toStep2(lab);
  await lab.locator('.nav').getByRole('button', { name: 'Show the answer' }).click();
  await expect(lab.getByText('It cannot remove the crunch', { exact: true })).toBeInViewport();
  await expect(lab.getByRole('button', { name: 'Next: turn the channel down' })).toBeFocused();
});

test('step 2 starts its clock on the first move of the recording level', async ({ page }) => {
  await page.clock.install();
  const lab = await openLab(page);
  const knob = await toTry(lab);
  const result = lab.getByText('You said yes. It cannot', { exact: true });

  // Reading the step takes as long as it takes.
  await page.clock.runFor(60_000);
  await expect(result).toHaveCount(0);

  // One move lights the key and starts the clock.
  await knob.press('ArrowLeft');
  await expect(lab.locator('.nav').getByRole('button', { name: 'Show the answer' })).toHaveClass(/primary/);
  await page.clock.runFor(21_000);
  await expect(result).toBeVisible();
});

test('the light follows the recording level a decibel at a time, and the crunch stays', async ({ page }) => {
  const lab = await openLab(page);
  const knob = await toTry(lab);
  const light = lab.locator('span.howler');
  const crunch = lab.locator('[data-crunch]');
  const origin = lab.locator('.origin');

  await expect(light).toContainText(/Input 3\sdB under its ceiling/);
  await knob.press('ArrowLeft');
  await expect(light).toContainText(/Input 4\sdB under its ceiling/);
  await expect(crunch).toHaveText('Crunchy');
  await expect(origin).toHaveText(/^Made in the mixer\. Tops cut by 6\sdB\.$/);
  // Up to the Howler's ceiling and past it: the light turns red, and the flat tops are cut again.
  for (let i = 0; i < 4; i++) await knob.press('ArrowRight');
  await expect(light).toContainText('Input at its ceiling');
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'red');
  await knob.press('ArrowRight');
  await expect(light).toContainText(/Input 1\sdB over its ceiling/);
  await expect(crunch).toHaveText('Crunchy');
  await expect(origin).toHaveText(/^Made in the mixer and at the Howler\. Tops cut by 7\sdB in all\.$/);
});

test('the channel fixes crunch made in the mixer, and the recording level fixes crunch at the Howler', async ({
  page,
}) => {
  const lab = await openLab(page);
  await toStep2(lab);
  const step = lab.getByRole('heading', { level: 4 });
  await lab.locator('.nav').getByRole('button', { name: 'Show the answer' }).click();
  await lab.getByRole('button', { name: 'Next: turn the channel down' }).click();
  await expect(step).toContainText('Step 3 of 4');
  // One fader: the recording level shows where it is set.
  await expect(lab.getByRole('slider')).toHaveCount(1);
  await expect(lab.locator('[data-stage="howler"] .reading')).toContainText(/Recording level\s*−9\sdB/);

  // The arrow keys move the one live control. +18 down to +11: out of the red, but high.
  const channel = lab.getByRole('slider', { name: 'Channel (TRIM and EQ)' });
  for (let i = 0; i < 7; i++) await channel.press('ArrowLeft');
  // What it means is said in the stage the step is about: the mixer's.
  const mixer = lab.locator('[data-stage="mixer"]');
  await expect(mixer.getByText('Fixed at the channel', { exact: true })).toBeVisible();
  // Anchored: the live region repeats the whole feedback a moment later.
  await expect(
    lab.getByText(/^A blend can add up to two more lights and reach the red\. Keep CH1 on the first orange/),
  ).toBeVisible();

  await lab.getByRole('button', { name: 'Next: recording level too high' }).click();
  await expect(step).toContainText('Step 4 of 4');
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'red');
  await expect(lab.locator('.origin')).toHaveText(/^Made at the Howler\./);
  const knob = lab.getByRole('slider', { name: 'Recording level' });
  // Green at −4 dB stops the overload, but leaves no room for a blend: the title says only that.
  for (let i = 0; i < 4; i++) await knob.press('ArrowLeft');
  const howler = lab.locator('[data-stage="howler"]');
  await expect(howler.getByText('Overload stopped', { exact: true })).toBeVisible();
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'green');
  // With room for a blend, it is fixed, and this time the light showed the fault.
  for (let i = 0; i < 5; i++) await knob.press('ArrowLeft');
  await expect(howler.getByText('Fixed with the recording level', { exact: true })).toBeVisible();
  await expect(howler.getByText(/^The LEVEL light showed this crunch\./)).toBeVisible();
  // The lab closes on the two ceilings, a sentence each.
  await expect(howler.getByText('Each light watches its own ceiling', { exact: true })).toBeVisible();
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
  const knob = await toTry(lab);
  expect(await blinkEnds(lab)).toBeLessThanOrEqual(5000);
  // Up to the Howler's ceiling, the light turns red and starts a fresh blink, just as short.
  for (let i = 0; i < 4; i++) await knob.press('ArrowRight');
  await expect(lab.locator('.howler .led')).toHaveAttribute('data-light', 'red');
  expect(await blinkEnds(lab)).toBeLessThanOrEqual(5000);
});

test('the Listen key and the clean pad say what you will hear, before the sound starts', async ({ page }) => {
  const lab = await openLab(page);
  await lab.getByRole('button', { name: 'Show the answer' }).click();
  await expect(lab.getByRole('button', { name: 'Listen' })).toHaveAccessibleDescription(/one steady loudness/);
  await expect(lab.getByRole('button', { name: 'Hear the clean version' })).toHaveAccessibleDescription(
    /Only the crunch changes/,
  );
  // Shown only while playing: nothing has played yet.
  await expect(lab.getByText('You hear the file turned up to one steady loudness.')).toBeHidden();
});

test('a try that ends where it began says nothing, and does not end the step', async ({ page }) => {
  await page.clock.install();
  const lab = await openLab(page);
  const knob = await toTry(lab);
  const howler = lab.locator('[data-stage="howler"]');
  const result = lab.getByText('You said yes. It cannot', { exact: true });
  // In the stage: the live region carries the same words a moment later.
  const tryIt = howler.getByText('Try it. Turn the recording level down, then up.', { exact: true });

  // Twice down and back, each settling as one try: two tries would otherwise end the step.
  for (let i = 0; i < 2; i++) {
    await knob.press('ArrowLeft');
    await knob.press('ArrowRight');
    await page.clock.runFor(700);
  }
  await expect(tryIt).toBeVisible();
  await expect(result).toHaveCount(0);

  // The first real move is the first try.
  await knob.press('ArrowLeft');
  await page.clock.runFor(700);
  await expect(lab.getByText(/^You turned it down 1\sdB\./)).toBeVisible();
  await expect(result).toHaveCount(0);
});

test('after step 2’s answer, each later try is read out, and the arrow does not come back', async ({ page }) => {
  await page.clock.install();
  const lab = await openLab(page);
  const knob = await toTry(lab);
  const live = lab.locator('[aria-live]');
  const result = lab.getByText('You said yes. It cannot', { exact: true });

  // Two tries end the step in its answer, which the live region reads.
  for (let i = 0; i < 2; i++) {
    await knob.press('ArrowLeft');
    await page.clock.runFor(700);
  }
  await expect(result).toBeVisible();
  await page.clock.runFor(500);
  await expect(live).toContainText('You said yes. It cannot.');

  // A later try is read out, with what it did, while the answer holds on screen.
  await knob.press('ArrowRight');
  await page.clock.runFor(1200);
  await expect(result).toBeVisible();
  await expect(live).toContainText(/^You turned it up 1\sdB\. The flat tops are bigger\. They are still flat\.$/);

  // Forward, then back: the answer is already on screen, so nothing points at the recording level.
  await lab.getByRole('button', { name: 'Next: turn the channel down' }).click();
  await expect(lab.locator('.control.cue')).toHaveCount(0);
  await lab.getByRole('button', { name: 'Back' }).click();
  await expect(result).toBeVisible();
  await expect(lab.locator('.control.cue')).toHaveCount(0);
});
