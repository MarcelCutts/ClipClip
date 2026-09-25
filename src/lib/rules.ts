/**
 * The rules, in one place, so every page, card and chat message says exactly the same thing.
 * They're written for our wiring: the Howler recording from MASTER 2, so MASTER LEVEL sets both
 * the speakers and the recording, and BOOTH MONITOR feeds the booth monitors.
 *
 * Each rule reads two ways. As a checklist line, for the "Know by heart" boxes: a challenge (what
 * to look at) and a response (what it should be), with a note on what to do if it isn't. And as one
 * sentence, `text`, for the booth card and the group chat.
 */

/** The piece of gear a rule's drawing shows on the print kit: a channel meter, the mix, a knob. */
export type RuleGlyph = 'meter' | 'stereo' | 'knob';

export interface Rule {
  /** The rule as one sentence. */
  text: string;
  /** What to look at, as named on the gear or in the booth. */
  challenge: string;
  /** What it should be. */
  response: string;
  /** What to do when it isn't. */
  note?: string;
  /** The part of the rig the rule is about, lettered like the gear: TRIM, MIX, REC. */
  label?: string;
  glyph?: RuleGlyph;
  /** Where the guide explains it: an anchor on the guide, like '#trim'. */
  why?: string;
}

const trim: Rule = {
  // Position, not just colour: orange runs from 0 to +9, and a blend adds up to two lights.
  // "Channel meters" names the meter: at a changeover the middle ones show the other DJ's track.
  text: 'Channel meters: first or second orange. Never red.',
  challenge: 'Channel meters',
  response: 'first or second orange',
  note: 'If red, ease TRIM back. Set it on cue, before the fader goes up.',
  label: 'TRIM',
  glyph: 'meter',
  why: '#trim',
};

const mix: Rule = {
  text: 'Blending? Watch the middle meters.',
  challenge: 'In a blend',
  response: 'watch the middle meters',
  note: 'If red, ease a fader down a notch.',
  label: 'MIX',
  glyph: 'stereo',
  why: '#blends',
};

/** The deal, as a DJ hears it. */
const rigDj: Rule = {
  text: 'Want it louder? Ask the crew.',
  challenge: 'Louder room',
  response: 'ask the crew',
  note: 'MASTER LEVEL is the crew’s. They turn the amps up.',
  label: 'RIG',
  glyph: 'knob',
  why: '#knobs',
};

/** The same deal, as the crew keep it. */
const rigCrew: Rule = {
  text: 'More volume comes from the amps.',
  challenge: 'More volume',
  response: 'at the amps',
  note: 'When a DJ wants more, turn the amps’ gain up, never their channels or MASTER LEVEL.',
  label: 'RIG',
  why: '#knobs',
};

const rec: Rule = {
  // MASTER LEVEL stays fully up so the middle meters show the mix itself (they read after it).
  text: 'Record level: set once, taped.',
  challenge: 'Record level',
  response: 'set once, taped',
  note: 'MASTER LEVEL fully up and marked REC. If the Howler still blinks red, use MASTER ATT.',
  label: 'REC',
  why: '#record-level',
};

const howler: Rule = {
  text: 'Check the Howler light at every changeover.',
  challenge: 'Howler LEVEL light',
  response: 'every changeover',
  note: 'Blinking green is right. If it blinks red, check the middle meters first.',
  label: 'HOWLER',
  why: '#two-ceilings',
};

/** For the booth card and the DJ briefing: the three a DJ needs. */
export const DJ_RULES: Rule[] = [trim, mix, rigDj];

/** For the night page and the crew cards. */
export const CREW_RULES: Rule[] = [rec, howler, rigCrew];

/**
 * The guide's opening: everyone's rules at once, in the order the signal meets them. The deal
 * appears once, in the DJ's words, since DJs and crew are often the same people.
 */
export const GUIDE_RULES: Rule[] = [trim, mix, rigDj, rec, howler];
