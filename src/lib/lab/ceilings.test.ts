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
  crunchFor,
  drawScope,
  goalMet,
  KNOB,
  LAB_SCOPE,
  labSignal,
  playbackLoop,
  REVEAL_AFTER_MOVES,
  readLab,
  STEP_COUNT,
  STEP_SCOPE,
  STEP_SETUP,
  scopeTraces,
} from './ceilings';

const track = labSignal();

describe('the two ceilings', () => {
  it('puts ceiling 1 at the red LED and ceiling 2 six dB below it', () => {
    expect(CEILING_1).toBe(1);
    expect(gainToDb(CEILING_2)).toBeCloseTo(-6, 12);
  });

  it('keeps the controls to what the hardware allows', () => {
    // The recording level tops out where MASTER LEVEL does: fully up is 0.
    expect(KNOB.max).toBe(0);
    expect(CHANNELS).toEqual({ min: -6, max: 18, step: 1 });
  });
});

describe('lab signals', () => {
  it('scales the track so its loudest peak is exactly what the channel meter shows', () => {
    expect(peak(track.samples)).toBeCloseTo(1, 6);
    expect(track.samples.length).toBe(Math.round((60 / 124) * 48_000 * 8));
    expect(labSignal()).toBe(track);
  });

  it('zooms the scopes in on 30 ms that contain the loudest peak', () => {
    const { start, count } = track.window;
    expect(count).toBe(1440);
    let top = 0;
    for (let i = start; i < start + count; i++) top = Math.max(top, Math.abs(track.samples[i]!));
    expect(top).toBeCloseTo(1, 6);
  });
});

