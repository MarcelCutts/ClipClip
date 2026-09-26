import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MeterCheck from '../../src/islands/MeterCheck.svelte';
import MeterPicture from '../../src/islands/quiz/MeterBridge.svelte';

test('a meter check answer commits on "How sure are you?", then locks and marks itself in words', async () => {
  const screen = await render(MeterCheck);
  await screen.getByRole('radio', { name: 'The second orange, on every kick' }).click();
  const certain = screen.getByRole('button', { name: 'Certain' });
  await expect.element(certain).toHaveAttribute('aria-pressed', 'false');
  await certain.click();

  await expect.element(certain).toHaveAttribute('aria-pressed', 'true');
  await expect.element(certain).toHaveAttribute('aria-disabled', 'true');
  await expect.element(certain).toHaveAttribute('tabindex', '-1');
  for (const radio of screen.getByRole('radio').elements()) expect(radio).toBeDisabled();
  await expect.element(screen.getByText('Your answer')).toBeVisible();
  await expect.element(screen.getByText('Right answer')).toBeVisible();
  await expect.element(screen.getByRole('status')).toMatchTextContent(/^Not quite\. A blend can add/);
  // The way on is the lit key; the rest stay rubber.
  await expect.element(screen.getByRole('button', { name: 'Next question' })).toHaveClass('primary');
});

test('the meter check counts its questions in words, with no progress dots beside them', async () => {
  const screen = await render(MeterCheck);
  await expect.element(screen.getByText('Question 1 of 4')).toBeVisible();
  expect(screen.container.querySelector('.pips')).toBeNull();
  // The guide's heading carries the anchor the group chat links to, so the card has no id of its own.
  expect(screen.container.querySelector('#check')).toBeNull();
});

test('the meter check links each answer to its section, and ends on the score and what to read again', async () => {
  const screen = await render(MeterCheck);
  const answers = [
    'A flash of red on the loudest hits',
    'The MASTER meters (the pair in the middle)',
    'Ask the crew',
    'Turn up BOOTH MONITOR',
  ];
  for (const [i, answer] of answers.entries()) {
    await screen.getByRole('radio', { name: answer }).click();
    await screen.getByRole('button', { name: i === 0 ? 'Certain' : 'Fairly sure' }).click();
    await expect.element(screen.getByRole('link', { name: /^2\.\d / })).toBeVisible();
    await screen.getByRole('button', { name: i === answers.length - 1 ? 'See your score' : 'Next question' }).click();
  }
  await expect.element(screen.getByText('You got 3 of 4.')).toBeVisible();
  await expect.element(screen.getByText('You were certain of one wrong answer.')).toBeVisible();
  await expect.element(screen.getByText('Read these again')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: /^2\.1 / })).toBeVisible();
});

test('the meter check is a printed card, with black kept for the gear', async () => {
  const check = await render(MeterCheck);
  expect(check.container.querySelector('.panel')).toBeNull();
  // The meters are gear, so on the second card they sit on a scrap of black faceplate.
  await check.getByRole('radio', { name: 'The first orange (0)' }).click();
  await check.getByRole('button', { name: 'Guessing' }).click();
  await check.getByRole('button', { name: 'Next question' }).click();
  await expect.element(check.getByRole('meter', { name: 'MASTER level' })).toBeInTheDocument();
  expect(check.container.querySelector('.plate [role="group"]')).not.toBeNull();
});

test('a chosen answer says so in words and shapes once it’s in, not by colour alone', async () => {
  const screen = await render(MeterCheck);
  await screen.getByRole('radio', { name: 'The first orange (0)' }).click();
  await screen.getByRole('button', { name: 'Guessing' }).click();
  // The right answer's row carries its mark in words, and the radio's name says it too.
  await expect.element(screen.getByRole('radio', { name: /first orange \(0\).*Right answer/ })).toBeChecked();
  expect(screen.container.textContent).not.toContain('Your answer');
  await expect.element(screen.getByRole('status')).toMatchTextContent(/^Right\. /);
});

test('the meter pictures print the panel’s scale, with a break where the colours change', async () => {
  const screen = await render(MeterPicture, { ch1: 6, master: 12, ch2: 6 });
  const scale = [...screen.container.querySelectorAll('.s1')].map((t) => t.textContent);
  expect(scale).toEqual(['+12', '+9', '+6', '+3', '0', '−3', '−6', '−9', '−12', '−15', '−18', '−24']);
  // The printed break sits above the first row of each new colour: orange under red, green under orange.
  expect([...screen.container.querySelectorAll('.s1.cut')].map((t) => t.textContent)).toEqual(['+9', '−3']);
  const zero = screen.container.querySelector<HTMLElement>('.s1.zero');
  expect(zero && Number(getComputedStyle(zero).fontWeight)).toBeGreaterThanOrEqual(700);
  // Every reading reaches screen readers in words.
  const master = screen.getByRole('meter', { name: 'MASTER level' });
  await expect
    .element(master)
    .toHaveAttribute('aria-valuetext', expect.stringMatching(/^MASTER: peaks at \+12.*in the red$/));
});
