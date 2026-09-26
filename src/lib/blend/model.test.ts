import { describe, expect, it } from 'vitest';
import { peak } from '../dsp/analysis';
import { dbToGain } from '../dsp/db';
import { loudnessLufs } from '../dsp/loudness';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from '../model';
import { CEILING_DB, meterDbToSample, sampleToMeterDb } from '../xdj';
import {
  ANALYSIS_RATE,
  analyseBlend,
  BARELY_OVER_DB,
  type BlendSettings,
  barelyOver,
  challengeStatus,
  clipState,
  cloneSettings,
  displayDb,
  FADER,
  faderDb,
  faderGain,
  hotDecks,
  LOW_STEPS,
  listenBuffer,
  PRESETS,
  type PresetId,
  preset,
  presetsIn,
  renderMix,
  START,
  sameSettings,
  TRIM,
  topLit,
  tracksAt,
} from './model';

const settingsOf = (id: PresetId) => cloneSettings(preset(id).settings);
const withDeck = (s: BlendSettings, deck: 'deck1' | 'deck2', change: Partial<BlendSettings['deck1']>) => {
  const next = cloneSettings(s);
  next[deck] = { ...next[deck], ...change };
  return next;
};
/** The challenge as the reader first meets it: deck 2 brought fully up from the start, both on +3. */
const challenge = withDeck(START, 'deck2', { fader: FADER.max });
/** Both decks on the third orange (+6), blended: the mix only just reaches the red. */
const sixes = withDeck(withDeck(challenge, 'deck1', { trim: 6 }), 'deck2', { trim: 6 });

/** How much of the loop the ceilings cut away: RMS of the removed part against the uncut blend, in %. */
function cutPercent(s: BlendSettings, sampleRate: number): number {
  const tracks = tracksAt(sampleRate);
  const out = renderMix(s, tracks);
  const deckGain = (d: BlendSettings['deck1']) => ({
    trim: meterDbToSample(d.trim),
    low: dbToGain(d.low),
    fader: faderGain(d.fader),
  });
  const g1 = deckGain(s.deck1);
  const g2 = deckGain(s.deck2);
  const { a, b, length: n } = tracks;
  const shift = s.aligned ? 0 : tracks.sixteenth;
  let removed = 0;
  let wanted = 0;
  for (let i = 0; i < n; i++) {
    const j = (i - shift + n) % n;
    const w =
      g1.fader * g1.trim * (g1.low * a.low[i]! + a.mid[i]! + a.high[i]!) +
      g2.fader * g2.trim * (g2.low * b.low[j]! + b.mid[j]! + b.high[j]!);
    removed += (w - out[i]!) ** 2;
    wanted += w * w;
  }
  return wanted === 0 ? 0 : 100 * Math.sqrt(removed / wanted);
}

