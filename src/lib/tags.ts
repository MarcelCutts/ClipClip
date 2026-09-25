/**
 * The knob tags crew stick on the gear, in one place, so the printed tags, the quiz picture and any
 * page that mentions them always say the same thing.
 *
 * One wiring: MASTER LEVEL sets MASTER 1 (the PA) and MASTER 2 (the Howler) together, so it stays
 * fully up and carries REC. BOOTH MONITOR sets only the booth monitors, so it's the DJ's: MONITOR.
 * The room's volume comes from the amps' gain knobs, taped RIG.
 */

export interface ShortTag {
  /** The big word on the tape. */
  name: string;
  /** Whose knob it is, printed small after the word. */
  owner: string;
  /** Where the tag goes. */
  where: string;
}

/** On MASTER LEVEL: the recording (and the PA) are set by the crew. */
export const REC_TAG: ShortTag = {
  name: 'REC',
  owner: 'set by crew',
  where: 'Next to MASTER LEVEL, which stays fully up. It sets the speakers and the recording.',
};

/** On BOOTH MONITOR: the DJ's own knob for the booth monitors. */
export const MONITOR_TAG: ShortTag = {
  name: 'MONITOR',
  owner: 'yours',
  where: 'Next to BOOTH MONITOR, the DJ’s own knob for the booth monitors.',
};

/** On the amps: the room's volume, turned up by the crew when a DJ asks. */
export const RIG_TAG: ShortTag = {
  name: 'RIG',
  owner: 'crew',
  where: 'On both amps, next to the gain knobs, once they’re set for the room.',
};

export const SHORT_TAGS: readonly ShortTag[] = [REC_TAG, MONITOR_TAG, RIG_TAG];

/** The long tag under MASTER LEVEL: what the knob does, and who to ask for more. */
export const MASTER_TAG = {
  name: 'SPEAKERS + RECORDING',
  lines: ['Turning it changes both, so leave it.', 'Want it louder? Ask the crew.'],
  /** Printed width in millimetres. */
  width: 90,
  where: 'Under MASTER LEVEL, where a DJ reads it before turning the knob.',
} as const;