describe('reading the lab', () => {
  it('shows the channel in the red as heavy crunch with a green Howler light', () => {
    const r = readLab(track, 18, -12);
    expect(r.mixer).toBe('over');
    expect(r.recorder).toBe('clear');
    expect(r.howler).toBe('green');
    expect(r.recordingPeakDbfs).toBeCloseTo(-6, 9);
    expect(r.crunch).toBe('heavy');
  });

  it('shows a recording level too high as a clean mix clipped at the Howler', () => {
    const r = readLab(track, 9, 0);
    expect(r.mixer).toBe('clear');
    expect(r.recorder).toBe('over');
    expect(r.howler).toBe('red');
    expect(r.recordingPeakDbfs).toBe(0);
    expect(r.crunch).toBe('some');
  });

  it('shows a tidy channel and a lower recording level as clean, green and comfortably low', () => {
    const r = readLab(track, 3, -9);
    expect(r.crunch).toBe('clean');
    expect(r.distortion).toBeLessThan(1e-9);
    expect(r.howler).toBe('green');
    expect(r.recordingPeakDbfs).toBeCloseTo(-12, 9);
  });

  it('keeps mixer crunch when the recording level comes down: quieter, same damage', () => {
    const base = readLab(track, 18, -6);
    for (const knob of [-9, -12, -18, -24]) {
      const r = readLab(track, 18, knob);
      expect(r.distortion).toBeCloseTo(base.distortion, 9);
      expect(r.crunch).toBe('heavy');
      // The mixer holds the peak at +12; ceiling 2 sits at +6, so the file peaks at knob + 6 dBFS.
      expect(r.recordingPeakDbfs).toBeCloseTo(knob + 6, 9);
    }
  });

  it('removes Howler-only clipping completely when the recording level comes down', () => {
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
    expect(overBy(1)).toBe('tips');
    expect(overBy(2)).toBe('some');
    expect(overBy(3)).toBe('some');
    expect(overBy(4)).toBe('heavy');
    expect(overBy(6)).toBe('heavy');
  });

  it('calls the first dB over what the blend lab calls its red: only the tips cut', () => {
    // The blend lab's red that only just lights cuts under 0.5 % and is too little to hear there
    // (blend/model.ts). One dB over here cuts less than that; its Top orange pad, which can be heard, over 2 %.
    const cut = (over: number) => addedDistortion(track.samples, 12 + over, -12);
    expect(cut(1)).toBeLessThan(0.005);
    expect(crunchFor(0.005)).toBe('tips');
    expect(cut(3)).toBeGreaterThan(0.02);
    expect(crunchFor(0.02)).toBe('some');
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

  it('draws the recording level fully up at the mixer’s size, cut at ceiling 2', () => {
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
  it('has three steps, each with one live control: the recording level, the channel, the recording level', () => {
    expect(STEP_COUNT).toBe(3);
    expect([STEP_SETUP[1].live, STEP_SETUP[2].live, STEP_SETUP[3].live]).toEqual(['knob', 'channels', 'knob']);
  });

  it('opens step 1 with the channel in the red and the Howler green, and step 3 with the Howler red', () => {
    const one = readLab(track, STEP_SETUP[1].start.channels, STEP_SETUP[1].start.knob);
    expect(one).toMatchObject({ mixer: 'over', howler: 'green', crunch: 'heavy' });
    const three = readLab(track, STEP_SETUP[3].start.channels, STEP_SETUP[3].start.knob);
    expect(three).toMatchObject({ mixer: 'clear', howler: 'red' });
  });

  it('points each step at the screen its control moves', () => {
    expect(STEP_SCOPE).toEqual({ 1: 'recording', 2: 'mixer', 3: 'recording' });
  });

  it('gives step 1 no way to win, and opens step 2 somewhere its one control can fix', () => {
    const { channels, knob } = STEP_SETUP[2].start;
    for (let k = KNOB.min; k <= KNOB.max; k++) expect(goalMet(1, readLab(track, 18, k))).toBe(false);
    expect(goalMet(2, readLab(track, channels, knob))).toBe(false);
    expect(goalMet(2, readLab(track, 3, knob))).toBe(true);
    expect(REVEAL_AFTER_MOVES).toBeGreaterThan(1);
  });

  it('only calls step 2 fixed when the crunch is gone, the light is green and the red is dark', () => {
    expect(goalMet(2, readLab(track, 3, -9))).toBe(true);
    expect(goalMet(2, readLab(track, 12, -12))).toBe(false);
    expect(goalMet(2, readLab(track, 18, -24))).toBe(false);
    expect(goalMet(2, readLab(track, 11, 0))).toBe(false);
  });

  it('calls step 3 fixed once the recording level brings the Howler back to green', () => {
    expect(goalMet(3, readLab(track, 9, -3))).toBe(false);
    expect(goalMet(3, readLab(track, 9, -4))).toBe(true);
  });
});

describe('which control can fix which crunch', () => {
  it('fixes crunch made in the mixer only at the channel, before ceiling 1', () => {
    expect(readLab(track, 3, -12).crunch).toBe('clean');
    for (let knob = KNOB.min; knob <= KNOB.max; knob++) expect(readLab(track, 18, knob).crunch).not.toBe('clean');
  });

  it('fixes crunch made at the Howler with either control, both before ceiling 2', () => {
    expect(readLab(track, 9, 0).crunch).not.toBe('clean');
    expect(readLab(track, 5, 0)).toMatchObject({ crunch: 'clean', howler: 'green' });
    expect(readLab(track, 9, -4)).toMatchObject({ crunch: 'clean', howler: 'green' });
  });
});

describe('sound', () => {
  it('never hands the engine anything outside ±1', () => {
    for (let channels = CHANNELS.min; channels <= CHANNELS.max; channels += 4) {
      for (let knob = KNOB.min; knob <= KNOB.max; knob += 4) {
        expect(peak(playbackLoop(track, channels, knob, false))).toBeLessThanOrEqual(1 + 1e-6);
      }
    }
    expect(peak(playbackLoop(track, 18, 0, true))).toBeLessThanOrEqual(1 + 1e-6);
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

  it('sounds the same after the recording level comes down, once turned back up: the crunch stays', () => {
    const a = playbackLoop(track, 18, -12, false);
    const b = playbackLoop(track, 18, -24, false);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff = Math.max(diff, Math.abs(a[i]! - b[i]!));
    expect(diff).toBeLessThan(1e-4);
  });

  it('renders at the device’s own sample rate', () => {
    const at44 = labSignal(44_100);
    expect(playbackLoop(at44, 18, -12, false)).toHaveLength(at44.samples.length);
  });
});
