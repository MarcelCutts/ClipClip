/**
 * The assumptions behind every simulation on the site, in one place.
 *
 * Levels are on the XDJ-RX2 meter's own dB scale (see xdj.ts). The mixer's ceiling is the red
 * LED at +12 dB; the Howler's ceiling is not published anywhere, so we pick a plausible value
 * and say so in the interface.
 */
import { CEILING_DB } from './xdj';

/** Ceiling 1: inside the mixer. At or past the red LED the peaks are flattened. */
export const MIXER_CEILING_DB = CEILING_DB;

/**
 * Ceiling 2: the Howler's input, as a meter reading with the knob feeding it fully up.
 *
 * Howler says the mixer distorts before the recorder, but it doesn't say which mixer outputs it
 * tested, and its recommended hookup is a REC OUT, which the XDJ-RX2 doesn't have. Howler also
 * publishes no maximum input level, so the promise is unverified on this rig. We assume the
 * Howler overloads 6 dB below the mixer's red, and the UI labels this as an assumption: on the
 * night, the Howler's LEVEL light is the only way to tell.
 */
export const HOWLER_CEILING_AT_FULL_KNOB_DB = 6;

/**
 * How far below the mixer's red the Howler overloads, with the knob fully up. Derived, so any
 * sentence that states the gap follows the two ceilings above.
 */
export const HOWLER_BELOW_RED_DB = MIXER_CEILING_DB - HOWLER_CEILING_AT_FULL_KNOB_DB;

/**
 * How much two beatmatched kicks can add when they land together: up to 6 dB, when they line up
 * exactly. Pioneer's staff put it as audio that "will either sum or cancel out, depending on the
 * phasing" (Pioneer DJ Community, sources.ts). The synth loops share one kick in phase, so they
 * measure 6.0, the worst case. The rules plan for all 6.
 */
export const KICKS_TOGETHER_DB = 6;

/** Where a channel's loudest part should land: the first orange light, printed 0. */
const AIM_DB = 0;

/**
 * The DJ's targets, as marks on the meter (rules.ts). A light comes on once the level reaches its
 * mark, so the first orange lit and the second dark is a peak from 0 to just under +3.
 *
 * Pioneer asks for "the orange indicator" at a track's loudest, with red dark (manual p. 31). On
 * this meter orange runs from 0 to +9. Where Pioneer gives a number, for the master, it is "around
 * [0 dB] at the peak level" (p. 34). The aim is the first orange, 0. A blend with the kicks lined
 * up then reaches two lights higher, +6, and the top orange, +9, stays dark.
 */
export const TARGET_PEAK_DB = {
  /** A channel meter at a track's loudest part: the first orange light. */
  aim: AIM_DB,
  /** The MASTER meters in the loudest blend, kicks lined up: two lights above the aim. */
  blend: AIM_DB + KICKS_TOGETHER_DB,
  /** The top orange: the MASTER meters keep it dark. If it lights, a channel fader comes down. */
  top: 9,
} as const;

/**
 * Where the Howler's file should land, in dBFS (audio-science §13), once S3 has set the recording
 * level: single tracks around −18, normal blends around −12, the loudest blend no higher than −6,
 * and the Howler light green throughout. The band is the window a night's peaks should sit in.
 */
export const TARGET = {
  /** A normal blend, kicks lined up (+6 on the MASTER meters): the "normal peak" of a night. */
  normal: -12,
  /** The loudest blend may go no higher than this. */
  blendMax: -6,
  band: { top: -6, bottom: -18 },
} as const;
