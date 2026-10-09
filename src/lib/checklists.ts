/**
 * The crew checklists, used by the <Checklist> island on /night/ and /recordings/, the printed crew cards
 * and a short crew chat reminder linking to the full workflow.
 *
 * How they're built:
 * - Each list belongs to one pause point, and says when (`when`). Every list is read-and-do: read a
 *   line, then do it. Pause points, READ-DO and DO-CONFIRM, and five to nine items to a list come from
 *   Boorman of Boeing as Gawande reports him (The Checklist Manifesto, 2009, pp. 111 and 123) and from
 *   the WHO Surgical Safety Checklist manual (2009, p. 13). Five to nine is a rule of thumb, not a law.
 * - C1 is the long one, so it is cut into sections at the evening's natural breaks (`group`), none
 *   longer than six lines: NASA's guideline 7 (Degani & Wiener, 1990), and Project Check's "fewer than
 *   10 items per pause point". Its lines run in the order the work is done and the gear is laid out
 *   (guideline 8).
 * - The drawings carry the how (`figures`); the lines confirm the states that matter. The FAA has
 *   pilots set up by a "flow", then run a checklist of "the most critical items within that flow and
 *   items that confirm the flow was done correctly" (AC 120-71B, 5.1.2). Where one state proves the
 *   steps before it, the line names that state (5.2.4, representative items): a top bolted to both
 *   handles proves the handles are up.
 * - A section stands alone. It never sends the reader to another card to carry on (AC 120-71B, 4.9:
 *   "Go-in, Stay-in"). A drill is named only for when a line isn't so.
 * - Written for one person working alone, so there is no completion call and no time budget: nobody
 *   has timed a real run.
 * - A line is the name printed on the gear, leader dots, and the state you can see. It is
 *   never "check" or "set", which Degani & Wiener (NASA, 1990) found get said without looking. The
 *   killer item goes first (Degani & Wiener, 1990).
 * - A note carries what to do if the line isn't so, starting "If …", or a fact. A consequence someone
 *   must know first, like deleting the recordings on the microSD card, is a plain sentence before the
 *   line (`before`).
 *
 * Wiring, one way only: MASTER 1 (XLR) feeds the DriveRack PA2 and the amps, MASTER 2 (RCA) feeds the
 * Howler, BOOTH feeds the booth monitors. MASTER LEVEL sets MASTER 1 and MASTER 2 together (Pioneer
 * manual p.27).
 *
 * The rig as it is built (the owner, 28 September 2026). The table is the trolley: a plywood top on
 * its two raised handles. At each end one M8 bolt holds three things: from the top down, the bolt and
 * its washer, the foot of a booth monitor's L-shaped bracket, the table top, the handle's top bar, and
 * a wingnut. Each monitor is screwed to its bracket's upright. The rack rides on the trolley's
 * bed under the table, knobs to the crowd and sockets to the DJ. The upper amp drives the tops and the
 * lower amp the subs. The subs stand in front of the table and the tops on stands. The decks go on
 * near the end. The gear carries no tape and no marks, and nobody can listen to a recording at the
 * event, so C1 sets levels by what the crew can see:
 * - MASTER LEVEL by the MASTER meters, as Pioneer does: "Rotate the [MASTER LEVEL] control to confirm
 *   that the orange indicator lights up at the highest volume for the track" (p.31), "around [0 dB] at
 *   the peak level" (p.34);
 * - the recording by the Howler's LEVEL light, on a blend, since a blend is the loudest a set gets;
 * - the room by the amps' gain knobs, with their CLIP lights dark (QSC p.5).
 *
 * Power. QSC gives the GX7's current, not its watts (p.11): at 230 V the pair draws about 13.4 A at
 * peak programme levels and about 26.5 A in full-power bursts, and a UK strip or plug is 13 A.
 * Those are QSC's 8 + 8 Ω rows. Yamaha's Club Series V manual lists the S112V and S115V as 8 Ω and the
 * S215V as 4 Ω; on 4 Ω a GX7 draws more current (QSC's 4 + 4 Ω rows), so the C1 note holds either way. dbx: the
 * amps go on last, with no audio passing, and off first, about 10 seconds before the rest (p.10).
 * Hum, earthing and the supply's protection are a separate subject, and not this guide's (the owner).
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes are curly.
 */
