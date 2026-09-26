/**
 * The knob tags crew stick on the gear, in one place, so the printed tags and the setup page's
 * wiring table say the same thing.
 *
 * One wiring: MASTER LEVEL sets MASTER 1 (the PA) and MASTER 2 (the Howler) together, so it stays
 * fully up and carries REC. BOOTH MONITOR sets only the booth monitors, so it's the DJ's: MONITOR.
 * The room's volume comes from the amps' gain knobs, no higher than the RIG marks: the lines S4 draws
 * on the RIG tape at each knob's highest click with both amps' CLIP lights dark on the loudest blend.
 *
 * A short tag is a word and whose it is, in one form for all three: "crew" or "yours". The long tag
 * under MASTER LEVEL leads with what to do, as a label a hand already on the knob reads first.
 */
import { DJ_RULES } from './rules';

export interface ShortTag {
  /** The big word on the tape. */
  name: string;
  /** Whose knob it is, printed small after the word. */
  owner: 'crew' | 'yours';
  /** Where the tag goes. */
  where: string;
  /** Settings the crew write on the tape by hand, printed as labelled blanks. */
  blanks?: readonly string[];
  /** A rule printed small under the word, for a tape that marks a limit. */
  rule?: string;
}

/**
 * On MASTER LEVEL: the recording (and the PA) are the crew's. The night's checklists compare both
 * attenuators with this tape, so it has a blank for each.
 */
export const REC_TAG: ShortTag = {
  name: 'REC',
  owner: 'crew',
  where:
    'Next to MASTER LEVEL. Write the MASTER ATT (MASTER ATTENUATOR in UTILITY) and BOOTH ATT settings in its blanks.',
  blanks: ['MASTER ATT', 'BOOTH ATT'],
};

/** On BOOTH MONITOR: the DJ's own knob for the booth monitors. */
export const MONITOR_TAG: ShortTag = {
  name: 'MONITOR',
  owner: 'yours',
  where: 'Next to BOOTH MONITOR, the DJ’s own knob for the booth monitors.',
};

/**
 * On the amps: the room's volume, turned up by the crew when a DJ asks, no higher than the RIG marks.
 * The marks are the lines drawn across each gain knob onto this tape in S4, so the tape says what
 * they are for.
 */
export const RIG_TAG: ShortTag = {
  name: 'RIG',
  owner: 'crew',
  rule: 'No higher than the marks',
  where: 'On both amps, beside the gain knobs, where S4 draws the RIG marks.',
};

export const SHORT_TAGS: readonly ShortTag[] = [REC_TAG, MONITOR_TAG, RIG_TAG];

/** The DJ rule for a louder room, word for word, so the tape under the knob says what the guide says. */
const ASK_THE_CREW = DJ_RULES.find((r) => r.label === 'RIG')?.text;
if (!ASK_THE_CREW) throw new Error('The DJ rule for a louder room (RIG) needs its one sentence for the tag');

/** The long tag under MASTER LEVEL: what to do with the knob, what it sets, and who to ask for more. */
export const MASTER_TAG = {
  name: 'LEAVE FULLY UP',
  lines: ['It sets the speakers and the recording.', ASK_THE_CREW],
  /** Printed width in millimetres. */
  width: 90,
  where: 'Under MASTER LEVEL, where a DJ reads it before turning the knob.',
} as const;
