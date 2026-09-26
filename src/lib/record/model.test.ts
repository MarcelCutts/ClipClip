import { describe, expect, it } from 'vitest';
import { LEVEL_FALLBACK } from '../checklists';
import { prng } from '../dsp/synth';
import { HOWLER_CEILING_AT_FULL_KNOB_DB, KICKS_TOGETHER_DB, MIXER_CEILING_DB } from '../model';
import { RANGES } from '../xdj';
import {
  ATT_LOWEST,
  ATT_VALUES,
  attMessage,
  feedDb,
  filePeakDbfs,
  firstGreen,
  HOWLER_LIMIT,
  holdMessage,
  judgeAtt,
  judgeHold,
  judgeLevel,
  judgePlay,
  judgeUp,
  LEVEL,
  LEVEL_NOTCHES,
  levelMessage,
  lightFor,
  MATERIAL_IDS,
  MATERIALS,
  MATERIALS_NOTE,
  material,
  middleMeterDb,
  NOTCH_DB,
  nearestNotch,
  newsSince,
  peaksFor,
  playMessage,
  type Rig,
  randomFound,
  recordedMessage,
  rigNews,
  settingsMessage,
  shuffledOrder,
  spokenLevel,
  spokenPeak,
  statusSentence,
  TARGET,
  targetAtt,
  targetLevel,
  upMessage,
} from './model';

/** Numbers keep their units with a no-break space (see the last test); compare the words. */
const expectText = (s: string | null | undefined, message?: string) =>
  expect(typeof s === 'string' ? s.replaceAll('\u00a0', ' ') : s, message);
const rig = (material: Rig['material'], level: number, att: Rig['att'] = 0): Rig => ({ material, level, att });
const OFF = Number.NEGATIVE_INFINITY;
/** A Howler with 9 dB less room than the site assumes: MASTER ATT alone can't get it green. */
const TIGHT = HOWLER_LIMIT - 9;
/** One with 6 dB more: a single MASTER ATT step does it. */
const ROOMY = HOWLER_LIMIT + 6;

describe('where MASTER 2 lands in the file', () => {
  it('puts a meter peak at the Howler limit on 0 dBFS with MASTER LEVEL fully up and MASTER ATT at 0 dB', () => {
    expect(HOWLER_LIMIT).toBe(HOWLER_CEILING_AT_FULL_KNOB_DB);
    expect(filePeakDbfs(HOWLER_LIMIT, { level: LEVEL.max, att: 0 })).toBe(0);
  });

  it('follows the model: mix peak − limit + MASTER LEVEL + MASTER ATT', () => {
    expect(filePeakDbfs(12, { level: -9, att: -6 })).toBe(12 - 6 - 9 - 6);
    expect(feedDb({ level: -3, att: -12 })).toBe(-15);
    expect(filePeakDbfs(12, { level: OFF, att: 0 })).toBe(OFF);
  });

  it('keeps the three things to play 6 dB apart, the loudest at the mixer ceiling', () => {
    expect(MATERIALS.map((m) => m.mixDb)).toEqual([0, 6, 12]);
    expect(material('blend').mixDb).toBe(MIXER_CEILING_DB);
    expect(material('blend').mixDb).toBe(material('loud').mixDb + KICKS_TOGETHER_DB);
    expect(MATERIALS_NOTE).toBe(
      'With MASTER LEVEL fully up, the middle meters show a quiet track at 0, a loud one at +6 and the blend at +12.',
    );
  });

  it('puts a whole night in the target band with MASTER LEVEL fully up and MASTER ATT at −12 dB', () => {
    expect(peaksFor({ level: 0, att: -12 })).toEqual([
      { id: 'quiet', dbfs: -18 },
      { id: 'loud', dbfs: -12 },
      { id: 'blend', dbfs: -6 },
    ]);
    for (const { dbfs } of peaksFor({ level: 0, att: -12 })) {
      expect(dbfs).toBeLessThanOrEqual(TARGET.band.top);
      expect(dbfs).toBeGreaterThanOrEqual(TARGET.band.bottom);
    }
  });

  it('reads the middle meters after MASTER LEVEL, so turning it down hides the blend', () => {
    expect(middleMeterDb(material('blend').mixDb, 0)).toBe(12);
    expect(middleMeterDb(material('blend').mixDb, -6)).toBe(6);
  });
});

