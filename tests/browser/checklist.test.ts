import { flushSync, mount, unmount } from 'svelte';
import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../src/styles/tokens.css';
import Checklist from '../../src/islands/Checklist.svelte';
import {
  CHECKLIST_ORDER,
  CHECKLISTS,
  type ChecklistId,
  HOWLER_RED_FIRST_ACTION,
  progressText,
  serialiseTicks,
  storageKey,
} from '../../src/lib/checklists';
import { clockTime, TICK_LIFETIMES } from '../../src/lib/checklistTimes';

const MINUTE = 60_000;
const ids = (list: ChecklistId) => CHECKLISTS[list].items.map((item) => item.id);
const save = (list: ChecklistId, done: string[], at: number) =>
  localStorage.setItem(storageKey(list), serialiseTicks(done, at));
const saved = (list: ChecklistId): { at: number; done: string[] } | null =>
  JSON.parse(localStorage.getItem(storageKey(list)) ?? 'null');

/**
 * A list whose boxes are on the page but whose island hasn't woken up: mount() leaves effects, onMount
 * included, until the next flush. `wake()` runs them.
 */
function asleep(list: ChecklistId) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Checklist, { target, props: { list } });
  return {
    panel: target.querySelector<HTMLElement>('.checklist')!,
    boxes: [...target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')],
    wake: () => flushSync(),
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

/** A colour token as the browser resolves it, to compare with computed colours. */
function token(name: string, property: 'color' | 'backgroundColor' = 'color'): string {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style[property] = `var(${name})`;
  const colour = getComputedStyle(probe)[property];
  probe.remove();
  return colour;
}

beforeEach(() => {
  for (const list of CHECKLIST_ORDER) localStorage.removeItem(storageKey(list));
});

/**
 * The Clear ticks key's name: "Clear ticks, Before doors". The list's name is in a visually hidden span,
 * which Chromium sets apart with a space, as it does the site's other "See 2.1, …" names.
 */
const clearTicks = (title: string) => new RegExp(`^Clear ticks ?, ${title}$`);

/** A list's name, as its title strip gives it: "C3 End of the night". */
const nameOf = (list: ChecklistId) => `${CHECKLISTS[list].code} ${CHECKLISTS[list].title}`;

test('a checklist is a named list under its own heading, not another landmark', async () => {
  const screen = await render(Checklist, { list: 'after' });
  const { items } = CHECKLISTS.after;
  await expect.element(screen.getByRole('heading', { level: 3, name: nameOf('after'), exact: true })).toBeVisible();
  await expect.element(screen.getByRole('list', { name: nameOf('after'), exact: true })).toBeVisible();
  expect(screen.getByRole('checkbox').elements()).toHaveLength(items.length);
  // The page's sections are the landmarks.
  expect(screen.getByRole('region').elements()).toHaveLength(0);
});

test('links from the group chat land on each list', async () => {
  for (const list of CHECKLIST_ORDER) {
    const screen = await render(Checklist, { list });
    expect(document.getElementById(CHECKLISTS[list].anchor)?.querySelector('h3')?.textContent).toBe(nameOf(list));
    await screen.unmount();
  }
});

test('its title strip carries the list’s code, and the line under it says when to run it, nothing more', async () => {
  const screen = await render(Checklist, { list: 'doors' });
  const strip = screen.container.querySelector('.strip')!;
  expect(strip.querySelector('.code')?.textContent).toBe('C1');
  // Read-and-do, for one person: no time budget on the strip, no method to learn, no call to say.
  expect(strip.textContent?.trim()).toBe(`C1 ${CHECKLISTS.doors.title}`);
  expect(screen.container.querySelector('.when')?.textContent).toBe(CHECKLISTS.doors.when);
  expect(screen.container.textContent).not.toMatch(/from memory|read down|Under a minute|Say: “[^”]*complete/);
});

test('is a printed card, in the page’s colours, not a hardware panel', async () => {
  const screen = await render(Checklist, { list: 'changeover' });
  const card = screen.container.querySelector<HTMLElement>('.checklist')!;
  expect(card.classList.contains('panel')).toBe(false);
  expect(getComputedStyle(card).backgroundColor).toBe(token('--paper', 'backgroundColor'));
  const strip = card.querySelector<HTMLElement>('.strip')!;
  expect(getComputedStyle(strip).backgroundColor).toBe(token('--strip', 'backgroundColor'));
  expect(getComputedStyle(strip).color).toBe(token('--on-strip'));
});

test('keeps ticks made before the island woke up, alongside the saved ones', () => {
  const [first, , third] = ids('doors');
  const total = ids('doors').length;
  const earlier = Date.now() - 60 * MINUTE;
  save('doors', [first!], earlier);
  const list = asleep('doors');
  try {
    // Ticked while the page was still loading.
    list.boxes[2]!.checked = true;
    list.wake();
    expect(list.boxes.map((box) => box.checked)).toEqual(ids('doors').map((id) => id === first || id === third));
    expect(list.panel.querySelector('.count')?.textContent?.trim()).toBe(progressText(2, total));
    expect(saved('doors')?.done).toEqual([first, third]);
    expect(saved('doors')?.at).toBeGreaterThan(earlier);
  } finally {
    list.close();
  }
});

test('waking up moves nothing, and the count never disagrees with the boxes', () => {
  const list = asleep('doors');
  try {
    const count = list.panel.querySelector<HTMLElement>('.count')!;
    const kept = list.panel.querySelector<HTMLElement>('.kept')!;
    // The line is there from the start, but it isn't true until the island can keep ticks.
    expect(kept.textContent).toMatch(/Ticks stay on this device/);
    expect(getComputedStyle(kept).visibility).toBe('hidden');
    list.boxes[0]!.checked = true;
    // "0 of 7 done" can't follow the box yet, so it gives way.
    expect(getComputedStyle(count).visibility).toBe('hidden');
    const height = list.panel.getBoundingClientRect().height;
    list.wake();
    expect(getComputedStyle(count).visibility).toBe('visible');
    expect(count.textContent?.trim()).toBe(progressText(1, ids('doors').length));
    expect(getComputedStyle(kept).visibility).toBe('visible');
    expect(list.panel.getBoundingClientRect().height).toBe(height);
  } finally {
    list.close();
  }
});

test('a changeover forgets its ticks after 30 minutes', async () => {
  save('changeover', ids('changeover'), Date.now() - 31 * MINUTE);
  const screen = await render(Checklist, { list: 'changeover' });
  await expect.element(screen.getByText(progressText(0, ids('changeover').length))).toBeVisible();
  await expect.element(screen.getByText(/^Ticks stay on this device for 30.minutes\.$/)).toBeVisible();
  expect(screen.getByText(/^Last run/).query()).toBeNull();
});

test('doors ticks last the night', async () => {
  save('doors', ids('doors').slice(0, 1), Date.now() - 31 * MINUTE);
  const screen = await render(Checklist, { list: 'doors' });
  await expect.element(screen.getByText(progressText(1, ids('doors').length))).toBeVisible();
  await expect.element(screen.getByText(/^Ticks stay on this device for 12.hours\.$/)).toBeVisible();
});

test('a finished changeover says when it ran, and starts the next one on request', async () => {
  const total = ids('changeover').length;
  const finished = Date.now() - 10 * MINUTE;
  save('changeover', ids('changeover'), finished);
  const screen = await render(Checklist, { list: 'changeover' });
  await expect.element(screen.getByText(`Last run ${clockTime(finished)}`)).toBeVisible();
  await expect.element(screen.getByText(progressText(total, total))).toBeVisible();

  await screen.getByRole('button', { name: 'Start the next changeover' }).click();
  await expect.element(screen.getByText(progressText(0, total))).toBeVisible();
  await expect.element(screen.getByRole('checkbox').first()).toHaveFocus();
  expect(screen.getByText(/^Last run/).query()).toBeNull();
  expect(saved('changeover')).toBeNull();

  // Pressed by mistake: Undo brings the last run back as it was.
  await expect.element(screen.getByText('Ticks cleared.')).toBeVisible();
  await screen.getByRole('button', { name: 'Undo clear ticks, Changeover' }).click();
  await expect.element(screen.getByText(`Last run ${clockTime(finished)}`)).toBeVisible();
  expect(saved('changeover')).toEqual({ at: finished, done: ids('changeover') });
});

test('an open page catches up when you come back to it', async () => {
  const total = ids('changeover').length;
  const screen = await render(Checklist, { list: 'changeover' });
  for (const box of screen.getByRole('checkbox').all()) await box.click();
  // Just finished: the count is the news, not when it ran.
  await expect.element(screen.getByRole('status').first()).toHaveTextContent(progressText(total, total));
  expect(screen.getByText(/^Last run/).query()).toBeNull();

  // Back for the next changeover, a set later: this one was the last run.
  document.dispatchEvent(new Event('visibilitychange'));
  await expect.element(screen.getByRole('button', { name: 'Start the next changeover' })).toBeVisible();

  // Back after half an hour or more: the ticks have gone.
  save('changeover', ids('changeover'), Date.now() - 31 * MINUTE);
  document.dispatchEvent(new Event('visibilitychange'));
  await expect.element(screen.getByText(progressText(0, total))).toBeVisible();
});

test('Clear ticks can be undone: Undo takes its place, focus and all, and says so politely', async () => {
  const total = ids('doors').length;
  const screen = await render(Checklist, { list: 'doors' });
  await screen.getByRole('checkbox').nth(0).click();
  await screen.getByRole('checkbox').nth(1).click();
  await expect.element(screen.getByText(progressText(2, total))).toBeVisible();
  const before = saved('doors');

  screen
    .getByRole('button', { name: clearTicks('Before doors') })
    .element()
    .focus();
  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByText(progressText(0, total))).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Undo clear ticks, Before doors' })).toHaveFocus();
  await expect.element(screen.getByText('Ticks cleared.')).toHaveAttribute('role', 'status');
  expect(saved('doors')).toBeNull();

  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByText(progressText(2, total))).toBeVisible();
  await expect.element(screen.getByRole('button', { name: clearTicks('Before doors') })).toHaveFocus();
  // Their time comes back too, so the ticks' lifetime doesn't start again.
  expect(saved('doors')).toEqual(before);
  expect(screen.getByText('Ticks cleared.').query()).toBeNull();
});

