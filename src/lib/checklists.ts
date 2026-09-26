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
 *   must know first, like clearing the SD card, is a plain sentence before the line (`before`).
 *
 * Wiring, one way only: MASTER 1 (XLR) feeds the DriveRack PA2 and the amps, MASTER 2 (RCA) feeds the
 * Howler, BOOTH feeds the booth monitors. MASTER LEVEL sets MASTER 1 and MASTER 2 together (Pioneer
 * manual p.27). It stays fully up on the REC mark, and the MASTER meters, which read after it (p.31),
 * show the mix itself. The room's volume comes from the amps' gain knobs (taped RIG), never the mixer.
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes are curly.
 */
import { formatDb } from './dsp/db';
import { TARGET } from './model';
import { CREW_RULES } from './rules';

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
 * The recording level's last resort, if the Howler still blinks red with MASTER ATT at −12 dB, or MASTER
 * ATT doesn't reach MASTER 2 (Pioneer doesn't say; the setup page tests it, T2). One rule, worded the
 * same on S3, T2 and F1: down a little at a time, until the LEVEL light is green. MASTER LEVEL turns the
 * PA down too, and the MASTER meters read after it (Pioneer p.31), so from then on they read low.
 */
export const LEVEL_FALLBACK = {
  /** As a step: the control, and what to do with it. */
  challenge: 'MASTER LEVEL',
  response: 'down a little at a time until green',
  /** How far, in the words every card uses. */
  how: 'a little at a time until green',
  /** What it costs, said before the step. */
  consequence: 'From then on, the MASTER meters read low. A blend can crunch before they show red.',
  /** The whole rule as sentences, for a card that carries on from MASTER ATT. */
  text: 'If it is still red, turn MASTER LEVEL down a little at a time until green. Then re-mark the REC tape.',
} as const;

/**
 * What to say when the MASTER meters show red: the DJ box's note (rules.ts), as the words to the DJ.
 * F1, F3 and F6 say it, and so do the Howler lines below.
 */
export const FADER_DOWN = 'Pull a channel fader down a little.';

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

/** What the Howler lines on C1 and C2 say under the line: the first action, and what each finding means. */
const HOWLER_RED_NOTE = `${HOWLER_RED_FIRST_ACTION} If they are red, say to the DJ: “${FADER_DOWN}”`;

/** Where the Howler lines send the crew when the MASTER meters are below red. */
const HOWLER_RED: DrillRef = { if: 'If they are below red', id: 'howler-red', code: 'F1' };

/**
 * What the crew say to the next DJ at a changeover: the DJ box's first line and the deal on volume,
 * in the box's own words (rules.ts), so the booth card and the crew agree.
 */
export const NEXT_DJ_WORDS = 'Keep the channel meters on the first or second orange. For a louder room, ask the crew.';

/** Where a night's peaks should sit in the file, from the model (model.ts): "−18 and −6 dBFS". */
const PEAK_RANGE = `${formatDb(TARGET.band.bottom, { unit: '' })} and ${formatDb(TARGET.band.top, { unit: 'dBFS' })}`;

/** A line's drills, in words: "If it hums, go to F10. If a side is missing, go to F11." */
export const drillText = (ref: DrillRef | readonly DrillRef[]): string =>
  [ref]
    .flat()
    .map((r) => `${r.if}, go to ${r.code}.`)
    .join(' ');

