import { describe, expect, it } from 'vitest';
import { prng } from '../dsp/synth';
import {
  type Action,
  doneAnnouncement,
  type Flow,
  offMark,
  practiceStart,
  ROOM_NOTE,
  reduce,
  STEPS,
  step,
  stepResponse,
  stepState,
  WORKED_FOUND,
  workedStart,
} from './flow';
import { HOWLER_LIMIT, LEVEL, MARGIN } from './model';

/** Numbers keep their units with a no-break space (see the last test); compare the words. */
const expectText = (s: string | null | undefined, message?: string) =>
  expect(typeof s === 'string' ? s.replaceAll('\u00a0', ' ') : s, message);
const run = (flow: Flow, ...actions: Action[]) => actions.reduce(reduce, flow);
const commit: Action = { type: 'commit' };
const level = (db: number): Action => ({ type: 'level', db });
const att = (db: -12 | -6 | 0): Action => ({ type: 'att', db });
const blend: Action = { type: 'play', material: 'blend' };
const hearAll: Action[] = [
  { type: 'heard', check: 'level', value: true },
  { type: 'heard', check: 'hum', value: true },
  { type: 'heard', check: 'sides', value: true },
];
/** A Howler with 9 dB less room than the site assumes, so step 4 has work to do. */
const TIGHT = HOWLER_LIMIT - 9;

/** The worked example, done right up to the start of a step. */
function upTo(id: 'play' | 'att' | 'level' | 'test', start = workedStart()): Flow {
  let f = run(start, level(0), commit);
  if (id === 'play') return f;
  f = run(f, blend, commit);
  if (id === 'att') return f;
  f = run(f, att(-6), commit, att(-12), commit);
  if (id === 'level') return f;
  return run(f, commit);
}

