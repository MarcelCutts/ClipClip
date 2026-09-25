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

/** Where Pioneer asks the loudest part of a track to land: the orange LEDs, red dark. */
export const TARGET_PEAK_DB = { first: 0, second: 3, top: 9 } as const;

/**
 * Where the Howler's file should land, in dBFS (audio-science §13): normal peaks around −12, the
 * loudest blend no higher than −6, and the Howler light green throughout. The band is the window
 * a night's peaks should sit in.
 */
export const TARGET = {
  /** A loud track, the "normal peak" of a night. */
  normal: -12,
  /** The loudest blend may go no higher than this. */
  blendMax: -6,
  band: { top: -6, bottom: -18 },
} as const;

/** How much two beatmatched kicks add when they land together (the synth loops measure 6.0). */
export const KICKS_TOGETHER_DB = 6;

/**
 * Howler publishes no noise figure, so the headroom ladder shows its converter's floor as a
 * deliberately wide guess, in dBFS.
 */
export const HOWLER_NOISE_GUESS_DBFS = { top: -90, bottom: -110 } as const;

/**
 * The research's worked example for the equal-loudness demo: at a club a 50 Hz bass reaches
 * about 100 dB SPL; home listening is about 30 dB quieter.
 */
export const CLUB_BASS_DB_SPL = 100;

/** How much quieter home listening is, in the same example (audio-science §11 D5; verify-audio-science B17). */
export const HOME_BELOW_CLUB_DB = 30;
