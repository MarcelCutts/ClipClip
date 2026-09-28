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
  CONTROL_STAGE,
  crunchFor,
  drawScope,
  goalMet,
  howlerMarginDb,
  KNOB,
  LAB_SCOPE,
  labSignal,
  playbackLoop,
  REVEAL_AFTER_MOVES,
  readLab,
  STEP_COUNT,
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
  it('shows the channel in the red as crunch with a green Howler light', () => {
    const r = readLab(track, 18, -12);
    expect(r.mixer).toBe('over');
    expect(r.recorder).toBe('clear');
    expect(r.howler).toBe('green');
    expect(r.recordingPeakDbfs).toBeCloseTo(-6, 9);
    expect(r.crunch).toBe('crunch');
    expect(r.cutDb).toBe(6);
  });

  it('shows a recording level too high as a clean mix clipped at the Howler', () => {
    const r = readLab(track, 9, 0);
    expect(r.mixer).toBe('clear');
    expect(r.recorder).toBe('over');
    expect(r.howler).toBe('red');
    expect(r.recordingPeakDbfs).toBe(0);
    expect(r.crunch).toBe('crunch');
    expect(r.cutDb).toBe(3);
  });

  it('shows a tidy channel and a lower recording level as clean, green and comfortably low', () => {
    const r = readLab(track, 3, -9);
    expect(r.crunch).toBe('clean');
    expect(r.distortion).toBeLessThan(1e-9);
    expect(r.howler).toBe('green');
    expect(r.recordingPeakDbfs).toBeCloseTo(-12, 9);
    expect(r.cutDb).toBe(0);
  });

  it('keeps mixer crunch when the recording level comes down: quieter, same damage', () => {
    const base = readLab(track, 18, -6);
    for (const knob of [-9, -12, -18, -24]) {
      const r = readLab(track, 18, knob);
      expect(r.distortion).toBeCloseTo(base.distortion, 9);
      expect(r.crunch).toBe('crunch');
      expect(r.cutDb).toBe(base.cutDb);
      // The mixer holds the peak at +12; ceiling 2 sits at +6, so the file peaks at knob + 6 dBFS.
      expect(r.recordingPeakDbfs).toBeCloseTo(knob + 6, 9);
    }
  });

  it('removes Howler-only clipping completely when the recording level comes down', () => {
    expect(readLab(track, 9, 0).crunch).toBe('crunch');
    const fixed = readLab(track, 9, -4);
    expect(fixed.crunch).toBe('clean');
    expect(fixed.howler).toBe('green');
  });

  it('counts touching a ceiling as red on the light, but not as crunch', () => {
    const atRed = readLab(track, 12, -12);
    expect(atRed.mixer).toBe('at');
    expect(atRed.crunch).toBe('clean');
    expect(atRed.cutDb).toBe(0);
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

  it('names crunch from the second dB past a ceiling, and never grades it', () => {
    // No study we could open says how much hard clipping on dance music is heavy, so the lab says
    // how much was cut, in dB, and names nothing past crunch.
    const overBy = (db: number) => crunchFor(addedDistortion(track.samples, 12 + db, -12));
    expect(overBy(0)).toBe('clean');
    expect(overBy(1)).toBe('tips');
    for (const db of [2, 3, 4, 6]) expect(overBy(db)).toBe('crunch');
  });

  it('counts the cut in dB, from both ceilings, whatever the recording level does after the first', () => {
    expect(readLab(track, 18, -9).cutDb).toBe(6);
    expect(readLab(track, 18, -24).cutDb).toBe(6);
    // Turned up past the Howler's ceiling, the flat tops are cut again.
    expect(readLab(track, 18, 0).cutDb).toBe(12);
    expect(readLab(track, 9, -3).cutDb).toBe(0);
  });

  it('calls the first dB over what the blend lab calls its red: only the tips cut', () => {
    // The blend lab's red that only just lights cuts under 0.5 % and is too little to hear there
    // (blend/model.ts). One dB over here cuts less than that; its Top orange pad, which can be heard, over 2 %.
    const cut = (over: number) => addedDistortion(track.samples, 12 + over, -12);
    expect(cut(1)).toBeLessThan(0.005);
    expect(crunchFor(0.005)).toBe('tips');
    expect(cut(3)).toBeGreaterThan(0.02);
    expect(crunchFor(0.02)).toBe('crunch');
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

  it('shows the mixer’s flat tops in the recording, and nothing cut there when the Howler has room', () => {
    const drawing = drawScope(scopeTraces(track, 18, -12).recording);
    expect(drawing.flats).not.toBe('');
    // The Howler's ceiling cut nothing: the flat tops arrived flat.
    expect(drawing.ghost).toBe('');
    expect(drawing.cut).toBe('');
  });

  it('draws on the Howler’s screen only what its own ceiling cut off', () => {
    // Turned up 3 dB past the Howler's ceiling: the mixer's flat tops arrive, and are cut again.
    const { recording } = scopeTraces(track, 18, -3);
    expect(peak(recording.arrived!)).toBeCloseTo(CEILING_1 * dbToGain(-3), 6);
    expect(peak(recording.arrived!)).toBeLessThan(peak(recording.wanted));
    const { ghost } = drawScope(recording);
    expect(ghost).not.toBe('');
    // The ghost rises to the flat tops as they arrived, not to the peaks the mixer cut.
    expect(highest(ghost)).toBeCloseTo(screenY(peak(recording.arrived!)), 0);
  });

  it('leaves the mixer’s screen as it was: with no ceiling before it, what arrived is what was wanted', () => {
    const { mixer, recording } = scopeTraces(track, 9, 0);
    expect('arrived' in mixer).toBe(false);
    expect(recording.arrived).toEqual(recording.wanted);
  });
});

/** Where a sample value sits on the lab's screen, as drawScope places it. */
function screenY(v: number): number {
  const half = LAB_SCOPE.height / 2;
  return half - (v / LAB_SCOPE.range) * (half - 4);
}

/** The highest point (smallest y) of a path of moves and relative steps, as drawScope writes them. */
function highest(path: string): number {
  const num = '-?(?:\\d+\\.?\\d*|\\.\\d+)';
  let top = Number.POSITIVE_INFINITY;
  for (const sub of path.split('M').filter(Boolean)) {
    const [head, ...moves] = sub.split('l');
    let y = Number(head!.trim().split(' ')[1]);
    top = Math.min(top, y);
    for (const move of moves) {
      const m = new RegExp(`^(${num})\\s?(${num})$`).exec(move.trim());
      y += Number(m![2]);
      top = Math.min(top, y);
    }
  }
  return top;
}

describe('the guided flow', () => {
  it('has four steps: a question, then one live control each', () => {
    expect(STEP_COUNT).toBe(4);
    expect([1, 2, 3, 4].map((step) => STEP_SETUP[step as 1 | 2 | 3 | 4].live)).toEqual([
      null,
      'knob',
      'channels',
      'knob',
    ]);
  });

  it('keeps each control in the stage whose ceiling it comes before', () => {
    expect(CONTROL_STAGE).toEqual({ channels: 'mixer', knob: 'howler' });
  });

  it('asks its question with the channel in the red, the file crunchy and the Howler’s light green', () => {
    const { channels, knob } = STEP_SETUP[1].start;
    const one = readLab(track, channels, knob);
    expect(one).toMatchObject({ mixer: 'over', recorder: 'clear', howler: 'green', crunch: 'crunch' });
    // The flat tops reach the Howler plainly under its ceiling, and big enough to see on a phone.
    expect(howlerMarginDb(one)).toBe(-3);
    // The next two steps carry on from the same place.
    expect(STEP_SETUP[2].start).toEqual(STEP_SETUP[1].start);
    expect(STEP_SETUP[3].start).toEqual(STEP_SETUP[1].start);
  });

  it('opens the last step with the mixer clean and the Howler red', () => {
    const four = readLab(track, STEP_SETUP[4].start.channels, STEP_SETUP[4].start.knob);
    expect(four).toMatchObject({ mixer: 'clear', howler: 'red' });
  });

  it('gives the question and step 2 no way to win, and opens step 3 somewhere its one control can fix', () => {
    const { channels, knob } = STEP_SETUP[3].start;
    for (let k = KNOB.min; k <= KNOB.max; k++) {
      expect(goalMet(1, readLab(track, 18, k))).toBe(false);
      expect(goalMet(2, readLab(track, 18, k))).toBe(false);
    }
    expect(goalMet(3, readLab(track, channels, knob))).toBe(false);
    expect(goalMet(3, readLab(track, 3, knob))).toBe(true);
    expect(REVEAL_AFTER_MOVES).toBeGreaterThan(1);
  });

  it('lets step 2 turn the light red and green again, with the crunch there throughout', () => {
    // The light follows the recording level a decibel at a time. The crunch does not move.
    const margins: number[] = [];
    for (let k = KNOB.min; k <= KNOB.max; k++) {
      const r = readLab(track, 18, k);
      expect(r.crunch).toBe('crunch');
      expect(r.howler).toBe(k < -6 ? 'green' : 'red');
      margins.push(howlerMarginDb(r));
    }
    expect(margins.slice(1).map((m, i) => m - margins[i]!)).toEqual(margins.slice(1).map(() => 1));
  });

  it('only calls step 3 fixed when the crunch is gone, the light is green and the red is dark', () => {
    expect(goalMet(3, readLab(track, 3, -9))).toBe(true);
    expect(goalMet(3, readLab(track, 12, -12))).toBe(false);
    expect(goalMet(3, readLab(track, 18, -24))).toBe(false);
    expect(goalMet(3, readLab(track, 11, 0))).toBe(false);
  });

  it('calls step 4 fixed once the recording level brings the Howler back to green', () => {
    expect(goalMet(4, readLab(track, 9, -3))).toBe(false);
    expect(goalMet(4, readLab(track, 9, -4))).toBe(true);
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
