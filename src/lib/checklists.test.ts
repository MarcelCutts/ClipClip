import { describe, expect, it } from 'vitest';
import {
  CHANNEL_METERS_WORDS,
  CHECKLIST_ORDER,
  CHECKLISTS,
  type ChecklistId,
  type ChecklistItem,
  type DrillRef,
  drillText,
  FADER_DOWN,
  HOWLER_RED_FIRST_ACTION,
  isChecklistId,
  MASTER_METERS_WORDS,
  NEXT_DJ_WORDS,
  progressText,
  RECORDING_DOWN,
  serialiseTicks,
  storageKey,
  ZERO_MARK,
} from './checklists';
import { drill } from './fixes';
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
  it('has the four lists, in running order', () => {
    expect(CHECKLIST_ORDER).toEqual(['doors', 'changeover', 'after', 'files']);
    for (const id of CHECKLIST_ORDER) expect(CHECKLISTS[id].id).toBe(id);
    expect(lists).toHaveLength(CHECKLIST_ORDER.length);
  });

  it('gives each list its own anchor for links from the chat', () => {
    expect(CHECKLIST_ORDER.map((id) => CHECKLISTS[id].anchor)).toEqual(['doors', 'changeover', 'after', 'next-day']);
    for (const list of lists) expect(list.anchor).toMatch(/^[a-z][a-z-]*$/);
  });

  it('codes the lists C1 to C4 in the order they run', () => {
    expect(CHECKLIST_ORDER.map((id) => CHECKLISTS[id].code)).toEqual(['C1', 'C2', 'C3', 'C4']);
    // The drills on the night page are F1, F2…, so no list's code can be mistaken for one.
    for (const list of lists) expect(list.code).toMatch(/^C[1-9]$/);
  });

  it.each(lists)('$title has named items, each with its own id', (list) => {
    expect(list.items.length).toBeGreaterThanOrEqual(5);
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
    expect(CHECKLISTS.doors.when).toContain('Every event');
    expect(CHECKLISTS.after).toMatchObject({ title: 'End of the night', when: 'When the last DJ finishes.' });
    expect(CHECKLISTS.files).toMatchObject({
      title: 'Next day',
      when: 'The day after, for whoever handles the recordings.',
    });
  });

  it('starts C1 with the table, and the night’s other lists with the recorder', () => {
    expect(CHECKLISTS.doors.items[0]?.check).toBe('Table top');
    expect(CHECKLISTS.changeover.items[0]?.check).toMatch(/Howler/);
    expect(CHECKLISTS.after.items[0]?.check).toMatch(/Howler/);
  });
});

