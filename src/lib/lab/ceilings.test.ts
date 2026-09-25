import { describe, expect, it } from 'vitest';
import { peak } from '../dsp/analysis';
import { dbToGain, gainToDb } from '../dsp/db';
import { loudnessLufs } from '../dsp/loudness';
import { meterDbToSample } from '../xdj';
import {
  addedDistortion,
  CEILING_1,
  CEILING_2,
  CHANNELS,
  canFix,
  crunchFor,
  drawScope,
  goalMet,
  KNOB,
  LAB_SCOPE,
  labSignal,
  matchingPreset,
  PRESETS,
  parseDeepLink,
  playbackLoop,
  presetById,
  REVEAL_AFTER_MOVES,
  readLab,
  STEP_SCOPE,
  STEP_SETUP,
  scopeTraces,
} from './ceilings';

const track = labSignal('track');
const tones = labSignal('tones');

describe('the two ceilings', () => {
  it('puts ceiling 1 at the red LED and ceiling 2 six dB below it', () => {
    expect(CEILING_1).toBe(1);
    expect(gainToDb(CEILING_2)).toBeCloseTo(-6, 12);
  });

  it('keeps the controls to what the hardware allows', () => {
    // The record level is MASTER LEVEL (the Howler records from MASTER 2): fully up is 0.
    expect(KNOB.max).toBe(0);
    expect(CHANNELS).toEqual({ min: -6, max: 18, step: 1 });
  });
});

describe('lab signals', () => {
  it('scales the track so its loudest peak is exactly what the channel meter shows', () => {
    expect(peak(track.samples)).toBeCloseTo(1, 6);
    expect(track.samples.length).toBe(Math.round((60 / 124) * 48_000 * 8));
    expect(labSignal('track')).toBe(track);
  });

  it('zooms the scopes in on 30 ms that contain the loudest peak', () => {
    const { start, count } = track.window;
    expect(count).toBe(1440);
    let top = 0;
    for (let i = start; i < start + count; i++) top = Math.max(top, Math.abs(track.samples[i]!));
    expect(top).toBeCloseTo(1, 6);
  });

  it('builds a tone loop that closes cleanly at other sample rates', () => {
    const at44 = labSignal('tones', 44_100);
    expect(peak(tones.samples)).toBeCloseTo(1, 6);
    expect(peak(at44.samples)).toBeCloseTo(1, 6);
    // 4096 samples at 48 kHz is 3763.2 at 44.1 kHz: five of those make a whole number.
    expect(at44.samples.length).toBe(18_816);
  });
});

describe('reading the lab', () => {
  it('shows "Channels in the red" as heavy crunch with a green Howler light', () => {
    const r = readLab(track, 18, -12);
    expect(r.mixer).toBe('over');
    expect(r.recorder).toBe('clear');
    expect(r.howler).toBe('green');
    expect(r.recordingPeakDbfs).toBeCloseTo(-6, 9);
    expect(r.crunch).toBe('heavy');
  });

  it('shows "Recorder knob too high" as a clean mix clipped at the Howler', () => {
    const r = readLab(track, 9, 0);
    expect(r.mixer).toBe('clear');
    expect(r.recorder).toBe('over');
    expect(r.howler).toBe('red');
    expect(r.recordingPeakDbfs).toBe(0);
    expect(r.crunch).toBe('some');
  });

  it('shows the clean preset as clean, green and comfortably low', () => {
    const r = readLab(track, 3, -9);
    expect(r.crunch).toBe('clean');
    expect(r.distortion).toBeLessThan(1e-9);
    expect(r.howler).toBe('green');
    expect(r.recordingPeakDbfs).toBeCloseTo(-12, 9);
  });

  it('keeps mixer crunch when the recorder knob comes down: quieter, same damage', () => {
    const base = readLab(track, 18, -6);
    for (const knob of [-9, -12, -18, -24]) {
      const r = readLab(track, 18, knob);
      expect(r.distortion).toBeCloseTo(base.distortion, 9);
      expect(r.crunch).toBe('heavy');
      // The mixer holds the peak at +12; ceiling 2 sits at +6, so the file peaks at knob + 6 dBFS.
      expect(r.recordingPeakDbfs).toBeCloseTo(knob + 6, 9);
    }
  });

  it('removes Howler-only clipping completely when the knob comes down', () => {
    expect(readLab(track, 9, 0).crunch).toBe('some');
    const fixed = readLab(track, 9, -4);
    expect(fixed.crunch).toBe('clean');
    expect(fixed.howler).toBe('green');
  });

  it('counts touching a ceiling as red on the light, but not as crunch', () => {
    const atRed = readLab(track, 12, -12);
    expect(atRed.mixer).toBe('at');
    expect(atRed.crunch).toBe('clean');
    const atHowler = readLab(track, 9, -3);
    expect(atHowler.recorder).toBe('at');
    expect(atHowler.howler).toBe('red');
    expect(atHowler.crunch).toBe('clean');
  });

  it('predicts the recording peak that the file actually has', () => {
    for (const [channels, knob] of [
      [18, -12],
      [3, -9],
      [-6, -24],
      [12, -20],
      [9, 0],
    ] as const) {
      const { recording } = scopeTraces(track, channels, knob);
      // The screen is in mixer units; the file's 0 dBFS is ceiling 2.
      const measured = gainToDb(peak(recording.actual) / CEILING_2);
      expect(measured).toBeCloseTo(readLab(track, channels, knob).recordingPeakDbfs, 4);
    }
  });

  it('grades crunch by how far past a ceiling the peaks go', () => {
    const overBy = (db: number) => crunchFor(addedDistortion(track.samples, 12 + db, -12));
    expect(overBy(0)).toBe('clean');
    expect(overBy(1)).toBe('some');
    expect(overBy(3)).toBe('some');
    expect(overBy(4)).toBe('heavy');
    expect(overBy(6)).toBe('heavy');
  });

  it('works on the engineer view’s test tones too', () => {
    expect(readLab(tones, 18, -12).crunch).toBe('heavy');
    expect(readLab(tones, 3, -9).crunch).toBe('clean');
  });
});