describe('the controls', () => {
  it('runs MASTER LEVEL from off to fully up in 3 dB notches', () => {
    expect(LEVEL.max).toBe(RANGES.masterLevel.max);
    expect(NOTCH_DB).toBe(3);
    expect(LEVEL_NOTCHES).toEqual([OFF, -24, -21, -18, -15, -12, -9, -6, -3, 0]);
  });

  it('snaps any level to a notch, off below the lowest', () => {
    expect(nearestNotch(1)).toBe(0);
    expect(nearestNotch(-4)).toBe(-3);
    expect(nearestNotch(-24.5)).toBe(-24);
    expect(nearestNotch(-26)).toBe(OFF);
    expect(nearestNotch(OFF)).toBe(OFF);
    expect(nearestNotch(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('steps MASTER ATT as Pioneer lists it: 0, −6 and −12 dB', () => {
    expect(ATT_VALUES).toEqual([0, -6, -12]);
    expect(ATT_LOWEST).toBe(-12);
  });
});

describe('the Howler LEVEL light', () => {
  it('is dark with nothing playing, or with MASTER LEVEL off', () => {
    expect(lightFor(rig(null, 0))).toBe('off');
    expect(lightFor(rig('blend', OFF))).toBe('off');
  });

  it('turns red at the limit, not just over it', () => {
    expect(lightFor(rig('blend', 0, 0))).toBe('red');
    expect(lightFor(rig('blend', 0, -6))).toBe('red');
    expect(lightFor(rig('blend', 0, -12))).toBe('green');
    expect(lightFor(rig('loud', 0, 0))).toBe('red');
    expect(lightFor(rig('loud', -3, 0))).toBe('green');
  });

  it('only reports what is playing now', () => {
    expect(lightFor(rig('quiet', 0))).toBe('green');
    expect(lightFor(rig('blend', 0))).toBe('red');
  });
});

describe('where each step should leave the rig', () => {
  it('needs MASTER ATT at −12 dB on the site’s Howler, with MASTER LEVEL left fully up', () => {
    expect(targetAtt()).toEqual({ att: -12, green: true });
    expect(targetLevel()).toEqual({ level: LEVEL.max, fullyUp: true });
  });

  it('stops at the first MASTER ATT step that goes green', () => {
    expect(targetAtt(ROOMY)).toEqual({ att: -6, green: true });
    expect(targetAtt(HOWLER_LIMIT + 7)).toEqual({ att: 0, green: true });
  });

  it('turns MASTER LEVEL down only when MASTER ATT runs out, a notch at a time until green', () => {
    expect(targetAtt(TIGHT)).toEqual({ att: -12, green: false });
    // Coming down from fully up with MASTER ATT at −12 dB: red, red, then the first steady green.
    expect(lightFor(rig('blend', 0, -12), TIGHT)).toBe('red');
    expect(lightFor(rig('blend', -3, -12), TIGHT)).toBe('red');
    expect(firstGreen(-12, TIGHT)).toBe(-2 * NOTCH_DB);
    expect(targetLevel(TIGHT)).toEqual({ level: -6, fullyUp: false });
  });
});

describe('judging step 1: MASTER LEVEL fully up', () => {
  it('only tapes it fully up', () => {
    expect(judgeUp(rig(null, 0))).toEqual({ kind: 'taped' });
    expectText(upMessage(judgeUp(rig(null, 0)))).toBe(
      'Taped fully up and marked REC. The middle meters now show the mix itself.',
    );
    expectText(upMessage(judgeUp(rig(null, -9)))).toBe('Turn MASTER LEVEL fully up first. It’s at −9 dB.');
    expectText(upMessage(judgeUp(rig(null, OFF)))).toBe('Turn MASTER LEVEL fully up first. It’s off.');
  });
});

describe('judging step 2: the loudest blend', () => {
  it('wants the blend, with MASTER LEVEL still on its tape', () => {
    expect(judgePlay(rig(null, 0), 0)).toEqual({ kind: 'nothing' });
    expect(judgePlay(rig('blend', -3), 0)).toEqual({ kind: 'off-tape', tape: 0 });
    expectText(playMessage(judgePlay(rig('blend', -3), 0))).toBe(
      'MASTER LEVEL is off its REC tape. Put it back fully up.',
    );
    expect(judgePlay(rig('blend', 0), 0)).toEqual({ kind: 'seen', light: 'red' });
    expectText(playMessage(judgePlay(rig('blend', 0), 0))).toBe(
      'The light blinks red on the loudest blend, so the feed is too loud for the Howler.',
    );
    expect(judgePlay(rig('blend', 0, -12), 0)).toEqual({ kind: 'seen', light: 'green' });
  });

  it('catches a quiet track, whose green light proves nothing', () => {
    const v = judgePlay(rig('quiet', 0), 0);
    expect(v).toEqual({ kind: 'wrong-material', material: 'quiet' });
    expect(lightFor(rig('quiet', 0))).toBe('green');
    expectText(playMessage(v)).toBe(
      'That’s a quiet track, and the light only shows what’s playing now. Play the loudest blend.',
    );
    expectText(playMessage(judgePlay(rig('loud', 0), 0))).toContain('play the loudest blend');
  });
});

describe('judging step 3: MASTER ATT', () => {
  it('steps down while the light is red', () => {
    expect(judgeAtt(rig('blend', 0, 0), 0)).toEqual({ kind: 'still-red', att: 0 });
    expectText(attMessage(judgeAtt(rig('blend', 0, 0), 0))).toBe('The light is red, so set MASTER ATT down a step.');
    expectText(attMessage(judgeAtt(rig('blend', 0, -6), 0))).toBe(
      'The light is still red, so set MASTER ATT down another step.',
    );
    const set = judgeAtt(rig('blend', 0, -12), 0);
    expect(set).toEqual({ kind: 'set', att: -12, blendDbfs: -6, loudDbfs: -12 });
    expectText(attMessage(set)).toBe(
      'The light stays green through the loudest blend. In the file it peaks at −6 dBFS, and a loud track at −12. Bring the room back up at the amps.',
    );
  });

  it('keeps MASTER LEVEL out of it while MASTER ATT has steps left', () => {
    const v = judgeAtt(rig('blend', -6, 0), 0);
    expect(v).toEqual({ kind: 'level-moved', tape: 0 });
    expectText(attMessage(v)).toBe(
      'Leave MASTER LEVEL fully up, on its tape. Turned down, the middle meters read low and hide a blend that’s too loud, so turn the recording down with MASTER ATT.',
    );
  });

  it('asks for the loudest blend', () => {
    expectText(attMessage(judgeAtt(rig('quiet', 0, -12), 0))).toBe(
      'Play the loudest blend. The light only shows what’s playing now.',
    );
  });

  it('stops at the first green step, and hands over to MASTER LEVEL when there is none', () => {
    expect(judgeAtt(rig('blend', 0, -6), 0, ROOMY)).toMatchObject({ kind: 'set', att: -6 });
    const low = judgeAtt(rig('blend', 0, -12), 0, ROOMY);
    expect(low).toEqual({ kind: 'too-low', att: -6 });
    expectText(attMessage(low)).toContain('Set MASTER ATT back up to −6 dB');
    expectText(attMessage(judgeAtt(rig('blend', 0, 0), 0, HOWLER_LIMIT + 7))).toContain(
      'Green with MASTER ATT at 0 dB, so leave it there.',
    );
    const out = judgeAtt(rig('blend', 0, -12), 0, TIGHT);
    expect(out).toEqual({ kind: 'lowest-red' });
    expectText(attMessage(out)).toBe('Still red with MASTER ATT at −12 dB, its lowest step. MASTER LEVEL is next.');
  });

  it('only gives the file’s numbers once it’s set: the booth can’t show them', () => {
    for (const r of [rig('blend', 0, 0), rig('blend', 0, -6), rig('blend', -6, 0), rig('quiet', 0, -12)]) {
      expectText(attMessage(judgeAtt(r, 0))).not.toMatch(/dBFS/);
    }
  });
});

describe('judging step 4: MASTER LEVEL, only if still red', () => {
  it('leaves MASTER LEVEL fully up when MASTER ATT got the light green', () => {
    expect(judgeLevel(rig('blend', 0, -12), -12)).toEqual({ kind: 'stays-up' });
    expectText(levelMessage({ kind: 'stays-up' })).toBe(
      'The light is green with MASTER LEVEL fully up, so MASTER LEVEL stays there, on its REC tape.',
    );
    const down = judgeLevel(rig('blend', -6, -12), -12);
    expect(down).toEqual({ kind: 'put-back-up' });
    expectText(levelMessage(down)).toContain('put it back there, on its tape');
  });

  it('holds MASTER ATT where step 3 left it', () => {
    const v = judgeLevel(rig('blend', 0, -6), -12);
    expect(v).toEqual({ kind: 'att-changed', att: -12 });
    expectText(levelMessage(v)).toBe('MASTER ATT has changed. Set it back to −12 dB.');
    expect(judgeLevel(rig('loud', 0, -12), -12)).toEqual({ kind: 'not-blend' });
  });

  it('wants the first notch that stays green', () => {
    const at = (level: number) => judgeLevel(rig('blend', level, -12), -12, TIGHT);
    expect(at(0)).toEqual({ kind: 'still-red' });
    expect(at(-3)).toEqual({ kind: 'still-red' });
    expect(at(-6)).toEqual({ kind: 'set', level: -6, blendDbfs: -3, metersLowDb: 6 });
    expect(at(-9)).toEqual({ kind: 'too-low' });
    expect(at(OFF)).toEqual({ kind: 'off' });
    expectText(levelMessage(at(-6))).toBe(
      'Marked REC at −6 dB. In the file, the blend peaks at −3 dBFS. The middle meters now read 6 dB low, so a blend can clip before they go red. Bring the room back up at the amps.',
    );
  });

  it('words the fallback the same way every time: a notch at a time until green', () => {
    expect(LEVEL_FALLBACK.how).toBe('a notch at a time until green');
    for (const kind of ['off', 'still-red', 'too-low'] as const) {
      expectText(levelMessage({ kind }), kind).toContain(`down ${LEVEL_FALLBACK.how}.`);
    }
    expectText(levelMessage({ kind: 'still-red' })).toBe(
      'Still red. Keep turning it down a notch at a time until green.',
    );
  });
});

describe('judging step 5: the test', () => {
  it('notices MASTER LEVEL and MASTER ATT separately', () => {
    expect(judgeHold(rig('quiet', 0, -12), 0, -12)).toEqual({ kind: 'held' });
    expect(judgeHold(rig('blend', -3, -12), 0, -12)).toEqual({ kind: 'level-moved', tape: 0 });
    expect(judgeHold(rig('blend', 0, -6), 0, -12)).toEqual({ kind: 'att-changed', att: -12 });
    expectText(holdMessage({ kind: 'level-moved', tape: 0 })).toBe(
      'MASTER LEVEL is off its REC tape. Put it back fully up, then record.',
    );
    expectText(holdMessage({ kind: 'level-moved', tape: -12 })).toContain('Put it back on −12 dB');
    expectText(holdMessage({ kind: 'att-changed', att: -12 })).toBe(
      'MASTER ATT has changed. Set it back to −12 dB, then record.',
    );
  });

  it('reports the test recording as the file would show it', () => {
    expectText(recordedMessage({ level: 0, att: -12 })).toBe(
      'Recorded 2 minutes. The loudest blend peaks at −6 dBFS, and the light stayed green.',
    );
  });
});

describe('what a DJ’s MY SETTINGS can undo', () => {
  it('works out what MASTER ATT back at 0 dB would do, rather than assuming', () => {
    expectText(settingsMessage(0, -12)).toBe(
      'If a DJ loads MY SETTINGS from USB, MASTER ATT can change. Back at 0 dB, the loudest blend would land 6 dB over the top. Check it at every changeover.',
    );
    expectText(settingsMessage(0, -12, HOWLER_LIMIT + 6)).toContain('the loudest blend would reach 0 dBFS');
    expectText(settingsMessage(0, 0, HOWLER_LIMIT + 7)).toBe(
      'If a DJ loads MY SETTINGS from USB, check UTILITY again, because it can change MASTER ATT.',
    );
  });
});

describe('the practice round', () => {
  it('never offers the choices in the worked order', () => {
    const rand = prng(7);
    for (let i = 0; i < 200; i++) {
      const order = shuffledOrder(rand);
      expect([...order].sort()).toEqual([...MATERIAL_IDS].sort());
      expect(order).not.toEqual(MATERIAL_IDS);
    }
  });

  it('finds MASTER LEVEL somewhere below fully up, never off, and MASTER ATT on any step', () => {
    const rand = prng(11);
    const levels = new Set<number>();
    const atts = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const found = randomFound(rand);
      levels.add(found.level);
      atts.add(found.att);
      expect(LEVEL_NOTCHES).toContain(found.level);
      expect(Number.isFinite(found.level)).toBe(true);
      expect(found.level).toBeLessThan(LEVEL.max);
    }
    expect(levels.size).toBe(LEVEL_NOTCHES.length - 2);
    expect([...atts].sort()).toEqual([...ATT_VALUES].sort());
  });
});

describe('the status sentence', () => {
  it('says what plays, what the light does and where it lands', () => {
    expectText(statusSentence(rig(null, 0))).toBe('Nothing playing. The Howler’s LEVEL light is dark.');
    expectText(statusSentence(rig('blend', 0, -12))).toBe(
      'The loudest blend playing. The Howler’s LEVEL light blinks green. It peaks at −6 dBFS in the file.',
    );
    expectText(statusSentence(rig('blend', 0))).toContain('6 dB over the top');
    expectText(statusSentence(rig('blend', OFF))).toBe(
      'The loudest blend playing, but MASTER LEVEL is off. The LEVEL light is dark.',
    );
  });

  it('calls a peak of exactly 0 dBFS right at the top, as the file ladder does', () => {
    expectText(statusSentence(rig('blend', 0, -6))).toBe(
      'The loudest blend playing. The Howler’s LEVEL light blinks red. It peaks right at the top in the file.',
    );
  });
});

describe('what the live region says', () => {
  it('says nothing when MASTER LEVEL moves within one light: the slider says where the peak lands', () => {
    expectText(newsSince(rigNews(rig('blend', -9)), rig('blend', -12))).toBeNull();
    expectText(newsSince(rigNews(rig('blend', 0)), rig('blend', -3))).toBeNull();
  });

  it('says when the light changes', () => {
    expectText(newsSince(rigNews(rig('blend', -6)), rig('blend', -9))).toBe('The LEVEL light is now blinking green.');
    expectText(newsSince(rigNews(rig('blend', -9)), rig('blend', -6))).toBe(
      'The LEVEL light is now blinking red, too loud.',
    );
  });

  it('gives the whole status when something else starts playing', () => {
    expect(newsSince(rigNews(rig('blend', -12)), rig('loud', -12))).toBe(statusSentence(rig('loud', -12)));
    expect(newsSince(rigNews(rig(null, 0)), rig('blend', 0))).toBe(statusSentence(rig('blend', 0)));
  });

  it('says what MASTER ATT did to the peak, and whether it’s where step 3 set it', () => {
    expectText(newsSince(rigNews(rig('blend', 0, 0)), rig('blend', 0, -6))).toBe(
      'MASTER ATT at −6 dB. The LEVEL light is still blinking red, too loud. The loudest blend now peaks right at the top in the file.',
    );
    expectText(newsSince(rigNews(rig('blend', 0, -6)), rig('blend', 0, -12))).toBe(
      'MASTER ATT at −12 dB. The LEVEL light is now blinking green. The loudest blend now peaks at −6 dBFS in the file.',
    );
    expectText(newsSince(rigNews(rig('blend', 0, -12)), rig('blend', 0, -6), -12)).toMatch(
      /That’s not where you set it\.$/,
    );
    expectText(newsSince(rigNews(rig('blend', 0, -6)), rig('blend', 0, -12), -12)).toMatch(
      /That’s where you set it\.$/,
    );
  });

  it('leaves MASTER ATT to its own radio buttons with nothing playing', () => {
    expectText(newsSince(rigNews(rig(null, 0)), rig(null, 0, -6))).toBeNull();
  });
});

describe('MASTER LEVEL’s spoken value', () => {
  it('says where it is, whether it’s off the tape, and where what’s playing lands', () => {
    expectText(spokenLevel(rig(null, 0), null)).toBe('0 decibels, fully up');
    expectText(spokenLevel(rig(null, OFF), null)).toBe('off');
    expectText(spokenLevel(rig('blend', -9), 0)).toBe(
      'minus 9 decibels, off the REC tape. The loudest blend peaks at minus 3 dBFS',
    );
    expectText(spokenLevel(rig('blend', 0), 0)).toBe(
      '0 decibels, fully up. The loudest blend peaks 6 decibels over the top, clipped',
    );
    expectText(spokenLevel(rig('blend', OFF), 0)).toBe('off, not on the REC tape. Nothing reaches the Howler');
  });

  it('spells out where the peak lands', () => {
    expectText(spokenPeak(rig(null, -12))).toBeNull();
    expectText(spokenPeak(rig('blend', 0, -12))).toBe('The loudest blend peaks at minus 6 dBFS');
    expectText(spokenPeak(rig('blend', 0, -6))).toBe('The loudest blend peaks right at the top, clipped');
  });
});

describe('typography', () => {
  it('keeps every number in the visible messages on the same line as its unit', () => {
    const texts = [
      upMessage(judgeUp(rig(null, -9))),
      attMessage(judgeAtt(rig('blend', 0, -12), 0)),
      attMessage(judgeAtt(rig('blend', 0, -12), 0, ROOMY)),
      levelMessage(judgeLevel(rig('blend', -6, -12), -12, TIGHT)),
      levelMessage({ kind: 'att-changed', att: -12 }),
      holdMessage({ kind: 'att-changed', att: -12 }),
      recordedMessage({ level: 0, att: -12 }),
      settingsMessage(0, -12),
      statusSentence(rig('blend', 0, -12)),
    ];
    for (const text of texts) {
      expect(text).toMatch(/\d\u00a0(?:dB|dBFS)\b/);
      expect(text).not.toMatch(/\d (?:dB|dBFS)\b/);
    }
  });
});
