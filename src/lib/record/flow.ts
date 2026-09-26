/**
 * S3 on the setup page, the recording level at every event, and the two tests it rests on, done
 * once per rig: T2, what MASTER ATT turns down, and T3, whether MASTER LEVEL fully up adds gain.
 *
 * The Howler has no input knob, so MASTER ATT and MASTER LEVEL set how loud it records (Pioneer:
 * MASTER LEVEL sets MASTER 1 and MASTER 2, p. 27; MASTER ATT is in UTILITY, p. 32). On most nights
 * the settings on the REC tape still give a green LEVEL light, and steps 5 to 8 have nothing to do.
 *
 * Pioneer publishes neither test's answer. MASTER ATT "sets the master output attenuator" (p. 32),
 * with no socket named and nothing on whether the MASTER meters read before or after it. The panel
 * prints 0 at the top of MASTER LEVEL (p. 27), with no dB figure behind it. The tests find out on
 * the kit, with lights and a file anyone can read.
 *
 * The cards are read-and-do, for one person working alone. A step is the control and the state it
 * should end in. A step that only applies sometimes names its condition after the control, as
 * "MASTER ATT, if red". Notes carry information, and at most one "If …" for when the state isn't
 * met. The last resort is the one rule the night page's drill uses too (LEVEL_FALLBACK).
 *
 * Typography: numbers and units are joined by a no-break space, and minus signs are true minus
 * signs (formatDb does both).
 */

import { ATT_NOTE, LEVEL_FALLBACK, OPEN_UTILITY, STORE_CHANGE } from '../checklists';
import { formatDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, TARGET } from '../model';
import { CEILING_DB, METER_SEGMENTS } from '../xdj';

/** A card's step, as the Procedure component sets it: the control, the state, a note under it. */
export interface Step {
  challenge: string;
  response: string;
  /** A consequence to know before the step, said before it. */
  before?: string;
  note?: string;
}

/**
 * Each deck's peak in the test blend. Two decks with their kicks lined up add KICKS_TOGETHER_DB, so
 * the blend lands on the red light: louder than any DJ should play, and the same blend the rest of
 * the setup (S1, S4) calls "the loudest blend".
 */
export const TEST_DECK_DB = CEILING_DB - KICKS_TOGETHER_DB;

/**
 * MASTER ATT's settings, in the order a red light steps through them. Pioneer's Operating
 * Instructions print the last as "+12 dB" (p. 32); the Quick Start Guide has −12 dB (p. 17), and an
 * attenuator only turns down. T2 says so where the crew first set it.
 */
export const ATT_SETTINGS = [0, -6, -12] as const;

const db = (v: number) => formatDb(v, { signed: false });
/** A reading on the XDJ's meters, as printed on its scale: "+6". */
const reading = (v: number) => formatDb(v, { unit: '' });
const [ATT_FULL, ATT_FIRST, ATT_LOWEST] = ATT_SETTINGS;
/** All three, as a sentence lists them: "0 dB, −6 dB and −12 dB". */
const ATT_LIST = `${ATT_SETTINGS.slice(0, -1).map(db).join(', ')} and ${db(ATT_LOWEST)}`;

/** Where the test blend should peak in the file: no higher than this. */
export const BLEND_MAX_DBFS = formatDb(TARGET.blendMax, { unit: 'dBFS' });

/**
 * If MASTER ATT does not reach MASTER 2, a fixed attenuator in the Howler's lead turns only the
 * recording down, and MASTER LEVEL and the PA stay as they are. No maker describes this: it is our
 * inference, and both cards that offer it say so (T2's finding, and S3's last resort).
 */
const IN_LINE_ATTENUATOR =
  'a fixed in-line RCA attenuator on the Howler’s lead would turn the recording down without moving MASTER LEVEL';
const OUR_INFERENCE = 'That is our inference, not a maker’s procedure.';

// ---- T2: what MASTER ATT turns down ------------------------------------------------------------