describe('the worked example', () => {
  it('starts as the booth is often found: MASTER LEVEL turned down, MASTER ATT at 0 dB, nothing playing', () => {
    const f = workedStart();
    expect(f.rig).toEqual({ material: null, level: -9, att: 0 });
    expect(f.found).toEqual(WORKED_FOUND);
    expect(f.limit).toBe(HOWLER_LIMIT);
    expect(f.step).toBe('up');
    expect(stepState(f, 'up')).toBe('current');
    expect(stepState(f, 'test')).toBe('todo');
  });

  it('runs clean from start to finish', () => {
    let f = run(workedStart(), level(0), commit);
    expect(f.step).toBe('play');
    expect(f.kept.tape).toBe(0);
    expect(f.last).toMatchObject({ tone: 'good', step: 'up', text: expect.stringContaining('Taped fully up') });
    f = run(f, blend, commit);
    expect(f.step).toBe('att');
    expectText(f.last?.text).toBe('The light blinks red on the loudest blend, so the feed is too hot for the Howler.');
    f = run(f, att(-6), commit);
    expect(f.step).toBe('att');
    expect(f.note).toMatchObject({ tone: 'fix', text: 'The light is still red, so set MASTER ATT down another step.' });
    // The step just finished keeps its words while you work on the next.
    expect(f.last?.step).toBe('play');
    f = run(f, att(-12), commit);
    expect(f.step).toBe('level');
    expect(f.note).toBeNull();
    expectText(f.last?.text).toContain('Bring the room back up at the amps');
    f = run(f, commit);
    expect(f.step).toBe('test');
    expectText(f.last?.text).toBe(
      'The light is green with MASTER LEVEL fully up, so MASTER LEVEL stays there, on its REC tape.',
    );
    f = run(f, commit);
    expect(f.recorded).toBe(true);
    expectText(f.note?.text).toContain('loudest blend peaks at −6 dBFS');
    expect(f.complete).toBe(false);
    f = run(f, ...hearAll);
    expect(f.complete).toBe(true);
    for (const s of STEPS) expect(stepState(f, s.id)).toBe('done');
    expectText(stepResponse(f, 'up')).toBe('Taped REC, fully up');
    expectText(stepResponse(f, 'play')).toBe('Light blinking red');
    expectText(stepResponse(f, 'att')).toBe('At −12 dB');
    expectText(stepResponse(f, 'level')).toBe('Stays fully up');
    expectText(stepResponse(f, 'test')).toBe('Heard on headphones');
  });

  it('won’t tape MASTER LEVEL until it’s fully up', () => {
    let f = run(workedStart(), commit);
    expect(f.step).toBe('up');
    expect(f.note?.tone).toBe('fix');
    expectText(f.note?.text).toBe('Turn MASTER LEVEL fully up first. It’s at −9 dB.');
    // The words remember the rig they were about, so the island can tell when they're out of date.
    expect(f.note?.rig).toBe(f.rig);
    f = run(f, level(-3));
    expect(f.note?.rig).not.toBe(f.rig);
    f = run(f, level(0), commit);
    expect(f.step).toBe('play');
  });

  it('keeps you on step 2 until the loudest blend is playing', () => {
    let f = run(upTo('play'), commit);
    expectText(f.note?.text).toBe('Pick something to play first.');
    // A quiet track lights green with MASTER ATT at 0 dB, so it's tempting to stop here.
    f = run(f, { type: 'play', material: 'quiet' }, commit);
    expect(f.step).toBe('play');
    expectText(f.note?.text).toContain('quiet track');
    f = run(f, blend, commit);
    expect(f.step).toBe('att');
  });

  it('won’t let MASTER LEVEL do MASTER ATT’s job', () => {
    let f = run(upTo('att'), level(-9));
    // The light goes green, but the tape shows the slip.
    expect(offMark(f)).toBe('level');
    f = run(f, commit);
    expect(f.step).toBe('att');
    expectText(f.note?.text).toContain('trim with MASTER ATT');
    f = run(f, level(0), att(-12), commit);
    expect(offMark(f)).toBeNull();
    expect(f.step).toBe('level');
  });

  it('leaves MASTER LEVEL fully up at step 4 on the site’s Howler, and says why if you move it', () => {
    let f = run(upTo('level'), level(-6), commit);
    expect(f.step).toBe('level');
    expectText(f.note?.text).toContain('put it back there, on its tape');
    f = run(f, level(0), commit);
    expect(f.step).toBe('test');
    expect(f.kept.tape).toBe(LEVEL.max);
  });

  it('refuses to record a setting that has moved', () => {
    let f = run(upTo('test'), level(-3));
    expect(offMark(f)).toBe('level');
    f = run(f, commit);
    expect(f.recorded).toBe(false);
    expectText(f.note?.text).toBe('MASTER LEVEL is off its REC tape. Put it back fully up, then record.');
    f = run(f, level(0), att(-6));
    expect(offMark(f)).toBe('att');
    f = run(f, commit);
    expectText(f.note?.text).toBe('MASTER ATT has changed. Set it back to −12 dB, then record.');
    f = run(f, att(-12), commit);
    expect(f.recorded).toBe(true);
  });

  it('only completes when every headphone check is ticked after recording', () => {
    let f = run(workedStart(), ...hearAll);
    expect(f.complete).toBe(false);
    f = run(upTo('test'), commit, ...hearAll.slice(0, 2));
    expect(f.complete).toBe(false);
    f = run(f, hearAll[2]!);
    expect(f.complete).toBe(true);
    expect(f.note).toBeNull();
    // Un-ticking a check takes you back to listening.
    f = run(f, { type: 'heard', check: 'sides', value: false });
    expect(f.complete).toBe(false);
    expectText(f.note?.text).toContain('Test clip recorded');
  });

  it('snaps MASTER LEVEL to its notches, from off to fully up', () => {
    expect(run(workedStart(), level(9)).rig.level).toBe(0);
    expect(run(workedStart(), level(-4)).rig.level).toBe(-3);
    expect(run(workedStart(), level(-60)).rig.level).toBe(Number.NEGATIVE_INFINITY);
  });

  it('says what the finished step did, then which step is next', () => {
    expect(doneAnnouncement(upTo('level'))).toMatch(/Step 4 of 5: MASTER LEVEL, if still red\.$/);
    const f = upTo('play');
    expectText(doneAnnouncement(f)).toBe(
      'Taped fully up and marked REC. The middle meters now show the mix itself. Step 2 of 5: Loudest blend.',
    );
  });
});

