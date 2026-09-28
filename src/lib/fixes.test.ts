import { describe, expect, it } from 'vitest';
import { CHANNEL_METERS_WORDS, FADER_DOWN, MASTER_METERS_WORDS, RECORDING_DOWN } from './checklists';
import {
  allSteps,
  type Branch,
  drill,
  drillAnchor,
  drillPath,
  FIXES,
  type Fix,
  isDoStep,
  isIfStep,
  isLineStep,
  isSayStep,
  type Next,
  type Step,
} from './fixes';
import { DJ_RULES } from './rules';
import { section } from './sections';

const branchesOf = (step: Step): readonly Branch[] => (isIfStep(step) ? [] : (step.choose ?? []));
const branches = (f: Fix): Branch[] => allSteps(f).flatMap(branchesOf);
const stepAt = (f: Fix, n: number): Step | undefined => allSteps(f)[n - 1];

/** Every string a reader sees on a drill. */
const copyOf = (f: Fix): string[] =>
  [
    f.title,
    f.short,
    f.condition ?? '',
    f.objective,
    f.later?.when ?? '',
    ...allSteps(f).flatMap((s) => [
      s.before ?? '',
      ...(isIfStep(s)
        ? [s.if, s.action ?? '', s.say ?? '']
        : [
            isLineStep(s) ? `${s.challenge} ${s.response}` : '',
            isDoStep(s) ? s.do : '',
            ...(isSayStep(s) ? [s.to ?? '', s.say] : []),
            s.note ?? '',
            ...(s.choose ?? []).flatMap((b) => [b.finding, b.action ?? '', b.to ?? '', b.say ?? '']),
          ]),
    ]),
    f.why,
  ].filter(Boolean);
const all = FIXES.flatMap(copyOf);
/** Sentences end at a stop before an ordinary space and a letter, so "p.\u00a031" stays inside its sentence. */
const sentences = (text: string) => text.split(/(?<=[.?!]”?) +(?=[A-Za-z“])/).filter(Boolean);

/** Every jump in a drill, with the step it's made from. */
const jumpsOf = (f: Fix): { from: number; next: Next }[] =>
  allSteps(f).flatMap((s, i) =>
    [...(isIfStep(s) ? [s.next] : []), ...branchesOf(s).map((b) => b.next)]
      .filter((next) => next !== undefined)
      .map((next) => ({ from: i + 1, next })),
  );

/**
 * Where a step can lead: the steps it jumps to, the next step if it falls through, and "end" for the end
 * of the drill or a jump to another drill. An "If …" step both jumps (if so) and falls through (if not).
 */
function exits(f: Fix, n: number): (number | 'end')[] {
  const step = stepAt(f, n);
  if (!step) return ['end'];
  const fall = n < allSteps(f).length ? n + 1 : 'end';
  const to = (next: Next | undefined, end?: true): number | 'end' | undefined =>
    end ? 'end' : next === undefined ? undefined : typeof next === 'number' ? next : 'end';
  if (isIfStep(step)) return [to(step.next, step.end) ?? fall, fall];
  const choose = step.choose ?? [];
  if (!choose.length) return [fall];
  return choose.map((b) => to(b.next, b.end) ?? fall);
}

/** Whether the end of the drill can be reached from step n. */
function canEnd(f: Fix, n: number, seen = new Set<number>()): boolean {
  if (seen.has(n)) return false;
  seen.add(n);
  return exits(f, n).some((e) => e === 'end' || canEnd(f, e, seen));
}

/** Every path from step 1 to the end, each step visited at most once (a loop back is cut short). */
function paths(f: Fix): number[][] {
  const out: number[][] = [];
  const walk = (n: number, path: number[]) => {
    if (path.includes(n)) return;
    const here = [...path, n];
    for (const e of exits(f, n)) {
      if (e === 'end') out.push(here);
      else walk(e, here);
    }
  };
  walk(1, []);
  return out;
}

/** The step that looks at a drill's own light again, by the name the step gives it. */
const RECHECK: Record<string, string> = {
  'howler-red': 'Howler LEVEL light',
  'meters-red': 'Channel meter',
  clip: 'CLIP light',
  'driverack-clip': 'DriveRack input CLIP lights',
};

