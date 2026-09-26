/**
 * The crew checklists, used by the <Checklist> island on /night/ and /setup/, the printed crew cards
 * and the crew's chat message (messages.ts builds it from the doors list, so the two can't disagree).
 *
 * How they're built:
 * - Each list belongs to one pause point, and says when (`when`). Every list is read-and-do: read a
 *   line, then do it. Pause points, READ-DO and DO-CONFIRM, and five to nine items to a list come from
 *   Boorman of Boeing as Gawande reports him (The Checklist Manifesto, 2009, pp. 111 and 123) and from
 *   the WHO Surgical Safety Checklist manual (2009, p. 13). Five to nine is a rule of thumb, not a law.
 * - Written for one person working alone, so there is no completion call and no time budget: nobody
 *   has timed a real run.
 * - A line is the name printed on the gear or the tape, leader dots, and the state you can see. It is
 *   never "check" or "set", which Degani & Wiener (NASA, 1990) found get said without looking. The
 *   killer item goes first (Degani & Wiener, 1990).
 * - A note carries what to do if the line isn't so, starting "If …", or a fact. A consequence someone
 *   must know first, like deleting the recordings on the microSD card, is a plain sentence before the
 *   line (`before`).
 *
 * Wiring, one way only: MASTER 1 (XLR) feeds the DriveRack PA2 and the amps, MASTER 2 (RCA) feeds the
 * Howler, BOOTH feeds the booth monitors. MASTER LEVEL sets MASTER 1 and MASTER 2 together (Pioneer
 * manual p.27). It stays fully up on the REC mark, and the MASTER meters, which read after it (p.31),
 * show the mix itself. The room's volume comes from the amps' gain knobs, never above the RIG marks
 * that S4 finds, and never from the mixer.
 *
 * Power, on a generator in the UK. HSE's GS50 asks for a generator earthed by a competent person (§28,
 * §33–34) and sockets on 30 mA RCDs (§22). QSC gives the GX7's current, not its watts (p.11): at 230 V
 * the pair draws about 13.4 A at peak programme levels and about 26.5 A in full-power bursts, and a UK
 * strip or plug is 13 A (GS50 §21). dbx: the amps go on last, with no audio passing, and off first,
 * about 10 seconds before the rest (p.10).
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes are curly.
 */
import { formatDb } from './dsp/db';
import { TARGET } from './model';
import { CREW_RULES, DJ_RULES, type Rule } from './rules';

export type ChecklistId = 'setup' | 'doors' | 'changeover' | 'after' | 'files';

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

export interface ChecklistItem {
  /** Stable key, used to remember the tick. Change it if the item's meaning changes. */
  id: string;
  /** What to look at, named as it's printed on the gear or the tape. */
  check: string;
  /** The state you should see. */
  target: string;
  /** A consequence to know before doing the line, as a plain sentence set before it. */
  before?: string;
  /** What to do if the line isn't so ("If …, …"), or a fact about it. */
  note?: string;
  /** The drill, or drills, for when the line isn't so, said after the note: "If it hums, go to F10." */
  drill?: DrillRef | readonly DrillRef[];
}

export interface Checklist {
  id: ChecklistId;
  /** The id of the list's heading on its page, for links such as /night/#doors. */
  anchor: string;
  /**
   * Its code in the handbook, on its title strip and in the night page's index: C1 to C4 for a night's
   * lists in the order they run, S1 for setting up.
   */
  code: string;
  title: string;
  /** The pause point: when to run it, and for whom if that isn't the crew on the night. */
  when: string;
  items: readonly ChecklistItem[];
}

/**
 * How to reach the attenuators, from Pioneer's Operating Instructions: "Press the [MENU (UTILITY)]
 * button for over 1 second. The [UTILITY] screen is displayed." (p.31, Changing the settings; the
 * button is item 9 of the browse section, p.20). MASTER ATTENUATOR and BOOTH MONITOR ATTENUATOR are in
 * its settings table (p.32). Said wherever a card first sends the crew into UTILITY, as information
 * about the button's long press: a note never carries an instruction.
 */
export const OPEN_UTILITY = 'UTILITY opens when you hold MENU (UTILITY) for over a second.';

/** Where both attenuators are, and how to get there: the note under a line that checks them. */
export const IN_UTILITY = 'They are in UTILITY. It opens when you hold MENU (UTILITY) for over a second.';

