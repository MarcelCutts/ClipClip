/**
 * The knob tags crew can stick on the gear, for the print kit. They are labels, and nothing depends
 * on them: the gear carries no marks, and no list, drill or quiz card asks for a tag (the owner, 28
 * September 2026).
 *
 * One wiring: MASTER LEVEL sets MASTER 1 (the PA) and MASTER 2 (the Howler) together, so it is the
 * crew's and carries REC. BOOTH MONITOR sets only the booth monitors, so it's the DJ's: MONITOR. The
 * room's volume comes from the amps' gain knobs, with their CLIP lights dark: RIG.
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
  /** A rule printed small under the word. */
  rule?: string;
}

/** On MASTER LEVEL: the recording (and the PA) are the crew's. */
export const REC_TAG: ShortTag = {
  name: 'REC',
  owner: 'crew',
  where: 'Next to MASTER LEVEL, which sets the speakers and the recording.',
};

/** On BOOTH MONITOR: the DJ's own knob for the booth monitors. */
export const MONITOR_TAG: ShortTag = {
  name: 'MONITOR',
  owner: 'yours',
  where: 'Next to BOOTH MONITOR, the DJ’s own knob for the booth monitors.',
};

/** On the amps: the room's volume, turned up by the crew when a DJ asks, with the CLIP lights dark. */
export const RIG_TAG: ShortTag = {
  name: 'RIG',
  owner: 'crew',
  rule: 'CLIP lights dark',
  where: 'On both amps, beside the gain knobs.',
};

export const SHORT_TAGS: readonly ShortTag[] = [REC_TAG, MONITOR_TAG, RIG_TAG];

/** The DJ rule for a louder room, word for word, so the tape under the knob says what the guide says. */
const ASK_THE_CREW = DJ_RULES.find((r) => r.label === 'RIG')?.text;
if (!ASK_THE_CREW) throw new Error('The DJ rule for a louder room (RIG) needs its one sentence for the tag');

/** The long tag under MASTER LEVEL: what to do with the knob, what it sets, and who to ask for more. */
export const MASTER_TAG = {
  name: 'LEAVE IT AS YOU FIND IT',
  lines: ['It sets the speakers and the recording.', ASK_THE_CREW],
  /** Printed width in millimetres. */
  width: 90,
  where: 'Under MASTER LEVEL, where a DJ reads it before turning the knob.',
} as const;