describe('the drills', () => {
  it('have unique ids that are safe in a link (#fix-<id>), and keep the ones other pages link to', () => {
    const ids = FIXES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    // The crew box (rules.ts), the rig reference and the lists link to these.
    for (const id of ['howler-red', 'not-loud', 'no-louder', 'driverack-clip', 'my-settings', 'crunch', 'hollow']) {
      expect(ids).toContain(id);
    }
  });

  it('are numbered F1, F2… on their title strips, in order, each number once', () => {
    const numbers = FIXES.map((f) => f.code);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const code of numbers) expect(code).toMatch(/^F[1-9]\d*$/);
    const values = numbers.map((code) => Number(code.slice(1)));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(drill('howler-red').code).toBe('F1');
  });

  it('cover the booth on the night, then the recordings the next day', () => {
    const where = FIXES.map((f) => f.where);
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
    // What is found by listening, the day after. They are on Recordings, where the listening is done.
    expect(FIXES.filter((f) => f.where === 'recording').map((f) => f.id)).toEqual(['crunch', 'hollow']);
    expect(drillPath('crunch')).toBe('/recordings/#fix-crunch');
    expect(drillPath('hollow', 2)).toBe('/recordings/#fix-hollow-step-2');
    expect(drillPath('howler-red')).toBe('/night/#fix-howler-red');
  });

  it('name the light as printed, then its state, when a light prompts the drill', () => {
    expect(drill('howler-red').title).toBe('Howler LEVEL light: red');
    expect(drill('channels-red').title).toBe('Channel meters: red');
    expect(drill('clip').title).toBe('CLIP light above the MASTER meters: blinking');
    expect(drill('driverack-clip').title).toBe('DriveRack input CLIP lights: lit');
    const lights = new Map(FIXES.filter((f) => f.light).map((f) => [f.light, f.id]));
    expect(lights).toEqual(
      new Map([
        ['howler-red', 'howler-red'],
        ['meters-red', 'channels-red'],
        ['clip', 'clip'],
        ['driverack-clip', 'driverack-clip'],
      ]),
    );
    for (const f of FIXES.filter((f) => f.light)) expect(f.title, f.id).toMatch(/^[A-Z][^:]*: [a-z]+$/);
  });

  it('give each drill a short name for the index rail, in the title’s word order', () => {
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
    expect(drill('not-loud').title).toBe('The room is not loud enough');
    expect(drill('power-cut').title).toBe('Power cut');
    const printed = ['LEVEL', 'CLIP', 'MASTER', 'MY', 'SETTINGS', 'DJ', 'USB'];
    for (const f of FIXES) {
      expect(f.title, f.id).toMatch(/^[A-Z]/);
      expect(f.title, f.id).not.toMatch(/[.?!]$/);
      for (const word of f.title.match(/\b[A-Z]{2,}\b/g) ?? []) expect(printed, f.id).toContain(word);
    }
  });

  it('state an objective, and a condition only where it adds to the title', () => {
    for (const f of FIXES) {
      expect(sentences(f.objective), f.id).toHaveLength(1);
      expect(f.objective, f.id).toMatch(/^[A-Z].*\.$/);
      if (f.condition) expect(f.condition.toLowerCase(), f.id).not.toContain(f.title.toLowerCase());
    }
  });

  it('say why in one or two sentences, and point to the guide by a section that exists', () => {
    for (const f of FIXES) {
      expect(sentences(f.why).length, f.id).toBeGreaterThanOrEqual(1);
      expect(sentences(f.why).length, f.id).toBeLessThanOrEqual(2);
      if (f.see) expect(() => section(f.see ?? ''), f.id).not.toThrow();
      if (f.seeAt) expect(f.see, `${f.id} lands inside a section it names`).toBeTruthy();
    }
    for (const f of FIXES.filter((f) => f.light)) expect(f.see, f.id).toBeTruthy();
    // Each link is about its drill: 3.2 has the recording's ceiling, 3.1 draws MASTER 1 into the DriveRack, and
    // 4.4 says what Pioneer publishes about MASTER ATT. The limiter myth answers F5.
    expect(['howler-red', 'driverack-clip', 'my-settings'].map((id) => drill(id).see)).toEqual([
      '#two-ceilings',
      '#signal',
      '#red-top',
    ]);
    expect(drill('no-louder')).toMatchObject({ see: '#myths', seeAt: '#myth-limiter' });
  });

  it('split a booth drill into “Now” and what waits, and the recordings’ drills into one block', () => {
    for (const f of FIXES.filter((f) => f.later))
      expect(['At the changeover', 'When the power is back']).toContain(f.later?.when);
    expect(FIXES.filter((f) => f.where === 'recording' && f.later)).toEqual([]);
    for (const f of FIXES) expect(allSteps(f).length, f.id).toBeLessThanOrEqual(7);
  });

  it('write each step as one instruction, with the condition first', () => {
    for (const f of FIXES) {
      for (const step of allSteps(f)) {
        if (step.before) expect(step.before, f.id).toMatch(/^[A-Z][^:]*\.$/);
        if (isIfStep(step)) {
          // "If the DJ wants it louder", then what to do, the words to say or where to go.
          expect(step.if, f.id).toMatch(/^If [^,.]+$/);
          expect(step.action || step.say || step.next !== undefined, f.id).toBeTruthy();
          if (step.action) expect(step.action, f.id).toMatch(/^[a-z].*[.:]$/);
          continue;
        }
        if (isLineStep(step)) {
          expect(step.challenge, f.id).toMatch(/^[A-Z+−]/);
          expect(step.challenge, f.id).not.toMatch(/[.?:]$/);
          // A state after the leader dots, never an instruction to look or a word that can be said without looking.
          expect(step.response, f.id).toMatch(/^[a-z0-9+−]/);
          expect(step.response, f.id).not.toMatch(/[.?:]$/);
          expect(step.response, f.id).not.toMatch(/^(?:check|set|watch|as required|look)\b/);
        }
        if (isDoStep(step)) expect(step.do, f.id).toMatch(/^[A-Z][^.]*\.$/);
        if (isSayStep(step)) expect(step.to ?? 'Say to the DJ:', f.id).toMatch(/:$/);
        // A note carries information, never an instruction. It ends on a full stop, or on a maker's words in
        // quotes and their page.
        if (step.note) {
          expect(step.note, f.id).toMatch(/^[A-Z].*(?:\.|\.” \(p\.\s\d+\))$/);
          expect(step.note, f.id).not.toMatch(/^(?:To |Turn|Set|Push|Look|Check|Wait|Tell|Ask|Say|Switch)\b/);
        }
      }
    }
  });

  it('offer “Choose one” as what you can see, each finding ending the drill or going somewhere', () => {
    for (const f of FIXES) {
      for (const step of allSteps(f)) {
        const choose = branchesOf(step);
        if (!choose.length) continue;
        expect(choose.length, f.id).toBeGreaterThanOrEqual(2);
        for (const b of choose) {
          // Set in bold before a colon, so it ends bare.
          expect(b.finding, f.id).toMatch(/^[A-Z0-9+−]/);
          expect(b.finding, f.id).not.toMatch(/[.?:!]$/);
          if (b.action) expect(b.action, f.id).toMatch(/^[A-Z].*\.$/);
          expect(b.next !== undefined || b.end, `${f.id}: ${b.finding}`).toBeTruthy();
          expect(b.next !== undefined && b.end, `${f.id}: ${b.finding}`).toBeFalsy();
        }
      }
    }
  });

  it('jump only to a step or a drill that exists, and can always reach an end from any step', () => {
    const ids = new Set(FIXES.map((f) => f.id));
    for (const f of FIXES) {
      // A loop is fine as long as it has a way out: every step can still reach the end of the drill.
      for (let n = 1; n <= allSteps(f).length; n++) expect(canEnd(f, n), `${f.id} step ${n}`).toBe(true);
      for (const { from, next } of jumpsOf(f)) {
        if (typeof next === 'number') {
          expect(next, `${f.id} step ${from}`).toBeGreaterThanOrEqual(1);
          expect(next, `${f.id} step ${from}`).toBeLessThanOrEqual(allSteps(f).length);
          expect(next, `${f.id} step ${from}`).not.toBe(from);
        } else {
          const id = typeof next === 'string' ? next : next.drill;
          expect(ids.has(id), `${f.id} → ${id}`).toBe(true);
          expect(id).not.toBe(f.id);
          if (typeof next === 'object') {
            expect(next.step).toBeGreaterThanOrEqual(1);
            expect(next.step).toBeLessThanOrEqual(allSteps(drill(id)).length);
          }
        }
      }
    }
  });

  it('close on the light they open on: every path to the end looks at it again after the last change', () => {
    for (const f of FIXES.filter((f) => f.light)) {
      const name = RECHECK[f.light ?? ''];
      const recheck = allSteps(f).findIndex((s) => isLineStep(s) && s.challenge === name) + 1;
      expect(recheck, `${f.id} has a step that looks at ${name} again`).toBeGreaterThan(0);
      // Still lit: back to an earlier step, never the end.
      const again = branchesOf(stepAt(f, recheck) as Step).filter(
        (b) => typeof b.next === 'number' && b.next < recheck,
      );
      expect(again, f.id).toHaveLength(1);
      for (const path of paths(f)) {
        expect(path, `${f.id}: ${path.join(' → ')}`).toContain(recheck);
        // After the last look, nothing changes the level now: only what waits, words for later, or another drill.
        for (const n of path.slice(path.lastIndexOf(recheck) + 1)) {
          const s = stepAt(f, n) as Step;
          const now = !isIfStep(s) && isSayStep(s) && !s.to;
          expect(now, `${f.id} step ${n} changes the level after the last look`).toBe(false);
        }
      }
    }
  });

  it('give every drill and step its own anchor', () => {
    expect(drillAnchor('howler-red')).toBe('fix-howler-red');
    expect(drillAnchor('howler-red', 3)).toBe('fix-howler-red-step-3');
    const anchors = FIXES.flatMap((f) => [drillAnchor(f.id), ...allSteps(f).map((_, i) => drillAnchor(f.id, i + 1))]);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
});

describe('what the drills say', () => {
  it('look at the MASTER meters before touching the recording level, in F1 step 1', () => {
    const f1 = drill('howler-red');
    const [meters] = f1.steps;
    expect(meters).toMatchObject({ challenge: 'MASTER meters', response: 'below red' });
    // Red: the DJ's fader first, then the Howler's light again (step 5).
    expect(branchesOf(meters as Step)).toEqual([
      { finding: 'Red', say: FADER_DOWN, next: 5 },
      { finding: 'Below red', next: 2 },
    ]);
    // Only the LEVEL light is F1's: the BATTERY light is red all the time the Howler charges (MK1 manual).
    expect(f1.condition).toBe('The LEVEL light blinks red. A steady red BATTERY light means the Howler is charging.');
  });

  it('tell the DJ the room will go quieter before the recording is turned down', () => {
    const f1 = drill('howler-red');
    const warned = stepAt(f1, 2);
    // "Will": MASTER LEVEL sets MASTER 1, the room's socket, as well as MASTER 2 (Pioneer p.27).
    expect(warned && isSayStep(warned) ? warned.say : '').toBe(
      'The room will go quieter until the amps are turned up. Keep your levels as they are.',
    );
    // F6 has its own loop: a DriveRack clip is never handed to the recording level's steps.
    for (const { next } of jumpsOf(drill('driverack-clip'))) expect(next).not.toMatchObject({ drill: 'howler-red' });
  });

  it('go by the lights, since the gear carries no marks, no tape and no test recording', () => {
    // The owner, 28 September 2026. Earthing is nowhere in the drills.
    expect(all.join(' ')).not.toMatch(/\bmarks?\b|\b(?:the|REC|RIG) tape\b|\bREC\b|\bRIG\b/);
    expect(all.join(' ')).not.toMatch(/test recording/i);
    expect(all.join(' ')).not.toMatch(/\bRCDs?\b|generator|competent person/i);
    expect(FIXES.filter((f) => /earth/i.test(copyOf(f).join(' '))).map((f) => f.code)).toEqual([]);
  });

  it('turn the recording down at MASTER LEVEL, with its cost said before the step, and leave MASTER ATT alone', () => {
    const f1 = drill('howler-red');
    expect(allSteps(f1)).toHaveLength(5);
    expect(stepAt(f1, 3)).toEqual({
      before: RECORDING_DOWN.consequence,
      challenge: RECORDING_DOWN.challenge,
      response: RECORDING_DOWN.response,
    });
    // The step names the light it waits for, and its cost is said of the step, not of "then".
    expect(RECORDING_DOWN).toEqual({
      challenge: 'MASTER LEVEL',
      response: 'down a little at a time, until the Howler’s LEVEL light blinks green',
      consequence: 'After this step, the MASTER meters read low.',
    });
    // The owner has never seen the Howler red with the MASTER meters below red, and Pioneer does not say which
    // sockets MASTER ATT reaches. No drill sends anyone into UTILITY to change it.
    expect(copyOf(f1).join(' ')).not.toMatch(/MASTER ATT|UTILITY/);
    for (const f of FIXES) {
      for (const step of allSteps(f)) {
        const doing = [
          isLineStep(step) ? step.challenge : '',
          isDoStep(step) ? step.do : '',
          ...branchesOf(step).map((b) => b.action ?? ''),
        ].join(' ');
        expect(doing, f.code).not.toMatch(/\bATT\b/);
      }
    }
    expect(all.join(' ')).not.toMatch(/\bstep down\b|down a step|a step lower/i);
    // A channel can clip before its fader with the MASTER meters below red, so the why never calls the mix clean.
    // It also says where the room is made up: a mixer turned back up would turn the recording up with it.
    expect(f1.why).toBe(
      'If the MASTER meters are below red, a red LEVEL light means the recording level is too high. The Howler’s lead leaves the mixer before the amps, and turning the amps up makes the room louder without changing the recording.',
    );
    expect(all.join(' ')).not.toMatch(/mix is clean|crunch before|hides? a blend/i);
  });

  it('cite no card that has gone: no test, no setup card, no fixed attenuator', () => {
    // The setup page's tests and commissioning cards needed a laptop, and this is a guide for the field.
    expect(all.join(' ')).not.toMatch(/\b(?:T[1-9]|S[1-9])\b/);
    expect(all.join(' ')).not.toMatch(/fixed attenuator|in-line/i);
  });

  it('bring the room back at the amps only if it went quieter, with their CLIP lights dark', () => {
    const f1 = drill('howler-red');
    // Once the Howler is green again: only a change F1 made brings the amps back up, never the DJ's fader.
    expect(branchesOf(stepAt(f1, 5) as Step)[0]).toEqual({
      finding: 'Blinking green',
      action: 'If step 3 made the room quieter, turn the amps back up, with their CLIP lights dark.',
      end: true,
    });
    // There is no tape to bring up to date: the drill ends on the light it opened on.
    expect(f1.later).toBeUndefined();
    // After MASTER LEVEL comes down, the DJ hears that the MASTER meters read low.
    const told = stepAt(f1, 4);
    expect(told && isSayStep(told) ? told.say : '').toBe(`The MASTER meters now read low. ${CHANNEL_METERS_WORDS}`);
    // QSC publishes no dB per click, so no card says the knobs move by the same number of clicks.
    expect(all.join(' ')).not.toMatch(/same number of clicks/i);
  });

  it('agree between F1 and F7: a red light is fixed now, and a change shows as a change in level', () => {
    const f7 = drill('my-settings');
    expect(f7.objective).toBe('Find any change in level at the mixer’s outputs.');
    expect(f7.steps[0]).toMatchObject({
      challenge: 'Howler LEVEL light',
      response: 'blinking green at the next loud part',
    });
    expect(branchesOf(f7.steps[0] as Step)).toEqual([
      { finding: 'Blinking green', next: 2 },
      { finding: 'Red', next: 'howler-red' },
    ]);
    // With no record of either attenuator to go back to, the drill looks for what a change does. The step
    // that leaves the drill comes last, so the booth monitors are never skipped.
    expect(f7.steps.slice(1)).toEqual([
      { if: 'If the booth monitors are now quieter', action: 'turn up BOOTH MONITOR.' },
      { if: 'If the room is now quieter', next: 'not-loud' },
    ]);
    expect(f7.later).toBeUndefined();
    // Pioneer: MY SETTINGS can call out UTILITY settings (p.31); what a stick carries, and which sockets MASTER
    // ATT reaches, are not published.
    expect(f7.why).toBe(
      'Pioneer says MY SETTINGS can call out UTILITY settings, and MASTER ATT and BOOTH ATT are UTILITY settings (pp. 31–32). A change to MASTER ATT may change the room’s volume too: Pioneer does not say which sockets it reaches.',
    );
  });

  it('mute every output, flip the DriveRack’s switch at the changeover, then take the room back up at the amps', () => {
    const f6 = drill('driverack-clip');
    // dbx p.7: "+4dBu option (switch out)", "-10dBV option (switch in)".
    expect(stepAt(f6, 3)).toMatchObject({
      challenge: 'DriveRack input switch, on the back',
      response: '+4 dBu',
      note: 'Out is +4 dBu. Pushed in is −10 dBV.',
    });
    expect(f6.later?.when).toBe('At the changeover');
    const later = f6.later?.steps ?? [];
    // A MUTE button that was lit before stays lit: the drill puts the outputs back as they were.
    expect(later.filter(isLineStep).map((s) => `${s.challenge} ${s.response}`)).toEqual([
      'DriveRack outputs every MUTE button on, any lit ones noted',
      'DriveRack input switch +4 dBu, out',
      'DriveRack MUTE buttons off, except any noted in step 4',
    ]);
    expect(later[0]?.before).toBe('The room goes silent until step 6.');
    // dbx p.5: a MUTE button's state is kept through a power cycle.
    expect(later.filter(isLineStep).at(-1)?.note).toMatch(/stays on, even after the power goes off and on\.$/);
    expect(later.at(-1)).toMatchObject({ if: 'If the room is now too quiet', next: 'not-loud' });
  });

  it('give the crew the words to say to the DJ, in the DJ box’s own words', () => {
    // FADER_DOWN is the DJ box's note for the MASTER meters (rules.ts), said as it is written there.
    expect(DJ_RULES.some((r) => r.note.toLowerCase().includes(FADER_DOWN.toLowerCase().replace(/\.$/, '')))).toBe(true);
    for (const id of ['howler-red', 'clip', 'driverack-clip']) {
      const says = [
        ...allSteps(drill(id))
          .filter(isSayStep)
          .map((s) => s.say),
        ...branches(drill(id)).map((b) => b.say),
      ];
      expect(says, id).toContain(FADER_DOWN);
    }
    // The channel meters' rule, word for word as the booth card has it.
    expect(CHANNEL_METERS_WORDS).toBe(`Keep the channel meters on the ${DJ_RULES[0]?.response}.`);
    expect(DJ_RULES[0]?.response).toBe('first orange (0) at the loudest part');
    expect(drill('no-louder').steps[0]).toEqual({ say: CHANNEL_METERS_WORDS });
    // The MASTER meters' rule, "top orange dark", between tracks (F3) and after a set (F9).
    expect(DJ_RULES[1]?.response).toBe('top orange dark');
    const f3 = drill('clip').steps[2];
    expect(f3 && isIfStep(f3) ? f3.say : '').toBe(`${MASTER_METERS_WORDS} ${CHANNEL_METERS_WORDS}`);
    expect(branches(drill('crunch')).find((b) => b.finding === 'On the blends')?.say).toBe(MASTER_METERS_WORDS);
    expect(all.join(' ')).not.toMatch(/first or second orange|below red in a blend/);
    // Words, not manner.
    expect(all.join(' ')).not.toMatch(/\bquietly\b|\bkindly\b|have a (?:quiet )?word|\bremind\b/i);
  });

  it('send the crew on to the drill that covers what they find, without doing its first step here', () => {
    expect(drill('channels-red').steps.at(-1)).toEqual({ if: 'If the DJ wants it louder', next: 'not-loud' });
    expect(branches(drill('no-louder')).find((b) => /input CLIP/i.test(b.finding))?.next).toBe('driverack-clip');
    expect(branches(drill('no-louder')).find((b) => b.finding === 'None of these')?.next).toBe('not-loud');
  });

  it('take the room up at the amps, a click at a time, and stop at the first red CLIP light', () => {
    const f4 = drill('not-loud');
    // The limit is looked at before any knob moves.
    expect(f4.steps[0]).toMatchObject({
      challenge: 'Amp gain knobs',
      response: 'below fully up',
      note: 'Each GX7 has two, CH1 and CH2, on the side of the rack that faces the crowd.',
    });
    expect(f4.steps[1]).toMatchObject({ challenge: 'Amp gain knobs', response: 'one click up, all four' });
    expect(f4.steps[2]).toMatchObject({ challenge: 'Both amps’ CLIP lights', response: 'dark, after a few bars' });
    const ends = branches(f4).filter((b) => b.end);
    expect(ends.map((b) => b.finding)).toEqual(['Fully up', 'A red CLIP light']);
    // At either, the crew tell the DJ this is the room's limit.
    for (const b of ends) expect(b.say).toBe('That is the room’s limit.');
    expect(f4.steps.at(-1)).toEqual({ if: 'If the DJ still wants it louder', next: 1 });
    expect(copyOf(f4).join(' ')).not.toMatch(/MASTER LEVEL|TRIM/);
  });

  it('run a power cut in dbx’s order: amps off first, on last with no track playing, the Howler still recording', () => {
    const cut = drill('power-cut');
    expect(cut.steps[0]).toEqual({ challenge: 'Both amps', response: 'switched off' });
    // Two GX7s on one strip can trip it (QSC p.11), and C1 gives each a socket of its own.
    expect(cut.steps.at(-1)).toEqual({
      if: 'If a breaker tripped',
      action: 'put each amp on a socket of its own before you reset it.',
    });
    expect(cut.later?.when).toBe('When the power is back');
    const later = (cut.later?.steps ?? []).filter(isLineStep);
    // The DriveRack has no power switch (dbx p.10), so its line is its screen.
    expect(later[0]).toEqual({ challenge: 'XDJ-RX2', response: 'switched on' });
    expect(later[1]).toEqual({ challenge: 'DriveRack', response: 'screen lit' });
    // dbx p.10: 10 seconds is for switching off; for switching on, no audio passing.
    expect(later[2]).toEqual({ challenge: 'Both amps', response: 'switched on last, with no track playing' });
    // A cut is no switch-off at the mixer's own switch (Pioneer p.35), so a UTILITY change may be lost.
    expect(later.at(-1)).toMatchObject({
      challenge: 'Howler LEVEL light',
      response: 'blinking green at the next loud part',
    });
    expect(branchesOf(later.at(-1) as Step)).toEqual([
      { finding: 'Blinking green', end: true },
      { finding: 'Red', next: 'howler-red' },
    ]);
    expect(cut.why).toMatch(/^dbx says to switch the amps on last, with no audio playing, and off first \(p\. 10\)\./);
    expect(cut.why).toMatch(/The Howler MK1 records for about 30 hours/);
  });

  it('find a recording’s crunch by where its flat tops sit, without blaming the DJ for the track', () => {
    const [file, look, where, track] = drill('crunch').steps;
    // Turning a file up moves its top: the flat tops are read on the copy the Howler wrote.
    expect(file).toMatchObject({ challenge: 'File', response: 'the copy kept as the Howler wrote it' });
    // After the converters a clipped top ripples and leans.
    expect(look && !isIfStep(look) ? look.note : '').toBe('In the file, flat tops can ripple or lean a little.');
    expect(branchesOf(look as Step).map((b) => b.finding)).toEqual([
      'Flat tops at the top of the file',
      'Flat tops lower down',
      'No flat tops',
    ]);
    // The Howler clipping can hide the mixer clipping under it.
    expect(branchesOf(look as Step)[0]?.action).toMatch(
      /^The Howler most likely clipped, and the mixer may have clipped too\./,
    );
    expect(branchesOf(where as Step)).toEqual([
      { finding: 'On the blends', to: 'Tell that DJ:', say: MASTER_METERS_WORDS, end: true },
      { finding: 'All through one track', next: 4 },
    ]);
    // A track can be clipped in its own mastering: the crew look at its file before they tell the DJ.
    expect(track && isDoStep(track) ? track.do : '').toBe('Zoom in on the same part of the track’s own file.');
    expect(branchesOf(track as Step)).toEqual([
      { finding: 'The same flat tops', action: 'The crunch came in with the track.', end: true },
      { finding: 'No flat tops', to: 'Tell that DJ:', say: CHANNEL_METERS_WORDS, end: true },
    ]);
    // Howler publishes no input limit: where it clips is our assumption.
    expect(drill('crunch').why).toMatch(
      /^We assume the Howler clips at the top of its file: Howler publishes no input limit\./,
    );
  });

  it('have no drill for hum: nobody can hear a recording at the event, and earthing is not the guide’s subject', () => {
    // The owner, 28 September 2026. F10's number is retired, not reused.
    expect(FIXES.map((f) => f.code)).not.toContain('F10');
    expect(FIXES.map((f) => f.id)).not.toContain('hum');
    expect(all.join(' ')).not.toMatch(/\bhums?\b|\bbuzz\b|\bearth|isolation transformer|PIN 1 LIFT|ground/i);
    expect(all.join(' ')).not.toMatch(/\bwarning\b|\bcaution\b/i);
  });

  it('keep the Howler on MASTER 2, RCA to RCA, with nothing else in its lead', () => {
    const text = all.join(' ');
    expect(text).not.toMatch(/proposed|Master 2 wiring|REC on BOOTH|BOOTH MONITOR (?:is|sets) the recording/i);
    expect(text).not.toMatch(/MASTER REC|USB backup|USB stick/);
    const hollow = drill('hollow');
    expect(copyOf(hollow).join(' ')).toMatch(/RCA lead from MASTER 2/);
    expect(hollow.steps[0]).toMatchObject({
      response: 'one stereo RCA lead, under 3 m',
      note: 'Nothing else goes in the lead.',
    });
    expect(branches(hollow).find((b) => b.finding === 'A splitter or an adapter')?.action).toBe(
      'Take it out, and use one RCA lead from MASTER 2.',
    );
    // An unbalanced RCA output cannot reverse a side: that takes an adapter on a balanced one.
    expect(hollow.why).toBe(
      'An adapter on BOOTH or MASTER 1 can record one side twice, one copy reversed, which sounds hollow. On MASTER 2, a loose or broken RCA lead loses a side.',
    );
  });

  it('checks the next recording after every F11 lead repair, with a handoff if the fault remains', () => {
    const hollow = drill('hollow');
    const recheck =
      hollow.steps.findIndex((step) => isLineStep(step) && step.challenge === 'Next recording, the day after') + 1;
    expect(recheck).toBeGreaterThan(1);
    for (const path of paths(hollow)) expect(path.at(-1), `F11: ${path.join(' → ')}`).toBe(recheck);
    const check = stepAt(hollow, recheck) as Step;
    expect(isLineStep(check) && check.response).toMatch(/both sides.*headphones/);
    expect(isLineStep(check) && check.note).toMatch(/still missing.*rig owner.*before use/);
  });
});

describe('drill copy follows the house style', () => {
  it('uses the printed names and the site’s words: MASTER meters, recording level, SD card, ATT setting', () => {
    const text = all.join(' ');
    expect(text).toMatch(/MASTER meters/);
    expect(text).not.toMatch(/middle meters?|record level|\bmemory card\b|subs and tops|the tops\b/i);
    expect(text).not.toMatch(/\byellow\b|\bTHD\b|\bcolor\b|\bnormaliz|\bplease\b|!/i);
    // "Hot" is jargon, and "trim" is only ever the TRIM knob.
    expect(text).not.toMatch(/\bhot(?:ter)?\b|\btrim(?:s|med)?\b/);
  });

  it('uses no idioms, no negative contractions and no “, so” chains', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/n’t\b|n't\b/);
      expect(text, text).not.toMatch(/, so\b/);
      expect(text, text).not.toMatch(
        /a notch|\bease\b|eased|on cue|for good|push .* home|louder yet|cut out|leave it for|room would jump|bits of gear|the extra\b/i,
      );
    }
  });

  it('writes conditions as “If …”, and asks the DJ its only question in quotes', () => {
    for (const text of all) if (text.includes('?')) expect(text, text).toBe('Is that loud enough?');
  });

  it('joins numbers to units with a no-break space, with true minus signs and curly quotes', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/\d (?:dB|dBu|dBV|dBFS|kW|m|seconds?|minutes?|hours?)\b/);
      expect(text, text).not.toMatch(/(^|[\s(])-\d/);
      expect(text, text).not.toMatch(/['"]/);
    }
  });
});