describe('a Howler that MASTER ATT alone can’t tame', () => {
  it('hands over to MASTER LEVEL, and moves the REC tape to the new spot', () => {
    let f = run(workedStart(TIGHT), level(0), commit, blend, commit, att(-6), commit, att(-12), commit);
    expect(f.step).toBe('level');
    expectText(f.last?.text).toBe('Still red with MASTER ATT at −12 dB, its lowest step. MASTER LEVEL is next.');
    // Moving MASTER LEVEL is this step's job, so it isn't flagged as a slip.
    f = run(f, level(-6));
    expect(offMark(f)).toBeNull();
    f = run(f, commit);
    expectText(f.note?.text).toBe(`The light is green, but only just. Aim for the ${MARGIN}.`);
    f = run(f, level(-12), commit);
    expect(f.step).toBe('test');
    expect(f.kept.tape).toBe(-12);
    expectText(stepResponse(f, 'level')).toBe('Marked REC at −12 dB');
    expectText(f.last?.text).toContain('The middle meters now read 12 dB low');
    // The test holds MASTER LEVEL to its new tape.
    f = run(f, level(0), commit);
    expectText(f.note?.text).toContain('Put it back on −12 dB');
    f = run(f, level(-12), commit);
    expect(f.recorded).toBe(true);
    expectText(f.note?.text).toContain('loudest blend peaks at −9 dBFS');
  });
});

describe('the steps’ words', () => {
  it('works in what the booth shows, and says why the test is hot', () => {
    for (const s of STEPS) expect(`${s.target} ${s.instruction}`, s.id).not.toMatch(/dBFS/);
    expect(step('play').instruction).toContain('hotter than any DJ should send');
    expect(step('play').instruction).toContain('on purpose');
    expect(step('att').instruction).toContain('down a step, to −6 dB');
    expect(step('att').instruction).toContain('If it’s still red, set it to −12 dB');
    // Conditions are written out, as a quick reference handbook writes them: no "Still red?" lead-ins.
    for (const s of STEPS) expect(`${s.label} ${s.instruction}`, s.id).not.toMatch(/\?/);
  });

  it('uses one phrasing for the safety margin', () => {
    expect(step('level').target).toBe('First steady green, then two notches down');
    expect(step('level').label).toBe('MASTER LEVEL, if still red');
    expect(step('level').instruction).toContain(`a notch at a time to the ${MARGIN}.`);
    expect(step('level').instruction).toContain('Re-mark the REC tape.');
    expect(step('level').instruction).toContain('The middle meters then read low');
  });

  it('gives every step a key, and says where the room’s volume comes from', () => {
    expect(STEPS.map((s) => s.action)).toEqual([
      'Tape it',
      'Check the light',
      'Set it here',
      'Mark it here',
      'Record 2 minutes',
    ]);
    expect(ROOM_NOTE).toContain('bring the room back up at the amps');
  });
});

describe('your turn', () => {
  it('starts somewhere random, shuffled, with nothing playing', () => {
    const f = practiceStart(prng(3));
    expect(f.mode).toBe('practice');
    expect(f.rig.material).toBeNull();
    expect(f.rig.level).toBeLessThan(LEVEL.max);
    expect(f.rig).toMatchObject(f.found);
    expect(f.order).not.toEqual(['quiet', 'loud', 'blend']);
  });

  it('runs the same steps and keeps the error recovery', () => {
    let f = practiceStart(prng(5));
    f = run(f, { type: 'play', material: 'quiet' }, level(0), commit, commit);
    expect(f.note?.tone).toBe('fix');
    expect(f.step).toBe('play');
    f = run(f, blend, commit, att(-12), commit, commit);
    expect(f.step).toBe('test');
  });
});
