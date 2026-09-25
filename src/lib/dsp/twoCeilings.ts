import { peak } from './analysis';

/**
 * The test signal behind the two-ceilings lab and the home page's prediction question: a bass
 * tone plus a quieter high tone, like a kick and a hi-hat, looped. The lab's model itself lives in
 * lib/lab/ceilings.ts.
 */
export const TEST_SIGNAL = {
  length: 4096,
  sampleRate: 48_000,
  /** Whole cycles of each tone per loop, so the loop repeats without a join. */
  bassBin: 5,
  highBin: 171,
  bassAmp: 0.8,
  highAmp: 0.2,
} as const;

export const BASS_HZ = (TEST_SIGNAL.bassBin * TEST_SIGNAL.sampleRate) / TEST_SIGNAL.length;
export const HIGH_HZ = (TEST_SIGNAL.highBin * TEST_SIGNAL.sampleRate) / TEST_SIGNAL.length;

const rawTestSignal = (() => {
  const { length, bassBin, highBin, bassAmp, highAmp } = TEST_SIGNAL;
  const x = new Float64Array(length);
  for (let n = 0; n < length; n++) {
    const phase = (2 * Math.PI * n) / length;
    x[n] = bassAmp * Math.sin(bassBin * phase) + highAmp * Math.sin(highBin * phase);
  }
  return x;
})();

const rawTestPeak = peak(rawTestSignal);

/** One loop of the test signal, normalised to a peak of exactly 1 (0 dBFS). */
export const testSignal: Float64Array = rawTestSignal.map((v) => v / rawTestPeak);

/**
 * Evaluate the normalised test signal at any time t in seconds, for building audio buffers
 * at the device's own sample rate. Matches `testSignal` sample for sample at 48 kHz.
 */
export function testSignalAt(t: number): number {
  return (
    (TEST_SIGNAL.bassAmp * Math.sin(2 * Math.PI * BASS_HZ * t) +
      TEST_SIGNAL.highAmp * Math.sin(2 * Math.PI * HIGH_HZ * t)) /
    rawTestPeak
  );
}
