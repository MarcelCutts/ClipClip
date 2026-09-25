import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MeterCheck from '../../src/islands/MeterCheck.svelte';
import Predict from '../../src/islands/Predict.svelte';

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
  await screen.getByRole('radio', { name: 'Gets quieter, stays' }).click();
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