/** Said before T2's steps: what Pioneer leaves open, and what to look at while MASTER ATT changes. */
export const T2_INTRO =
  'Pioneer says only that MASTER ATT (MASTER ATTENUATOR in UTILITY) “sets the master output attenuator” (p. 32). It does not say which sockets that includes, or whether the MASTER meters, the pair in the middle, read before or after it. At steps 4 and 5, look at the MASTER meters, the DriveRack’s INPUT meters and the room.';

export const T2_STEPS: readonly Step[] = [
  {
    challenge: 'Rig',
    response: 'built, amps on at a low volume',
    note: 'The amps go on last, with no track playing (S4).',
  },
  { challenge: 'Loud track', response: 'playing, recording on the Howler' },
  {
    challenge: 'MASTER ATT',
    response: db(ATT_FULL),
    note: `It is in UTILITY. ${OPEN_UTILITY} ${STORE_CHANGE} Its settings are ${ATT_LIST}. The Operating Instructions misprint the last as +12 dB, and the Quick Start Guide has it right.`,
  },
  { challenge: 'MASTER ATT, a few bars later', response: db(ATT_FIRST) },
  { challenge: 'MASTER ATT, a few bars later', response: db(ATT_LOWEST) },
  { challenge: 'MASTER ATT', response: `back to ${db(ATT_FULL)}` },
  { challenge: 'Howler recording', response: 'stopped with RECORD' },
  // F1 on the night asks whether MASTER ATT reaches the Howler; the REC tape is where the crew look.
  { challenge: 'REC tape', response: 'says whether MASTER ATT reaches the Howler' },
];

/** One thing T2 looks at, and what each thing it can do means. */
export interface Finding {
  /** What to look at. */
  look: string;
  readings: readonly {
    /** What you see. */
    seen: string;
    /** What that means, and what to do about it. */
    means: string;
  }[];
}

/** What each result of T2 means: one entry per thing to look at, the expected result first. */
export const T2_FINDINGS: readonly Finding[] = [
  {
    look: 'The Howler’s file, in Audacity',
    readings: [
      { seen: 'A step down at each change', means: 'MASTER ATT reaches MASTER 2, the Howler’s socket.' },
      {
        seen: 'No step',
        means: `MASTER ATT does not reach MASTER 2. In S3, leave it at ${db(ATT_FULL)} and skip its two steps. ${IN_LINE_ATTENUATOR.replace(/^a/, 'A')}. ${OUR_INFERENCE}`,
      },
    ],
  },
  {
    look: 'The DriveRack’s INPUT meters, and the room',
    readings: [
      {
        seen: 'Lower at each change',
        means:
          'MASTER ATT reaches MASTER 1, the PA’s socket, too. Turning the recording down turns the room down with it.',
      },
      { seen: 'No change', means: 'MASTER ATT does not reach MASTER 1. It leaves the room as it is.' },
    ],
  },
  {
    look: 'The MASTER meters',
    readings: [
      { seen: 'No change', means: 'They read before MASTER ATT, and show the mix at any setting.' },
      {
        seen: 'Lower at each change',
        means: `They read after MASTER ATT. With it below ${db(ATT_FULL)}, they read low by that much.`,
      },
    ],
  },
];

// ---- T3: whether MASTER LEVEL fully up adds gain -----------------------------------------------

/** How far apart the lights are where a loud track peaks: from the 0 light to the next (xdj.ts). */
const LIGHT_STEP_DB = (() => {
  const at = METER_SEGMENTS.findIndex((s) => s.db === 0);
  const next = METER_SEGMENTS[at + 1];
  if (at < 0 || !next) throw new Error('The meter has no light above 0');
  return next.db - METER_SEGMENTS[at]!.db;
})();

/** Said before T3's steps: what the panel prints, and what gain at the top would do. */
export const T3_INTRO =
  'The panel prints 0 at the top of MASTER LEVEL’s scale (Pioneer, p. 27), and Pioneer gives no dB figure for it. If fully up adds gain, the MASTER meters read higher than the channel meters, and a blend reaches red sooner.';

