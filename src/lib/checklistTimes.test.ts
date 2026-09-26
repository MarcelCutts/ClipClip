import { describe, expect, it } from 'vitest';
import { CHECKLIST_ORDER, CHECKLISTS, serialiseTicks } from './checklists';
import {
  clockTime,
  lifetimeText,
  NEXT_RUN,
  readSaved,
  type SavedRun,
  startingTicks,
  TICK_LIFETIMES,
} from './checklistTimes';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const now = 1_790_000_000_000;
const ids = (id: keyof typeof CHECKLISTS) => CHECKLISTS[id].items.map((item) => item.id);
const run = (at: number, done: string[]): SavedRun => ({ at, done: new Set(done) });

describe('tick lifetimes', () => {
  it('gives every list one', () => {
    expect(Object.keys(TICK_LIFETIMES).sort()).toEqual([...CHECKLIST_ORDER].sort());
  });

  it('keeps ticks for the night on the lists that run once', () => {
    for (const id of CHECKLIST_ORDER.filter((id) => !NEXT_RUN[id] && id !== 'files')) {
      expect(TICK_LIFETIMES[id]).toBe(12 * HOUR);
    }
  });

  it('keeps the next day’s ticks for two days, since the work on the recordings can spread out', () => {
    expect(TICK_LIFETIMES.files).toBe(48 * HOUR);
    expect(lifetimeText(TICK_LIFETIMES.files)).toBe('48 hours');
  });

  it('clears a changeover about half an hour after its last tick, well before the next DJ’s set ends', () => {
    expect(TICK_LIFETIMES.changeover).toBe(30 * MINUTE);
    expect(NEXT_RUN.changeover).toBe('Start the next changeover');
  });

  it('only repeats lists whose ticks go before the night is out', () => {
    for (const id of CHECKLIST_ORDER.filter((id) => NEXT_RUN[id])) expect(TICK_LIFETIMES[id]).toBeLessThan(HOUR);
  });
});

describe('reading saved ticks', () => {
  const doors = CHECKLISTS.doors;
  const changeover = CHECKLISTS.changeover;

  it('round-trips with the time the ticks last changed', () => {
    const saved = readSaved(serialiseTicks(['howler', 'rec'], now), doors, now + 1_000);
    expect(saved?.at).toBe(now);
    expect([...(saved?.done ?? [])]).toEqual(['howler', 'rec']);
  });

  it('forgets a changeover after 30 minutes', () => {
    const raw = serialiseTicks(ids('changeover'), now);
    expect(readSaved(raw, changeover, now + 29 * MINUTE)).not.toBeNull();
    expect(readSaved(raw, changeover, now + 31 * MINUTE)).toBeNull();
  });

  it('keeps doors ticks for 12 hours, not 30 minutes', () => {
    const raw = serialiseTicks(['howler'], now);
    expect(readSaved(raw, doors, now + 31 * MINUTE)).not.toBeNull();
    expect(readSaved(raw, doors, now + 12 * HOUR - 1)).not.toBeNull();
    expect(readSaved(raw, doors, now + 12 * HOUR + 1)).toBeNull();
  });

  it('drops items that are no longer on the list', () => {
    expect([...(readSaved(serialiseTicks(['howler', 'gone'], now), doors, now)?.done ?? [])]).toEqual(['howler']);
    expect(readSaved(serialiseTicks(['gone'], now), doors, now)).toBeNull();
  });

  it.each([
    null,
    '',
    'not json',
    '42',
    'null',
    '{"at":"x","done":[]}',
    '{"at":1,"done":"howler"}',
    '{"at":1e999,"done":["howler"]}',
  ])('starts empty from %j', (raw) => {
    expect(readSaved(raw, doors, now)).toBeNull();
  });

  it('distrusts timestamps from the future, with a minute’s grace', () => {
    expect(readSaved(serialiseTicks(['howler'], now + 30_000), doors, now)).not.toBeNull();
    expect(readSaved(serialiseTicks(['howler'], now + HOUR), doors, now)).toBeNull();
  });
});

describe('where a list starts when its island wakes up', () => {
  const doors = CHECKLISTS.doors;
  const changeover = CHECKLISTS.changeover;
  const earlier = now - 10 * MINUTE;

  it('takes the saved run as it is when nothing was ticked early, without saving again', () => {
    const start = startingTicks(doors, run(earlier, ['howler']), new Set(), now);
    expect(start).toEqual({ done: new Set(['howler']), at: earlier, save: false });
    expect(startingTicks(doors, null, new Set(), now)).toEqual({ done: new Set(), at: null, save: false });
  });

  it('keeps ticks made before it woke up, alongside the saved ones', () => {
    const start = startingTicks(doors, run(earlier, ['howler']), new Set(['att']), now);
    expect(start).toEqual({ done: new Set(['howler', 'att']), at: now, save: true });
  });

  it('keeps early ticks when nothing was saved', () => {
    expect(startingTicks(doors, null, new Set(['att']), now)).toEqual({ done: new Set(['att']), at: now, save: true });
  });

  it('doesn’t move the time when the early ticks were saved already', () => {
    const start = startingTicks(doors, run(earlier, ['howler', 'att']), new Set(['att']), now);
    expect(start).toEqual({ done: new Set(['howler', 'att']), at: earlier, save: false });
  });

  it('starts the next changeover from early ticks when the saved one was finished', () => {
    const start = startingTicks(changeover, run(earlier, ids('changeover')), new Set(['light']), now);
    expect(start).toEqual({ done: new Set(['light']), at: now, save: true });
  });

  it('carries on an unfinished changeover', () => {
    const start = startingTicks(changeover, run(earlier, ['light']), new Set(['rec']), now);
    expect(start).toEqual({ done: new Set(['light', 'rec']), at: now, save: true });
  });

  it('never starts a list that runs once afresh', () => {
    const start = startingTicks(doors, run(earlier, ids('doors')), new Set(['howler']), now);
    expect(start).toEqual({ done: new Set(ids('doors')), at: earlier, save: false });
  });
});

describe('words for times', () => {
  it('tells the time on a 24-hour clock, local time', () => {
    expect(clockTime(new Date(2026, 8, 25, 22, 14).getTime())).toBe('22:14');
    expect(clockTime(new Date(2026, 8, 26, 0, 5).getTime())).toBe('00:05');
    expect(clockTime(new Date(2026, 8, 25, 9, 30, 59).getTime())).toBe('09:30');
  });

  it('says how long ticks stay, with a no-break space', () => {
    expect(lifetimeText(12 * HOUR)).toBe('12 hours');
    expect(lifetimeText(30 * MINUTE)).toBe('30 minutes');
    expect(lifetimeText(HOUR)).toBe('1 hour');
    expect(lifetimeText(MINUTE)).toBe('1 minute');
  });
});
