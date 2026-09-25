import { describe, expect, it } from 'vitest';
import { BASS_HZ, HIGH_HZ, TEST_SIGNAL, testSignal, testSignalAt } from './twoCeilings';

describe('test signal', () => {
  it('peaks at exactly 0 dBFS and matches its continuous form', () => {
    expect(Math.max(...testSignal.map(Math.abs))).toBeCloseTo(1, 12);
    for (const n of [0, 17, 1000, 4095])
      expect(testSignalAt(n / TEST_SIGNAL.sampleRate)).toBeCloseTo(testSignal[n]!, 9);
  });

  it('uses a bass tone near 58 Hz and a high tone near 2 kHz', () => {
    expect(BASS_HZ).toBeCloseTo(58.59, 2);
    expect(HIGH_HZ).toBeCloseTo(2003.9, 1);
  });
});
