import { describe, expect, it } from 'vitest';
import {
  ATT_NOTE,
  CHANNEL_METERS_WORDS,
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
  MASTER_METERS_WORDS,
  NEXT_DJ_WORDS,
  OPEN_UTILITY,
  progressText,
  STORE_CHANGE,
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
  it('makes the supply safe first, puts the leads in before the power, and switches the amps on last', () => {
    expect(CHECKLISTS.setup.items.map((i) => i.id)).toEqual([
      'generator',
      'leads',
      'supply',
      'howler',
      'tests',
      'record-level',
      'amps',
      'tags',
      'test-recording',
    ]);
    // HSE GS50: a generator earthed by a competent person, big enough for the load, sockets on 30 mA RCDs, and a
    // trip means a fault. Separate sockets are no help if the generator behind them is too small.
    expect(itemOf('setup', 'generator')).toMatchObject({
      check: 'Generator',
      target: 'earthed and sized for the load by a competent person, 30 mA RCDs',
      note: 'If an RCD trips, find the fault before you reset it.',
    });
    expect(lineOf('setup', 'supply')).toBe('Sound gear on one distribution board, amps switched off');
    // The once-only cards: T2 and T3 test the mixer, S5 and S6 set the DriveRack and the amps.
    expect(lineOf('setup', 'tests')).toBe('T2, T3, S5 and S6 done once for this rig');
    expect(itemOf('setup', 'record-level')).toMatchObject({
      check: 'Howler LEVEL light',
      target: 'blinking green on the loudest blend',
      note: 'If it blinks red, go to S3.',
    });
    // dbx p.10: amps on last, with no audio passing to the mixer's outputs.
    expect(itemOf('setup', 'amps')).toMatchObject({
      check: 'DriveRack and amps',
      target: 'as in S4, amps switched on last',
      note: 'If a track is playing, stop it before the amps go on.',
    });
  });

  it('gives the amps’ draw in amps, as QSC does, and never puts both on one 13 A strip', () => {
    const { note } = itemOf('setup', 'supply');
    // QSC p.11, halved for 230 V: about 13.4 A for the pair at peak programme levels, 26.5 A in full-power bursts.
    // The burst figure is the one that trips a breaker, and the generator line asks for a supply sized for it.
    expect(note).toMatch(/^Both GX7 amps draw about 26 A together in short bursts \(QSC p\. 11\)\./);
    expect(note).toMatch(/Each has its own socket: a 13 A strip cannot take both\.$/);
    expect(allCopy.join(' ')).not.toMatch(/\bkW\b|one power strip|if the load allows/i);
  });

  it('fits the audio isolation transformer only when F10 finds hum, so S1 has no line for it', () => {
    expect(allCopy.join(' ')).not.toMatch(/transformer/i);
    expect(drillText(itemOf('setup', 'test-recording').drill ?? [])).toMatch(/If it hums, go to F10\./);
  });

  it('puts both ATT settings on the REC tape, where the night’s lists check them', () => {
    // The first mention of MASTER ATT on /setup/, so it carries Pioneer's name once (A13), as the night's C1 does.
    expect(itemOf('setup', 'tags').note).toBe(
      'The REC tape also carries both ATT settings, MASTER ATT (MASTER ATTENUATOR in UTILITY) and BOOTH ATT.',
    );
    const setupNotes = CHECKLISTS.setup.items.flatMap((i) => [i.check, i.target, i.note ?? '']);
    expect(setupNotes.filter((text) => /MASTER ATT\b/.test(text))[0]).toContain(
      'MASTER ATT (MASTER ATTENUATOR in UTILITY)',
    );
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
    // Howler MK1 manual: the BATTERY light is red while charging; RECORD stops blinking when the microSD card is full
    // or faulty; the card must be FAT32, and A2 cards and SanDisk's Ultra and Pro cards do not work.
    expect(itemOf('doors', 'howler').note).toBe(
      'Its BATTERY light is red while it charges. If RECORD stops blinking soon after you press it, put in another FAT32 microSD card. For the MK1, Howler says A2 cards and SanDisk’s Ultra and Pro cards “do not work”.',
    );
    expect(lineOf('doors', 'start')).toBe('Recording start time noted');
    // The room's volume comes from the amps, never above the RIG marks (S4); dbx p.10 for the order.
    expect(itemOf('doors', 'amps')).toMatchObject({
      check: 'Both amps',
      target: 'on, gain knobs at or below the RIG marks',
      note: 'If they are off, switch them on after everything else, with no track playing.',
    });
  });

  it('start a new file at every changeover, with RECORD blinking, and note who is next', () => {
    expect(CHECKLISTS.changeover.items.map((i) => i.id)).toEqual([
      'light',
      'charge',
      'new-file',
      'rec',
      'settings',
      'next-dj',
    ]);
    // Howler MK1 manual: a WAV file holds about 3.5 hours, then carries on in a new one with a gap. A new file at
    // every changeover keeps any gap between DJs, however long the sets. RECORD blinking means it is recording.
    expect(lineOf('changeover', 'new-file')).toBe('Howler recording a new file for the next set, RECORD blinking');
    expect(itemOf('changeover', 'new-file').note).toBe(
      'If it is still the last set’s file, press RECORD to stop it, then again to start a new one. If RECORD stops blinking soon after, put in another FAT32 microSD card.',
    );
    expect(lineOf('changeover', 'next-dj')).toBe('Next DJ name and start time noted, shown the booth card');
    expect(itemOf('files', 'sets').note).toMatch(/^C1 and C2 have the start times and the DJs’ names\./);
  });

  it('put the Howler on charge before the new file: a low battery starts nothing new off charge', () => {
    // Howler MK1 manual: with around an hour left, "You are unable to start new recordings until you connect a
    // charger." The charger comes before the line that starts one.
    const ids = CHECKLISTS.changeover.items.map((i) => i.id);
    expect(ids.indexOf('charge')).toBeLessThan(ids.indexOf('new-file'));
    expect(lineOf('changeover', 'charge')).toBe('Howler on charge');
  });

  it('name the Howler’s light every time: the BATTERY light is red all the time it charges', () => {
    for (const [list, item] of [
      ['setup', 'howler'],
      ['doors', 'howler'],
    ] as const) {
      expect(itemOf(list, item).note, `${list} ${item}`).toMatch(/Its BATTERY light is red while it charges\./);
    }
    expect(allCopy.join(' ')).not.toMatch(/Howler(?:’s)? (?:red )?light\b|red light on the Howler/);
    // The MK1's figures are said as the MK1's: the MK2 differs. The battery's hours are F8's (a power cut).
    expect(itemOf('setup', 'howler').note).toBe('Its BATTERY light is red while it charges.');
  });

  it('give the next DJ the booth card’s words, as the DJ box has them', () => {
    expect(itemOf('changeover', 'next-dj').note).toBe(`Say: “${NEXT_DJ_WORDS}”`);
    expect(NEXT_DJ_WORDS).toContain(`on the ${DJ_RULES[0]?.response}`);
    expect(NEXT_DJ_WORDS).toContain('on the first orange (0) at the loudest part');
    expect(NEXT_DJ_WORDS.startsWith(CHANNEL_METERS_WORDS)).toBe(true);
    expect(DJ_RULES.map((r) => r.note).join(' ')).toContain(NEXT_DJ_WORDS.split('. ')[1]);
    // The MASTER line as the crew say it, from the box's "top orange dark".
    expect(DJ_RULES[1]?.response).toBe('top orange dark');
    expect(MASTER_METERS_WORDS).toBe('Keep the top orange on the MASTER meters dark.');
  });

  it('say how to open UTILITY, and how a change is kept, wherever a list sends the crew into it', () => {
    const into = lists.flatMap((l) => l.items.filter((i) => /UTILITY/.test(i.note ?? '')));
    expect(into.map((i) => i.id)).toEqual(['tags', 'att', 'settings', 'xdj-off']);
    // Pioneer: "Press the [MENU (UTILITY)] button for over 1 second" (Operating Instructions p.31).
    expect(OPEN_UTILITY).toBe('UTILITY opens when you hold MENU (UTILITY) for over a second.');
    expect(IN_UTILITY).toBe('They are in UTILITY. It opens when you hold MENU (UTILITY) for over a second.');
    // Pioneer p.31, step 3: "Press the rotary selector. The changed settings are stored."
    expect(STORE_CHANGE).toBe(
      'After a change, Pioneer says: “Press the rotary selector. The changed settings are stored.” (p. 31)',
    );
    expect(ATT_NOTE).toBe(`${IN_UTILITY} ${STORE_CHANGE}`);
    expect(itemOf('doors', 'att').note).toBe(
      `MASTER ATT (MASTER ATTENUATOR in UTILITY) and BOOTH ATT are UTILITY settings. ${OPEN_UTILITY} ${STORE_CHANGE}`,
    );
    // Pioneer says MY SETTINGS can call out UTILITY settings (p.31), not which ones a stick carries: "may".
    expect(itemOf('changeover', 'settings').note).toBe(
      `A DJ’s MY SETTINGS may change them. ${OPEN_UTILITY} ${STORE_CHANGE}`,
    );
  });

  it('give MASTER ATT its full name once on the night page, at its first mention in the cards', () => {
    const night = (['doors', 'changeover', 'after', 'files'] as const).flatMap((id) =>
      CHECKLISTS[id].items.flatMap((i) => [i.check, i.target, i.before ?? '', i.note ?? '']),
    );
    const named = night.filter((text) => text.includes('MASTER ATTENUATOR'));
    expect(named).toEqual([itemOf('doors', 'att').note]);
    expect(named[0]).toContain('MASTER ATT (MASTER ATTENUATOR in UTILITY)');
  });

  it('shut down in dbx’s order, the XDJ-RX2 at its own switch, and keep the microSD card for the next day', () => {
    expect(CHECKLISTS.after.items.map((i) => `${i.check} ${i.target}`)).toEqual([
      'Howler recording stopped with RECORD',
      'Both amps switched off',
      'XDJ-RX2 switched off at its own switch, about 10 seconds later',
      'The rest of the rig switched off',
      'Howler on charge',
      'microSD card kept safe for the next day',
    ]);
    // Pioneer p.35: a change can be lost if the unit goes off straight after it, or not at its own switch.
    expect(itemOf('after', 'xdj-off').note).toBe(
      'At the wall, or within 10 seconds of a UTILITY change, switching off can lose the change (Pioneer, p. 35).',
    );
    // dbx p.10: the PA2 has no power switch.
    expect(itemOf('after', 'rest-off').note).toBe(
      'The DriveRack has no power switch: it goes off at its socket (dbx p. 10).',
    );
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

  it('words the MASTER LEVEL fallback once, from its parts, with only what is published', () => {
    const { challenge, response, how, text, consequence } = LEVEL_FALLBACK;
    expect(response).toBe('down a little at a time until green');
    expect(how.startsWith(response.replace(/^down /, ''))).toBe(true);
    expect(text).toContain(`${challenge} down ${how}.`);
    expect(text).toMatch(/Then re-mark the REC tape\.$/);
    // The MASTER meters read after MASTER LEVEL (Pioneer p.31). Where the mixer clips inside is not published, so
    // no card says a blend can crunch before they show red.
    expect(consequence).toBe('From then on, the MASTER meters read low.');
    expect(allCopy.join(' ')).not.toMatch(/crunch before|hide a blend|hides a blend/i);
  });
});

describe('C4: the next day’s work on the recordings', () => {
  it('copies, checks each set’s file, checks and normalises, and deletes the files on the microSD card last', () => {
    expect(CHECKLISTS.files.items.map((i) => i.id)).toEqual([
      'copies',
      'play',
      'sets',
      'flat-tops',
      'peak',
      'normalise',
      'clear',
    ]);
    // Two drives: two folders on one drive fail together.
    expect(lineOf('files', 'copies')).toBe('microSD card files copied to two drives, one copy kept as it is');
    expect(lineOf('files', 'play')).toBe('Both copies same files and sizes as the card, the end of each file playing');
  });

  it('gives each set its own file, by name: the Howler MK1’s file dates are unreliable', () => {
    // Howler's MK2 announcement: "file timestamps are now set correctly".
    expect(itemOf('files', 'sets')).toMatchObject({
      check: 'Each DJ’s set',
      target: 'its own file, in file name order',
    });
    expect(itemOf('files', 'sets').note).toMatch(/If a set runs on into a second file, join the two\./);
    expect(itemOf('files', 'sets').note).toMatch(/Its file dates are unreliable: Howler fixed them in the MK2\.$/);
  });

  it('says what deleting the recordings costs before the line, and clears the card by deleting', () => {
    const clear = itemOf('files', 'clear');
    expect(clear).toMatchObject({
      id: 'clear',
      check: 'microSD card',
      target: 'files deleted',
      before:
        'Deleting the files on the microSD card deletes the original recordings. Delete them only after both copies match the card.',
    });
    // Howler MK1 manual: the card must be FAT32 ("MS-DOS (FAT)" on a Mac); Windows can't make FAT32 over 32 GB.
    expect(clear.note).toBe(
      'If you format it instead, choose FAT32: on a Mac, MS-DOS (FAT). On Windows, a card over 32 GB needs extra software for FAT32.',
    );
    // The only line with a consequence before it, and the last.
    expect(lists.flatMap((l) => l.items).filter((i) => i.before)).toEqual([clear]);
    expect(CHECKLISTS.files.items.at(-1)).toBe(clear);
  });

  it('looks for mixer clipping below full scale, flat or not quite, and sends crunch to F9', () => {
    const flat = itemOf('files', 'flat-tops');
    expect(`${flat.check} ${flat.target}`).toBe('Loudest blends, zoomed in no flat tops, at any height');
    // Audacity manual, View menu: Show Clipping in Waveform is off by default, and marks samples at 0 dB.
    expect(flat.note).toBe(
      'In the file, flat tops can ripple or lean a little. Audacity’s Show Clipping in Waveform is off by default, and marks only the top of the file. Mixer clipping sits lower.',
    );
    expect(flat.drill).toEqual({ if: 'If you see flat tops or hear crunch', id: 'crunch', code: 'F9' });
  });

  it('gives one healthy range for a set’s loudest peak, the model’s, and how to read it', () => {
    const peak = itemOf('files', 'peak');
    expect(TARGET.band).toEqual({ top: -6, bottom: -18 });
    expect(lineOf('files', 'peak')).toBe('Each set’s loudest peak between −18 and −6 dBFS');
    // Audacity manual, Amplify: the negative of the Amplification it offers is the selection's peak.
    expect(peak.note).toMatch(/^Audacity’s Amplify, in the Effect menu, reads it with the whole set selected\./);
    expect(peak.note).toMatch(
      /If the peak is higher than −6 dBFS, set the recording level again with S3 before the next event\.$/,
    );
  });

  it('normalises to −2 dB on the samples, and says why, with SoundCloud’s words', () => {
    const normalise = itemOf('files', 'normalise');
    expect(normalise.target).toBe('normalised to −2 dB');
    // Audacity sets the sample peak; SoundCloud asks loud masters for −2 dB true peak.
    expect(sentences(normalise.note ?? '')).toEqual([
      // Audacity's own name for the effect, as it prints it.
      'Audacity’s Normalize, in the Effect menu, sets the sample peak.',
      'At −2 dB it leaves room for the peaks between samples.',
      'SoundCloud asks a master louder than −14 LUFS to stay “below −2 dB TP (True Peak) max”.',
    ]);
    expect(allCopy.join(' ')).not.toMatch(/−1 dB true peak/);
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

  it('uses the site’s words: MASTER meters, recording level, microSD card, no USB backup', () => {
    const text = allCopy.join(' ');
    expect(text).not.toMatch(/middle meters?|record level|Howler card|memory card|MASTER REC|USB backup|USB stick/i);
    expect(text).not.toMatch(/\bBoth ATTs\b|\bthe tape\b/);
    expect(text).toMatch(/MASTER meters/);
    // Howler's manual calls it a microSD card, and the MK1 is fussy about which ones work.
    expect(text).not.toMatch(/(?<!micro)SD card/);
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