import { formatDb } from './dsp/db';
import { CREW_RULES, DJ_RULES, type Rule } from './rules';

export type ChecklistId = 'doors' | 'changeover' | 'after' | 'files';

/**
 * A drill to go to when a line isn't so, said after its note: "If they are below red, go to F1." The
 * code is the drill's own (fixes.ts), copied here so the checklist island doesn't carry every drill;
 * the tests keep the two in step.
 */
export interface DrillRef {
  /** When to go to it, as a condition without its comma: "If they are below red". */
  if: string;
  /** The drill's id: it lands on /night/#fix-<id>. */
  id: string;
  /** The drill's code, as its title strip gives it: "F1". */
  code: string;
}

/** The drawings a list can show at the head of a group (components/figures). */
export type FigureId = 'table' | 'booth' | 'rackRear' | 'mixerRear' | 'rackFront';

export interface ChecklistItem {
  /** Stable key, used to remember the tick. Change it if the item's meaning changes. */
  id: string;
  /** A task boundary, shown before this item. */
  group?: string;
  /** The drawings this line needs, shown before it (and under its group's name, if it opens one). */
  figures?: readonly FigureId[];
  /** Supporting procedure, needed only if this check fails or is unfamiliar. */
  help?: { path: string; label: string };
  /** What to look at, named as it's printed on the gear. */
  check: string;
  /** The state you should see. */
  target: string;
  /** A consequence to know before doing the line, as a plain sentence set before it. */
  before?: string;
  /** What to do if the line isn't so ("If …, …"), or a fact about it. */
  note?: string;
  /** The drill, or drills, for when the line isn't so, said after the note: "If they light, go to F6." */
  drill?: DrillRef | readonly DrillRef[];
}

export interface Checklist {
  id: ChecklistId;
  /** The id of the list's heading on its page, for links such as /night/#doors. */
  anchor: string;
  /**
   * Its code in the handbook, on its title strip and in the night page's index: C1 to C4 for a night's
   * lists in the order they run. The old setup route (/setup/#setup) leads to C1.
   */
  code: string;
  title: string;
  /** The pause point: when to run it, and for whom if that isn't the crew on the night. */
  when: string;
  items: readonly ChecklistItem[];
}

/**
 * How the recording comes down when the Howler blinks red with the MASTER meters below red (F1): MASTER
 * LEVEL, a little at a time, until the LEVEL light is green. It sets MASTER 1 and MASTER 2 together
 * (Pioneer p.27), so the room comes down too, and the amps bring it back. The MASTER meters read after
 * it (p.31), so from then on they read low. Pioneer's own fix for distorted sound is to turn MASTER
 * LEVEL down (p.34). No card changes MASTER ATT: Pioneer does not say which sockets it reaches.
 */
export const RECORDING_DOWN = {
  /** As a step: the control, and what to do with it. */
  challenge: 'MASTER LEVEL',
  response: 'down a little at a time, until the Howler’s LEVEL light blinks green',
  /** What it costs, said before the step. */
  consequence: 'After this step, the MASTER meters read low.',
} as const;

/** A line of the DJ box (rules.ts) by its tape label, so a missing line fails loudly. */
function djRule(label: string): Rule {
  const rule = DJ_RULES.find((r) => r.label === label);
  if (!rule) throw new Error(`The DJ box has no line labelled ${label} (rules.ts)`);
  return rule;
}

/** A line of the crew box (rules.ts) by the drill it names, so a missing line fails loudly. */
function crewRule(drillId: string): Rule {
  const rule = CREW_RULES.find((r) => r.drill === drillId);
  if (!rule) throw new Error(`The crew box has no line for the drill ${drillId} (rules.ts)`);
  return rule;
}

/**
 * What to say when the MASTER meters show red, or their top orange lights: the action in the DJ box's
 * note for the MASTER meters (rules.ts), as the words to the DJ. F1, F3 and F6 say it, and so do the
 * Howler lines below.
 */
