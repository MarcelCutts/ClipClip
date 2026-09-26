import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_ORDER,
  CHECKLISTS,
  type ChecklistId,
  type ChecklistItem,
  type DrillRef,
  drillText,
  FADER_DOWN,
  HOWLER_RED_FIRST_ACTION,
  IN_UTILITY,
  isChecklistId,
  LEVEL_FALLBACK,
  NEXT_DJ_WORDS,
  OPEN_UTILITY,
  progressText,
  serialiseTicks,
  storageKey,
} from './checklists';
import { drill } from './fixes';
import { TARGET } from './model';
import { CREW_RULES, DJ_RULES } from './rules';

const lists = Object.values(CHECKLISTS);
const refsOf = (item: ChecklistItem): DrillRef[] => [item.drill ?? []].flat();
const allCopy = lists.flatMap((l) => [
  l.title,
  l.when,
  ...l.items.flatMap((i) => [i.check, i.target, i.before ?? '', i.note ?? '', i.drill ? drillText(i.drill) : '']),
]);
const itemOf = (id: ChecklistId, item: string) => {
  const found = CHECKLISTS[id].items.find((i) => i.id === item);
  if (!found) throw new Error(`${id} has no ${item}`);
  return found;
};
const lineOf = (id: ChecklistId, item: string) => {
  const found = itemOf(id, item);
  return `${found.check} ${found.target}`;
};
/** Sentences end at a stop before an ordinary space and a letter, so "p. 31" stays inside its sentence. */
const sentences = (text: string) => text.split(/(?<=[.?!]”?) +(?=[A-Za-z“])/).filter(Boolean);

describe('checklist shape', () => {
  it('has the five lists, in running order', () => {
    expect(CHECKLIST_ORDER).toEqual(['setup', 'doors', 'changeover', 'after', 'files']);
    for (const id of CHECKLIST_ORDER) expect(CHECKLISTS[id].id).toBe(id);
    expect(lists).toHaveLength(CHECKLIST_ORDER.length);
  });

  it('gives each list its own anchor for links from the chat', () => {
    expect(CHECKLIST_ORDER.map((id) => CHECKLISTS[id].anchor)).toEqual([
      'setup',
      'doors',
      'changeover',
      'after',
      'next-day',
    ]);
    for (const list of lists) expect(list.anchor).toMatch(/^[a-z][a-z-]*$/);
  });

  it('codes the night’s lists C1 to C4 in the order they run, and setting up S1', () => {
    expect(CHECKLIST_ORDER.map((id) => CHECKLISTS[id].code)).toEqual(['S1', 'C1', 'C2', 'C3', 'C4']);
    // The drills on the night page are F1, F2…, so no list's code can be mistaken for one.
    for (const list of lists) expect(list.code).toMatch(/^[CS][1-9]$/);
  });

  it.each(lists)('$title has 5 to 9 items, each with its own id', (list) => {
    expect(list.items.length).toBeGreaterThanOrEqual(5);
    expect(list.items.length).toBeLessThanOrEqual(9);
    const ids = list.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is read-and-do for one person: no completion call, no time budget, no “from memory”', () => {
    for (const list of lists) {
      expect(Object.keys(list).sort(), list.id).toEqual(['anchor', 'code', 'id', 'items', 'title', 'when']);
    }
    expect(allCopy.join(' ')).not.toMatch(
      /from memory|read down|\bcomplete\b|Say: “[^”]*complete|Under a minute|\d s\b/i,
    );
  });

  it('says when each list is run, the setup at every event', () => {
    for (const list of lists) expect(list.when, list.id).toMatch(/^[A-Z].*\.$/);
    expect(CHECKLISTS.setup).toMatchObject({ title: 'Setting up', when: 'Every event, while you build the rig.' });
    expect(CHECKLISTS.after).toMatchObject({ title: 'End of the night', when: 'When the last DJ finishes.' });
    expect(CHECKLISTS.files).toMatchObject({
      title: 'Next day',
      when: 'The day after, for whoever handles the recordings.',
    });
  });

  it('puts the recorder first on the night’s lists', () => {
    expect(CHECKLISTS.doors.items[0]?.check).toMatch(/Howler/);
    expect(CHECKLISTS.changeover.items[0]?.check).toMatch(/Howler/);
    expect(CHECKLISTS.after.items[0]?.check).toMatch(/Howler/);
  });
});

