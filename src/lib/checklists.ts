/**
 * The crew checklists, used by the <Checklist> island on /night/ and /setup/, the printed crew cards
 * and the crew's chat message (messages.ts builds it from the doors list, so the two can't disagree).
 *
 * Built to Degani & Wiener's checklist guidelines (pedagogy-ux §6):
 * - each list belongs to one pause point, and says so (`when`);
 * - READ-DO for the one-off setup and the wrap-up, DO-CONFIRM for doors and changeovers;
 * - 5 to 9 items, killer items first (the setup follows the cables instead);
 * - every response is the state the control should be in, never "checked";
 * - each list ends on a completion call, said out loud.
 *
 * Wiring, one way only: MASTER 1 (XLR) feeds the DriveRack PA2 and the amps, MASTER 2 (RCA) feeds the
 * Howler, BOOTH feeds the booth monitors. MASTER LEVEL sets the PA and the recording together, so it
 * stays fully up and taped REC: the middle meters read after it, so fully up they show the mix itself.
 * The room's volume comes from the amps' gain knobs (taped RIG), never the mixer.
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes are curly.
 */

export type ChecklistId = 'setup' | 'doors' | 'changeover' | 'after';

/** READ-DO: read a line, do it. DO-CONFIRM: do it all from memory, then read down and confirm. */
export type ChecklistKind = 'read-do' | 'do-confirm';

/**
 * The drill to turn to when a line isn't so, said after its note: "If it blinks red, see F1." The code
 * is the drill's own (fixes.ts), copied here so the checklist island doesn't carry every drill; the
 * tests keep the two in step.
 */
export interface DrillRef {
  /** When to turn to it, as a condition without its full stop: "If it blinks red". */
  if: string;
  /** The drill's id: it lands on /night/#fix-<id>. */
  id: string;
  /** The drill's code, as its title strip gives it: "F1". */
  code: string;
}

export interface ChecklistItem {
  /** Stable key, used to remember the tick. Change it if the item's meaning changes. */
  id: string;
  /** The control or thing to check, named as it's printed on the gear or the tape. */
  check: string;
  /** The state it should be in. */
  target: string;
  /** One short line of how or why. */
  note?: string;
  /** The drill for when the line isn't so. */
  drill?: DrillRef;
}

/**
 * How to reach the attenuators, from Pioneer's Operating Instructions: "Press the [MENU (UTILITY)]
 * button for over 1 second. The [UTILITY] screen is displayed." (p.31, Changing the settings; the
 * button is item 9 of the browse section, p.20). MASTER ATTENUATOR and BOOTH MONITOR ATTENUATOR are in
 * its settings table (p.32). Said wherever a card first sends the crew into UTILITY.
 */
export const OPEN_UTILITY = 'To open UTILITY, hold MENU (UTILITY) for over a second.';

/**
 * The record level's last resort, if the Howler still blinks red with MASTER ATT at −12 dB, or MASTER
 * ATT doesn't reach MASTER 2 (Pioneer doesn't say; the setup page tests it, T2). One rule, worded the
 * same on S1, S3, T2 and F1: MASTER LEVEL down a notch at a time until green, and the REC tape
 * re-marked. The record level walkthrough models the same thing (record/model.ts). MASTER LEVEL turns
 * the PA down too, and the middle meters read after it, so they read low from then on.
 */
export const LEVEL_FALLBACK = {
  /** As a step: the control and what to do with it. */
  challenge: 'MASTER LEVEL',
  response: 'down a notch at a time',
  /** How far, in the words every card uses. */
  how: 'a notch at a time until green',
  /** How far, as the note under that step. */
  note: 'Until the light stays green through the loudest blend.',
  /** The whole rule as a sentence, for a note that carries on from MASTER ATT. */
  text: 'If it’s still red, turn MASTER LEVEL down a notch at a time until green, and re-mark the REC tape.',
} as const;

/** A line's drill, in words: "If it blinks red, see F1." */
export const drillText = (ref: DrillRef): string => `${ref.if}, see ${ref.code}.`;

/** Where the Howler lines on C1 and C2 send the crew when its light blinks red. */
const HOWLER_RED: DrillRef = { if: 'If it blinks red', id: 'howler-red', code: 'F1' };

export interface Checklist {
  id: ChecklistId;
  /** The id of the list's heading on its page, for links such as /night/#doors. */
  anchor: string;
  /**
   * Its code in the handbook, on its title strip and the night page's tabs: C1 to C3 for a night's lists in
   * the order they run, S1 for the one-off setup.
   */
  code: string;
  title: string;
  kind: ChecklistKind;
  /** The pause point: when to run it. */
  when: string;
  /** Time budget for a DO-CONFIRM list. */
  seconds?: number;
  items: readonly ChecklistItem[];
  /** The completion call, said out loud when every line is true. */
  call: string;
}

