/**
 * How long a checklist's ticks last on this device, and the clock for the list that runs more than once
 * a night. Used by the <Checklist> island.
 *
 * Ticks are kept so a reload or a locked phone doesn't lose them, but only for as long as one run of the
 * list lasts. Setup, Doors and After run once, so their ticks last 12 hours. Changeover runs at every DJ
 * change, so its ticks go 30 minutes after the last one: the next changeover starts empty, and one that
 * comes round sooner opens on when the last one ran and a key to start afresh.
 *
 * Storage keeps the format `serialiseTicks` writes (checklists.ts): `{ at, done }`, where `at` is when
 * the ticks last changed. A list's lifetime runs from `at`, so a finished list's `at` is when it finished.
 *
 * Clearing a list offers Undo with no time limit (WCAG 2.2.1): it stays until the next tick, or until
 * the cleared ticks' own lifetime would have run out.
 */
import type { Checklist, ChecklistId } from './checklists';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long ticks last after the last change to a list, in milliseconds. */
export const TICK_LIFETIMES: Readonly<Record<ChecklistId, number>> = {
  setup: 12 * HOUR,
  doors: 12 * HOUR,
  changeover: 30 * MINUTE,
  after: 12 * HOUR,
};

/**
 * Lists that run more than once a night, and the key that starts the next run. A finished one you come
 * back to leads with when it ran and this key, so the last run never passes for the next.
 */
export const NEXT_RUN: Readonly<Partial<Record<ChecklistId, string>>> = {
  changeover: 'Start the next changeover',
};

/** A run saved on this device: when its ticks last changed, and which items are ticked. */
export interface SavedRun {
  at: number;
  done: ReadonlySet<string>;
}

/** Where a list starts when its island wakes up, and whether storage needs to hear about it. */
export interface StartingTicks {
  done: Set<string>;
  at: number | null;
  save: boolean;
}

/**
 * Read a list's saved ticks back. Anything malformed, from the future, older than the list's lifetime or
 * no longer on the list is dropped, so a bad or stale entry can only ever mean "start from empty": null.
 */
export function readSaved(raw: string | null, list: Checklist, now: number): SavedRun | null {
  if (!raw) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof saved !== 'object' || saved === null) return null;
  const { at, done } = saved as { at?: unknown; done?: unknown };
  if (typeof at !== 'number' || !Number.isFinite(at) || !Array.isArray(done)) return null;
  // A minute's grace for a phone clock that has been nudged back.
  if (now - at > TICK_LIFETIMES[list.id] || at > now + MINUTE) return null;
  const valid = new Set(list.items.map((item) => item.id));
  const kept = new Set(done.filter((id): id is string => typeof id === 'string' && valid.has(id)));
  return kept.size ? { at, done: kept } : null;
}

/**
 * Where a list starts when its island wakes up. The boxes work before then, so some may be ticked
 * already (`early`): those are always kept, alongside the run saved on this device. If a repeating list's
 * saved run was finished, early ticks start the next run rather than join the last one. `save` is true
 * only when the early ticks add something, so waking up never moves `at`, or "Last run", on its own.
 */
export function startingTicks(
  list: Checklist,
  saved: SavedRun | null,
  early: ReadonlySet<string>,
  now: number,
): StartingTicks {
  if (!early.size) return { done: new Set(saved?.done), at: saved?.at ?? null, save: false };
  const finished = saved !== null && saved.done.size === list.items.length;
  if (!saved || (finished && NEXT_RUN[list.id])) return { done: new Set(early), at: now, save: true };
  const done = new Set([...saved.done, ...early]);
  return done.size > saved.done.size ? { done, at: now, save: true } : { done, at: saved.at, save: false };
}

/** "22:14": local time on a 24-hour clock. */
export function clockTime(at: number): string {
  const time = new Date(at);
  return [time.getHours(), time.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "12 hours", "30 minutes", with a no-break space between the number and the unit. */
export function lifetimeText(ms: number): string {
  const [n, unit] = ms % HOUR === 0 ? [ms / HOUR, 'hour'] : [Math.round(ms / MINUTE), 'minute'];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}