describe('scopes', () => {
  it('draws both screens on the mixer’s scale, never magnified or auto-scaled', () => {
    const { mixer, recording } = scopeTraces(track, 18, -12);
    expect(peak(mixer.wanted)).toBeCloseTo(meterDbToSample(18), 5);
    expect(peak(mixer.actual)).toBeCloseTo(CEILING_1, 9);
    // The knob takes 12 dB off the mixer's flat tops: a quarter of ceiling 1's height, under
    // ceiling 2. The ghost of the cut-off peaks just reaches ceiling 2.
    expect(peak(recording.actual)).toBeCloseTo(CEILING_1 * dbToGain(-12), 6);
    expect(peak(recording.actual)).toBeLessThan(CEILING_2);
    expect(peak(recording.wanted)).toBeCloseTo(CEILING_2, 5);
  });

  it('draws the recorder knob fully up at the mixer’s size, cut at ceiling 2', () => {
    const { mixer, recording } = scopeTraces(track, 9, 0);
    expect(recording.wanted).toEqual(mixer.wanted);
    expect(peak(recording.actual)).toBeCloseTo(CEILING_2, 6);
  });

  it('keeps every ghost on the screen', () => {
    const { mixer, recording } = scopeTraces(track, CHANNELS.max, KNOB.max);
    expect(peak(mixer.wanted)).toBeLessThan(LAB_SCOPE.range);
    expect(peak(recording.wanted)).toBeLessThan(LAB_SCOPE.range);
  });

  it('only draws a ghost and flat tops when something was cut off', () => {
    const clean = drawScope(scopeTraces(track, 3, -9).mixer);
    expect(clean.ghost).toBe('');
    expect(clean.flats).toBe('');
    expect(clean.cut).toBe('');
    // One point every 2 units across the screen: a move, then relative steps.
    expect(clean.trace.split('l')).toHaveLength(LAB_SCOPE.width / 2);

    const red = drawScope(scopeTraces(track, 18, -12).mixer);
    expect(red.ghost).not.toBe('');
    expect(red.flats).not.toBe('');
    expect(red.cut.endsWith('Z')).toBe(true);
  });

  it('draws paths that start and end at the screen’s edges, in short relative steps', () => {
    const { trace } = drawScope(scopeTraces(track, 18, -12).mixer);
    expect(trace.startsWith('M0 ')).toBe(true);
    let x = 0;
    for (const m of trace.matchAll(/l(-?[\d.]+)/g)) x += Number(m[1]);
    expect(x).toBeCloseTo(LAB_SCOPE.width, 6);
    expect(trace.length).toBeLessThan(1600);
  });

  it('closes each cut-off area back on the trace', () => {
    const { cut, flats } = drawScope(scopeTraces(track, 18, -12).mixer);
    expect(cut.match(/Z/g)?.length).toBe(flats.match(/M/g)?.length);
  });

  it('shows the mixer’s damage in the recording even when the Howler has room', () => {
    const drawing = drawScope(scopeTraces(track, 18, -12).recording);
    expect(drawing.flats).not.toBe('');
    expect(drawing.ghost).not.toBe('');
  });
});