/**
 * How a change in UTILITY is kept, in Pioneer's words: "3 Press the rotary selector. The changed
 * settings are stored." (Operating Instructions p.31, Changing the settings). Said wherever a card may
 * change an attenuator. The setup page's S3 and T2 say the same (record/flow.ts).
 */
export const STORE_CHANGE =
  'After a change, Pioneer says: “Press the rotary selector. The changed settings are stored.” (p. 31)';

/**
 * The note under a line that checks both attenuators against the REC tape: where they are, and how a
 * change is kept.
 */
export const ATT_NOTE = `${IN_UTILITY} ${STORE_CHANGE}`;

/**
 * The same note at MASTER ATT's first mention in the night page's cards (C1), with the name Pioneer's
 * settings table prints, "MASTER ATTENUATOR." (p.32), in the words the setup page's T2 uses. Given once
 * a page: the drills after it say MASTER ATT.
 */
const ATT_NOTE_NAMED = `MASTER ATT (MASTER ATTENUATOR in UTILITY) and BOOTH ATT are UTILITY settings. ${OPEN_UTILITY} ${STORE_CHANGE}`;

/**
 * The recording level's last resort, if the Howler still blinks red with MASTER ATT at −12 dB, or MASTER
 * ATT doesn't reach MASTER 2 (Pioneer doesn't say; the setup page tests it, T2). One rule, worded the
 * same on S3, T2 and F1: down a little at a time, until the LEVEL light is green. MASTER LEVEL turns the
 * PA down too, and the MASTER meters read after it (Pioneer p.31), so from then on they read low.
 * Whether a blend can then crunch before they show red depends on where the mixer clips inside, which
 * Pioneer does not publish; Pioneer's own fix for distorted sound is to turn MASTER LEVEL down (p.34).
 * The guide's 4.4 keeps that question, so the cards say only what is published.
 */
export const LEVEL_FALLBACK = {
  /** As a step: the control, and what to do with it. */
  challenge: 'MASTER LEVEL',
  response: 'down a little at a time until green',
  /** How far, in the words every card uses. */
  how: 'a little at a time until green',
  /** What it costs, said before the step. */
  consequence: 'From then on, the MASTER meters read low.',
  /** The whole rule as sentences, for a card that carries on from MASTER ATT. */
  text: 'If it is still red, turn MASTER LEVEL down a little at a time until green. Then re-mark the REC tape.',
} as const;

/** A line of the DJ box (rules.ts) by its tape label, so a missing line fails loudly. */
function djRule(label: string): Rule {
  const rule = DJ_RULES.find((r) => r.label === label);
  if (!rule) throw new Error(`The DJ box has no line labelled ${label} (rules.ts)`);
  return rule;
}

/**
 * What to say when the MASTER meters show red, or their top orange lights: the action in the DJ box's
 * note for the MASTER meters (rules.ts), as the words to the DJ. F1, F3 and F6 say it, and so do the
 * Howler lines below.
 */
export const FADER_DOWN = 'Pull a channel fader down a little.';

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
 * Red, not the top orange, is where the crew step in: a blend at the top orange is still below the
 * level S3 sets the recording for.
 */
const HOWLER_RED_NOTE = `${HOWLER_RED_FIRST_ACTION} If they are red, say to the DJ: “${FADER_DOWN}”`;

/** Where the Howler lines send the crew when the MASTER meters are below red. */
const HOWLER_RED: DrillRef = { if: 'If they are below red', id: 'howler-red', code: 'F1' };

/**
 * What the crew say to the next DJ at a changeover: the DJ box's first line and the deal on volume,
 * in the box's own words (rules.ts), so the booth card and the crew agree.
 */
export const NEXT_DJ_WORDS = `${CHANNEL_METERS_WORDS} ${djRule('RIG').text ?? ''}`.trim();

/** Where a night's peaks should sit in the file, from the model (model.ts): "−18 and −6 dBFS". */
const PEAK_RANGE = `${formatDb(TARGET.band.bottom, { unit: '' })} and ${formatDb(TARGET.band.top, { unit: 'dBFS' })}`;

/** The top of that range, as a peak to compare with: "−6 dBFS". */
const PEAK_TOP = formatDb(TARGET.band.top, { unit: 'dBFS' });

/** A line's drills, in words: "If it hums, go to F10. If a side is missing, go to F11." */
export const drillText = (ref: DrillRef | readonly DrillRef[]): string =>
  [ref]
    .flat()
    .map((r) => `${r.if}, go to ${r.code}.`)
    .join(' ');