test('Undo has no time limit: it stays until the next tick', async () => {
  const screen = await render(Checklist, { list: 'doors' });
  const undo = screen.getByRole('button', { name: 'Undo clear ticks, Before doors' });
  const clear = screen.getByRole('button', { name: clearTicks('Before doors') });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    (screen.getByRole('checkbox').first().element() as HTMLElement).click();
    flushSync();
    (clear.element() as HTMLElement).click();
    flushSync();
    expect(undo.query()).not.toBeNull();
    // A crew member called away mid-list comes back to it minutes later.
    vi.advanceTimersByTime(10 * MINUTE);
    flushSync();
    expect(undo.query()).not.toBeNull();
    expect(screen.getByText('Ticks cleared.').query()).not.toBeNull();
    // The next tick starts afresh, and Clear ticks is back.
    (screen.getByRole('checkbox').nth(1).element() as HTMLElement).click();
    flushSync();
    expect(undo.query()).toBeNull();
    expect(clear.query()).not.toBeNull();
    expect(screen.getByText('Ticks cleared.').query()).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('Undo goes once the cleared ticks would have gone anyway', async () => {
  const screen = await render(Checklist, { list: 'changeover' });
  const undo = screen.getByRole('button', { name: 'Undo clear ticks, Changeover' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  try {
    (screen.getByRole('checkbox').first().element() as HTMLElement).click();
    flushSync();
    (screen.getByRole('button', { name: clearTicks('Changeover') }).element() as HTMLElement).click();
    flushSync();
    expect(undo.query()).not.toBeNull();
    vi.advanceTimersByTime(TICK_LIFETIMES.changeover + 2_000);
    flushSync();
    await expect.poll(() => undo.query()).toBeNull();
    expect(screen.getByRole('button', { name: clearTicks('Changeover') }).query()).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('the Howler line gives the first action for a red light, then sends the crew to F1', async () => {
  const screen = await render(Checklist, { list: 'changeover' });
  const link = screen.getByRole('link', { name: 'go to F1' });
  await expect.element(link).toBeVisible();
  expect(link.element().getAttribute('href')).toMatch(/\/night\/#fix-howler-red$/);
  // The note describes its box, so a screen reader hears what to do with the line.
  const box = screen.getByRole('checkbox').first();
  await expect
    .element(box)
    .toHaveAccessibleDescription(
      `${HOWLER_RED_FIRST_ACTION} If they are red, say to the DJ: “Pull a channel fader down a little.” If they are below red, go to F1.`,
    );
  // The link sits outside the row's label: following it never ticks the box.
  expect(link.element().closest('label')).toBeNull();
});

test('a note and its drill are set apart as sentences of their own', async () => {
  const screen = await render(Checklist, { list: 'changeover' });
  const note = [...screen.container.querySelectorAll('.item-note')].find((el) =>
    el.textContent?.includes('MY SETTINGS'),
  );
  expect(note?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'Say: “Keep the channel meters on the first orange (0) at the loudest part. For a louder room, ask the crew.” If the DJ loads MY SETTINGS, go to F7.',
  );
});

test('C1 shows a drawing only where the page hands one in, before the line it serves', async () => {
  // The island draws nothing of its own: on the night page each drawing arrives as a slot (night/index.astro).
  const screen = await render(Checklist, { list: 'doors' });
  expect(screen.container.querySelectorAll('.figure')).toHaveLength(0);
  expect([...screen.container.querySelectorAll('.group')].map((el) => el.textContent)).toEqual([
    'Table',
    'Leads',
    'Power',
    'Levels',
    'Record',
  ]);
});

test('says what a line costs before it, at full strength, outside the row, and never as a note', async () => {
  const screen = await render(Checklist, { list: 'files' });
  const before = screen.getByText(/^Deleting the files on the microSD card deletes the original recordings\./);
  await expect.element(before).toBeVisible();
  const line = before.element().closest('li')!;
  // It comes before the box, so it's read before the line is done.
  expect(line.firstElementChild).toBe(before.element());
  expect(before.element().closest('label')).toBeNull();
  expect(getComputedStyle(before.element()).color).toBe(token('--ink'));
  expect(Number.parseFloat(getComputedStyle(before.element()).fontSize)).toBeGreaterThanOrEqual(15);
});

test('notes read at an instruction’s strength and 15px or more, until their line is ticked', async () => {
  const screen = await render(Checklist, { list: 'doors' });
  const instruction = token('--ink-2');
  const notes = [...screen.container.querySelectorAll<HTMLElement>('.item-note')];
  expect(notes.length).toBeGreaterThan(1);
  for (const text of notes) {
    expect(Number.parseFloat(getComputedStyle(text).fontSize)).toBeGreaterThanOrEqual(15);
    expect(getComputedStyle(text).color).toBe(instruction);
  }
  // When to run it is read first, at full strength.
  const when = screen.container.querySelector<HTMLElement>('.when')!;
  expect(Number.parseFloat(getComputedStyle(when).fontSize)).toBeGreaterThanOrEqual(15);
  expect(getComputedStyle(when).color).toBe(token('--ink'));
  const [ticked, next] = notes.map((note) => note.closest('li')!);
  await page.elementLocator(ticked!.querySelector('input')!).click();
  // A ticked line steps back; the next one still reads as a job to do, its response in the action colour.
  for (const part of ['.check', '.target', '.item-note']) {
    expect(getComputedStyle(ticked!.querySelector(part)!).color).toBe(token('--ink-3'));
  }
  expect(getComputedStyle(next!.querySelector('.check')!).color).toBe(token('--ink'));
  expect(getComputedStyle(next!.querySelector('.target')!).color).toBe(token('--action'));
  expect(getComputedStyle(next!.querySelector('.target')!).fontWeight).toBe('700');
  expect(getComputedStyle(next!.querySelector('.item-note')!).color).toBe(instruction);
});

test('phone checklist responses stack below their checks and align left', async () => {
  const screen = await render(Checklist, { list: 'doors' });
  screen.container.style.width = '20rem';
  for (const text of screen.container.querySelectorAll('.text')) {
    const check = text.querySelector('.check')!;
    const target = text.querySelector('.target')!;
    expect(getComputedStyle(target).textAlign).toBe('left');
    expect(getComputedStyle(text.querySelector('.leader')!).display).toBe('none');
    expect(target.getBoundingClientRect().top).toBeGreaterThanOrEqual(check.getBoundingClientRect().bottom);
    expect(target.getBoundingClientRect().left).toBeCloseTo(check.getBoundingClientRect().left, 0);
  }
});