export const FADER_DOWN = 'Pull a channel fader down a little.';

/**
 * What the (0) is: the mark on the meter's scale, which the panel prints beside each light (Pioneer
 * p.27: 12, 9, 6, 3, 0, −3 … −24, dB). Said once where a page first gives the target.
 */
export const ZERO_MARK = 'The mixer prints 0 beside that light.';

/**
 * The DJ box's first line, as the crew say it to a DJ: "Keep the channel meters on the first orange (0)
 * at the loudest part." Built from the box (rules.ts), so the booth card and the crew can't disagree.
 */
export const CHANNEL_METERS_WORDS = `Keep the channel meters on the ${djRule('TRIM').response}.`;

/**
 * The DJ box's line for the MASTER meters, "top orange dark", as the crew say it to a DJ. Said in F3
 * and F9; the tests keep it in step with the box.
 */
export const MASTER_METERS_WORDS = 'Keep the top orange on the MASTER meters dark.';

/**
 * The first thing to do when the Howler's LEVEL light blinks red, as one sentence: F1's step 1, and the
 * crew box's note for that light (rules.ts), taken from there so the two can't drift apart. The Howler
 * lines on C1 and C2 open their note with it, so the printed cards carry the first action, with F1 for
 * the rest.
 */
export const HOWLER_RED_FIRST_ACTION: string = (() => {
  const rule = CREW_RULES.find((r) => r.drill === 'howler-red');
  if (!rule) throw new Error('The crew box has no line for the Howler’s red light (rules.ts)');
  return rule.note;
})();

/**
 * What the Howler lines on C1 and C2 say under the line: the first action, and what each finding means.
 * Red, not the top orange, is where the crew step in.
 */
const HOWLER_RED_NOTE = `${HOWLER_RED_FIRST_ACTION} If they are red, say to the DJ: “${FADER_DOWN}”`;

/** The same at soundcheck (C1), where the crew play the blend themselves and no DJ is there to tell. */
const HOWLER_RED_AT_SOUNDCHECK = `${HOWLER_RED_FIRST_ACTION} If they are red, ${FADER_DOWN.replace(/^P/, 'p')}`;

/** Where the Howler lines send the crew when the MASTER meters are below red. */
const HOWLER_RED: DrillRef = { if: 'If they are below red', id: 'howler-red', code: 'F1' };

/**
 * What the crew say to the next DJ at a changeover: the DJ box's first line and the deal on volume,
 * in the box's own words (rules.ts), so the booth card and the crew agree.
 */
export const NEXT_DJ_WORDS = `${CHANNEL_METERS_WORDS} ${djRule('RIG').text ?? ''}`.trim();

/** The top of the file, where a recording can go no higher: "0 dBFS". */
const FILE_TOP = formatDb(0, { unit: 'dBFS', signed: false });

/** A line's drills, in words: "If they are below red, go to F1." */
export const drillText = (ref: DrillRef | readonly DrillRef[]): string =>
  [ref]
    .flat()
    .map((r) => `${r.if}, go to ${r.code}.`)
    .join(' ');

