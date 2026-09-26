import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MeterCheck from '../../src/islands/MeterCheck.svelte';
import Predict from '../../src/islands/Predict.svelte';
import MeterPicture from '../../src/islands/quiz/MeterBridge.svelte';

test('a meter check answer commits on "How sure are you?", then locks and marks itself in words', async () => {
  const screen = await render(MeterCheck);
  await screen.getByRole('radio', { name: 'In the recorder' }).click();
  const certain = screen.getByRole('button', { name: 'Certain' });
  await expect.element(certain).toHaveAttribute('aria-pressed', 'false');
  await certain.click();

  await expect.element(certain).toHaveAttribute('aria-pressed', 'true');
  await expect.element(certain).toHaveAttribute('aria-disabled', 'true');
  await expect.element(certain).toHaveAttribute('tabindex', '-1');
  for (const radio of screen.getByRole('radio').elements()) expect(radio).toBeDisabled();
  await expect.element(screen.getByText('Your answer')).toBeVisible();
  await expect.element(screen.getByText('Right answer')).toBeVisible();
  await expect.element(screen.getByRole('status')).toMatchTextContent(/^Not quite\. A green light/);
  // The way on is the lit key; the rest stay rubber.
  await expect.element(screen.getByRole('button', { name: 'Next question' })).toHaveClass('primary');
});

test('the meter check counts its questions in words, with no progress dots beside them', async () => {
  const screen = await render(MeterCheck);
  await expect.element(screen.getByText('Question 1 of 5')).toBeVisible();
  expect(screen.container.querySelector('.pips')).toBeNull();
  // The Howler is drawn, and named for screen readers with its light's state.
  await expect.element(screen.getByRole('img', { name: 'The Howler recorder, its LEVEL light green.' })).toBeVisible();
});

test('a sure bet on "Goes away" gets its surprise named, on screen and in the announcement', async () => {
  const screen = await render(Predict);
  await screen.getByRole('radio', { name: 'Goes away' }).click();
  await screen.getByRole('button', { name: 'Certain' }).click();
  const line =
    'You were certain it would go away. A confident wrong guess is the kind people remember once it’s put right.';
  await expect.element(screen.getByText(line)).toBeVisible();
  await expect.element(screen.getByRole('status')).toMatchTextContent(line);
});

test('a guess on "Goes away" gets no surprise line', async () => {
  const screen = await render(Predict);
  await screen.getByRole('radio', { name: 'Goes away' }).click();
  await screen.getByRole('button', { name: 'Guessing' }).click();
  await expect.element(screen.getByRole('status')).toMatchTextContent(/^Not quite\./);
  expect(screen.container.textContent).not.toContain('confident wrong guess');
});

test('a sure right answer gets no surprise line', async () => {
  const screen = await render(Predict);
  await screen.getByRole('radio', { name: 'Gets quieter but stays' }).click();
  await screen.getByRole('button', { name: 'Certain' }).click();
  await expect.element(screen.getByRole('status')).toMatchTextContent(/^Right\./);
  expect(screen.container.textContent).not.toContain('confident wrong guess');
});

test('"Not sure" skips the bet: one lit key reveals the answer, then locks', async () => {
  const screen = await render(Predict);
  await screen.getByRole('radio', { name: 'Not sure' }).click();
  const show = screen.getByRole('button', { name: 'Show me what happens' });
  await expect.element(show).toHaveClass('primary');
  await show.click();
  await expect.element(show).toHaveAttribute('aria-disabled', 'true');
  await expect.element(screen.getByRole('status')).toMatchTextContent(/^It gets quieter/);
});

test('the prediction and the meter check are printed cards, with black kept for the gear', async () => {
  const predict = await render(Predict);
  expect(predict.container.querySelector('.panel')).toBeNull();
  await expect.element(predict.getByText('Crunch in the recording')).toBeVisible();
  expect(predict.container.textContent).not.toContain('Quick question');
  const check = await render(MeterCheck);
  expect(check.container.querySelector('.panel')).toBeNull();
  // The Howler is gear, so it sits on a scrap of black faceplate on the card.
  await expect.element(check.getByRole('img', { name: /Howler recorder/ })).toBeVisible();
  expect(check.container.querySelector('.plate [role="img"]')).not.toBeNull();
});

test('a chosen answer says so in words and shapes once it’s in, not by colour alone', async () => {
  const screen = await render(MeterCheck);
  await screen.getByRole('radio', { name: 'Inside the mixer, before the outputs' }).click();
  await screen.getByRole('button', { name: 'Guessing' }).click();
  // The right answer's row carries its mark in words, and the radio's name says it too.
  await expect.element(screen.getByRole('radio', { name: /Inside the mixer.*Right answer/ })).toBeChecked();
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

test('the hidden middle meters stay dark, and say so, until the answer is in', async () => {
  const screen = await render(MeterPicture, { ch1: 6, master: 12, ch2: 6, hideMaster: true });
  await expect
    .element(screen.getByRole('meter', { name: 'MASTER level' }))
    .toHaveAttribute('aria-valuetext', 'MASTER: hidden until you answer');
  expect(screen.container.querySelectorAll('.ml[data-on="true"]')).toHaveLength(0);
  expect(screen.container.querySelector('.unknown')?.textContent).toBe('?');
});
