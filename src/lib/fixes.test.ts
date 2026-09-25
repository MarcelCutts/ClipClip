import { describe, expect, it } from 'vitest';
import { type ActionStep, type Branch, drill, drillAnchor, FIXES, type Fix, isIfStep } from './fixes';
import { section } from './sections';

const actions = (f: Fix): ActionStep[] => f.steps.filter((s): s is ActionStep => !isIfStep(s));
const branches = (f: Fix): Branch[] => actions(f).flatMap((s) => s.choose ?? []);

/** Every string a reader sees on a drill. */
const copyOf = (f: Fix): string[] =>
  [
    f.title,
    f.condition,
    f.objective,
    f.warning ?? '',
    ...f.steps.flatMap((s) =>
      isIfStep(s)
        ? [s.if]
        : [s.challenge, s.response, s.note ?? '', ...(s.choose ?? []).flatMap((b) => [b.finding, b.action ?? ''])],
    ),
    f.why ?? '',
  ].filter(Boolean);
const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).filter(Boolean);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe('the drills', () => {
  it('have unique ids that are safe in a link (/night/#fix-<id>)', () => {
    const ids = FIXES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
  });

  it('are numbered F1, F2… on their title strips, in order, each number once', () => {
    const numbers = FIXES.map((f) => f.code);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const code of numbers) expect(code).toMatch(/^F[1-9]\d*$/);
    const values = numbers.map((code) => Number(code.slice(1)));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(drill('howler-red').code).toBe('F1');
  });

  it('cover the booth on the night, then the recording afterwards', () => {
    const where = FIXES.map((f) => f.where);
    expect(where.indexOf('recording')).toBeGreaterThan(0);
    // Booth drills first, then recording drills, never interleaved.
    expect(where.slice(where.indexOf('recording')).every((w) => w === 'recording')).toBe(true);
    expect(FIXES.filter((f) => f.where === 'booth').map((f) => f.id)).toEqual([
      'howler-red',
      'channels-red',
      'clip',
      'not-loud',
      'no-louder',
      'driverack-clip',
      'my-settings',
      'power-cut',
    ]);
    expect(FIXES.filter((f) => f.where === 'recording').map((f) => f.id)).toEqual(['crunch', 'hum', 'hollow']);
  });

  it('quote the light as printed, and where it is, when a light prompts the drill', () => {
    expect(drill('howler-red').title).toBe('LEVEL light on the Howler: red');
    expect(drill('channels-red').title).toBe('Channel meters: red');
    expect(drill('clip').title).toBe('CLIP light above the middle meters: blinking');
    expect(drill('driverack-clip').title).toBe('CLIP lights on the DriveRack: lit');
    const lights = new Map(FIXES.filter((f) => f.light).map((f) => [f.light, f.id]));
    expect(lights).toEqual(
      new Map([
        ['howler-red', 'howler-red'],
        ['meters-red', 'channels-red'],
        ['clip', 'clip'],
        ['driverack-clip', 'driverack-clip'],
      ]),
    );
    // Every lit drill names its light and its state after a colon.
    for (const f of FIXES.filter((f) => f.light)) expect(f.title, f.id).toMatch(/^[A-Z][^:]*: [a-z]+$/);
  });

  it('title the symptoms in sentence case, with capitals only for names printed on the gear', () => {
    expect(drill('not-loud').title).toBe('The room isn’t loud enough');
    expect(drill('my-settings').title).toMatch(/MY SETTINGS/);
    for (const f of FIXES) {
      expect(f.title, f.id).toMatch(/^[A-Z]/);
      expect(f.title, f.id).not.toMatch(/[.?!]$/);
      const shouting = f.title.match(/\b[A-Z]{2,}\b/g) ?? [];
      for (const word of shouting) expect(['LEVEL', 'CLIP', 'MY', 'SETTINGS', 'DJ', 'USB'], f.id).toContain(word);
    }
  });

  it('state one condition and one objective, each a sentence', () => {
    for (const f of FIXES) {
      for (const line of [f.condition, f.objective]) {
        expect(sentences(line), f.id).toHaveLength(1);
        expect(line, f.id).toMatch(/^[A-Z].*\.$/);
      }
    }
  });

  it('number their steps, each a control and what to do with it, or an “If” line', () => {
    for (const f of FIXES) {
      expect(f.steps.length, f.id).toBeGreaterThan(0);
      expect(f.steps.length, f.id).toBeLessThanOrEqual(7);
      for (const step of f.steps) {
        if (isIfStep(step)) {
          expect(step.if, f.id).toMatch(/^If .*\.$/);
          continue;
        }
        expect(step.challenge, f.id).toMatch(/^[A-Z+−]/);
        expect(step.challenge, f.id).not.toMatch(/[.?:]$/);
        // The response is set after leader dots: a short phrase, never a sentence.
        expect(step.response, f.id).toMatch(/^[a-z+−]/);
        expect(step.response, f.id).not.toMatch(/[.?:]$/);
        expect(words(step.response), step.response).toBeLessThanOrEqual(6);
        if (step.note) expect(step.note, f.id).toMatch(/^[A-Z].*\.$/);
      }
    }
  });

  it('offer two or more branches under “Choose one”, each ending, jumping or carrying on', () => {
    for (const f of FIXES) {
      for (const step of actions(f)) {
        if (!step.choose) continue;
        expect(step.choose.length, f.id).toBeGreaterThanOrEqual(2);
        for (const b of step.choose) {
          // Set in bold before a colon, so it ends bare.
          expect(b.finding, f.id).toMatch(/^[A-Z+−]/);
          expect(b.finding, f.id).not.toMatch(/[.?:!]$/);
          if (b.action) expect(b.action, f.id).toMatch(/^[A-Z].*\.$/);
          expect(b.next !== undefined && b.end, `${f.id}: ${b.finding}`).toBeFalsy();
          // A branch with nothing to do has to go somewhere.
          if (!b.action) expect(b.next !== undefined || b.end, `${f.id}: ${b.finding}`).toBeTruthy();
        }
      }
    }
  });

  it('only jump forward to a step that exists, or to another drill', () => {
    const ids = new Set(FIXES.map((f) => f.id));
    for (const f of FIXES) {
      const jumps = f.steps.flatMap((step, i) =>
        (isIfStep(step) ? [step.next] : (step.choose ?? []).map((b) => b.next))
          .filter((next) => next !== undefined)
          .map((next) => ({ from: i + 1, next })),
      );
      for (const { from, next } of jumps) {
        if (typeof next === 'number') {
          expect(next, `${f.id} step ${from}`).toBeGreaterThan(from);
          expect(next, `${f.id} step ${from}`).toBeLessThanOrEqual(f.steps.length);
        } else {
          expect(ids.has(next), `${f.id} → ${next}`).toBe(true);
          expect(next).not.toBe(f.id);
        }
      }
    }
  });

  it('link to where the guide explains them', () => {
    for (const f of FIXES.filter((f) => f.see)) expect(() => section(f.see ?? ''), f.id).not.toThrow();
    for (const f of FIXES.filter((f) => f.light)) expect(f.see, f.id).toBeTruthy();
  });

  it('give every drill and step its own anchor', () => {
    expect(drillAnchor('howler-red')).toBe('fix-howler-red');
    expect(drillAnchor('howler-red', 3)).toBe('fix-howler-red-step-3');
    const anchors = FIXES.flatMap((f) => [drillAnchor(f.id), ...f.steps.map((_, i) => drillAnchor(f.id, i + 1))]);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
});

describe('what the drills say', () => {
  it('check the cause before turning the recording down', () => {
    const howler = drill('howler-red');
    const [meters, settings, att, level, tape, room] = actions(howler);
    expect(meters).toMatchObject({ challenge: 'Middle meters', response: 'check' });
    expect(meters?.note).toMatch(/before you touch anything/);
    const [mix, loaded, neither] = meters?.choose ?? [];
    expect(mix?.finding).toMatch(/Middle meters red too/);
    expect(mix?.action).toMatch(/TRIM down.*Leave the record level alone/);
    expect(mix?.end).toBe(true);
    expect(loaded).toMatchObject({ finding: 'A DJ just loaded MY SETTINGS', next: 2 });
    expect(neither).toMatchObject({ finding: 'Neither', next: 3 });
    expect(settings).toMatchObject({ challenge: 'MASTER ATT and BOOTH ATT', response: 'as on the tape' });
    expect(settings?.note).toMatch(/UTILITY/);
    expect(att).toMatchObject({ challenge: 'MASTER ATT', response: 'down a step' });
    expect(att?.note).toMatch(/UTILITY: −6\sdB, then −12\sdB/);
    expect(att?.choose?.map((b) => [b.finding, b.next])).toEqual([
      ['Green through the loudest blend', 5],
      ['Still red, or no change', 4],
    ]);
    // Pioneer doesn't say MASTER ATT reaches MASTER 2: MASTER LEVEL is the fallback, and it costs the meters.
    expect(level).toMatchObject({ challenge: 'MASTER LEVEL', response: 'down a notch at a time' });
    expect(level?.note).toMatch(/middle meters then read low/);
    // Both turn the PA down too, so the room comes back at the amps.
    expect(tape).toMatchObject({ challenge: 'REC tape', response: 're-marked' });
    expect(room).toMatchObject({ response: 'back up at the amps' });
  });

  it('take the room up at the amps, a click at a time, and say when to stop', () => {
    const room = drill('not-loud');
    const all = copyOf(room).join(' ');
    expect(actions(room)[0]).toMatchObject({ challenge: 'Both amps', response: 'up one click' });
    expect(room.objective).toMatch(/at the amps, and leave the mixer alone/);
    expect(all).toMatch(/gain knobs, 1 and 2, on the front of each GX7/);
    expect(all).toMatch(/red CLIP light on either amp/);
    expect(all).not.toMatch(/MASTER LEVEL|TRIM/);
  });

  it('blame limiters, not the DJ’s ears, when pushing stops working', () => {
    const all = copyOf(drill('no-louder')).join(' ');
    expect(all).toMatch(/limiters/);
    expect(all).toMatch(/TH lights red/);
  });

  it('run the power cut in dbx’s order: amps off first, on last', () => {
    const cut = drill('power-cut');
    expect(cut.steps[0]).toEqual({ challenge: 'Both amps', response: 'off, now' });
    const lines = actions(cut).map((s) => `${s.challenge} ${s.response}`);
    const at = (text: string) => lines.findIndex((line) => line.startsWith(text));
    expect(at('Howler left recording')).toBeGreaterThan(0);
    expect(at('Mixer and DriveRack on')).toBeGreaterThan(at('Howler left recording'));
    expect(at('Amps on last')).toBeGreaterThan(at('Mixer and DriveRack on'));
    expect(copyOf(cut).join(' ')).toMatch(/MASTER LEVEL on its REC mark, both ATTs/);
  });

  it('never cure hum by lifting an earth', () => {
    const hum = drill('hum');
    expect(hum.steps[0]).toEqual({ challenge: 'Isolation transformer', response: 'on the Howler’s lead' });
    // A warning comes before the steps it guards.
    expect(hum.warning).toMatch(/^Never lift an earth\./);
  });

  it('keep the Howler on MASTER 2, RCA to RCA', () => {
    const all = FIXES.flatMap(copyOf).join(' ');
    expect(all).not.toMatch(/proposed|Master 2 wiring|REC on BOOTH|BOOTH MONITOR (?:is|sets) the recording/i);
    expect(copyOf(drill('hollow')).join(' ')).toMatch(/RCA lead from MASTER 2/);
  });

  it('send the crew on to the drill that covers what they find', () => {
    expect(drill('channels-red').steps.find(isIfStep)?.next).toBe('not-loud');
    expect(branches(drill('no-louder')).find((b) => /input CLIP/.test(b.finding))?.next).toBe('driverack-clip');
  });
});

describe('drill copy follows the house style', () => {
  const all = FIXES.flatMap(copyOf);

  it('keeps every sentence to 20 words or fewer', () => {
    for (const text of all) for (const s of sentences(text)) expect(words(s), s).toBeLessThanOrEqual(20);
  });

  it('says no please, never shouts, and uses DJ words', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/\bplease\b|!/i);
      expect(text, text).not.toMatch(/\byellow\b|\bTHD\b|\bcolor\b|\bnormaliz/i);
    }
  });

  it('writes conditions as “If …”, and asks no questions', () => {
    for (const text of all) expect(text, text).not.toContain('?');
    expect(all.join(' ')).not.toMatch(/clean in, rig up/);
  });

  it('joins numbers to units with a no-break space, with true minus signs and curly quotes', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/\d (?:dB|dBu|dBV|dBFS|m|seconds?|minutes?|hours?)\b/);
      expect(text, text).not.toMatch(/(^|[\s(])-\d/);
      expect(text, text).not.toMatch(/['"]/);
    }
  });
});
