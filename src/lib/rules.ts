/**
 * The lines to know by heart, in one place, so the guide, the night page, the booth card and the
 * chat messages say exactly the same thing. Written for our wiring: the Howler records from
 * MASTER 2, so MASTER LEVEL sets both the speakers and the recording, and BOOTH MONITOR sets only
 * the booth monitors.
 *
 * Each line is set like a quick reference handbook's: the name printed on the gear, leader dots,
 * then the state you can see. Its note says what to do if it isn't so, in one sentence that starts
 * with the condition. A box holds three lines: UK CAA CAP 676 prefers fewer than four (Ch. 7 §2.6).
 */

export interface Rule {
  /** What to look at, named as it's printed on the gear. */
  challenge: string;
  /** The state you should see. */
  response: string;
  /** What to do if it isn't so, as one "If …, …" sentence. The chat and the booth card carry it whole. */
  note: string;
  /** Where the guide explains it: a section's anchor, like '#trim'. */
  why?: string;
  /** The drill for when it isn't so, by its id in fixes.ts: 'howler-red' lands on /night/#fix-howler-red. */
  drill?: string;
  /** The rule as one sentence, for the tape tag that prints it. */
  text?: string;
  /** The tape tag the print kit finds it by: TRIM, MIX, RIG. */
  label?: string;
}

const channelMeters: Rule = {
  // Position, not just colour: orange runs from 0 to +9, and a blend adds up to two lights.
  challenge: 'Channel meters',
  response: 'first or second orange',
  note: 'If red, turn TRIM (the gain knob) down a little.',
  label: 'TRIM',
  why: '#trim',
};

const masterMeters: Rule = {
  // Pioneer prints MASTER over the pair; its manual calls them the master level indicator.
  challenge: 'MASTER meters (the pair in the middle)',
  response: 'below red in a blend',
  note: 'If red, pull a channel fader down a little.',
  label: 'MIX',
  why: '#blends',
};

/** The deal, as a DJ hears it: MASTER LEVEL is the crew's, and so is the room's volume. */
const masterLevel: Rule = {
  challenge: 'MASTER LEVEL',
  response: 'fully up, the crew’s',
  note: 'For a louder room, ask the crew. For a louder booth, turn up BOOTH MONITOR.',
  text: 'For a louder room, ask the crew.',
  label: 'RIG',
  why: '#knobs',
};

/** The same deal, as the crew keep it: the room's volume comes from the amps (F4). */
const crewMasterLevel: Rule = {
  challenge: 'MASTER LEVEL',
  response: 'fully up, on the REC mark',
  note: 'If a DJ wants a louder room, turn up the amps.',
  drill: 'not-loud',
};

const howlerLight: Rule = {
  challenge: 'Howler LEVEL light',
  response: 'blinking green',
  note: 'If it blinks red, look at the MASTER meters, the pair in the middle, first.',
  drill: 'howler-red',
};

/** A DJ's MY SETTINGS can bring back their own UTILITY settings, the ATTs among them (Pioneer manual p. 31). */
const atts: Rule = {
  challenge: 'MASTER ATT and BOOTH ATT',
  response: 'as on the REC tape',
  note: 'If a DJ loads MY SETTINGS, compare both with the tape.',
  drill: 'my-settings',
};

/** For the guide's box, the booth card and the DJ briefing. */
export const DJ_RULES: Rule[] = [channelMeters, masterMeters, masterLevel];

/** For the crew's box on the night page. */
export const CREW_RULES: Rule[] = [crewMasterLevel, howlerLight, atts];