export const CHECKLISTS: Readonly<Record<ChecklistId, Checklist>> = {
  setup: {
    // The whole job in order, every event, for one person. The leads go in before anything is plugged in
    // (Pioneer manual p.10: connect the power cord "after all the connections are completed"; dbx p.8). T2 and
    // T3 are once per rig. The DriveRack and amps come after S3, so S4 finds the RIG marks at the recording
    // level on the REC tape. The cards it points to are on /setup/: S2 the wiring table, T2 and T3 the one-off
    // tests, S3 the recording level, S4 the DriveRack and amps.
    id: 'setup',
    anchor: 'setup',
    code: 'S1',
    title: 'Setting up',
    when: 'Every event, while you build the rig.',
    items: [
      {
        // HSE GS50: the generator "must be maintained, correctly installed and adequately earthed by a competent
        // person" (§28), with its own means of earthing (§34); sockets for portable equipment on RCDs "having a
        // tripping current of 30 mA", and "If a 30 mA RCD trips, it is an indication that there is a fault. Do
        // not ignore it." (§22). INDG247 p.3: "Never bypass the RCD".
        id: 'generator',
        check: 'Generator',
        target: 'earthed by a competent person, sockets on 30 mA RCDs',
        note: 'If an RCD trips, find the fault before you reset it.',
      },
      {
        // S2 has each lead: MASTER 1 (XLR) to the DriveRack, MASTER 2 (RCA) to the Howler, BOOTH to the monitors.
        id: 'leads',
        check: 'Leads',
        target: 'as in the wiring table (S2)',
      },
      {
        // QSC GX manual p.11, AC current for a GX7 into 8 Ω a side, halved for 230 V (its note 4): 6.7 A each at
        // 1/3 power, "peak program levels", and about 13.25 A each at full power, "breaker limited to short
        // periods". The Yamaha tops and EV subs are 8 Ω. QSC p.10: one supply for all the sound gear helps with
        // hum, "if the total power consumption is not excessive".
        id: 'supply',
        check: 'Sound gear',
        target: 'on one distribution board, amps switched off',
        note: 'Both GX7 amps draw about 13 A together at peak levels, and 26 A in short bursts (QSC p. 11). Each amp has its own socket: a 13 A strip cannot take both.',
      },
      {
        // Howler MK1 manual: "able to record around 30 hours on a full battery"; the BATTERY indicator is "red when
        // charging"; "We recommend to charge Howler while recording just to be safe." The MK2 differs.
        id: 'howler',
        check: 'Howler',
        target: 'on charge, on WAV',
        note: 'The Howler MK1 records for about 30 hours on its battery. Its BATTERY light is red while it charges.',
      },
      {
        // Pioneer doesn't say which sockets MASTER ATT reaches (manual p.32), or what MASTER LEVEL adds fully up (the
        // panel prints 0, p.27). T2 and T3 find out on the kit, once per rig (setup page).
        id: 'tests',
        check: 'Tests T2 and T3',
        target: 'done once for this rig',
      },
      {
        // Howler MK1 manual: blinking red means the volume is too high. S3 sets the recording level.
        id: 'record-level',
        check: 'Howler LEVEL light',
        target: 'blinking green on the loudest blend',
        note: 'If it blinks red, go to S3.',
      },
      {
        // dbx manual p.10: the amps go on last, and "ensure you're not passing audio to the mixer's outputs" first.
        // With MASTER LEVEL taped fully up, that means no track playing. S4 also finds the RIG marks.
        id: 'amps',
        check: 'DriveRack and amps',
        target: 'as in S4, amps switched on last',
        note: 'If a track is playing, stop it before the amps go on.',
      },
      {
        // The night's lists check both attenuators against the REC tape, so both settings go on it. The first mention
        // of MASTER ATT on /setup/, so it gives Pioneer's name (manual p.32) once, as T2 does.
        id: 'tags',
        check: 'Tape tags',
        target: 'REC, MONITOR and RIG on, a line across each knob',
        note: 'The REC tape also carries both ATT settings, MASTER ATT (MASTER ATTENUATOR in UTILITY) and BOOTH ATT.',
      },
      {
        // F10 fits the audio isolation transformer only if this finds hum (the wiring table, S2, says so too).
        id: 'test-recording',
        check: 'Test recording',
        target: '2 minutes, on headphones: both sides, no hum',
        drill: [
          { if: 'If it hums', id: 'hum', code: 'F10' },
          { if: 'If a side is missing', id: 'hollow', code: 'F11' },
        ],
      },
    ],
  },

  doors: {
    id: 'doors',
    anchor: 'doors',
    code: 'C1',
    title: 'Doors open',
    when: 'Before the doors open.',
    // Terse on purpose: the crew's chat message is built from these lines and has to fit in 80 words.
    items: [
      {
        // Howler MK1 manual: the BATTERY indicator is "red when charging". If RECORD "stops blinking soon after
        // you've pushed it, there is something wrong with the microSD card, or the microSD card is full". Its own
        // card must be "FAT32 formatted", "A2 class cards do not work" and "SanDisk's 'Ultra' & 'Pro' line cards do
        // not work". The id keeps its old name, so ticks made before the change still count.
        id: 'howler',
        check: 'Howler',
        target: 'recording on WAV, on charge',
        note: 'Its BATTERY light is red while it charges. If RECORD stops blinking soon after you press it, put in another FAT32 microSD card. For the MK1, Howler says A2 cards and SanDisk’s Ultra and Pro cards “do not work”.',
      },
      {
        // Howler's MK2 announcement says the MK1's file timestamps were wrong ("file timestamps are now set
        // correctly"), so the file can't say when it started. With C2's times, this is how the next day's work
        // finds each DJ's set.
        id: 'start',
        check: 'Recording start time',
        target: 'noted',
      },
      {
        id: 'level',
        check: 'Howler LEVEL light',
        target: 'blinking green',
        note: HOWLER_RED_NOTE,
        drill: HOWLER_RED,
      },
      {
        id: 'rec',
        check: 'MASTER LEVEL',
        target: 'fully up, on the REC mark',
      },
      {
        id: 'att',
        check: 'MASTER ATT and BOOTH ATT',
        target: 'as on the REC tape',
        note: ATT_NOTE_NAMED,
      },
      {
        // dbx manual p.10: power amps last on, with no audio passing to the mixer's outputs, and first off. The
        // RIG marks are the highest the amps go (S4).
        id: 'amps',
        check: 'Both amps',
        target: 'on, gain knobs at or below the RIG marks',
        note: 'If they are off, switch them on after everything else, with no track playing.',
      },
      {
        id: 'booth-card',
        check: 'Booth card',
        target: 'by the meters',
      },
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
        // Howler MK1 manual: a WAV file holds about 3.5 hours (about 4 GB); recording then carries on in a new
        // file, with up to a second missing. "The BATTERY indicator blinks blue and red when you have around 1 hour
        // left of recording. You are unable to start new recordings until you connect a charger." A new file
        // started between DJs keeps the gap out of a set. The times noted here are where the next day's work cuts
        // the sets.
        id: 'time',
        check: 'Changeover time',
        target: 'noted',
        note: 'The Howler MK1’s WAV files end at about 3.5 hours, with up to a second missing. Its BATTERY light blinks blue and red with about an hour left. It then starts a new recording only on charge. If the recording started over 3 hours ago, press RECORD to stop it, then again to start a new one.',
      },
      {
        id: 'rec',
        check: 'MASTER LEVEL',
        target: 'fully up, on the REC mark',
      },
      {
        // Pioneer manual p.31: "[UTILITY] settings and other settings stored on a USB device can be called out" with
        // MY SETTINGS; both attenuators are UTILITY settings (p.32). Pioneer doesn't list what a stick carries, so it
        // may change them. At a changeover the room can take the change, so this is where F7's step waits for.
        id: 'settings',
        check: 'MASTER ATT and BOOTH ATT',
        target: 'as on the REC tape',
        note: `A DJ’s MY SETTINGS may change them. ${OPEN_UTILITY} ${STORE_CHANGE}`,
      },
      {
        id: 'next-dj',
        check: 'Next DJ',
        target: 'shown the booth card',
        note: `Say: “${NEXT_DJ_WORDS}”`,
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
        note: 'At the wall, or within 10 seconds of a UTILITY change, switching off can lose the change (Pioneer, p. 35).',
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
        // The work below is on one copy; the other stays as the Howler wrote it.
        id: 'copies',
        check: 'microSD card files',
        target: 'copied to two places, one kept as it is',
      },
      {
        id: 'play',
        check: 'Both copies',
        target: 'play to the end',
      },
      {
        // Howler MK1 manual: a WAV file holds about 3.5 hours, then recording carries on in a new file with up to a
        // second missing (C2 says so). Files that start at a changeover are cut there anyway. Howler's MK2
        // announcement (May 2026): "A shortcoming of the original hardware has also been resolved: file timestamps
        // are now set correctly". The MK1's dates can't put the files in order; their names can.
        id: 'join',
        check: 'Split files',
        target: 'joined in file name order',
        note: 'The Howler MK1’s file dates are unreliable: Howler fixed them in the MK2.',
      },
      {
        id: 'cut',
        check: 'Each DJ’s set',
        target: 'cut at the noted times',
        note: 'C1 has the start time, and C2 each changeover.',
      },
      {
        // Clipped in the mixer but not at the Howler: the flat tops sit below the file's full scale, where a 0 dBFS
        // marker never looks. Audacity manual, View menu: Show Clipping in Waveform is off by default, and marks a
        // sample that "touches or exceeds 0 dB". After the XDJ's and the Howler's converters, a clipped top ripples
        // and leans (Esqueda, Bilbao and Välimäki, 2016), so it is rarely quite flat.
        id: 'flat-tops',
        check: 'Loudest blends, zoomed in',
        target: 'no flat tops, at any height',
        note: 'In the file, flat tops can ripple or lean a little. Audacity’s Show Clipping in Waveform is off by default, and marks only the top of the file. Mixer clipping sits lower.',
        drill: { if: 'If you see flat tops or hear crunch', id: 'crunch', code: 'F9' },
      },
      {
        // The healthy range is the model's (model.ts TARGET.band), the one the guide's 4.3 and S3 use. Audacity
        // manual, Amplify: "If you take the negative of the value shown in the Amplification (dB) box, this will give
        // you the current peak amplitude of the selection." S3 reads its test file the same way.
        id: 'peak',
        check: 'Each set’s loudest peak',
        target: `between ${PEAK_RANGE}`,
        note: `Audacity’s Amplify, in the Effect menu, reads it with the whole set selected. Its Amplification box shows how far the peak is below 0 dB: 12 dB means −12 dBFS. If the peak is higher than ${PEAK_TOP}, set the recording level again with S3 before the next event.`,
      },
      {
        // Audacity's Normalize sets "the peak amplitude", the sample peak; it can't read true peak. BS.1770-5: "the
        // true-peak value may occur between samples". SoundCloud Help: "If your master is louder than -14 dB
        // integrated LUFS, make sure it stays below -2 dB TP (True Peak) max to avoid extra distortion." −2 dB on
        // the samples leaves room for both.
        id: 'normalise',
        check: 'Each set',
        target: 'normalised to −2 dB',
        note: 'Audacity’s Normalize, in the Effect menu, sets the sample peak. At −2 dB it leaves room for the peaks between samples. SoundCloud asks a master louder than −14 LUFS to stay “below −2 dB TP (True Peak) max”.',
      },
      {
        // Howler MK1 manual: "FAT32 formatted"; on a Mac, Disk Utility's "MS-DOS (FAT)" gives FAT32; on Windows, 64GB+
        // cards "may need to install 3rd party software". FAQ: "Windows won't allow formatting cards larger than
        // 32GB to FAT32 natively".
        id: 'clear',
        check: 'microSD card',
        target: 'files deleted',
        before:
          'Deleting the files on the microSD card deletes the original recordings. Delete them only after both copies play to the end.',
        note: 'If you format it instead, choose FAT32: on a Mac, MS-DOS (FAT). On Windows, a card over 32 GB needs extra software for FAT32.',
      },
    ],
  },
};

/** The order the lists run in: setting up, then a night's, then the next day. */
export const CHECKLIST_ORDER: readonly ChecklistId[] = ['setup', 'doors', 'changeover', 'after', 'files'];

export const isChecklistId = (value: string): value is ChecklistId => Object.hasOwn(CHECKLISTS, value);

/** "3 of 7 done", for the live count. */
export const progressText = (done: number, total: number): string => `${done} of ${total} done`;

// ---- Remembering ticks -------------------------------------------------------------------------
// Ticks are kept in localStorage so a reload or a locked phone doesn't lose them. How long they last,
// and reading them back, live in checklistTimes.ts.

/** Namespaced, because every GitHub Pages project site of one owner shares an origin. */
export const storageKey = (id: ChecklistId): string => `out-of-the-red:checklist:${id}`;

interface SavedTicks {
  at: number;
  done: string[];
}

export function serialiseTicks(done: Iterable<string>, now: number): string {
  const saved: SavedTicks = { at: now, done: [...done] };
  return JSON.stringify(saved);
}