export const CHECKLISTS: Readonly<Record<ChecklistId, Checklist>> = {
  setup: {
    // The whole job in order, every event, for one person. The DriveRack and amps come after T2 and S3, so the
    // amps' gain is set once, after the recording level. The cards it points to are on /setup/: S2 the wiring
    // table, S3 the recording level, S4 the DriveRack and amps; T2 is the one-off MASTER ATT test.
    id: 'setup',
    anchor: 'setup',
    code: 'S1',
    title: 'Setting up',
    when: 'Every event, while you build the rig.',
    items: [
      {
        // QSC GX manual: about 3.8 A per GX7 on a normal night and 6.7 A on a heavy one, at 230 V; plugging the
        // sound gear into one supply often helps with hum (p.10). dbx manual p.10: amps on last, off first.
        id: 'supply',
        check: 'Sound gear',
        target: 'on one supply, amps switched off',
        note: 'The two GX7 amps can draw about 3 kW between them on a heavy night.',
      },
      {
        // S2 has each lead: MASTER 1 (XLR) to the DriveRack, MASTER 2 (RCA) to the Howler, BOOTH to the monitors.
        id: 'leads',
        check: 'Leads',
        target: 'as in the wiring table (S2)',
      },
      {
        // Rane Note 110: an isolation transformer in the audio lead breaks an earth loop, and every earth stays
        // connected.
        id: 'isolation',
        check: 'Howler’s lead',
        target: 'through the isolation transformer',
      },
      {
        // Howler MK1 manual: about 30 hours on a full battery; charge it while it records, to be safe.
        id: 'howler',
        check: 'Howler',
        target: 'on charge, on WAV',
        note: 'It records for about 30 hours on its battery.',
      },
      {
        // Pioneer doesn't say whether MASTER ATT reaches MASTER 2 (manual p.32), so T2 tests it, once per rig.
        id: 'att-test',
        check: 'MASTER ATT test (T2)',
        target: 'done once',
      },
      {
        // Howler MK1 manual: blinking red means the volume is too high. S3 sets the recording level.
        id: 'record-level',
        check: 'Howler LEVEL light',
        target: 'blinking green on the loudest blend',
        note: 'If it blinks red, go to S3.',
      },
      {
        id: 'amps',
        check: 'DriveRack and amps',
        target: 'as in S4, amps switched on last',
      },
      {
        // The night's lists check both attenuators against the REC tape, so both settings go on it.
        id: 'tags',
        check: 'Tape tags',
        target: 'REC, MONITOR and RIG on, a line across each knob',
        note: 'The REC tape also carries both ATT settings, MASTER ATT and BOOTH ATT.',
      },
      {
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
    // Terse on purpose: the crew's chat message is built from these lines and has to fit in 60 words.
    items: [
      {
        // Howler MK1 manual: if RECORD stops blinking soon after it's pushed, the microSD card is full or faulty.
        // The id keeps its old name, so ticks made before the change still count.
        id: 'howler',
        check: 'Howler',
        target: 'recording on WAV, on charge',
        note: 'If RECORD stops blinking soon after you press it, put in another SD card.',
      },
      {
        // The Howler MK1 has no clock, so the file can't say when it started. With C2's times, this is how the
        // next day's work finds each DJ's set.
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
        note: IN_UTILITY,
      },
      {
        // dbx manual p.10: power amps last on, first off.
        id: 'amps',
        check: 'Both amps',
        target: 'on, gain knobs on the RIG marks',
        note: 'If they are off, switch them on after everything else.',
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
        // file, with up to a second missing. A new file started between DJs keeps that gap out of a set. The
        // times noted here are where the next day's work cuts the sets.
        id: 'time',
        check: 'Changeover time',
        target: 'noted',
        note: 'If the recording started over 3 hours ago, press RECORD to stop it, then again to start a new one. The Howler’s WAV files end at about 3.5 hours, with up to a second missing.',
      },
      {
        id: 'rec',
        check: 'MASTER LEVEL',
        target: 'fully up, on the REC mark',
      },
      {
        // A DJ's MY SETTINGS can bring their own UTILITY settings back (Pioneer manual p.31). At a changeover
        // the room can take the change, so this is where F7's step waits for.
        id: 'settings',
        check: 'MASTER ATT and BOOTH ATT',
        target: 'as on the REC tape',
        note: `A DJ’s MY SETTINGS can change them. ${OPEN_UTILITY}`,
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
        id: 'rest-off',
        check: 'The rest of the rig',
        target: 'switched off, about 10 seconds later',
      },
      {
        id: 'charge',
        check: 'Howler',
        target: 'on charge',
      },
      {
        id: 'card',
        check: 'SD card',
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
        check: 'SD card files',
        target: 'copied to two places, one kept as it is',
      },
      {
        id: 'play',
        check: 'Both copies',
        target: 'play to the end',
      },
      {
        // Howler MK1 manual: a WAV file holds about 3.5 hours, then recording carries on in a new file with up to a
        // second missing (C2 says so). Files that start at a changeover are cut there anyway.
        id: 'join',
        check: 'Split files',
        target: 'joined, in order',
      },
      {
        id: 'cut',
        check: 'Each DJ’s set',
        target: 'cut at the noted times',
        note: 'C1 has the start time, and C2 each changeover.',
      },
      {
        // Clipped in the mixer but not at the Howler: the flat tops sit below the file's full scale, where a
        // 0 dBFS marker such as Audacity's View > Show Clipping in Waveform never looks.
        id: 'flat-tops',
        check: 'Loudest blends, zoomed in',
        target: 'no flat tops, at any height',
        note: 'Audacity’s Show Clipping in Waveform marks only the top of the file. Mixer clipping sits lower.',
        drill: { if: 'If you see flat tops or hear crunch', id: 'crunch', code: 'F9' },
      },
      {
        // The healthy range is the model's (model.ts TARGET.band), the one the guide's 4.3 and S3 use.
        id: 'normalise',
        check: 'Each set',
        target: 'normalised to −1 dB true peak',
        note: `Before this step, its loudest peak should be between ${PEAK_RANGE}. If it is higher, set the recording level again with S3 before the next event.`,
      },
      {
        id: 'clear',
        check: 'SD card',
        target: 'cleared',
        before:
          'Clearing the SD card deletes the original recordings. Clear it only after both copies play to the end.',
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
