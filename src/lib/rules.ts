/**
 * The lines to know by heart, in one place, so the guide, the night page, the booth card and the
 * chat messages say exactly the same thing. Written for our wiring: the Howler records from
 * MASTER 2, so MASTER LEVEL sets both the speakers and the recording, and BOOTH MONITOR sets only
 * the booth monitors.
 *
 * Each line is set like a quick reference handbook's: the name printed on the gear, leader dots,
 * then the state you can see. Its note says what to do if it isn't so, in one sentence that starts
 * with the condition. A box holds three lines at most: UK CAA CAP 676 prefers fewer than four
 * (Ch. 7 §2.6).
 *
 * The gear carries no tape and no marks (the owner, 28 September 2026), so no line names one. The
 * crew set MASTER LEVEL by the MASTER meters at soundcheck, as Pioneer's manual does (p. 31, and
 * p. 34: "around [0 dB] at the peak level"), and the amps by their CLIP lights.
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
  /** A short key the code finds the line by: TRIM, MIX, RIG. It is not printed. */
  label?: string;
  /**
   * The line as the drawing of the meters carries it, beside the light it is about: the meter's
   * name, then the state of that light. Each is the start of the line's own words.
   */
  drawn?: { meter: string; state: string };
}

const channelMeters: Rule = {
  // Position, not just colour: orange runs from 0 to +9, so the line names the light and its mark
  // (TARGET_PEAK_DB.aim in model.ts). A light is a threshold: the second orange lit on every kick
  // means peaks from +3 up, and a blend adds up to two lights on top.
  challenge: 'Channel meters',
  response: 'first orange (0) at the loudest part',
  note: 'If the second orange lights on every kick, turn TRIM (the gain knob) down a little.',
  label: 'TRIM',
  why: '#trim',
  drawn: { meter: 'Channel meters', state: 'first orange (0)' },
};

const masterMeters: Rule = {
  // Pioneer prints MASTER over the pair; its manual calls them the master level indicator. Channels
  // on the first orange keep a blend under the top orange (TARGET_PEAK_DB.top), so the top
  // orange is the first sign of a blend or an EQ boost that is too loud, a light before the red.
  challenge: 'MASTER meters (the pair in the middle)',
  response: 'top orange dark',
  note: 'If the top orange lights, pull a channel fader down a little.',
  label: 'MIX',
  why: '#blends',
  drawn: { meter: 'MASTER meters', state: 'top orange dark' },
};

/** The deal, as a DJ hears it: MASTER LEVEL is the crew's, and so is the room's volume. */
const masterLevel: Rule = {
  challenge: 'MASTER LEVEL',
  // The crew set it by the MASTER meters at soundcheck (C1). A DJ needs to know only that it stays.
  response: 'leave it as you find it',
  note: 'For a louder room, ask the crew. For a louder booth, turn up BOOTH MONITOR.',
  text: 'For a louder room, ask the crew.',
  label: 'RIG',
  why: '#knobs',
};

/**
 * The same deal, as the crew keep it: the room's volume comes from the amps, and an amp's CLIP
 * light is its limit (QSC GX manual p. 5; F4).
 */
const crewMasterLevel: Rule = {
  challenge: 'MASTER LEVEL',
  response: 'as soundcheck left it',
  note: 'If a DJ wants a louder room, turn up the amps, with their CLIP lights dark.',
  drill: 'not-loud',
};

const howlerLight: Rule = {
  challenge: 'Howler LEVEL light',
  response: 'blinking green',
  note: 'If it blinks red, look at the MASTER meters, the pair in the middle, first.',
  drill: 'howler-red',
};

/**
 * The amps' own limit, on the side of the rack that faces the crowd. QSC: the red CLIP LEDs flash
 * when the amp is overdriven (GX manual p. 5).
 */
const ampClip: Rule = {
  challenge: 'Amp CLIP lights',
  response: 'dark',
  note: 'If one flashes, turn all four gain knobs back one click.',
  drill: 'no-louder',
};

/** For the guide's box, the booth card and the DJ briefing. */
export const DJ_RULES: Rule[] = [channelMeters, masterMeters, masterLevel];

/** For the crew's box on the night page. */
export const CREW_RULES: Rule[] = [crewMasterLevel, howlerLight, ampClip];