export const CHECKLISTS: Readonly<Record<ChecklistId, Checklist>> = {
  setup: {
    id: 'setup',
    anchor: 'setup',
    code: 'S1',
    title: 'First-time setup',
    kind: 'read-do',
    when: 'Once, before the first night, and again after any rewiring. Cables first, then levels.',
    items: [
      {
        id: 'pa-feed',
        check: 'MASTER 1 (XLR, L and R)',
        target: 'into the DriveRack PA2 inputs',
      },
      {
        id: 'pa-switch',
        check: 'DriveRack PA2 input switch',
        target: '+4 dBu',
        // dbx manual p.5: its input reaches 0 dBFS at +19.9 dBu on +4 dBu, but at about +9.9 dBu on −10 dBV,
        // and dbx recommends muting its outputs before flipping the switch.
        note: 'On −10 dBV its input clips about 10 dB early. Mute its outputs before you flip it.',
      },
      {
        id: 'howler-feed',
        check: 'MASTER 2 (RCA, L and R)',
        target: 'into the Howler’s input',
        // RCA to RCA is Pioneer's own unbalanced hookup (QSG p.20). Rane Note 110: keep unbalanced runs under 3 m.
        note: 'One stereo RCA lead, under 3 m, with no adapters.',
      },
      {
        id: 'monitor-feed',
        check: 'BOOTH (¼″ jacks, L and R)',
        target: 'into the booth monitor speakers',
        // Pioneer: BOOTH is for a booth monitor (manual p.10), used balanced (QSG p.20), and BOOTH MONITOR sets
        // it alone (manual p.27).
        note: 'Balanced leads. BOOTH MONITOR sets only these speakers, and it’s the DJ’s knob.',
      },
      {
        id: 'rec',
        check: 'MASTER LEVEL',
        target: 'fully up, taped, marked REC',
        // Pioneer: MASTER LEVEL sets MASTER1 and MASTER2 (manual p.27), and the master meter reads after it (p.31).
        note: 'It sets the PA and the recording. Fully up, the middle meters show the mix itself.',
      },
      {
        id: 'record-level',
        check: 'Howler, on WAV and recording',
        target: 'LEVEL blinking green on the loudest blend',
        // Pioneer's own fix for distortion is MASTER ATT (manual p.34, UTILITY table p.32), but it doesn't say
        // MASTER ATT reaches MASTER 2, so MASTER LEVEL is the fallback. Settings save 10 s after a change (p.35).
        note: `If it blinks red, set MASTER ATT in UTILITY to −6 dB, then −12 dB. ${OPEN_UTILITY} ${LEVEL_FALLBACK.text} Wait 10 seconds before anyone switches the mixer off, so the settings save.`,
      },
      {
        id: 'amps',
        check: 'Both GX7 amps',
        target: 'FULL RANGE on the back, gain knobs at the room level',
        // QSC GX manual: FULL RANGE bypasses the crossover (p.6); red CLIP LEDs flash when the amp is overdriven
        // (p.5). dbx manual p.10: amps on last, off first.
        note: 'Switch them on last. On the loudest blend, turn the gain knobs up to what the room needs, short of any red CLIP light.',
      },
      {
        id: 'tags',
        check: 'Knob tags',
        target: 'REC on MASTER LEVEL, MONITOR on BOOTH MONITOR, RIG on the amps',
        // The night's lists check both attenuators against the REC tape, so both go on it.
        note: 'Draw a line across each knob and onto the panel. Write both ATT settings, MASTER ATT and BOOTH ATT, on the REC tape.',
      },
      {
        id: 'test-recording',
        check: 'Test recording',
        target: '2 minutes, on headphones: both sides, no hum',
      },
    ],
    call: 'Setup complete.',
  },

  doors: {
    id: 'doors',
    anchor: 'doors',
    code: 'C1',
    title: 'Doors open',
    kind: 'do-confirm',
    when: 'Before the doors open.',
    seconds: 60,
    // Terse on purpose: the crew's chat message is built from these lines and has to fit in 60 words.
    items: [
      {
        id: 'howler',
        check: 'Howler',
        target: 'recording on WAV, charging, LEVEL blinking green',
        drill: HOWLER_RED,
      },
      {
        id: 'rec',
        check: 'MASTER LEVEL',
        target: 'fully up, on the REC mark',
      },
      {
        id: 'att',
        check: 'Both ATTs',
        target: 'as on the REC tape',
        // A DJ's MY SETTINGS can bring their own UTILITY settings back (Pioneer manual p.31).
        note: `MASTER ATT and BOOTH ATT, in UTILITY. ${OPEN_UTILITY} Check again if a DJ loads MY SETTINGS from USB.`,
      },
      {
        id: 'card',
        check: 'Howler card',
        target: 'room for tonight',
      },
      {
        // The id keeps its old name, so ticks made before the rename still count.
        id: 'test-clip',
        check: 'Test recording',
        target: 'clean on headphones, no hum',
      },
      {
        id: 'booth-card',
        check: 'Booth card',
        target: 'by the meters',
      },
      {
        // dbx manual p.10: power amps last on, first off.
        id: 'amps',
        check: 'Amps',
        target: 'on last, knobs on RIG',
      },
    ],
    call: 'Doors check complete.',
  },

  changeover: {
    id: 'changeover',
    anchor: 'changeover',
    code: 'C2',
    title: 'Changeover',
    kind: 'do-confirm',
    when: 'Between DJs, before the next one starts.',
    seconds: 30,
    items: [
      {
        id: 'light',
        check: 'Howler LEVEL light',
        target: 'blinking green, not red, not off',
        drill: HOWLER_RED,
      },
      {
        id: 'rec',
        check: 'MASTER LEVEL',
        target: 'fully up, on the REC mark',
      },
      {
        id: 'settings',
        // A DJ's MY SETTINGS can bring their own UTILITY settings back (Pioneer manual p.31).
        check: 'If a DJ loaded MY SETTINGS',
        target: 'both ATTs as on the REC tape',
      },
      {
        id: 'next-dj',
        check: 'Next DJ',
        target: 'shown the booth card',
      },
      {
        id: 'restart',
        check: 'If the recording is over 3 hours',
        target: 'restarted now, between DJs',
        note: 'A WAV file ends at about 3.5 hours, with a gap of up to a second.',
      },
    ],
    call: 'Changeover check complete.',
  },

  after: {
    id: 'after',
    anchor: 'after',
    code: 'C3',
    title: 'After the night',
    kind: 'read-do',
    when: 'When the last DJ finishes.',
    items: [
      {
        id: 'stop',
        check: 'Howler recording',
        target: 'stopped with RECORD before anything’s switched off',
      },
      {
        // dbx manual p.10: power the amps down first, wait about 10 seconds, then the mixer and the PA2.
        id: 'amps-off',
        check: 'Amps',
        target: 'off first, the rest about 10 seconds later',
      },
      {
        id: 'copy',
        check: 'Card files',
        target: 'copied to two places, before any editing',
      },
      {
        id: 'originals',
        check: 'Originals',
        target: 'kept as they are',
        note: 'Work on copies.',
      },
      {
        id: 'flat-tops',
        check: 'Each set',
        target: 'checked for flat tops',
        // Clipped in the mixer but not at the Howler: the flat tops sit below the file's full scale, where a
        // 0 dBFS marker such as Audacity's Show Clipping never looks (pedagogy-ux §9).
        note: 'Zoom in on the loudest blends for flat tops at any height, and listen on headphones. Audacity’s Show Clipping only marks the file’s top, so it misses mixer clipping, which sits lower.',
      },
      {
        id: 'normalise',
        check: 'Copies',
        target: 'normalised to −1 dB true peak, MP3s made last',
      },
      {
        id: 'files',
        check: 'Files',
        target: 'one per set, named with the date and the DJ',
      },
      {
        id: 'send',
        check: 'Each DJ',
        target: 'sent their set, with a word on how it came out',
      },
      {
        id: 'charge',
        check: 'Howler',
        target: 'on charge',
        note: 'Clear its card once both copies play.',
      },
    ],
    call: 'Recordings saved.',
  },
};

/** The order the lists run in: the one-off setup first, then a night's. */
export const CHECKLIST_ORDER: readonly ChecklistId[] = ['setup', 'doors', 'changeover', 'after'];

export const isChecklistId = (value: string): value is ChecklistId => Object.hasOwn(CHECKLISTS, value);

/** How to run a list, in plain words. */
export function howToRun(list: Checklist): string {
  const how =
    list.kind === 'read-do' ? 'Read each line, then do it.' : 'Do it from memory, then read down and confirm.';
  return list.seconds ? `${how} ${budgetText(list.seconds)}` : how;
}

/** The time budget on a list's title strip: "60 s". */
export const budgetLabel = (seconds: number): string => `${seconds}\u00a0s`;

/** "Under a minute.", "Under 30 seconds." */
export function budgetText(seconds: number): string {
  if (seconds === 60) return 'Under a minute.';
  if (seconds > 60 && seconds % 60 === 0) return `Under ${seconds / 60} minutes.`;
  return `Under ${seconds} seconds.`;
}

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