describe('S1: the whole job in order, every event', () => {
  it('runs power, leads, the Howler and T2 before the recording level, and the amps after it', () => {
    expect(CHECKLISTS.setup.items.map((i) => i.id)).toEqual([
      'supply',
      'leads',
      'isolation',
      'howler',
      'att-test',
      'record-level',
      'amps',
      'tags',
      'test-recording',
    ]);
    expect(lineOf('setup', 'supply')).toBe('Sound gear on one supply, amps switched off');
    expect(lineOf('setup', 'att-test')).toBe('MASTER ATT test (T2) done once');
    expect(itemOf('setup', 'record-level')).toMatchObject({
      check: 'Howler LEVEL light',
      target: 'blinking green on the loudest blend',
      note: 'If it blinks red, go to S3.',
    });
    expect(lineOf('setup', 'amps')).toBe('DriveRack and amps as in S4, amps switched on last');
  });

  it('puts both ATT settings on the REC tape, where the night’s lists check them', () => {
    expect(itemOf('setup', 'tags').note).toBe('The REC tape also carries both ATT settings, MASTER ATT and BOOTH ATT.');
    for (const id of ['doors', 'changeover'] as const) {
      expect(CHECKLISTS[id].items.map((i) => `${i.check} ${i.target}`)).toContain(
        'MASTER ATT and BOOTH ATT as on the REC tape',
      );
    }
  });

  it('ends on a test recording, with the drills for what it can find', () => {
    const test = itemOf('setup', 'test-recording');
    expect(test.target).toBe('2 minutes, on headphones: both sides, no hum');
    expect(drillText(test.drill ?? [])).toBe('If it hums, go to F10. If a side is missing, go to F11.');
  });
});

describe('the night’s lists', () => {
  it('open the doors with the Howler recording and its start time noted, for cutting the sets later', () => {
    expect(CHECKLISTS.doors.items.map((i) => i.id)).toEqual([
      'howler',
      'start',
      'level',
      'rec',
      'att',
      'amps',
      'booth-card',
    ]);
    expect(lineOf('doors', 'howler')).toBe('Howler recording on WAV, on charge');
    // Howler MK1 manual: RECORD stops blinking when the card is full or faulty.
    expect(itemOf('doors', 'howler').note).toBe(
      'If RECORD stops blinking soon after you press it, put in another SD card.',
    );
    expect(lineOf('doors', 'start')).toBe('Recording start time noted');
    expect(lineOf('doors', 'amps')).toBe('Both amps on, gain knobs on the RIG marks');
  });

  it('note the time at every changeover, where the next day’s work cuts the sets', () => {
    expect(CHECKLISTS.changeover.items.map((i) => i.id)).toEqual(['light', 'time', 'rec', 'settings', 'next-dj']);
    expect(lineOf('changeover', 'time')).toBe('Changeover time noted');
    // Howler MK1 manual: a WAV file holds about 3.5 hours, then carries on in a new one with a gap.
    expect(itemOf('changeover', 'time').note).toMatch(/^If the recording started over 3 hours ago, press RECORD/);
    expect(itemOf('changeover', 'time').note).toMatch(/about 3\.5 hours, with up to a second missing\.$/);
    expect(itemOf('files', 'cut').note).toBe('C1 has the start time, and C2 each changeover.');
  });

  it('give the next DJ the booth card’s words, as the DJ box has them', () => {
    expect(itemOf('changeover', 'next-dj').note).toBe(`Say: “${NEXT_DJ_WORDS}”`);
    expect(NEXT_DJ_WORDS).toContain(`on the ${DJ_RULES[0]?.response}`);
    expect(DJ_RULES.map((r) => r.note).join(' ')).toContain(NEXT_DJ_WORDS.split('. ')[1]);
  });

  it('say how to open UTILITY wherever a list sends the crew into it, as information', () => {
    const into = lists.flatMap((l) => l.items.filter((i) => /UTILITY/.test(i.note ?? '')));
    expect(into.map((i) => i.id)).toEqual(['att', 'settings']);
    expect(itemOf('doors', 'att').note).toBe(IN_UTILITY);
    expect(itemOf('changeover', 'settings').note).toBe(`A DJ’s MY SETTINGS can change them. ${OPEN_UTILITY}`);
    // Pioneer: "Press the [MENU (UTILITY)] button for over 1 second" (Operating Instructions p.31).
    expect(OPEN_UTILITY).toBe('UTILITY opens when you hold MENU (UTILITY) for over a second.');
    expect(IN_UTILITY).toBe('They are in UTILITY. It opens when you hold MENU (UTILITY) for over a second.');
  });

  it('shut down in dbx’s order, and keep the SD card for the next day', () => {
    expect(CHECKLISTS.after.items.map((i) => `${i.check} ${i.target}`)).toEqual([
      'Howler recording stopped with RECORD',
      'Both amps switched off',
      'The rest of the rig switched off, about 10 seconds later',
      'Howler on charge',
      'SD card kept safe for the next day',
    ]);
  });
});