describe('C1: the whole before-doors job', () => {
  const items = CHECKLISTS.doors.items;
  const ids = items.map((i) => i.id);
  /** The sections, each with its lines: a line with a `group` opens one. */
  const sections = items.reduce<{ name: string; lines: ChecklistItem[] }[]>((all, item) => {
    if (item.group) all.push({ name: item.group, lines: [] });
    all.at(-1)?.lines.push(item);
    return all;
  }, []);
  const copy = items.flatMap((i) => [i.check, i.target, i.before ?? '', i.note ?? '']).join(' ');

  it('runs in the order the booth is built: table, leads, power, levels, recording', () => {
    expect(sections.map((s) => s.name)).toEqual(['Table', 'Leads', 'Power', 'Levels', 'Record']);
    expect(items[0]?.group).toBe('Table');
    for (const [earlier, later] of [
      ['table-top', 'table-bolts'],
      ['table-bolts', 'rack-place'],
      ['rack-place', 'speaker-leads'],
      ['subs-place', 'speaker-leads'],
      ['tops-place', 'speaker-leads'],
      // The decks go on near the end (the owner): after the speakers are in, before their own leads.
      ['speaker-leads', 'mixer-place'],
      ['mixer-place', 'master-1'],
      ['speaker-leads', 'power-leads'],
      ['master-1', 'power-leads'],
      ['master-2', 'power-leads'],
      ['booth-out', 'power-leads'],
      ['amps-down', 'power-leads'],
      ['power-leads', 'howler-on'],
      ['howler-on', 'amps-start'],
      ['mixer-on', 'amps-start'],
      ['driverack-on', 'amps-start'],
      ['amps-start', 'soundcheck-file'],
      ['soundcheck-file', 'level'],
      ['trim', 'master-level'],
      ['master-level', 'level'],
      ['level', 'room-level'],
      ['room-level', 'first-file'],
    ])
      expect(ids.indexOf(earlier!), `${earlier} before ${later}`).toBeLessThan(ids.indexOf(later!));
    // Pioneer p.10: the power goes in after every other connection. dbx p.10: the amps go on last.
    expect(sections.find((s) => s.name === 'Power')?.lines.at(-1)?.id).toBe('amps-start');
    expect(itemOf('doors', 'speaker-leads').before).toBe(
      'Keep the rack’s power leads out while you connect the speakers.',
    );
  });

  it('cuts the long list into sections of six lines or fewer, as a pilot’s list is', () => {
    // Degani & Wiener (NASA, 1990), guideline 7: a long list is cut into smaller ones. Project Check: fewer
    // than 10 items per pause point. WHO: five to nine to a section is ideal; ours run shorter.
    for (const section of sections) {
      expect(section.lines.length, section.name).toBeGreaterThanOrEqual(3);
      expect(section.lines.length, section.name).toBeLessThanOrEqual(6);
    }
    expect(sections.map((s) => s.lines.length)).toEqual([6, 5, 6, 6, 3]);
    expect(items).toHaveLength(26);
  });

  it('places everything a later line leans on: the rack, the speakers, the mixer and the card', () => {
    expect(lineOf('doors', 'subs-place')).toBe('Subs on the ground, in front of the table');
    expect(lineOf('doors', 'mixer-place')).toBe('XDJ-RX2 on the table, between the booth monitors');
    // C3 takes the card away for the next day, so C1 puts one in.
    expect(itemOf('doors', 'howler-on').target).toMatch(/^microSD card in, /);
    expect(lineOf('after', 'card')).toMatch(/^microSD card /);
  });

  it('shows each drawing once, before the line it serves', () => {
    expect(items.flatMap((i) => i.figures ?? [])).toEqual(['table', 'booth', 'rackRear', 'mixerRear', 'rackFront']);
    expect(itemOf('doors', 'table-top').figures).toEqual(['table']);
    expect(itemOf('doors', 'rack-place').figures).toEqual(['booth']);
    expect(itemOf('doors', 'speaker-leads').figures).toEqual(['rackRear']);
    expect(itemOf('doors', 'master-1').figures).toEqual(['mixerRear']);
    expect(itemOf('doors', 'amps-down').figures).toEqual(['rackFront']);
  });

  it('stands alone: no line sends the crew to another card to carry on', () => {
    // FAA AC 120-71B, 4.9: "Go-in, Stay-in". A drill is named only for when a line is not so.
    for (const item of items) expect(item.help, item.id).toBeUndefined();
    expect(copy).not.toMatch(/\b[ST][1-9]\b|rig record|reference/i);
    expect(items.flatMap(refsOf).map((ref) => ref.code)).toEqual(['F1', 'F6', 'F4']);
  });

  it('goes by what the crew can see: no marks, no tape, no test recording', () => {
    // The owner, 28 September 2026: the gear carries no marks and none are planned, and nobody can listen
    // to a recording at the event. Earthing and the supply's protection are not this guide's subject.
    expect(copy).not.toMatch(/\bmarks?\b|\btape\b|\bREC\b|\bRIG\b/);
    expect(copy).not.toMatch(/test recording|headphones/i);
    expect(copy).not.toMatch(/RCD|earth|generator|competent/i);
  });

  it('builds the table from the trolley, and faces the rack’s knobs to the crowd', () => {
    expect(lineOf('doors', 'table-top')).toBe('Table top on both handles, a monitor’s bracket over each hole');
    // The maker: "Remember to retighten the wingbolts after changing the frame length."
    expect(itemOf('doors', 'table-top').note).toBe(
      'If the holes do not line up, change the frame’s length, then tighten its wingbolts.',
    );
    // The owner: bolt and washer, the monitor's bracket, the top, the handle, then the wingnut.
    expect(lineOf('doors', 'table-bolts')).toBe(
      'Both bolts through bracket, top and handle, wingnuts tight underneath',
    );
    expect(lineOf('doors', 'brakes')).toBe('Caster brakes both on');
    expect(lineOf('doors', 'rack-place')).toBe('Rack on the trolley’s bed, knobs facing the crowd');
    // Yamaha, Club Series V manual p.2: a stand's legs fully opened.
    expect(lineOf('doors', 'tops-place')).toBe('Tops on their stands, legs fully open');
  });

  it('names each lead by the socket it leaves, and where it ends', () => {
    // The owner: the upper amp drives the tops and the lower the subs. QSC p.7: "Insert and turn until the
    // connector clicks."
    expect(lineOf('doors', 'speaker-leads')).toBe(
      'Speaker leads tops in the top amp, subs in the bottom amp, each turned until it clicks',
    );
    expect(lineOf('doors', 'master-1')).toBe('MASTER 1 two XLR leads to the DriveRack’s inputs');
    // Howler MK1 manual: "RCA IN connectors (A)", and "RCA OUT connectors (B)" at the other end.
    expect(lineOf('doors', 'master-2')).toBe('MASTER 2 RCA lead to the Howler’s IN');
    expect(lineOf('doors', 'booth-out')).toBe('BOOTH a lead to each booth monitor');
  });

  it('powers up with the amps down and last, each on a socket of its own', () => {
    expect(lineOf('doors', 'amps-down')).toBe('Both amps POWER off, all four gain knobs fully down');
    expect(lineOf('doors', 'power-leads')).toBe('Power leads in, each amp on a socket of its own');
    expect(itemOf('doors', 'power-leads').note).toBe(
      'Both GX7s can draw about 26\u00a0A together in short bursts (QSC p.\u00a011). A 13\u00a0A strip cannot take both.',
    );
    expect(lineOf('doors', 'amps-start')).toBe('Both amps switched on last');
    expect(itemOf('doors', 'driverack-on').note).toBe('It has no power switch (dbx p.\u00a010).');
  });

  it('switches the Howler on, on WAV and on charge, and allows it its ten seconds', () => {
    // Howler MK1 manual: "It can take up to 10 seconds before your microSD card is initialised after
    // inserting/turning on Howler"; the mode switch chooses the format; "We recommend to charge Howler
    // while recording just to be safe."
    expect(lineOf('doors', 'howler-on')).toBe('Howler microSD card in, on charge, mode switch on WAV, switched on');
    expect(itemOf('doors', 'howler-on').note).toBe(
      'It takes up to 10\u00a0seconds to read its microSD card. Its BATTERY light is red while it charges.',
    );
  });

  it('sets MASTER LEVEL by the MASTER meters, as Pioneer does', () => {
    // Pioneer p.31: "Rotate the [MASTER LEVEL] control to confirm that the orange indicator lights up at
    // the highest volume for the track." p.34: "around [0 dB] at the peak level".
    expect(lineOf('doors', 'trim')).toBe(`One loud track, its TRIM channel meter on the ${DJ_RULES[0]?.response}`);
    // The MASTER meters show the mix, so they match the channel's meter only with its fader fully up.
    expect(lineOf('doors', 'master-level')).toBe(
      'MASTER LEVEL, with the channel fader fully up MASTER meters on the first orange (0) too',
    );
    expect(itemOf('doors', 'master-level').note).toBe(
      'Pioneer sets it by the MASTER meters (p.\u00a031). It stays there for the night.',
    );
    expect(lineOf('doors', 'room-level')).toBe('Amp gain knobs up to the room’s volume, CLIP lights dark');
  });

  it('reads the Howler’s light while it records, then gives the first set a file of its own', () => {
    // Howler MK1 manual: "correctly recording when the RECORD button is blinking constantly, and the LEVEL
    // indicator is blinking green".
    expect(lineOf('doors', 'soundcheck-file')).toBe('Howler recording, RECORD blinking');
    expect(itemOf('doors', 'soundcheck-file').note).toBe(
      'If RECORD stops blinking soon after you press it, use another FAT32 microSD card.',
    );
    expect(lineOf('doors', 'first-file')).toBe('Howler recording a new file for the first set, RECORD blinking');
    expect(itemOf('doors', 'first-file').note).toBe(
      'Press RECORD to stop the soundcheck’s file, then again to start a new one.',
    );
    expect(itemOf('doors', 'start').check).toContain('name and recording start time');
    expect(items.at(-1)?.id).toBe('booth-card');
  });
});

