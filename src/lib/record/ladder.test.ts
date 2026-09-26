import { describe, expect, it } from 'vitest';
import { fileFinding, spreadLabels } from './ladder';
import { peaksFor } from './model';

/** Numbers keep their units with a no-break space; compare the words. */
const words = (s: string) => s.replaceAll(' ', ' ');
const OFF = Number.NEGATIVE_INFINITY;

describe('the file ladder’s finding', () => {
  it('says when all three land in the target band, as they do once the level is set', () => {
    expect(fileFinding(peaksFor({ level: 0, att: -12 }))).toBe('All three are inside the target band.');
  });

  it('puts clipping first, with how far over the top', () => {
    expect(words(fileFinding(peaksFor({ level: -3, att: 0 })))).toBe('Blend is 3 dB over the top, so it clips.');
    expect(fileFinding(peaksFor({ level: 0, att: -6 }))).toBe('Blend is right at the top, so it clips.');
    // MASTER LEVEL fully up and MASTER ATT at 0 dB: the blend lands 6 dB over, and a loud track at the top.
    expect(fileFinding(peaksFor({ level: 0, att: 0 }))).toBe('Loud and Blend reach the top, so they clip.');
    // In the order the walkthrough passes them, loudest first: the words still run quietest first.
    const hot = [
      { id: 'blend', dbfs: 9 },
      { id: 'loud', dbfs: 3 },
      { id: 'quiet', dbfs: -3 },
    ] as const;
    expect(fileFinding(hot)).toBe('Loud and Blend reach the top, so they clip.');
  });

  it('says what sits above or below the band', () => {
    // As the worked example finds the rig: MASTER LEVEL three notches down, MASTER ATT at 0 dB.
    expect(fileFinding(peaksFor({ level: -9, att: 0 }))).toBe('Blend is above the target band, close to the top.');
    expect(fileFinding(peaksFor({ level: -6, att: -12 }))).toBe('Quiet is below the target band.');
    expect(fileFinding(peaksFor({ level: -24, att: -12 }))).toBe('All three are below the target band.');
  });

  it('says when nothing reaches the file', () => {
    expect(fileFinding(peaksFor({ level: OFF, att: 0 }))).toBe('Nothing reaches the file.');
  });
});

describe('the strip’s labels', () => {
  it('sit on their marks when there’s room', () => {
    expect(spreadLabels([50, 100, 150], [30, 30, 30], 0, 200)).toEqual([50, 100, 150]);
  });

  it('push apart around their marks when they’d overlap, keeping their order', () => {
    const [a, b, c] = spreadLabels([100, 120, 140], [30, 30, 30], 0, 300, 4);
    expect(b).toBe(120);
    expect(b! - a!).toBe(34);
    expect(c! - b!).toBe(34);
  });

  it('stay inside the ends', () => {
    // Marks at the right-hand end, as when the blend lands 6 dB over the top.
    const centres = spreadLabels([150, 175, 200], [33, 26, 33], -16, 216, 4);
    expect(centres.at(-1)! + 33 / 2).toBeLessThanOrEqual(216);
    expect(centres[0]! - 33 / 2).toBeGreaterThanOrEqual(-16);
    for (let i = 1; i < centres.length; i++) expect(centres[i]!).toBeGreaterThan(centres[i - 1]!);
    const lone = spreadLabels([0], [40], 0, 100);
    expect(lone).toEqual([20]);
  });
});
