import { describe, expect, it } from 'vitest';
import { LEVEL_FALLBACK, OPEN_UTILITY } from './checklists';
import { type ActionStep, type Branch, drill, drillAnchor, FIXES, type Fix, isIfStep } from './fixes';
import { section } from './sections';

const actions = (f: Fix): ActionStep[] => f.steps.filter((s): s is ActionStep => !isIfStep(s));
const branches = (f: Fix): Branch[] => actions(f).flatMap((s) => s.choose ?? []);

/** Every string a reader sees on a drill. */
const copyOf = (f: Fix): string[] =>
  [
    f.title,
    f.short,
    f.condition,
    f.objective,
    f.warning ?? '',
    ...f.steps.flatMap((s) =>
      isIfStep(s)
        ? [s.if, s.see?.title ?? '']
        : [
            s.before ?? '',
            s.challenge,
            s.response,
            s.note ?? '',
            ...(s.choose ?? []).flatMap((b) => [b.finding, b.action ?? '']),
          ],
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

  it('give each drill a short name for the index rail, one line of it, each one different', () => {
    const shorts = FIXES.map((f) => f.short);
    expect(new Set(shorts).size).toBe(shorts.length);
    for (const f of FIXES) {
      expect(f.short.length, f.id).toBeLessThanOrEqual(18);
      expect(f.short, f.id).toMatch(/^[A-Z]/);
      expect(f.short, f.id).not.toMatch(/[.?!]$/);
    }
    expect(drill('howler-red').short).toBe('Howler LEVEL: red');
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
        // What the step also does is a plain sentence, never a CAUTION label.
        if (step.before) expect(step.before, f.id).toMatch(/^[A-Z][^:]*\.$/);
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
    expect(settings).toMatchObject({ challenge: 'MASTER ATT and BOOTH ATT', response: 'as on the REC tape' });
    expect(settings?.note).toContain(OPEN_UTILITY);
    expect(att).toMatchObject({ challenge: 'MASTER ATT', response: 'down a step' });
    expect(att?.note).toMatch(/UTILITY: −6\sdB, then −12\sdB/);
    expect(att?.choose?.map((b) => [b.finding, b.next])).toEqual([
      ['Green through the loudest blend', 5],
      ['Still red, or no change', 4],
    ]);
    // Pioneer doesn't say MASTER ATT reaches MASTER 2: MASTER LEVEL is the fallback, worded as S1 words it,
    // and it costs the meters.
    expect(level).toMatchObject({ challenge: LEVEL_FALLBACK.challenge, response: LEVEL_FALLBACK.response });
    expect(level?.note?.startsWith(LEVEL_FALLBACK.note)).toBe(true);
    expect(level?.note).toMatch(/middle meters then read low/);
    expect(howler.why).toMatch(/Pioneer doesn’t say whether MASTER ATT reaches MASTER 2/);
    // Both turn the PA down too, so the room comes back at the amps.
    expect(tape).toMatchObject({ challenge: 'REC tape', response: 're-marked' });
    expect(room).toMatchObject({ response: 'back up at the amps' });
  });

  it('say before turning MASTER ATT down that the room drops too, so the DJ hears it first', () => {
    for (const f of FIXES) {
      for (const step of actions(f).filter((s) => s.challenge === 'MASTER ATT' && /down/.test(s.response))) {
        expect(step.before, f.id).toBe('This turns the room down too, so tell the DJ first.');
      }
    }
    const [, settings] = actions(drill('howler-red'));
    expect(settings?.before).toMatch(/room down too, so tell the DJ first\.$/);
    // Not a caution label: the handbook keeps those for hazards to people.
    expect(FIXES.flatMap(copyOf).join(' ')).not.toMatch(/\bcaution\b/i);
  });

  it('say how to open UTILITY wherever a drill sends the crew into it', () => {
    const into = FIXES.flatMap((f) =>
      actions(f)
        .filter((s) => /UTILITY/.test(`${s.challenge} ${s.note ?? ''}`) || /\bATT\b/.test(s.challenge))
        .map((s) => ({ id: f.id, step: s })),
    );
    // F1 steps 2 and 3, F6 step 3, F7 step 1 (F7's last step follows its first).
    expect(into.length).toBeGreaterThanOrEqual(4);
    for (const { id, step } of into.filter(({ step }) => step.challenge !== 'The ATT that changed')) {
      expect(step.note, `${id}: ${step.challenge}`).toContain(OPEN_UTILITY);
    }
    // Pioneer: "Press the [MENU (UTILITY)] button for over 1 second" (Operating Instructions p.31).
    expect(OPEN_UTILITY).toBe('To open UTILITY, hold MENU (UTILITY) for over a second.');
  });

  it('check both attenuators against the REC tape, where the crew wrote them', () => {
    const all = FIXES.flatMap(copyOf).join(' ');
    expect(all).not.toMatch(/\bthe tape\b/);
    expect(all).toMatch(/both ATTs against the REC tape/);
    expect(actions(drill('my-settings'))[0]).toMatchObject({ response: 'check against the REC tape' });
  });

  it('say what MASTER REC is at its first mention, and send the crew to the setup card for it', () => {
    const cut = drill('power-cut');
    const last = cut.steps.at(-1);
    expect(last && isIfStep(last) ? last.if : '').toMatch(/^If the USB backup \(MASTER REC\) was running/);
    expect(last && isIfStep(last) ? last.see : undefined).toEqual({
      code: 'S6',
      title: 'USB backup',
      path: '/setup/#backup',
    });
    const first = FIXES.flatMap(copyOf).find((text) => text.includes('MASTER REC'));
    expect(first).toMatch(/USB backup \(MASTER REC\)/);
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

  it('never cure hum by disconnecting an earth', () => {
    const hum = drill('hum');
    expect(hum.steps[0]).toEqual({ challenge: 'Isolation transformer', response: 'on the Howler’s lead' });
    // A warning comes before the steps it guards. It's the one hazard to people on the page.
    expect(hum.warning).toMatch(/^Never disconnect an earth: no ground-lift adapters, no taped or cut earth pins\./);
    expect(FIXES.filter((f) => f.warning).map((f) => f.id)).toEqual(['hum']);
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
      // "Hot" is jargon, and "trim" is only ever the TRIM knob.
      expect(text, text).not.toMatch(/\bhot(?:ter)?\b|\btrim(?:s|med)?\b/);
    }
  });

  it('asks the DJ plainly, with no colon reveals', () => {
    for (const text of all) expect(text, text).not.toMatch(/quiet word with the DJ:|Remind (?:that DJ|them):/);
    expect(all.join(' ')).toMatch(/Ask the DJ, quietly, to turn TRIM down\./);
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
