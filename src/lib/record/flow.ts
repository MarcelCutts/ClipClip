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
 * met: any other action gets a step of its own. The last resort is the one rule the night page's
 * drill uses too (LEVEL_FALLBACK).
 *
 * T2 and T3 use a steady test tone played from USB (Pioneer p. 5: WAV, 16 or 24 bit, from a FAT32
 * stick), so a change shows as a step in the file and the meters, not lost in the music.
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
/** The no-break space that joins a number to its unit. */
const nb = '\u00a0';
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

/**
 * T2's answer as the REC tape carries it, for S3 and the night's F1. MASTER ATT is not used when it
 * does not reach MASTER 2, or when the MASTER meters read after it: turned down, it would make them
 * read low, and a blend could crunch with their top orange dark.
 */
export const ATT_NOT_USED = 'If the REC tape says MASTER ATT is not used (T2)';
/** What the crew write on the REC tape when T2 finds MASTER ATT is not to be used. */
const WRITE_NOT_USED = `Leave it at ${formatDb(0, { signed: false })}, and write “not used” beside MASTER${nb}ATT on the REC tape.`;

/** The tone T2 and T3 play, and how to make one: a steady 1 kHz at −12 dBFS. */
const TONE_NOTE = `Make it in Audacity: Generate, Tone, 1000${nb}Hz, amplitude 0.25, 60${nb}seconds, exported as a WAV file. The XDJ-RX2 plays WAV files from a FAT32 USB stick (Pioneer p.${nb}5).`;

// ---- T2: what MASTER ATT turns down ------------------------------------------------------------

/** Said before T2's steps: what Pioneer leaves open, and what to look at while MASTER ATT changes. */
export const T2_INTRO =
  'Pioneer says only that MASTER ATT (MASTER ATTENUATOR in UTILITY) “sets the master output attenuator” (p. 32). It does not say which sockets that includes, or whether the MASTER meters, the pair in the middle, read before or after it. A steady tone shows each change clearly. At steps 7 and 8, look at the MASTER meters and the DriveRack’s INPUT meters.';

export const T2_STEPS: readonly Step[] = [
  { challenge: 'Test tone', response: 'on a USB stick', note: TONE_NOTE },
  { challenge: 'Both GX7 amps', response: 'switched off', note: 'The DriveRack’s INPUT meters read without them.' },
  { challenge: 'Test tone', response: 'playing on one deck, its fader and MASTER LEVEL fully up' },
  { challenge: 'TRIM', response: 'channel meter on the first orange (0)' },
  { challenge: 'Howler', response: 'recording' },
  {
    challenge: 'MASTER ATT',
    response: db(ATT_FULL),
    note: `It is in UTILITY. ${OPEN_UTILITY} ${STORE_CHANGE} Its settings are ${ATT_LIST}. The Operating Instructions misprint the last as +12 dB, and the Quick Start Guide has it right.`,
  },
  { challenge: `MASTER ATT, 10${nb}seconds later`, response: db(ATT_FIRST) },
  { challenge: `MASTER ATT, 10${nb}seconds later`, response: db(ATT_LOWEST) },
  { challenge: 'MASTER ATT', response: `back to ${db(ATT_FULL)}` },
  { challenge: 'Howler recording', response: 'stopped with RECORD' },
  // S3 and the night's F1 ask whether MASTER ATT is used for the recording level; the REC tape answers.
  { challenge: 'REC tape', response: 'says whether MASTER ATT is used' },
];

/** After T2's findings: a result that is neither answer. */
export const T2_UNCLEAR = 'If a result is not clear, do the test again.';

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
        means: `MASTER ATT does not reach MASTER 2. ${WRITE_NOT_USED} ${IN_LINE_ATTENUATOR.replace(/^a/, 'A')}. ${OUR_INFERENCE}`,
      },
    ],
  },
  {
    look: 'The DriveRack’s INPUT meters',
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
        means: `They read after MASTER ATT, and would read low with it below ${db(ATT_FULL)}. ${WRITE_NOT_USED}`,
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

/** The light T3 watches: the one above the first orange, "+3". */
const T3_LIGHT = reading(METER_SEGMENTS[METER_SEGMENTS.findIndex((m) => m.db === 0) + 1]?.db ?? LIGHT_STEP_DB);

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
  { challenge: 'HI, MID and LOW', response: '12 o’clock, effects off' },
  {
    challenge: 'Test tone',
    response: 'playing on one deck, its fader fully up',
    note: 'The one from T2. The other deck is stopped.',
  },
  { challenge: 'MASTER LEVEL', response: 'fully up' },
  { challenge: 'TRIM', response: `up slowly until the channel meter’s ${T3_LIGHT} light just comes on` },
  {
    challenge: 'MASTER meters',
    response: `${T3_LIGHT} light on at the same moment`,
    note: `The lights are ${db(LIGHT_STEP_DB)} apart where a track peaks. With a steady tone, the two ${T3_LIGHT} lights come on together if fully up adds no gain.`,
  },
  {
    challenge: `MASTER LEVEL, if the MASTER meters’ ${T3_LIGHT} light came on first`,
    response: 'down until that light only just stays on',
  },
  {
    challenge: 'REC mark',
    response: 'drawn where MASTER LEVEL sits',
    note: 'It is at fully up, unless step 8 moved it.',
  },
];

