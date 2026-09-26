/**
 * S3 on the setup page: the recording level, at every event. The Howler has no input knob, so
 * MASTER ATT and MASTER LEVEL set how loud it records (Pioneer: MASTER LEVEL sets MASTER 1 and
 * MASTER 2, p. 27; MASTER ATT is in UTILITY, p. 32). On most nights the settings on the REC tape
 * still give a green LEVEL light, and steps 5 to 7 and 9 have nothing to do.
 *
 * The card is read-and-do, for one person working alone. A step is the control and the state it
 * should end in. A step that only applies sometimes names its condition after the control, as
 * "MASTER ATT, if red". Notes carry information, and at most one "If …" for when the state isn't
 * met. The last resort is the one rule the night page's drill uses too (LEVEL_FALLBACK).
 *
 * Typography: numbers and units are joined by a no-break space, and minus signs are true minus
 * signs (formatDb does both).
 */

import { IN_UTILITY, LEVEL_FALLBACK } from '../checklists';
import { formatDb } from '../dsp/db';
import { KICKS_TOGETHER_DB, TARGET } from '../model';
import { CEILING_DB } from '../xdj';

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

/** Where the test blend should peak in the file: no higher than this. */
export const BLEND_MAX_DBFS = formatDb(TARGET.blendMax, { unit: 'dBFS' });

/** Said before the steps: what step 3 does on purpose, and what that asks of you. */
export const CONSEQUENCE =
  'Step 3 puts the MASTER meters, the pair in the middle, in the red on purpose. Do it with no set playing, and delete any recording of it.';

export const STEPS: readonly Step[] = [
  { challenge: 'MASTER LEVEL', response: 'fully up, on the REC mark' },
  {
    // A DJ's MY SETTINGS can change both (Pioneer p. 31), so both go on the REC tape and come back from it.
    challenge: 'MASTER ATT and BOOTH ATT',
    response: `as on the REC tape, or ${db(ATT_SETTINGS[0])} the first time`,
    note: IN_UTILITY,
  },
  {
    challenge: 'Loudest blend',
    response: `both channel meters at ${reading(TEST_DECK_DB)}, kicks lined up`,
  },
  { challenge: 'Howler LEVEL light', response: 'blinking green' },
  { challenge: 'MASTER ATT, if red', response: db(ATT_SETTINGS[1]) },
  { challenge: 'MASTER ATT, if still red', response: db(ATT_SETTINGS[2]) },
  {
    // If −12 dB is not enough, or MASTER ATT does not reach MASTER 2 (T2). The night's drill uses the same rule.
    challenge: `${LEVEL_FALLBACK.challenge}, if still red`,
    response: `down ${LEVEL_FALLBACK.how}`,
    before: LEVEL_FALLBACK.consequence,
  },
  // The night's checklists compare both attenuators with this tape.
  { challenge: 'REC tape', response: 'MASTER ATT and BOOTH ATT written on it' },
  {
    // The old test T6: where the file lands, the one number the light can't give.
    challenge: 'Test recording, if a setting changed',
    response: `loudest blend at ${BLEND_MAX_DBFS} or lower`,
    note: 'Record a minute of the loudest blend, and open the file in Audacity. If it peaks higher, turn the recording level down one more setting.',
  },
];

/**
 * After the steps: when the mixer keeps a change. Pioneer's troubleshooting table (p. 35): "Turn
 * this unit off 10 seconds after changing the settings."
 */
export const SAVE_NOTE =
  'A change in UTILITY is lost if the mixer is switched off within 10\u00a0seconds of it (Pioneer, p. 35).';