describe('fader curve', () => {
  it('hits the documented points', () => {
    expect(faderDb(10)).toBe(0);
    expect(faderDb(8)).toBeCloseTo(-6, 9);
    expect(faderDb(6)).toBeCloseTo(-12, 9);
    expect(faderDb(4)).toBeCloseTo(-20, 9);
    expect(faderDb(2)).toBeCloseTo(-35, 9);
    expect(faderDb(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(faderGain(0)).toBe(0);
    expect(faderGain(10)).toBe(1);
  });

  it('only ever gets louder as the fader goes up, and fades smoothly to silence', () => {
    let last = Number.NEGATIVE_INFINITY;
    for (let p = FADER.step; p <= FADER.max; p += FADER.step) {
      const db = faderDb(p);
      expect(db).toBeGreaterThan(last);
      last = db;
    }
    expect(faderDb(1.99)).toBeCloseTo(faderDb(2), 1);
    expect(faderDb(0.5)).toBeLessThan(-45);
  });

  it('clamps positions outside its travel', () => {
    expect(faderDb(12)).toBe(0);
    expect(faderDb(-1)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('controls', () => {
  it('puts flat in the middle of the LOW knob, like its 12 o’clock detent', () => {
    expect(LOW_STEPS[(LOW_STEPS.length - 1) / 2]).toBe(0);
    expect(LOW_STEPS[0]).toBe(-26);
    expect(LOW_STEPS.at(-1)).toBe(6);
    expect([...LOW_STEPS].sort((a, b) => a - b)).toEqual(LOW_STEPS);
  });

  it('starts TRIM on the second orange, the highest start from which a blend lights the top orange', () => {
    expect(TRIM.initial).toBe(3);
    expect(TRIM.initial + KICKS_TOGETHER_DB).toBe(TARGET_PEAK_DB.top);
    expect(TRIM.initial).toBeGreaterThan(TARGET_PEAK_DB.aim);
    expect(START.deck1.trim).toBe(TRIM.initial);
    expect(START.deck2.trim).toBe(TRIM.initial);
  });
});

describe('meters', () => {
  it('reads TRIM straight off the channel meter with the EQ flat', () => {
    for (const trim of [-6, 0, 3, 6, 9, 12]) {
      const r = analyseBlend({ deck1: { trim, low: 0, fader: 10 }, deck2: { trim, low: 0, fader: 10 }, aligned: true });
      expect(r.channel[0]).toBeCloseTo(trim, 6);
      expect(r.channel[1]).toBeCloseTo(trim, 6);
    }
  });

  it('keeps the channel meters still when a fader moves: they read before the fader', () => {
    const base = analyseBlend(START);
    for (const fader of [0, 2, 5, 8, 10]) {
      const r = analyseBlend(withDeck(START, 'deck2', { fader }));
      expect(r.channel).toEqual(base.channel);
    }
  });

  it('moves the channel meter with LOW, since the kick is the peak', () => {
    const cut = analyseBlend(settingsOf('swap'));
    expect(cut.channel[0]).toBeCloseTo(-2.4, 1);
    const boost = analyseBlend(settingsOf('boost'));
    expect(boost.channel[1]).toBeGreaterThan(7.5);
    expect(boost.channel[1]).toBeLessThan(TARGET_PEAK_DB.top);
  });

  it('shows deck 1 alone on the master meter while deck 2’s fader is down', () => {
    const r = analyseBlend(START);
    expect(r.mix).toBeCloseTo(3, 6);
    expect(r.clip).toBe('off');
  });
});

describe('blends add up', () => {
  it('stacks two +3 tracks onto the top orange when the kicks line up (+6.0 dB)', () => {
    const r = analyseBlend(challenge);
    expect(r.mix - 3).toBeCloseTo(6.0, 1);
    expect(r.mix).toBeGreaterThan(TARGET_PEAK_DB.top);
    expect(displayDb(r.mix)).toBe(TARGET_PEAK_DB.top);
    expect(topLit(r)).toBe(true);
    expect(r.clip).toBe('off');
  });

  it('stacks two +6 tracks to the red', () => {
    const r = analyseBlend(sixes);
    expect(r.mix - 6).toBeCloseTo(6.0, 1);
    expect(displayDb(r.mix)).toBe(CEILING_DB);
    expect(r.clip).toBe('fast');
  });

  it('puts both tracks on the top orange light for Top orange, so the blend goes 3 dB past the red', () => {
    const s = settingsOf('hot');
    expect(s.deck1.trim).toBe(TARGET_PEAK_DB.top);
    expect(s.deck2.trim).toBe(TARGET_PEAK_DB.top);
    const r = analyseBlend(s);
    expect(displayDb(r.channel[0])).toBe(9);
    expect(displayDb(r.channel[1])).toBe(9);
    expect(r.mix - TARGET_PEAK_DB.top).toBeCloseTo(6.0, 1);
    expect(displayDb(r.mix)).toBe(CEILING_DB + 3);
    expect(r.clip).toBe('fast');
  });

  it('adds about +1.9 dB with deck 1’s LOW cut', () => {
    const r = analyseBlend(settingsOf('swap'));
    expect(r.mix - 3).toBeCloseTo(1.9, 1);
    expect(r.clip).toBe('off');
  });

  it('adds less with deck 1’s fader one mark down, and far less with the kicks apart', () => {
    const eased = analyseBlend(settingsOf('ease'));
    expect(eased.mix).toBeGreaterThan(7);
    expect(eased.mix).toBeLessThan(8);
    const apart = analyseBlend({ ...challenge, aligned: false });
    expect(apart.mix - 3).toBeGreaterThan(1.5);
    expect(apart.mix - 3).toBeLessThan(3.5);
  });

  it('lights the top orange and CLIP, just under the red, with a LOW boost from the start', () => {
    const r = analyseBlend(settingsOf('boost'));
    expect(r.mix).toBeGreaterThan(CEILING_DB - 1);
    expect(displayDb(r.mix)).toBeLessThan(CEILING_DB);
    expect(r.clip).toBe('slow');
  });

  it('keeps the top orange dark with a LOW boost on one deck from the first orange', () => {
    const r = analyseBlend({
      deck1: { trim: TARGET_PEAK_DB.aim, low: 0, fader: 10 },
      deck2: { trim: TARGET_PEAK_DB.aim, low: 6, fader: 10 },
      aligned: true,
    });
    expect(topLit(r)).toBe(false);
  });

  it('keeps a first-orange blend in the orange with room to spare', () => {
    const r = analyseBlend(settingsOf('orange'));
    expect(r.channel[0]).toBeCloseTo(0, 6);
    expect(displayDb(r.mix)).toBe(6);
    expect(r.clip).toBe('off');
  });

  it('shows the loop’s loudest moment in the two beats on screen', () => {
    const cases = [START, ...PRESETS.map((p) => p.settings), { ...settingsOf('hot'), aligned: false }];
    for (const s of cases) {
      const r = analyseBlend(s);
      expect(sampleToMeterDb(peak(r.view.mix))).toBeCloseTo(r.mix, 1);
    }
  });

  it('draws the view post-fader: a closed fader is a flat line', () => {
    const r = analyseBlend(START);
    expect(peak(r.view.deck2)).toBe(0);
    expect(peak(r.view.deck1)).toBeCloseTo(meterDbToSample(START.deck1.trim), 2);
  });
});

describe('the ceiling', () => {
  it('blinks CLIP slowly just below the red and fast past it', () => {
    expect(clipState(12.01)).toBe('fast');
    expect(clipState(12)).toBe('slow');
    expect(clipState(10.5)).toBe('slow');
    expect(clipState(10.49)).toBe('off');
    expect(clipState(Number.NEGATIVE_INFINITY)).toBe('off');
  });

  it('never rounds a level up to a light that is still dark', () => {
    expect(displayDb(11.98)).toBe(11);
    expect(displayDb(12.02)).toBe(12);
    expect(displayDb(-0.3)).toBe(-1);
    expect(displayDb(-0.6)).toBe(-1);
    expect(displayDb(7.87)).toBe(8);
    // The top orange, which the MASTER meters keep dark: +8.6 does not light it.
    expect(displayDb(8.6)).toBe(8);
    expect(displayDb(9.02)).toBe(9);
    // Rounding noise on a mark still lights it.
    expect(displayDb(6 - 1e-9)).toBe(6);
    expect(Object.is(displayDb(-0.2 + 0.2), 0)).toBe(true);
    expect(displayDb(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('cuts a red channel flat before its fader, so easing the fader leaves flat tops', () => {
    // TRIM +12 with LOW +6: deck 1 would peak about +16.6 on its own meter.
    const hot: BlendSettings = {
      deck1: { trim: 12, low: 6, fader: 6 },
      deck2: { trim: 6, low: 0, fader: 0 },
      aligned: true,
    };
    const r = analyseBlend(hot);
    expect(r.channel[0]).toBeGreaterThan(CEILING_DB + 4);
    // What leaves the fader tops out at the fader's gain times the ceiling, not above it.
    expect(peak(r.view.deck1)).toBeCloseTo(faderGain(6), 4);
    expect(sampleToMeterDb(peak(renderMix(hot, tracksAt(ANALYSIS_RATE))))).toBeCloseTo(CEILING_DB + faderDb(6), 4);
    // Below the red nothing changes: a +3 track passes its channel untouched.
    const clean = analyseBlend(START);
    expect(peak(clean.view.deck1)).toBeCloseTo(meterDbToSample(3), 4);
  });

  it('cuts the output flat at ±1 (meter +12)', () => {
    const out = renderMix(settingsOf('hot'), tracksAt(ANALYSIS_RATE));
    expect(peak(out)).toBe(1);
    const clean = renderMix(settingsOf('orange'), tracksAt(ANALYSIS_RATE));
    expect(sampleToMeterDb(peak(clean))).toBeCloseTo(analyseBlend(settingsOf('orange')).mix, 4);
  });

  it('cuts enough off the red pad to hear, at 44.1 and 48 kHz, and nothing off the rest', () => {
    for (const sr of [44_100, 48_000]) {
      expect(cutPercent(settingsOf('hot'), sr)).toBeGreaterThan(2);
      // Clean: only float rounding between the render and the uncut sum. Boost the LOW lights
      // CLIP just under the red, so nothing is cut yet.
      for (const id of ['boost', 'swap', 'ease', 'orange'] as const)
        expect(cutPercent(settingsOf(id), sr)).toBeLessThan(1e-3);
    }
  });
});

describe('only just in the red', () => {
  it('covers every level shown as +12, and nothing past it', () => {
    expect(BARELY_OVER_DB).toBe(0.5);
    expect(barelyOver(analyseBlend(sixes))).toBe(true);
    // Deck 1 alone right on the red: the mix and its channel both touch the ceiling.
    const alone = withDeck(START, 'deck1', { trim: 12 });
    expect(analyseBlend(alone).mix).toBeCloseTo(CEILING_DB, 6);
    expect(barelyOver(analyseBlend(alone))).toBe(true);
    // One more dB on deck 2: +12.5, shown as "1 dB over the red".
    const over = withDeck(sixes, 'deck2', { trim: 7 });
    expect(displayDb(analyseBlend(over).mix)).toBe(13);
    expect(barelyOver(analyseBlend(over))).toBe(false);
    for (const id of ['hot', 'boost', 'swap', 'ease', 'orange'] as const)
      expect(barelyOver(analyseBlend(settingsOf(id)))).toBe(false);
    expect(barelyOver(analyseBlend(START))).toBe(false);
    expect(barelyOver(analyseBlend(challenge))).toBe(false);
  });

  it('counts a channel just in the red, even with the middle meters clear', () => {
    const channel = withDeck(START, 'deck1', { trim: 12, fader: 6 });
    const r = analyseBlend(channel);
    expect(displayDb(r.mix)).toBeLessThan(CEILING_DB);
    expect(displayDb(r.channel[0])).toBe(CEILING_DB);
    expect(barelyOver(r)).toBe(true);
    // A LOW boost on top takes that channel 0.8 dB past the red: no longer "only just".
    expect(barelyOver(analyseBlend(withDeck(channel, 'deck1', { low: 1 })))).toBe(false);
  });

  it('really is too little to hear: under 0.5% cut, at 44.1 and 48 kHz', () => {
    const states: BlendSettings[] = [
      sixes,
      withDeck(START, 'deck1', { trim: 12 }),
      withDeck(sixes, 'deck2', { low: 1 }),
      withDeck(START, 'deck1', { trim: 12, fader: 6 }),
      // A channel and the mix both just past the red.
      {
        deck1: { trim: 3, low: 0, fader: 8 },
        deck2: { trim: 11, low: 2, fader: 10 },
        aligned: false,
      },
    ];
    for (const s of states) {
      expect(barelyOver(analyseBlend(s))).toBe(true);
      for (const sr of [44_100, 48_000]) expect(cutPercent(s, sr)).toBeLessThan(0.5);
    }
  });
});

describe('presets', () => {
  it('are all different, and the lab starts on none of them', () => {
    for (const p of PRESETS) {
      expect(sameSettings(p.settings, START)).toBe(false);
      expect(PRESETS.filter((q) => sameSettings(q.settings, p.settings))).toHaveLength(1);
    }
  });

  it('match the spec', () => {
    expect(settingsOf('swap').deck1.low).toBe(-26);
    // One printed mark: the DJ box's "pull a channel fader down a little".
    expect(faderDb(settingsOf('ease').deck1.fader)).toBeCloseTo(-3, 6);
    expect(settingsOf('boost').deck2.low).toBe(6);
    expect(settingsOf('orange').deck1.trim).toBe(TARGET_PEAK_DB.aim);
    expect(settingsOf('orange').deck2.trim).toBe(TARGET_PEAK_DB.aim);
    expect(settingsOf('hot').deck1.trim).toBe(TARGET_PEAK_DB.top);
    // Every other pad starts from the lab's own levels, one change away from the challenge.
    for (const id of ['boost', 'ease', 'swap'] as const) {
      expect(settingsOf(id).deck1.trim).toBe(TRIM.initial);
      expect(settingsOf(id).deck2.trim).toBe(TRIM.initial);
    }
  });

  it('come in two sets: blends that light the top orange, then ways to keep it dark', () => {
    expect(presetsIn('push').map((p) => p.label)).toEqual(['Top orange', 'Boost the LOW']);
    expect(presetsIn('out').map((p) => p.label)).toEqual(['Pull a fader down', 'Swap the bass', 'First orange']);
    expect(presetsIn('push').length + presetsIn('out').length).toBe(PRESETS.length);
    expect(challengeStatus(settingsOf('hot'), analyseBlend(settingsOf('hot')))).toBe('red');
    expect(challengeStatus(settingsOf('boost'), analyseBlend(settingsOf('boost')))).toBe('clip');
    for (const p of presetsIn('push')) expect(topLit(analyseBlend(p.settings))).toBe(true);
    for (const p of presetsIn('out')) {
      const r = analyseBlend(p.settings);
      expect(challengeStatus(p.settings, r)).toBe('done');
    }
  });

  it('line the kicks up, as every blend in the lab does', () => {
    for (const p of PRESETS) expect(p.settings.aligned).toBe(true);
    expect(START.aligned).toBe(true);
  });
});

describe('fader steps', () => {
  it('move one printed mark a press', () => {
    expect(FADER.step).toBe(1);
    // From the top orange, one press down on deck 1 clears the challenge: "a little".
    expect(challengeStatus(challenge, analyseBlend(challenge))).toBe('top');
    const one = withDeck(challenge, 'deck1', { fader: FADER.max - FADER.step });
    expect(challengeStatus(one, analyseBlend(one))).toBe('done');
    // From the red, one press lights CLIP and a second leaves the top orange lit.
    const red = withDeck(sixes, 'deck1', { fader: FADER.max - FADER.step });
    expect(challengeStatus(red, analyseBlend(red))).toBe('clip');
  });
});

describe('challenge: bring deck 2 all the way up without lighting the top orange', () => {
  it('waits until deck 2 is fully up', () => {
    expect(challengeStatus(START, analyseBlend(START))).toBe('waiting');
    const nine = withDeck(START, 'deck2', { fader: 9.5 });
    expect(challengeStatus(nine, analyseBlend(nine))).toBe('waiting');
  });

  it('fails on the top orange, in the red, and while CLIP blinks', () => {
    expect(challengeStatus(challenge, analyseBlend(challenge))).toBe('top');
    for (const red of [sixes, settingsOf('hot')]) expect(challengeStatus(red, analyseBlend(red))).toBe('red');
    const close = withDeck(sixes, 'deck1', { fader: 9 });
    expect(analyseBlend(close).clip).toBe('slow');
    expect(challengeStatus(close, analyseBlend(close))).toBe('clip');
  });

  it('is solved by swapping the bass, easing deck 1 or trimming both down', () => {
    for (const id of ['swap', 'ease', 'orange'] as const) {
      const s = settingsOf(id);
      expect(challengeStatus(s, analyseBlend(s))).toBe('done');
    }
  });

  it('does not count a channel meter in the red, even with the middle meters clear', () => {
    // Deck 1 trimmed into the red, then pulled to −12 dB: MASTER is under the top orange, CH1 is red.
    const s: BlendSettings = {
      deck1: { trim: 12, low: 0, fader: 6 },
      deck2: { trim: TRIM.initial, low: 0, fader: 10 },
      aligned: true,
    };
    const r = analyseBlend(s);
    expect(topLit(r)).toBe(false);
    expect(r.clip).toBe('off');
    expect(hotDecks(r)).toEqual([1]);
    expect(challengeStatus(s, r)).toBe('hot1');
    for (const id of ['hot', 'swap', 'ease', 'boost', 'orange'] as const)
      expect(hotDecks(analyseBlend(settingsOf(id)))).toEqual([]);
  });

  it('does not count a cut or kicks that are apart', () => {
    const cut = withDeck(challenge, 'deck1', { fader: 2 });
    expect(challengeStatus(cut, analyseBlend(cut))).toBe('cut');
    const apart = { ...challenge, aligned: false };
    expect(challengeStatus(apart, analyseBlend(apart))).toBe('apart');
  });
});

describe('listening', () => {
  const lufs = (s: BlendSettings, sr: number) => loudnessLufs(listenBuffer(s, sr), sr);

  it('stays inside ±1, the audio engine’s contract', () => {
    const extremes: BlendSettings[] = [
      { deck1: { trim: 12, low: 6, fader: 10 }, deck2: { trim: 12, low: 6, fader: 10 }, aligned: true },
      { deck1: { trim: -6, low: -26, fader: 0.5 }, deck2: { trim: -6, low: 6, fader: 10 }, aligned: false },
      { deck1: { trim: 0, low: 6, fader: 10 }, deck2: { trim: 0, low: 6, fader: 10 }, aligned: true },
    ];
    for (const s of [START, ...PRESETS.map((p) => p.settings), ...extremes]) {
      for (const sr of [44_100, 48_000]) expect(peak(listenBuffer(s, sr))).toBeLessThanOrEqual(0.98);
    }
  });

  it('plays every preset at the same loudness, so red never wins by being louder', () => {
    for (const sr of [44_100, 48_000]) {
      const ref = lufs(settingsOf('orange'), sr);
      for (const p of PRESETS) expect(Math.abs(lufs(p.settings, sr) - ref)).toBeLessThan(0.1);
      expect(Math.abs(lufs(START, sr) - ref)).toBeLessThan(0.1);
    }
  });

  it('turns quiet clean settings up to the same loudness, so a clipped one never wins on level', () => {
    const quiet: BlendSettings[] = [
      { deck1: { trim: -6, low: 0, fader: 4 }, deck2: { trim: -6, low: 0, fader: 4 }, aligned: true },
      { deck1: { trim: -6, low: 0, fader: 10 }, deck2: { trim: -6, low: 0, fader: 10 }, aligned: true },
      withDeck(START, 'deck1', { trim: 0 }),
      // The spikiest corner: both LOWs cut, so the hats set the peak.
      { deck1: { trim: -6, low: -26, fader: 10 }, deck2: { trim: -15.5, low: -26, fader: 10 }, aligned: true },
      { deck1: { trim: -6, low: -26, fader: 10 }, deck2: { trim: 6, low: 0, fader: 0 }, aligned: true },
    ];
    for (const sr of [44_100, 48_000]) {
      const ref = lufs(settingsOf('orange'), sr);
      for (const s of quiet) expect(Math.abs(lufs(s, sr) - ref)).toBeLessThan(0.1);
    }
  });

  it('plays silence as silence', () => {
    const silent = withDeck(withDeck(START, 'deck1', { fader: 0 }), 'deck2', { fader: 0 });
    expect(peak(listenBuffer(silent, 48_000))).toBe(0);
  });
});