export const T3_STEPS: readonly Step[] = [
  { challenge: 'MASTER ATT', response: db(ATT_FULL), note: 'As T2 leaves it. It is in UTILITY.' },
  {
    challenge: 'CROSS FADER CURVE',
    response: 'THRU',
    note: 'Pioneer: “Select when not using the crossfader.” (p. 28)',
  },
  { challenge: 'One deck', response: 'a loud track playing, its fader fully up', note: 'The other deck is stopped.' },
  { challenge: 'MASTER LEVEL', response: 'fully up' },
  {
    challenge: 'MASTER meters',
    response: 'the same light as the channel meter, at the loudest part',
    note: `The lights are ${db(LIGHT_STEP_DB)} apart, and a match rules out a gain of ${db(LIGHT_STEP_DB)} or more. If the MASTER meters read higher, turn MASTER LEVEL down until they match, and put the REC mark there. From then on, the REC mark stands for fully up on every card.`,
  },
];

// ---- S3: the recording level -------------------------------------------------------------------

/** Said before the steps: what step 3 does on purpose, and what that asks of you. */
export const CONSEQUENCE =
  'Step 3 puts the MASTER meters, the pair in the middle, in the red on purpose. Do it with no set playing, and delete any recording of it.';

export const STEPS: readonly Step[] = [
  { challenge: 'MASTER LEVEL', response: 'fully up, on the REC mark' },
  {
    // A DJ's MY SETTINGS can change both (Pioneer p. 31), so both go on the REC tape and come back from it.
    challenge: 'MASTER ATT and BOOTH ATT',
    response: `as on the REC tape, or ${db(ATT_FULL)} the first time`,
    note: ATT_NOTE,
  },
  {
    challenge: 'Loudest blend',
    response: `both channel meters at ${reading(TEST_DECK_DB)}, kicks lined up`,
  },
  { challenge: 'Howler LEVEL light', response: 'blinking green' },
  { challenge: 'MASTER ATT, if red', response: db(ATT_FIRST) },
  { challenge: 'MASTER ATT, if still red', response: db(ATT_LOWEST) },
  {
    // If −12 dB is not enough, or MASTER ATT does not reach MASTER 2 (T2). The night's drill uses the same rule.
    challenge: `${LEVEL_FALLBACK.challenge}, if still red`,
    response: `down ${LEVEL_FALLBACK.how}`,
    before: LEVEL_FALLBACK.consequence,
    note: `If MASTER ATT does not reach MASTER 2 (T2), ${IN_LINE_ATTENUATOR}. ${OUR_INFERENCE}`,
  },
  {
    // The night's checklists compare both attenuators with this tape.
    challenge: 'REC tape',
    response: 'MASTER ATT and BOOTH ATT written on it',
    note: 'If step 7 moved MASTER LEVEL, draw its REC mark again.',
  },
  // The old test T6: where the file lands, the one number the light can't give.
  { challenge: 'Test recording, if a setting changed', response: 'a minute of the loudest blend' },
  {
    // Audacity manual, Amplify: "If you take the negative of the value shown in the Amplification (dB) box, this
    // will give you the current peak amplitude of the selection." View menu: Show Clipping in Waveform is off by
    // default, and marks only samples at 0 dB.
    challenge: 'Its peak, in Audacity’s Amplify',
    response: `${BLEND_MAX_DBFS} or lower`,
    note: `Amplify is in the Effect menu. With the whole file selected, its Amplification box shows how far the peak is below ${db(0)}: ${db(-TARGET.blendMax)} means ${BLEND_MAX_DBFS}. Show Clipping cannot tell you this: it is off by default, and marks only ${db(0)}. If the peak is higher, turn the recording level down one more setting.`,
  },
];

/**
 * After the steps: when the mixer keeps a change. Pioneer's troubleshooting table (p. 35), for
 * "Settings are not stored in the memory": "Turn this unit off 10 seconds after changing the
 * settings. Make sure to press the [power] switch to turn this unit off."
 */
export const SAVE_NOTE =
  'A change in UTILITY can be lost if the mixer is switched off within 10 seconds of it, or at the wall instead of at its own power switch (Pioneer, p. 35).';