export const CHECKLISTS: Readonly<Record<ChecklistId, Checklist>> = {
  doors: {
    id: 'doors',
    anchor: 'doors',
    code: 'C1',
    title: 'Before doors',
    when: 'Every event, from unloading the trolley to starting the first set.',
    items: [
      // ---- Table: the trolley becomes the table. RocknRoller R12: both sides raised, a hole in each top
      // bar, brakes on the two front casters, wingbolts to hold the frame's length (maker's sheet, 2017).
      // The bolts are the representative item (FAA AC 120-71B, 5.2.4): a bolt through bracket, top and
      // handle proves the frame's length, the raised handles and the monitors' places.
      {
        id: 'table-top',
        group: 'Table',
        figures: ['table'],
        check: 'Table top',
        target: 'on both handles, a monitor’s bracket over each hole',
        note: 'If the holes do not line up, change the frame’s length, then tighten its wingbolts.',
      },
      {
        id: 'table-bolts',
        check: 'Both bolts',
        target: 'through bracket, top and handle, wingnuts tight underneath',
      },
      { id: 'brakes', check: 'Caster brakes', target: 'both on' },
      {
        id: 'rack-place',
        figures: ['booth'],
        check: 'Rack',
        target: 'on the trolley’s bed, knobs facing the crowd',
      },
      { id: 'subs-place', check: 'Subs', target: 'on the ground, in front of the table' },
      {
        // Yamaha, Club Series V manual p.2: a stand's legs fully opened, and one speaker to a stand.
        id: 'tops-place',
        check: 'Tops',
        target: 'on their stands, legs fully open',
      },

      // ---- Leads: upper amp to the tops, lower amp to the subs (the owner). Pioneer's rear panel, left
      // to right from behind: MASTER 1, MASTER 2, BOOTH, then the inputs (manual p.10).
      {
        id: 'speaker-leads',
        group: 'Leads',
        figures: ['rackRear'],
        check: 'Speaker leads',
        target: 'tops in the top amp, subs in the bottom amp, each turned until it clicks',
        before: 'Keep the rack’s power leads out while you connect the speakers.',
      },
      { id: 'mixer-place', check: 'XDJ-RX2', target: 'on the table, between the booth monitors' },
      {
        id: 'master-1',
        figures: ['mixerRear'],
        check: 'MASTER 1',
        target: 'two XLR leads to the DriveRack’s inputs',
      },
      {
        // Howler MK1 manual: the mixer's output goes to "RCA IN connectors (A)"; "RCA OUT connectors (B)"
        // pass the sound on. The mixer's LINE/PHONO and AUX inputs are RCA sockets too (Pioneer p.10).
        id: 'master-2',
        check: 'MASTER 2',
        target: 'RCA lead to the Howler’s IN',
      },
      { id: 'booth-out', check: 'BOOTH', target: 'a lead to each booth monitor' },

      // ---- Power: Pioneer, "Connect the power cord to a power outlet after all the connections are
      // completed" (p.10). dbx: the amps go on last (p.10). Howler MK1 manual: "It can take up to 10
      // seconds before your microSD card is initialised after inserting/turning on Howler"; the mode
      // switch chooses MP3 or WAV; "We recommend to charge Howler while recording just to be safe."
      {
        id: 'amps-down',
        group: 'Power',
        figures: ['rackFront'],
        check: 'Both amps',
        target: 'POWER off, all four gain knobs fully down',
      },
      {
        id: 'power-leads',
        check: 'Power leads',
        target: 'in, each amp on a socket of its own',
        note: 'Both GX7s can draw about 26 A together in short bursts (QSC p. 11). A 13 A strip cannot take both.',
      },
      {
        id: 'howler-on',
        check: 'Howler',
        target: 'microSD card in, on charge, mode switch on WAV, switched on',
        note: 'It takes up to 10 seconds to read its microSD card. Its BATTERY light is red while it charges.',
      },
      { id: 'mixer-on', check: 'XDJ-RX2 and booth monitors', target: 'switched on' },
      {
        id: 'driverack-on',
        check: 'DriveRack',
        target: 'screen lit',
        note: 'It has no power switch (dbx p. 10).',
      },
      { id: 'amps-start', check: 'Both amps', target: 'switched on last' },

      // ---- Levels: by the meters and the lights, since the gear carries no marks. The Howler's light is
      // read while it records, as its manual describes it: "correctly recording when the RECORD button is
      // blinking constantly, and the LEVEL indicator is blinking green".
      {
        id: 'soundcheck-file',
        group: 'Levels',
        check: 'Howler',
        target: 'recording, RECORD blinking',
        note: 'If RECORD stops blinking soon after you press it, use another FAT32 microSD card.',
      },
      {
        id: 'trim',
        check: 'One loud track, its TRIM',
        target: `channel meter on the ${djRule('TRIM').response}`,
        note: ZERO_MARK,
      },
      {
        id: 'master-level',
        check: 'MASTER LEVEL, with the channel fader fully up',
        target: 'MASTER meters on the first orange (0) too',
        note: 'Pioneer sets it by the MASTER meters (p. 31). It stays there for the night.',
      },
      {
        id: 'level',
        check: 'Howler LEVEL light, on a loud blend',
        target: 'blinking green',
        note: HOWLER_RED_AT_SOUNDCHECK,
        drill: HOWLER_RED,
      },
      {
        id: 'driverack-clip',
        check: 'DriveRack input CLIP lights',
        target: 'dark',
        drill: { if: 'If they light', id: 'driverack-clip', code: 'F6' },
      },
      {
        id: 'room-level',
        check: 'Amp gain knobs',
        target: 'up to the room’s volume, CLIP lights dark',
        drill: { if: 'If the room is too quiet', id: 'not-loud', code: 'F4' },
      },

      // ---- Record: a file of its own for the first set, as C2 gives every set after it ----
      {
        id: 'first-file',
        group: 'Record',
        check: 'Howler recording',
        target: 'a new file for the first set, RECORD blinking',
        note: 'Press RECORD to stop the soundcheck’s file, then again to start a new one.',
      },
      { id: 'start', check: 'First DJ’s name and recording start time', target: 'noted' },
      { id: 'booth-card', check: 'Booth card', target: 'by the meters' },
    ],
  },

  changeover: {
    id: 'changeover',
    anchor: 'changeover',
    code: 'C2',
    title: 'Changeover',
    when: 'Between DJs, before the next one starts.',
    items: [
      {
        id: 'light',
        check: 'Howler LEVEL light',
        target: 'blinking green',
        note: HOWLER_RED_NOTE,
        drill: HOWLER_RED,
      },
      {
        // Howler MK1 manual: the BATTERY indicator is "red when charging". "The BATTERY indicator blinks blue and red
        // when you have around 1 hour left of recording. You are unable to start new recordings until you connect a
        // charger." The next line starts one, so the charger comes first. The warning came with firmware 1.2
        // (Howler's update notes, 7 November 2023).
        id: 'charge',
        check: 'Howler',
        target: 'on charge',
      },
      {
        // Howler MK1 manual: a WAV file holds "about 3.5 hours of recording per file (≈4GB)", then recording carries
        // on in a new file, "though there will be a brief ~1 second audio gap" (the FAQ says half a second). A new
        // file at every changeover puts any gap between DJs, whatever the sets' lengths, and gives each set its own
        // file. Recording is running "when the RECORD button is blinking constantly"; if it "stops blinking soon
        // after you've pushed it, there is something wrong with the microSD card, or the microSD card is full".
        // Howler's FAQ says a full card makes RECORD "blink rapidly", the MK2 manual's words; this rig is a MK1.
        id: 'new-file',
        check: 'Howler recording',
        target: 'a new file for the next set, RECORD blinking',
        note: 'If it is still the last set’s file, press RECORD to stop it, then again to start a new one. If RECORD stops blinking soon after, put in another FAT32 microSD card.',
      },
      {
        // QSC GX manual p.5: the red CLIP LEDs flash when the amp is overdriven. The crew box's line and
        // its remedy (rules.ts), at the pause when someone can walk round to the rack's front.
        id: 'amp-clip',
        check: crewRule('no-louder').challenge,
        target: crewRule('no-louder').response,
        note: crewRule('no-louder').note,
      },
      {
        // The name and time name each set's file the next day (C4), and cut a set that shares a file.
        // Pioneer manual p.31: MY SETTINGS can call out UTILITY settings from a USB device, and both
        // attenuators are UTILITY settings (p.32), so a stick may change the level at the outputs (F7).
        id: 'next-dj',
        check: 'Next DJ',
        target: 'name and start time noted, shown the booth card',
        note: `Say: “${NEXT_DJ_WORDS}”`,
        drill: { if: 'If the DJ loads MY SETTINGS', id: 'my-settings', code: 'F7' },
      },
    ],
  },

  after: {
    id: 'after',
    anchor: 'after',
    code: 'C3',
    title: 'End of the night',
    when: 'When the last DJ finishes.',
    items: [
      {
        id: 'stop',
        check: 'Howler recording',
        target: 'stopped with RECORD',
      },
      {
        // dbx manual p.10: power the amps down first, wait about 10 seconds, then the mixer and the PA2.
        id: 'amps-off',
        check: 'Both amps',
        target: 'switched off',
      },
      {
        // Pioneer manual p.35, for "Settings are not stored in the memory": "Turn this unit off 10 seconds after
        // changing the settings. Make sure to press the [power] switch to turn this unit off." Its own switch,
        // never the wall.
        id: 'xdj-off',
        check: 'XDJ-RX2',
        target: 'switched off at its own switch, about 10 seconds later',
        note: 'Switched off at the wall, it can lose its settings (Pioneer, p. 35).',
      },
      {
        // dbx manual p.10: "Since the PA2 does not have a power switch, an AC power strip or power conditioner can be
        // used for switching power to the PA2 on or off."
        id: 'rest-off',
        check: 'The rest of the rig',
        target: 'switched off',
        note: 'The DriveRack has no power switch: it goes off at its socket (dbx p. 10).',
      },
      {
        id: 'charge',
        check: 'Howler',
        target: 'on charge',
      },
      {
        id: 'card',
        check: 'microSD card',
        target: 'kept safe for the next day',
      },
    ],
  },

  files: {
    // For whoever handles the recordings: sometimes the DJs get them, sometimes one person works on them first.
    id: 'files',
    anchor: 'next-day',
    code: 'C4',
    title: 'Next day',
    when: 'The day after, for whoever handles the recordings.',
    items: [
      {
        // The work below is on one copy; the other stays as the Howler wrote it (F9 needs it). Two drives, not two
        // folders on one drive: a drive that fails takes both.
        id: 'copies',
        check: 'microSD card files',
        target: 'copied to two drives, one copy kept as it is',
      },
      {
        // A file that stops early shows as a smaller size, or goes quiet before its end.
        id: 'play',
        check: 'Both copies',
        target: 'same files and sizes as the card, the end of each file playing',
      },
      {
        // C2 starts a new file at each changeover. Howler MK1 manual: a WAV file holds about 3.5 hours, then
        // recording carries on in a new file with up to a second missing. Howler's MK2 announcement (May 2026): "file
        // timestamps are now set correctly", so the MK1's dates can't put the files in order; their names can.
        id: 'sets',
        check: 'Each DJ’s set',
        target: 'its own file, in file name order',
        note: 'The crew noted the start times and the DJs’ names at C1 and C2. The Howler MK1 splits a WAV file at about 3.5 hours, about 4 GB. If a set runs on into a second file, join the two. The MK1’s file dates are unreliable: Howler fixed them in the MK2.',
      },
      {
        // Clipped in the mixer but not at the Howler: the flat tops sit below the file's full scale, where a 0 dBFS
        // marker never looks. Audacity manual, View menu: Show Clipping in Waveform is off by default, and marks a
        // sample that "touches or exceeds 0 dB". Audacity 4 prints "Show clipping in waveform" in View (its manual,
        // October 2026); the card keeps 3.7's capitals. Its off-by-default setting is confirmed in the 4.0.1 source:
        // src/projectscene/internal/projectsceneconfiguration.cpp, DEFAULT_CLIPPING_IN_WAVEFORM_VISIBILITY.
        // After the XDJ's and the Howler's converters, a clipped top ripples and leans (Esqueda, Bilbao and
        // Välimäki, 2016), so it is rarely quite flat.
        id: 'flat-tops',
        check: 'Loudest blends, zoomed in',
        target: 'no flat tops, at any height',
        note: 'In the file, flat tops can ripple or lean a little. Audacity’s Show Clipping in Waveform, in the View menu, is off by default, and marks only the top of the file. Mixer clipping sits lower.',
        drill: { if: 'If you see flat tops or hear crunch', id: 'crunch', code: 'F9' },
      },
      {
        // Audacity manual, Amplify: "If you take the negative of the value shown in the Amplification (dB) box, this
        // will give you the current peak amplitude of the selection." Audacity 3.7: "Effect > Volume and Compression
        // > Amplify"; Audacity 4: "Effect → Volume and compression → Amplify" (both manuals, October 2026).
        // A peak at the top of the file is where the Howler's input clips (the guide's 4.4 assumes it; Howler
        // publishes no limit). Nobody sets the recording to a band now, and a quiet recording is fine (4.3),
        // so the line asks only for a peak below the top.
        id: 'peak',
        check: 'Each set’s loudest peak',
        target: `below ${FILE_TOP}`,
        note: `Audacity’s Amplify is in the Effect menu, under Volume and Compression. With the whole set selected, its Amplification box shows how far the peak is below the top: 12 dB means −12 dBFS.`,
        drill: { if: 'If the box shows 0', id: 'crunch', code: 'F9' },
      },
      {
        // Audacity's Normalize sets "the peak amplitude", the sample peak, and no built-in tool reads or limits true
        // peak. BS.1770-5: "the true-peak value may occur between samples". SoundCloud Help asks for true peaks below
        // −1 dB at −14 LUFS, and below −2 dB for louder masters. Measured with BS.1770 true peak, normalised to
        // −2 dB: 10 released tracks at −2.04 to −1.31 dB, and 45 blends of them at a median −1.97, worst −0.95; −1 dB
        // or lower in 54 of 55. Whole sets land around −14 LUFS. So −2 dB meets the −14 LUFS ask, and can miss the
        // louder one by tenths. This sample of music does not set a general bound on intersample peaks.
        id: 'normalise',
        check: 'Each set',
        target: 'normalised to −2 dB',
        note: 'Audacity’s Normalize, in the Effect menu under Volume and Compression, sets the sample peak. The true peak, between samples, can sit higher, and Audacity’s built-in tools do not show it. At −2 dB, a set usually meets SoundCloud’s ask for a master at −14 LUFS: true peaks below −1 dB.',
      },
      {
        // Howler MK1 manual: "FAT32 formatted"; on a Mac, Disk Utility's "MS-DOS (FAT)" gives FAT32; on Windows, 64GB+
        // cards "may need to install 3rd party software". FAQ: "Windows won't allow formatting cards larger than
        // 32GB to FAT32 natively".
        id: 'clear',
        check: 'microSD card',
        target: 'files deleted',
        before:
          'Deleting the files on the microSD card deletes the original recordings. Delete them only after both copies match the card.',
        note: 'If you format it instead, choose FAT32: on a Mac, MS-DOS (FAT). On Windows, a card over 32 GB needs extra software for FAT32.',
      },
    ],
  },
};