describe('a red LEVEL light', () => {
  it('gets its first action on C1 and C2, the crew box’s words, and F1 for the rest', () => {
    for (const [list, item] of [
      ['doors', 'level'],
      ['changeover', 'light'],
    ] as const) {
      const line = itemOf(list, item);
      expect(`${line.check} ${line.target}`).toBe('Howler LEVEL light blinking green');
      expect(line.note).toBe(`${HOWLER_RED_FIRST_ACTION} If they are red, say to the DJ: “${FADER_DOWN}”`);
      expect(line.drill).toEqual({ if: 'If they are below red', id: 'howler-red', code: 'F1' });
    }
    // One sentence, the crew box's note for the light word for word, and it starts with the look.
    expect(sentences(HOWLER_RED_FIRST_ACTION)).toHaveLength(1);
    expect(CREW_RULES.find((r) => r.drill === 'howler-red')?.note).toBe(HOWLER_RED_FIRST_ACTION);
    expect(HOWLER_RED_FIRST_ACTION).toMatch(/^If it blinks red, look at the MASTER meters\b/);
    // The words to the DJ are the DJ box's own (rules.ts).
    expect(DJ_RULES.map((r) => r.note.toLowerCase()).join(' ')).toContain(FADER_DOWN.toLowerCase().replace(/\.$/, ''));
  });

  it('copies each drill’s code as the drill has it', () => {
    for (const item of lists.flatMap((l) => l.items)) {
      for (const ref of refsOf(item)) expect(ref.code, item.id).toBe(drill(ref.id).code);
    }
  });

  it('words the MASTER LEVEL fallback once, from its parts', () => {
    const { challenge, response, how, text, consequence } = LEVEL_FALLBACK;
    expect(response).toBe('down a little at a time until green');
    expect(how.startsWith(response.replace(/^down /, ''))).toBe(true);
    expect(text).toContain(`${challenge} down ${how}.`);
    expect(text).toMatch(/Then re-mark the REC tape\.$/);
    expect(consequence).toBe('From then on, the MASTER meters read low. A blend can crunch before they show red.');
  });
});

describe('C4: the next day’s work on the recordings', () => {
  it('copies, joins, cuts, checks and normalises, and clears the SD card last', () => {
    expect(CHECKLISTS.files.items.map((i) => i.id)).toEqual([
      'copies',
      'play',
      'join',
      'cut',
      'flat-tops',
      'normalise',
      'clear',
    ]);
  });

  it('says what clearing the SD card costs before the line, not in a note', () => {
    const clear = itemOf('files', 'clear');
    expect(clear).toEqual({
      id: 'clear',
      check: 'SD card',
      target: 'cleared',
      before: 'Clearing the SD card deletes the original recordings. Clear it only after both copies play to the end.',
    });
    // The only line with a consequence before it, and the last.
    expect(lists.flatMap((l) => l.items).filter((i) => i.before)).toEqual([clear]);
    expect(CHECKLISTS.files.items.at(-1)).toBe(clear);
  });

  it('looks for mixer clipping below full scale, and sends crunch to F9', () => {
    const flat = itemOf('files', 'flat-tops');
    expect(`${flat.check} ${flat.target}`).toBe('Loudest blends, zoomed in no flat tops, at any height');
    expect(flat.note).toBe(
      'Audacity’s Show Clipping in Waveform marks only the top of the file. Mixer clipping sits lower.',
    );
    expect(flat.drill).toEqual({ if: 'If you see flat tops or hear crunch', id: 'crunch', code: 'F9' });
  });

  it('gives one healthy range for a set’s loudest peak, the model’s', () => {
    const normalise = itemOf('files', 'normalise');
    expect(normalise.target).toBe('normalised to −1 dB true peak');
    expect(TARGET.band).toEqual({ top: -6, bottom: -18 });
    expect(normalise.note).toMatch(/^Before this step, its loudest peak should be between −18 and −6 dBFS\./);
    expect(normalise.note).toMatch(/If it is higher, set the recording level again with S3 before the next event\.$/);
  });
});