// ---- S3: the recording level -------------------------------------------------------------------

/** Said before the steps: what step 3 does on purpose, and what that asks of you. */
export const CONSEQUENCE =
  'Step 3 puts the MASTER meters, the pair in the middle, in the red on purpose. Do it with no set playing, and delete any recording of it.';

export const STEPS: readonly Step[] = [
  { challenge: 'MASTER LEVEL', response: 'on the REC mark', note: 'T3 draws it.' },
  {
    // A DJ's MY SETTINGS can change both (Pioneer p. 31), so both go on the REC tape and come back from it.
    challenge: 'MASTER ATT and BOOTH ATT',
    response: `as on the REC tape, or ${db(ATT_FULL)} the first time`,
    note: ATT_NOTE,
  },
  {
    // Two released tracks add about 5 dB in a blend, not always the full 6 (model.ts, KICKS_TOGETHER_DB), so
    // the step asks for the light itself rather than trusting the sum.
    challenge: 'Loudest blend',
    response: 'MASTER meters red on the loudest peaks',
    note: `Two tracks with both channel meters at ${reading(TEST_DECK_DB)} usually get there. If the red light does not come on, turn one TRIM up a little.`,
  },
  { challenge: 'Howler LEVEL light', response: 'blinking green' },
  {
    challenge: 'MASTER ATT, if red',
    response: db(ATT_FIRST),
    note: `${ATT_NOT_USED}, leave it at ${db(ATT_FULL)} and go to step 7.`,
  },
  { challenge: 'MASTER ATT, if still red', response: db(ATT_LOWEST) },
  {
    // If −12 dB is not enough, or MASTER ATT is not used (T2). The night's drill uses the same rule.
    challenge: `${LEVEL_FALLBACK.challenge}, if still red`,
    response: `down ${LEVEL_FALLBACK.how}`,
    before: LEVEL_FALLBACK.consequence,
    note: `If MASTER ATT is not used (T2), ${IN_LINE_ATTENUATOR}. ${OUR_INFERENCE}`,
  },
  {
    // The night's checklists compare both attenuators with this tape.
    challenge: 'REC tape',
    response: 'MASTER ATT and BOOTH ATT written on it',
    note: 'If step 7 moved MASTER LEVEL, draw its REC mark again.',
  },
  // The old test T6: where the file lands, the one number the light can't give. Every time, the first included.
  { challenge: 'Test recording', response: 'a minute of the loudest blend, the first time and after any change' },
  {
    // Audacity manual, Amplify: "If you take the negative of the value shown in the Amplification (dB) box, this
    // will give you the current peak amplitude of the selection." View menu: Show Clipping in Waveform is off by
    // default, and marks only samples at 0 dB.
    challenge: 'Its peak, in Audacity’s Amplify',
    response: `${BLEND_MAX_DBFS} or lower`,
    note: `Amplify is in the Effect menu. With the whole file selected, its Amplification box shows how far the peak is below ${db(0)}: ${db(-TARGET.blendMax)} means ${BLEND_MAX_DBFS}. Show Clipping cannot tell you this: it is off by default, and marks only ${db(0)}.`,
  },
  {
    // The loop closes: a lower setting is recorded and read again, and the tape follows it.
    challenge: 'Recording level, if the peak is higher',
    response: 'one MASTER ATT setting lower, then steps 8 to 10 again',
    note: `At ${db(ATT_LOWEST)}, or if MASTER ATT is not used (T2), use step 7.`,
  },
];

/**
 * After the steps: when the mixer keeps a change. Pioneer's troubleshooting table (p. 35), for
 * "Settings are not stored in the memory": "Turn this unit off 10 seconds after changing the
 * settings. Make sure to press the [power] switch to turn this unit off."
 */
export const SAVE_NOTE =
  'A change in UTILITY can be lost if the mixer is switched off within 10 seconds of it, or at the wall instead of at its own power switch (Pioneer, p. 35).';