/** The order the lists run in: the night's three, then the next day's. */
export const CHECKLIST_ORDER: readonly ChecklistId[] = ['doors', 'changeover', 'after', 'files'];

export const isChecklistId = (value: string): value is ChecklistId => Object.hasOwn(CHECKLISTS, value);

/** "3 of 7 done", for the live count. */
export const progressText = (done: number, total: number): string => `${done} of ${total} done`;

// ---- Remembering ticks -------------------------------------------------------------------------
// Ticks are kept in localStorage so a reload or a locked phone doesn't lose them. How long they last,
// and reading them back, live in checklistTimes.ts.

/** Namespaced, because every GitHub Pages project site of one owner shares an origin. */
export function storageKey(id: ChecklistId): string {
  // A changed instruction must not inherit a tick from the old version. The deployment base also
  // separates this project's installations on a shared GitHub Pages origin.
  let revision = 0x811c9dc5;
  for (const char of JSON.stringify(CHECKLISTS[id])) {
    revision = Math.imul(revision ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return `out-of-the-red:${import.meta.env.BASE_URL}:checklist:${id}:${revision.toString(16)}`;
}

interface SavedTicks {
  at: number;
  done: string[];
}

export function serialiseTicks(done: Iterable<string>, now: number): string {
  const saved: SavedTicks = { at: now, done: [...done] };
  return JSON.stringify(saved);
}