describe('responses are states you can see', () => {
  const bare = /^(check(ed)?|done|ok(ay)?|yes|confirm(ed)?|set|fine|good|tick(ed)?)\.?$/i;

  it.each(lists.flatMap((l) => l.items.map((i) => ({ list: l.title, ...i }))))(
    '$list: $check → $target',
    ({ check, target }) => {
      expect(check.trim().length).toBeGreaterThan(2);
      expect(target.trim().length).toBeGreaterThan(2);
      expect(target).not.toMatch(bare);
      // A state, not an instruction to go and look or to do something.
      expect(target).not.toMatch(/^(check|make sure|ensure|verify|restart|turn|set|switch|watch|look)\b/i);
      // A condition goes in the note, never the line.
      expect(check).not.toMatch(/^If\b/);
    },
  );

  it('keeps each response to a state, with anything more in its note', () => {
    for (const list of lists) for (const item of list.items) expect(item.target, item.id).not.toMatch(/\.$/);
  });

  it('starts a note that asks for something with its condition', () => {
    for (const item of lists.flatMap((l) => l.items)) {
      if (!item.note) continue;
      for (const s of sentences(item.note)) {
        // A fact, or "If …, …". Nothing else tells the reader to act.
        if (/^(?:If|To|Say)\b/.test(s)) continue;
        expect(s, item.id).not.toMatch(
          /^(?:Turn|Set|Push|Look|Check|Wait|Tell|Ask|Switch|Press|Put|Clear|Keep|Work|Edit)\b/,
        );
      }
    }
  });
});

describe('copy', () => {
  it('keeps every sentence to 20 words or fewer', () => {
    for (const text of allCopy) {
      for (const sentence of sentences(text)) {
        expect(sentence.split(/\s+/).filter(Boolean).length, sentence).toBeLessThanOrEqual(20);
      }
    }
  });

  it('uses the site’s words: MASTER meters, recording level, SD card, no USB backup', () => {
    const text = allCopy.join(' ');
    expect(text).not.toMatch(/middle meters?|record level|Howler card|memory card|MASTER REC|USB backup|USB stick/i);
    expect(text).not.toMatch(/\bBoth ATTs\b|\bthe tape\b/);
    expect(text).toMatch(/MASTER meters/);
  });

  it('says no please, never shouts, and uses no idioms or negative contractions', () => {
    for (const text of allCopy) {
      expect(text).not.toMatch(/\bplease\b/i);
      expect(text).not.toContain('!');
      expect(text, text).not.toMatch(/n’t\b|n't\b|, so\b/);
      expect(text, text).not.toMatch(/a notch|\bease\b|with a word|came out|room for tonight|read down/i);
    }
  });

  it('asks no questions', () => {
    for (const text of allCopy) expect(text, text).not.toContain('?');
  });

  it('joins numbers to units with a no-break space and uses true minus signs and curly apostrophes', () => {
    for (const text of allCopy) {
      expect(text, text).not.toMatch(/\d (dB|dBu|dBV|dBFS|kW|m|minutes?|seconds?|hours?)\b/);
      expect(text, text).not.toMatch(/(^|[\s(])-\d/);
      expect(text, text).not.toMatch(/['"]/);
    }
  });
});

describe('lists and ticks', () => {
  it('counts progress', () => {
    expect(progressText(3, 7)).toBe('3 of 7 done');
  });

  it('recognises list ids', () => {
    expect(isChecklistId('doors')).toBe(true);
    expect(isChecklistId('files')).toBe(true);
    expect(isChecklistId('rewire')).toBe(false);
    expect(isChecklistId('toString')).toBe(false);
  });

  it('keys storage per list, inside the site’s namespace', () => {
    const keys = CHECKLIST_ORDER.map((id: ChecklistId) => storageKey(id));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^out-of-the-red:/);
  });

  it('saves when the ticks changed and which items are ticked', () => {
    const now = 1_790_000_000_000;
    expect(JSON.parse(serialiseTicks(['howler', 'rec'], now))).toEqual({ at: now, done: ['howler', 'rec'] });
    expect(JSON.parse(serialiseTicks(new Set(['light']), now))).toEqual({ at: now, done: ['light'] });
  });
});