describe('the night’s lists', () => {
  it('start a new file at every changeover, with RECORD blinking, and note who is next', () => {
    expect(CHECKLISTS.changeover.items.map((i) => i.id)).toEqual([
      'light',
      'charge',
      'new-file',
      'amp-clip',
      'next-dj',
    ]);
    // Howler MK1 manual: a WAV file holds about 3.5 hours, then carries on in a new one with a gap. A new file at
    // every changeover keeps any gap between DJs, however long the sets. RECORD blinking means it is recording.
    expect(lineOf('changeover', 'new-file')).toBe('Howler recording a new file for the next set, RECORD blinking');
    expect(itemOf('changeover', 'new-file').note).toBe(
      'If it is still the last set’s file, press RECORD to stop it, then again to start a new one. If RECORD stops blinking soon after, put in another FAT32 microSD card.',
    );
    expect(lineOf('changeover', 'next-dj')).toBe('Next DJ name and start time noted, shown the booth card');
    // The cards have nowhere to write: the crew hold the names and times.
    expect(itemOf('files', 'sets').note).toMatch(/^The crew noted the start times and the DJs’ names at C1 and C2\./);
  });

  it('put the Howler on charge before the new file: a low battery starts nothing new off charge', () => {
    // Howler MK1 manual: with around an hour left, "You are unable to start new recordings until you connect a
    // charger." The charger comes before the line that starts one.
    const ids = CHECKLISTS.changeover.items.map((i) => i.id);
    expect(ids.indexOf('charge')).toBeLessThan(ids.indexOf('new-file'));
    expect(lineOf('changeover', 'charge')).toBe('Howler on charge');
  });

  it('name the Howler’s light every time: the BATTERY light is red all the time it charges', () => {
    expect(itemOf('doors', 'howler-on').note).toContain('Its BATTERY light is red while it charges.');
    expect(allCopy.join(' ')).not.toMatch(/Howler(?:’s)? (?:red )?light\b|red light on the Howler/);
  });

  it('look at the amps’ lights at the changeover, in the crew box’s words', () => {
    const rule = CREW_RULES.find((r) => r.drill === 'no-louder');
    expect(lineOf('changeover', 'amp-clip')).toBe('Amp CLIP lights dark');
    expect(itemOf('changeover', 'amp-clip').note).toBe(rule?.note);
    expect(rule?.note).toBe('If one flashes, turn all four gain knobs back one click.');
  });

  it('send a DJ’s MY SETTINGS to its drill, since there is no record to set the mixer back to', () => {
    expect(itemOf('changeover', 'next-dj').drill).toEqual({
      if: 'If the DJ loads MY SETTINGS',
      id: 'my-settings',
      code: 'F7',
    });
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

  it('send nobody into UTILITY: no list names the menu', () => {
    // No card changes a UTILITY setting, so none needs to say how to open it.
    expect(allCopy.join(' ')).not.toMatch(/UTILITY/);
  });

  it('say what the (0) is where the crew first meet it', () => {
    // Pioneer's panel prints the scale between the lights: 12, 9, 6, 3, 0, −3 … (p.27).
    expect(ZERO_MARK).toBe('The mixer prints 0 beside that light.');
    expect(itemOf('doors', 'trim').note).toBe(ZERO_MARK);
    const first = lists.flatMap((l) => l.items).find((i) => /\(0\)/.test(`${i.target} ${i.note ?? ''}`));
    expect(first?.id).toBe('trim');
  });

  it('leave the attenuators to the drills: no list names one', () => {
    expect(allCopy.join(' ')).not.toMatch(/MASTER ATT|BOOTH ATT/);
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
    // Pioneer p.35: settings are stored when the unit goes off at its own switch.
    expect(itemOf('after', 'xdj-off').note).toBe(
      'Switched off at the wall, it can lose its settings (Pioneer, p. 35).',
    );
    // dbx p.10: the PA2 has no power switch.
    expect(itemOf('after', 'rest-off').note).toBe(
      'The DriveRack has no power switch: it goes off at its socket (dbx p. 10).',
    );
  });
});

describe('a red LEVEL light', () => {
  it('gets its first action on C1 and C2, the crew box’s words, and F1 for the rest', () => {
    for (const [list, item, check] of [
      // At soundcheck a blend is the test: two tracks at once are the loudest a set gets.
      ['doors', 'level', 'Howler LEVEL light, on a loud blend'],
      ['changeover', 'light', 'Howler LEVEL light'],
    ] as const) {
      const line = itemOf(list, item);
      expect(`${line.check} ${line.target}`).toBe(`${check} blinking green`);
      expect(line.note).toMatch(new RegExp(`^${HOWLER_RED_FIRST_ACTION} If they are red, `));
      expect(line.drill).toEqual({ if: 'If they are below red', id: 'howler-red', code: 'F1' });
    }
    // At a changeover there is a DJ to tell. At soundcheck the crew play the blend themselves.
    expect(itemOf('changeover', 'light').note).toBe(
      `${HOWLER_RED_FIRST_ACTION} If they are red, say to the DJ: “${FADER_DOWN}”`,
    );
    expect(itemOf('doors', 'level').note).toBe(
      `${HOWLER_RED_FIRST_ACTION} If they are red, pull a channel fader down a little.`,
    );
    expect(CHECKLISTS.doors.items.map((i) => i.note ?? '').join(' ')).not.toMatch(/say to the DJ/i);
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

  it('words how the recording comes down once, with only what is published', () => {
    expect(RECORDING_DOWN.challenge).toBe('MASTER LEVEL');
    expect(RECORDING_DOWN.response).toBe('down a little at a time, until the Howler’s LEVEL light blinks green');
    // The MASTER meters read after MASTER LEVEL (Pioneer p.31). Where the mixer clips inside is not published, so
    // no card says a blend can crunch before they show red.
    expect(RECORDING_DOWN.consequence).toBe('After this step, the MASTER meters read low.');
    expect(allCopy.join(' ')).not.toMatch(/crunch before|hide a blend|hides a blend/i);
  });

  it('cite no card that has gone: no test and no setup card', () => {
    expect(allCopy.join(' ')).not.toMatch(/\b(?:T[1-9]|S[1-9])\b/);
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
    expect(itemOf('files', 'sets').note).toMatch(
      /The MK1’s file dates are unreliable: Howler fixed them in the MK2\.$/,
    );
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
    expect(CHECKLISTS.files.items.filter((i) => i.before)).toEqual([clear]);
    expect(CHECKLISTS.files.items.at(-1)).toBe(clear);
  });

  it('looks for mixer clipping below full scale, flat or not quite, and sends crunch to F9', () => {
    const flat = itemOf('files', 'flat-tops');
    expect(`${flat.check} ${flat.target}`).toBe('Loudest blends, zoomed in no flat tops, at any height');
    // Audacity manual, View menu: Show Clipping in Waveform is off by default, and marks samples at 0 dB.
    // Audacity 4 keeps it in the same menu, so the note names the menu.
    expect(flat.note).toBe(
      'In the file, flat tops can ripple or lean a little. Audacity’s Show Clipping in Waveform, in the View menu, is off by default, and marks only the top of the file. Mixer clipping sits lower.',
    );
    expect(flat.drill).toEqual({ if: 'If you see flat tops or hear crunch', id: 'crunch', code: 'F9' });
  });

  it('asks only that a set’s loudest peak is below the top of the file, and says how to read it', () => {
    const peak = itemOf('files', 'peak');
    // Nobody sets the recording to a band now, and a quiet recording is fine: only the top matters.
    expect(lineOf('files', 'peak')).toBe('Each set’s loudest peak below 0 dBFS');
    // Audacity manual, Amplify: the negative of the Amplification it offers is the selection's peak. The
    // submenu is the same in Audacity 3.7 and 4, so the note names it.
    expect(peak.note).toBe(
      'Audacity’s Amplify is in the Effect menu, under Volume and Compression. With the whole set selected, its Amplification box shows how far the peak is below the top: 12 dB means −12 dBFS.',
    );
    expect(peak.drill).toEqual({ if: 'If the box shows 0', id: 'crunch', code: 'F9' });
  });

  it('normalises to −2 dB on the samples, and says why, with SoundCloud’s words', () => {
    const normalise = itemOf('files', 'normalise');
    expect(normalise.target).toBe('normalised to −2 dB');
    // Audacity's built-in tools set the sample peak and cannot show the true peak. On 10 tracks and their blends,
    // −2 dB put the true peak at −1 dB or lower in 54 of 55: SoundCloud's ask at −14 LUFS.
    expect(sentences(normalise.note ?? '')).toEqual([
      // Audacity's own name for the effect, as it prints it, and where both 3.7 and 4 put it.
      'Audacity’s Normalize, in the Effect menu under Volume and Compression, sets the sample peak.',
      'The true peak, between samples, can sit higher, and Audacity’s built-in tools do not show it.',
      'At −2 dB, a set usually meets SoundCloud’s ask for a master at −14 LUFS: true peaks below −1 dB.',
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
});

describe('copy', () => {
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

  it('invalidates saved completion when an instruction changes, even if its id stays the same', () => {
    const item = CHECKLISTS.doors.items[0]!;
    const before = storageKey('doors');
    const original = item.target;
    try {
      item.target = `${original}; changed instruction`;
      expect(storageKey('doors')).not.toBe(before);
    } finally {
      item.target = original;
    }
    expect(storageKey('doors')).toBe(before);
  });

  it('saves when the ticks changed and which items are ticked', () => {
    const now = 1_790_000_000_000;
    expect(JSON.parse(serialiseTicks(['howler', 'rec'], now))).toEqual({ at: now, done: ['howler', 'rec'] });
    expect(JSON.parse(serialiseTicks(new Set(['light']), now))).toEqual({ at: now, done: ['light'] });
  });
});
