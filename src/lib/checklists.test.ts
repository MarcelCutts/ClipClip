import { describe, expect, it } from 'vitest';
import {
  budgetLabel,
  budgetText,
  CHECKLIST_ORDER,
  CHECKLISTS,
  type ChecklistId,
  howToRun,
  isChecklistId,
  progressText,
  serialiseTicks,
  storageKey,
} from './checklists';

const lists = Object.values(CHECKLISTS);
const allCopy = lists.flatMap((l) => [
  l.title,
  l.when,
  l.call,
  ...l.items.flatMap((i) => [i.check, i.target, i.note ?? '']),
]);
const lineOf = (id: ChecklistId, item: string) => {
  const found = CHECKLISTS[id].items.find((i) => i.id === item);
  if (!found) throw new Error(`${id} has no ${item}`);
  return `${found.check} ${found.target}`;
};

describe('checklist shape', () => {
  it('has the four lists, in running order', () => {
    expect(CHECKLIST_ORDER).toEqual(['setup', 'doors', 'changeover', 'after']);
    for (const id of CHECKLIST_ORDER) expect(CHECKLISTS[id].id).toBe(id);
    expect(lists).toHaveLength(CHECKLIST_ORDER.length);
  });

  it('gives each list its own anchor for links from the chat', () => {
    expect(CHECKLIST_ORDER.map((id) => CHECKLISTS[id].anchor)).toEqual(['setup', 'doors', 'changeover', 'after']);
    for (const list of lists) expect(list.anchor).toMatch(/^[a-z][a-z-]*$/);
  });

  it('codes a night’s lists C1 to C3 in the order they run, and the one-off setup S1', () => {
    expect(CHECKLIST_ORDER.map((id) => CHECKLISTS[id].code)).toEqual(['S1', 'C1', 'C2', 'C3']);
    // The drills on the night page are F1, F2…, so no list's code can be mistaken for one.
    for (const list of lists) expect(list.code).toMatch(/^[CS][1-9]$/);
  });

  it.each(lists)('$title has 5 to 9 items', (list) => {
    expect(list.items.length).toBeGreaterThanOrEqual(5);
    expect(list.items.length).toBeLessThanOrEqual(9);
  });

  it.each(lists)('$title has unique item ids', (list) => {
    const ids = list.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(lists)('$title ends on a completion call', (list) => {
    expect(list.call).toMatch(/^[A-Z].*\.$/);
  });

  it('runs doors and changeovers as timed DO-CONFIRM lists, and the setup as READ-DO', () => {
    expect(CHECKLISTS.doors.kind).toBe('do-confirm');
    expect(CHECKLISTS.doors.seconds).toBeLessThanOrEqual(60);
    expect(CHECKLISTS.changeover.kind).toBe('do-confirm');
    expect(CHECKLISTS.changeover.seconds).toBeLessThanOrEqual(30);
    expect(CHECKLISTS.setup.kind).toBe('read-do');
    expect(CHECKLISTS.setup.title).toBe('First-time setup');
  });

  it('puts the recorder first on the DO-CONFIRM lists', () => {
    expect(CHECKLISTS.doors.items[0]?.check).toMatch(/Howler/);
    expect(CHECKLISTS.changeover.items[0]?.check).toMatch(/Howler/);
  });
});

describe('one wiring: the Howler on MASTER 2', () => {
  it('has no alternative wiring left on any line', () => {
    for (const list of lists) for (const item of list.items) expect(Object.keys(item), item.id).not.toContain('alt');
    expect(allCopy.join(' ')).not.toMatch(/proposed|Master 2 wiring|old wiring|rewire/i);
  });

  it('wires the setup in cable order: PA, recorder, monitors', () => {
    const ids = CHECKLISTS.setup.items.map((i) => i.id);
    expect(ids.slice(0, 4)).toEqual(['pa-feed', 'pa-switch', 'howler-feed', 'monitor-feed']);
    expect(lineOf('setup', 'pa-feed')).toMatch(/^MASTER 1 \(XLR.*DriveRack/);
    expect(lineOf('setup', 'howler-feed')).toMatch(/^MASTER 2 \(RCA.*Howler/);
    expect(lineOf('setup', 'monitor-feed')).toMatch(/^BOOTH .*monitor/);
  });

  it('keeps MASTER LEVEL fully up and taped REC, with MASTER ATT only if the Howler still blinks red', () => {
    expect(lineOf('setup', 'rec')).toBe('MASTER LEVEL fully up, taped, marked REC');
    const level = CHECKLISTS.setup.items.find((i) => i.id === 'record-level');
    expect(level?.target).toMatch(/blinking green on the loudest blend/);
    expect(level?.note).toMatch(/^If it blinks red, set MASTER ATT/);
    // Pioneer doesn't say MASTER ATT reaches MASTER 2, so MASTER LEVEL is the fallback.
    expect(level?.note).toMatch(/MASTER LEVEL down a notch at a time/);
  });

  it('sets the room at the amps, and tags every knob', () => {
    expect(lineOf('setup', 'amps')).toMatch(/FULL RANGE.*gain knobs/);
    expect(lineOf('setup', 'tags')).toBe('Knob tags REC on MASTER LEVEL, MONITOR on BOOTH MONITOR, RIG on the amps');
    expect(lineOf('setup', 'test-recording')).toMatch(/2 minutes, on headphones/);
  });

  it('switches the amps on last and off first', () => {
    expect(CHECKLISTS.doors.items.at(-1)?.id).toBe('amps');
    expect(lineOf('doors', 'amps')).toMatch(/on last/);
    const after = CHECKLISTS.after.items.map((i) => i.id);
    // The recording stops first, then the power goes off amps first.
    expect(after.slice(0, 2)).toEqual(['stop', 'amps-off']);
    expect(lineOf('after', 'amps-off')).toMatch(/off first/);
  });
});

describe('responses are target states', () => {
  const bare = /^(check(ed)?|done|ok(ay)?|yes|confirm(ed)?|set|fine|good|tick(ed)?)\.?$/i;

  it.each(lists.flatMap((l) => l.items.map((i) => ({ list: l.title, ...i }))))(
    '$list: $check → $target',
    ({ check, target }) => {
      expect(check.trim().length).toBeGreaterThan(2);
      expect(target.trim().length).toBeGreaterThan(2);
      expect(target).not.toMatch(bare);
      // A state, not an instruction to go and look or to do something.
      expect(target).not.toMatch(/^(check|make sure|ensure|verify|restart|turn|set|switch)\b/i);
    },
  );

  it('looks for mixer clipping below full scale', () => {
    // Clipped in the mixer but not at the recorder: the flat tops never reach 0 dBFS, so a
    // full-scale marker like Audacity's Show Clipping can't be the whole check.
    const note = CHECKLISTS.after.items.find((i) => i.id === 'flat-tops')?.note ?? '';
    expect(note).toMatch(/at any height/);
    expect(note).toMatch(/headphones/);
  });

  it('names the controls the way the gear and the tape do', () => {
    const doors = CHECKLISTS.doors.items.map((i) => `${i.check} ${i.target}`).join(' ');
    expect(doors).toContain('MASTER LEVEL fully up, on the REC mark');
    expect(doors).toContain('Amps on last, knobs on RIG');
    expect(doors).not.toMatch(/BOOTH knob/);
    expect(CHECKLISTS.setup.items.find((i) => i.id === 'pa-switch')?.target).toBe('+4 dBu');
  });
});

describe('copy', () => {
  it('keeps every sentence to 20 words or fewer', () => {
    for (const text of allCopy) {
      for (const sentence of text.split(/(?<=[.?!])\s+/)) {
        expect(sentence.split(/\s+/).filter(Boolean).length, sentence).toBeLessThanOrEqual(20);
      }
    }
  });

  it('writes a line that only sometimes applies as “If …”, never as a question', () => {
    for (const text of allCopy) expect(text, text).not.toContain('?');
    expect(lineOf('changeover', 'settings')).toMatch(/^If a DJ loaded MY SETTINGS both ATTs as on the tape$/);
  });

  it('keeps each response to a state, with anything more in its note', () => {
    for (const list of lists) for (const item of list.items) expect(item.target, item.id).not.toMatch(/\./);
  });

  it('says no please, and never shouts', () => {
    for (const text of allCopy) {
      expect(text).not.toMatch(/\bplease\b/i);
      expect(text).not.toContain('!');
    }
  });

  it('joins numbers to units with a no-break space and uses true minus signs and curly apostrophes', () => {
    for (const text of allCopy) {
      expect(text, text).not.toMatch(/\d (dB|dBu|dBV|m|minutes?|seconds?|hours?)\b/);
      expect(text, text).not.toMatch(/(^|[\s(])-\d/);
      expect(text, text).not.toMatch(/['"]/);
    }
  });
});

describe('how to run a list', () => {
  it('explains the two kinds in plain words', () => {
    expect(howToRun(CHECKLISTS.setup)).toBe('Read each line, then do it.');
    expect(howToRun(CHECKLISTS.doors)).toBe('Do it from memory, then read down and confirm. Under a minute.');
    expect(howToRun(CHECKLISTS.changeover)).toMatch(/Under 30 seconds\.$/);
  });

  it('labels time budgets for the title strip, with a no-break space', () => {
    expect(budgetLabel(60)).toBe('60 s');
    expect(budgetLabel(CHECKLISTS.changeover.seconds ?? 0)).toBe('30 s');
  });

  it('words time budgets', () => {
    expect(budgetText(60)).toBe('Under a minute.');
    expect(budgetText(30)).toBe('Under 30 seconds.');
    expect(budgetText(120)).toBe('Under 2 minutes.');
  });

  it('counts progress', () => {
    expect(progressText(3, 7)).toBe('3 of 7 done');
  });

  it('recognises list ids', () => {
    expect(isChecklistId('doors')).toBe(true);
    expect(isChecklistId('setup')).toBe(true);
    expect(isChecklistId('rewire')).toBe(false);
    expect(isChecklistId('toString')).toBe(false);
    expect(isChecklistId('nope')).toBe(false);
  });
});

describe('remembering ticks', () => {
  // How long ticks last, and reading them back, are checklistTimes.ts's job (and its tests).
  const now = 1_790_000_000_000;

  it('keys storage per list, inside the site’s namespace', () => {
    const keys = CHECKLIST_ORDER.map((id: ChecklistId) => storageKey(id));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^out-of-the-red:/);
  });

  it('saves when the ticks changed and which items are ticked', () => {
    expect(JSON.parse(serialiseTicks(['howler', 'rec'], now))).toEqual({ at: now, done: ['howler', 'rec'] });
    expect(JSON.parse(serialiseTicks(new Set(['light']), now))).toEqual({ at: now, done: ['light'] });
  });
});