describe('the guided flow', () => {
  it('locks the channels in the red for the knob challenge', () => {
    expect(STEP_SETUP[2]).toEqual({ start: { channels: 18, knob: -12 }, lockChannels: true, lockKnob: false });
    const r = readLab(track, STEP_SETUP[4].start!.channels, STEP_SETUP[4].start!.knob);
    expect(r.howler).toBe('red');
    expect(r.mixer).toBe('clear');
  });

  it('gives each guided step one live control, and the sandbox both', () => {
    const live = (s: 1 | 2 | 3 | 4 | 5) =>
      [!STEP_SETUP[s].lockChannels && 'channels', !STEP_SETUP[s].lockKnob && 'knob'].filter(Boolean);
    expect(live(1)).toEqual([]);
    expect(live(2)).toEqual(['knob']);
    expect(live(3)).toEqual(['channels']);
    expect(live(4)).toEqual(['knob']);
    expect(live(5)).toEqual(['channels', 'knob']);
  });

  it('points each step at the screen its control moves', () => {
    expect(STEP_SCOPE).toEqual({ 1: 'mixer', 2: 'recording', 3: 'mixer', 4: 'recording', 5: 'both' });
  });

  it('opens step 3 somewhere its one control can fix', () => {
    const { channels, knob } = STEP_SETUP[3].start!;
    expect(goalMet(3, readLab(track, channels, knob))).toBe(false);
    expect(goalMet(3, readLab(track, 3, knob))).toBe(true);
    expect(REVEAL_AFTER_MOVES).toBeGreaterThan(1);
  });

  it('only calls step 3 fixed when the crunch is gone, the light is green and the red is dark', () => {
    expect(goalMet(3, readLab(track, 3, -9))).toBe(true);
    expect(goalMet(3, readLab(track, 12, -12))).toBe(false);
    expect(goalMet(3, readLab(track, 18, -24))).toBe(false);
    expect(goalMet(3, readLab(track, 11, 0))).toBe(false);
  });

  it('calls step 4 fixed once the knob brings the Howler back to green', () => {
    expect(goalMet(4, readLab(track, 9, -3))).toBe(false);
    expect(goalMet(4, readLab(track, 9, -4))).toBe(true);
  });
});

describe('which control can fix which crunch', () => {
  it('lets a control fix only a ceiling that comes after it', () => {
    expect(canFix('channels', 'mixer')).toBe(true);
    expect(canFix('channels', 'recorder')).toBe(true);
    expect(canFix('knob', 'mixer')).toBe(false);
    expect(canFix('knob', 'recorder')).toBe(true);
  });

  it('agrees with the simulation', () => {
    // Made in the mixer: the channel cleans it, no knob setting does.
    expect(readLab(track, 3, -12).crunch).toBe('clean');
    for (let knob = KNOB.min; knob <= KNOB.max; knob++) expect(readLab(track, 18, knob).crunch).not.toBe('clean');
    // Made at the recorder: either control cleans it.
    expect(readLab(track, 9, 0).crunch).not.toBe('clean');
    expect(readLab(track, 5, 0)).toMatchObject({ crunch: 'clean', howler: 'green' });
    expect(readLab(track, 9, -4)).toMatchObject({ crunch: 'clean', howler: 'green' });
  });
});

describe('presets and deep links', () => {
  it('lights a preset only when both controls match it', () => {
    for (const p of PRESETS) expect(matchingPreset(p.channels, p.knob)).toBe(p.id);
    expect(matchingPreset(17, -12)).toBeNull();
    expect(presetById('knob-high').knob).toBe(0);
  });

  it('reads ?lab=sandbox&preset=… and ignores anything else', () => {
    expect(parseDeepLink('?lab=sandbox&preset=channels-red')).toEqual({ sandbox: true, preset: 'channels-red' });
    expect(parseDeepLink('?lab=sandbox')).toEqual({ sandbox: true, preset: null });
    expect(parseDeepLink('?preset=clean')).toEqual({ sandbox: true, preset: 'clean' });
    expect(parseDeepLink('?preset=loud&lab=nope')).toEqual({ sandbox: false, preset: null });
    expect(parseDeepLink('')).toEqual({ sandbox: false, preset: null });
  });
});

describe('sound', () => {
  it('never hands the engine anything outside ±1', () => {
    for (const signal of [track, tones]) {
      for (let channels = CHANNELS.min; channels <= CHANNELS.max; channels += 4) {
        for (let knob = KNOB.min; knob <= KNOB.max; knob += 4) {
          expect(peak(playbackLoop(signal, channels, knob, false))).toBeLessThanOrEqual(1 + 1e-6);
        }
      }
      expect(peak(playbackLoop(signal, 18, 0, true))).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('matches the loudness of the clipped file and the clean version', () => {
    for (const [channels, knob] of [
      [18, -12],
      [9, 0],
      [18, 0],
    ] as const) {
      const file = playbackLoop(track, channels, knob, false);
      const clean = playbackLoop(track, channels, knob, true);
      expect(loudnessLufs(file, 48_000)).toBeCloseTo(loudnessLufs(clean, 48_000), 1);
    }
  });

  it('sounds the same after the knob comes down, once turned back up: the crunch stays', () => {
    const a = playbackLoop(track, 18, -12, false);
    const b = playbackLoop(track, 18, -24, false);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff = Math.max(diff, Math.abs(a[i]! - b[i]!));
    expect(diff).toBeLessThan(1e-4);
  });

  it('renders at the device’s own sample rate', () => {
    const at44 = labSignal('track', 44_100);
    expect(playbackLoop(at44, 18, -12, false)).toHaveLength(at44.samples.length);
  });
});
