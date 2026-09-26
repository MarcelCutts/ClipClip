/**
 * What we copy from the Pioneer DJ XDJ-RX2, from its Quick Start Guide and panel. Every widget
 * that draws the mixer takes its numbers from here, so they all agree with the real unit.
 */
import { formatDb } from './dsp/db';

export type Zone = 'green' | 'orange' | 'red';

export interface MeterSegment {
  /** The dB mark printed beside this LED. It lights once the level reaches the mark. */
  db: number;
  zone: Zone;
}

/**
 * The channel and master level indicators: twelve LEDs, bottom to top.
 * Green to −3 dB, orange from 0 to +9 dB, red at +12 dB. The master adds a CLIP light above.
 */
export const METER_SEGMENTS: readonly MeterSegment[] = [
  { db: -24, zone: 'green' },
  { db: -18, zone: 'green' },
  { db: -15, zone: 'green' },
  { db: -12, zone: 'green' },
  { db: -9, zone: 'green' },
  { db: -6, zone: 'green' },
  { db: -3, zone: 'green' },
  { db: 0, zone: 'orange' },
  { db: 3, zone: 'orange' },
  { db: 6, zone: 'orange' },
  { db: 9, zone: 'orange' },
  { db: 12, zone: 'red' },
];

/**
 * A mark on the meter's scale as the panel prints it: −24 … −3, 0, +3 … +12, with a true minus
 * sign and a plus sign. Every meter on the site prints its scale with this.
 */
export const scaleLabel = (db: number): string => formatDb(db, { unit: '' });

/** Control ranges printed on the panel (manual p. 27). */
export const RANGES = {
  trim: { min: Number.NEGATIVE_INFINITY, max: 9 },
  /** HI, MID and LOW with EQUALIZER CURVE on EQUALIZER in UTILITY (p. 32); the panel prints −26/−∞ … +6. */
  eq: { min: -26, max: 6 },
  // The output knobs: the panel prints them −∞ … 0. We take fully up as no gain; Pioneer gives no
  // gain figure, and test T3 on /setup/ checks it on the unit.
  masterLevel: { min: Number.NEGATIVE_INFINITY, max: 0 },
  boothMonitor: { min: Number.NEGATIVE_INFINITY, max: 0 },
} as const;

/**
 * In our simulation the mixer's ceiling sits at the red LED: a level that lights red is at, or
 * past, the point where the sound gets flattened. Pioneer only promises "may be distorted" there,
 * so treating red as the ceiling is the cautious reading, and the one we teach.
 */
export const CEILING_DB = 12;

/** How many LEDs a peak level lights. */
export function litCount(levelDb: number): number {
  let n = 0;
  for (const s of METER_SEGMENTS) if (levelDb >= s.db) n++;
  return n;
}

/** The zone of the highest lit LED, or null if nothing lights. */
export function zoneFor(levelDb: number): Zone | null {
  const n = litCount(levelDb);
  return n === 0 ? null : METER_SEGMENTS[n - 1]!.zone;
}

/** Plain words for a meter reading, for labels and screen readers. */
export function describeLevel(levelDb: number): string {
  const zone = zoneFor(levelDb);
  if (!zone) return 'no signal';
  if (zone === 'red') return 'in the red';
  if (zone === 'orange') return 'in the orange';
  return 'in the green';
}

/**
 * Convert between the meter's dB scale and our internal sample scale, where ±1.0 is the
 * ceiling. A level of `CEILING_DB` on the meter is a sample value of 1.
 */
export const meterDbToSample = (db: number): number => 10 ** ((db - CEILING_DB) / 20);
export const sampleToMeterDb = (value: number): number => 20 * Math.log10(Math.abs(value)) + CEILING_DB;
