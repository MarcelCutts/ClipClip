import { describe, expect, it } from 'vitest';
import { CLUB_BASS_DB_SPL, HOME_BELOW_CLUB_DB } from '../model';
import {
  bassPhon,
  CHART,
  CROSSING_DB,
  crunchPhon,
  DEFAULT_SIZES,
  equalLabelRect,
  LEVEL_RANGE,
  louder,
  readoutFor,
  START_DB,
  STOPS,
  sentenceFor,
  shownPhon,
  speakLevel,
  worthAnnouncing,
  yPx,
} from './homeVsClub';
import { overlaps } from './readout';

describe('the home-vs-club model', () => {
  it('reproduces the research’s worked example at the club and home stops', () => {
    expect(START_DB).toBe(CLUB_BASS_DB_SPL);
    const home = STOPS.find((s) => s.id === 'home')!.db;
    expect(CLUB_BASS_DB_SPL - home).toBe(30);
    expect(HOME_BELOW_CLUB_DB).toBe(30);
    expect(bassPhon(CLUB_BASS_DB_SPL)).toBeCloseTo(76.9, 1);
    expect(crunchPhon(CLUB_BASS_DB_SPL)).toBeCloseTo(73.1, 1);
    expect(bassPhon(home)).toBeCloseTo(28.0, 1);
    expect(crunchPhon(home)).toBeCloseTo(44.3, 1);
  });

  it('crosses at about 94.7 dB, between the loud car and the club', () => {
    expect(CROSSING_DB).toBeCloseTo(94.7, 1);
    expect(CROSSING_DB).toBeGreaterThan(STOPS[1].db);
    expect(CROSSING_DB).toBeLessThan(STOPS[2].db);
  });
});

describe('the takeaway', () => {
  it('says the bass wins at the club and the crunch wins at home', () => {
    expect(sentenceFor(100)).toBe('At club level, the bass sounds 4 phon louder than the crunch.');
    expect(sentenceFor(70)).toBe('At home on headphones, the crunch sounds 16 phon louder than the bass.');
    expect(sentenceFor(85)).toMatch(/^In a loud car, the crunch sounds \d+ phon louder/);
  });

  it('agrees with the rounded numbers the chart shows, at every level', () => {
    for (let db = LEVEL_RANGE.min; db <= LEVEL_RANGE.max; db++) {
      const { bass, crunch } = shownPhon(db);
      const s = sentenceFor(db);
      if (bass === crunch) expect(s).toContain('about as loud');
      else expect(s).toContain(`${Math.abs(bass - crunch)} phon louder`);
      expect(s).not.toMatch(/\d dB/);
    }
    // Right by the crossing both read 67, so the sentence calls it even.
    expect(shownPhon(94)).toEqual({ bass: 67, crunch: 67 });
    expect(sentenceFor(94)).toContain('about as loud');
  });
});

describe('what the slider and the live region say', () => {
  it('speaks the level, the stop and both loudnesses at every step', () => {
    expect(speakLevel(100)).toBe('bass at 100 decibels, club. Bass 77 phon, crunch 73 phon');
    expect(speakLevel(70)).toBe('bass at 70 decibels, home, headphones. Bass 28 phon, crunch 44 phon');
    expect(speakLevel(99)).toMatch(/^bass at 99 decibels\. Bass \d+ phon, crunch \d+ phon$/);
  });

  it('announces arriving at a stop, or the louder sound changing over, and nothing else', () => {
    // Stepping down from the club: quiet until the two draw level, then when the crunch takes
    // over, then at the loud car.
    const said: number[] = [];
    for (let db = 100; db > 84; db--) if (worthAnnouncing(db, db - 1)) said.push(db - 1);
    expect(said).toEqual([94, 93, 85]);
    expect([louder(95), louder(94), louder(93)]).toEqual(['bass', 'even', 'crunch']);
    expect(worthAnnouncing(100, 100)).toBe(false);
    expect(worthAnnouncing(99, 100)).toBe(true);
    expect(worthAnnouncing(80, 70)).toBe(true);
    expect(worthAnnouncing(80, 79)).toBe(false);
  });
});

describe('the crosshair readout', () => {
  // Chart widths from a 320 px phone (258) and a 360 px phone (298) to the wide frame (about 600).
  const widths = [258, 280, 298, 328, 360, 420, 520, 600, 700];

  it('never covers a line, stays in the plot, and from a 360 px phone up misses every label too', () => {
    for (const width of widths) {
      // Sizes a little larger than they render, for safety.
      const s = { ...DEFAULT_SIZES, width, readout: { w: 94, h: 40 }, title: { w: 165, h: 16 } };
      const plotW = width - CHART.inset.left - CHART.inset.right;
      const span = LEVEL_RANGE.max - LEVEL_RANGE.min;
      for (let level = LEVEL_RANGE.min; level <= LEVEL_RANGE.max; level += 0.5) {
        const p = readoutFor(level, s);
        const where = `width ${width}, level ${level}: ${JSON.stringify(p)}`;
        if (width >= 298) {
          expect(p.clear, where).toBe(true);
          expect(overlaps(p, equalLabelRect(s)), where).toBe(false);
        }
        expect(p.y, where).toBeGreaterThanOrEqual(0);
        expect(p.y + p.h, where).toBeLessThanOrEqual(CHART.plot.top + CHART.plot.height);
        expect(p.x + p.w, where).toBeLessThanOrEqual(width);
        // Sample both lines across the box: no point of either may fall inside it.
        for (let x = Math.max(p.x, CHART.inset.left); x <= Math.min(p.x + p.w, CHART.inset.left + plotW); x += 1) {
          const db = LEVEL_RANGE.min + ((x - CHART.inset.left) / plotW) * span;
          for (const phon of [bassPhon(db), crunchPhon(db)]) {
            const y = CHART.plot.top + yPx(phon);
            expect(y < p.y - 2 || y > p.y + p.h + 2, `${where} line at x ${x}`).toBe(true);
          }
        }
      }
    }
  });

  it('sits above the lines on the cursor’s left at the club, the level it opens on', () => {
    for (const width of widths) {
      const p = readoutFor(START_DB, { ...DEFAULT_SIZES, width });
      expect(p).toMatchObject({ side: 'before', spot: 'above' });
    }
  });
});
