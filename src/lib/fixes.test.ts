import { describe, expect, it } from 'vitest';
import {
  ATT_NOTE,
  CHANNEL_METERS_WORDS,
  FADER_DOWN,
  LEVEL_FALLBACK,
  MASTER_METERS_WORDS,
  OPEN_UTILITY,
  STORE_CHANGE,
} from './checklists';
import {
  allSteps,
  type Branch,
  drill,
  drillAnchor,
  F1_TURN_DOWN,
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
    f.warning ?? '',
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
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Every jump in a drill, with the step it's made from. */
const jumpsOf = (f: Fix): { from: number; next: Next }[] =>
  allSteps(f).flatMap((s, i) =>
    [...(isIfStep(s) ? [s.next] : []), ...branchesOf(s).map((b) => b.next)]
      .filter((next) => next !== undefined)
      .map((next) => ({ from: i + 1, next })),
  );

describe('the drills', () => {
  it('have unique ids that are safe in a link (/night/#fix-<id>), and keep the ones other pages link to', () => {
    const ids = FIXES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    // The crew box (rules.ts), the setup page and the chat link to these.
    for (const id of ['howler-red', 'not-loud', 'my-settings', 'power-cut', 'hum', 'hollow']) {
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
    expect(FIXES.filter((f) => f.where === 'recording').map((f) => f.id)).toEqual(['crunch', 'hum', 'hollow']);
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
    // 3.2 carries the recording-level table; the limiter myth answers F5.
    expect(['howler-red', 'driverack-clip', 'my-settings'].map((id) => drill(id).see)).toEqual([
      '#two-ceilings',
      '#two-ceilings',
      '#two-ceilings',
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
          expect(words(step.response), step.response).toBeLessThanOrEqual(8);
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

  it('jump only to a step or a drill that exists, and loop only back to a step that ends the loop', () => {
    const ids = new Set(FIXES.map((f) => f.id));
    for (const f of FIXES) {
      for (const { from, next } of jumpsOf(f)) {
        if (typeof next === 'number') {
          expect(next, `${f.id} step ${from}`).toBeGreaterThanOrEqual(1);
          expect(next, `${f.id} step ${from}`).toBeLessThanOrEqual(allSteps(f).length);
          expect(next, `${f.id} step ${from}`).not.toBe(from);
          // A jump back is a loop: the step it returns to has a finding that ends the drill.
          if (next < from) expect(branchesOf(stepAt(f, next) as Step).some((b) => b.end)).toBe(true);
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
    expect(branchesOf(meters as Step)).toEqual([
      { finding: 'Red', say: FADER_DOWN, end: true },
      { finding: 'Below red', next: 2 },
    ]);
    // Only the LEVEL light is F1's: the BATTERY light is red all the time the Howler charges (MK1 manual).
    expect(f1.condition).toBe('The LEVEL light blinks red. A steady red BATTERY light means the Howler is charging.');
  });

  it('tell the DJ the room may go quieter before the recording is turned down', () => {
    const f1 = drill('howler-red');
    const warned = stepAt(f1, F1_TURN_DOWN);
    // "May": Pioneer does not say whether MASTER ATT reaches MASTER 1, the room's socket (T2 finds out).
    expect(warned && isSayStep(warned) ? warned.say : '').toBe(
      'The room may go quieter for a few seconds. Keep your levels as they are.',
    );
    // F6 sends the crew to the same place, so the DJ always hears it first.
    const f6 = branches(drill('driverack-clip')).find((b) => b.finding === '+4 dBu');
    expect(f6?.next).toEqual({ drill: 'howler-red', step: F1_TURN_DOWN });
  });

  it('go straight to the last resort on a rig where T2 found MASTER ATT does not reach MASTER 2', () => {
    expect(stepAt(drill('howler-red'), 3)).toEqual({
      if: 'If the REC tape says MASTER ATT does not reach the Howler (T2)',
      next: 5,
    });
  });

  it('set MASTER ATT by value, one setting lower than it is, never higher, and store it', () => {
    const look = stepAt(drill('howler-red'), 4);
    expect(look && isDoStep(look) ? look.do : '').toBe('Look at MASTER ATT in UTILITY.');
    expect(look && !isIfStep(look) ? look.note : '').toBe(OPEN_UTILITY);
    // Pioneer p.31: "Press the rotary selector. The changed settings are stored."
    const store = 'Press the rotary selector. The changed settings are stored.';
    expect(STORE_CHANGE).toContain(`“${store}”`);
    expect(branchesOf(look as Step).map((b) => [b.finding, b.action, b.next])).toEqual([
      ['0 dB', `Set it to −6 dB. ${store}`, 6],
      ['−6 dB', `Set it to −12 dB. ${store}`, 6],
      ['−12 dB', undefined, 5],
    ]);
    expect(all.join(' ')).not.toMatch(/\bstep down\b|down a step|a step lower/i);
  });

  it('turn MASTER LEVEL down only as the last resort, with its cost said before the step', () => {
    const level = stepAt(drill('howler-red'), 5);
    expect(level).toEqual({
      before: LEVEL_FALLBACK.consequence,
      challenge: LEVEL_FALLBACK.challenge,
      response: LEVEL_FALLBACK.response,
    });
    // A channel can clip before its fader with the MASTER meters below red, so the why never calls the mix clean.
    expect(drill('howler-red').why).toBe(
      'If the MASTER meters are below red, a red LEVEL light means the recording level is too high. Pioneer does not say which sockets MASTER ATT reaches: T2 finds out.',
    );
    expect(all.join(' ')).not.toMatch(/mix is clean|crunch before|hides? a blend/i);
  });

  it('bring the room back at the amps only if it went quieter, never past the RIG marks', () => {
    const f1 = drill('howler-red');
    expect(stepAt(f1, 6)).toEqual({
      if: 'If the room went quieter',
      action: 'turn the four amp gain knobs back up, no higher than the RIG marks.',
    });
    expect(f1.later).toEqual({ when: 'At the changeover', steps: [{ challenge: 'REC tape', response: 're-marked' }] });
    // QSC publishes no dB per click, so no card says the knobs move by the same number of clicks.
    expect(all.join(' ')).not.toMatch(/same number of clicks/i);
  });

  it('agree between F1 and F7: a red light is fixed now, and the ATTs go back at the changeover', () => {
    const f7 = drill('my-settings');
    expect(f7.steps[0]).toMatchObject({ challenge: 'Howler LEVEL light', response: 'blinking green' });
    expect(branchesOf(f7.steps[0] as Step)).toEqual([
      { finding: 'Blinking green', next: 2 },
      { finding: 'Red', next: 'howler-red' },
    ]);
    expect(f7.later?.when).toBe('At the changeover');
    expect(f7.later?.steps[0]).toEqual({
      challenge: 'MASTER ATT and BOOTH ATT',
      response: 'as on the REC tape',
      note: ATT_NOTE,
    });
    // Pioneer: MY SETTINGS can call out UTILITY settings (p.31); what a stick carries, and which sockets MASTER
    // ATT reaches, are not published.
    expect(f7.why).toBe(
      'Pioneer says MY SETTINGS can call out UTILITY settings, and both ATTs are UTILITY settings (pp. 31–32). A change to MASTER ATT may change the room’s volume too: Pioneer does not say which sockets it reaches.',
    );
  });

  it('mute every output, flip the DriveRack’s switch at the changeover, then take the room back up at the amps', () => {
    const f6 = drill('driverack-clip');
    // dbx p.7: "+4dBu option (switch out)", "-10dBV option (switch in)".
    expect(stepAt(f6, 2)).toMatchObject({
      challenge: 'DriveRack input switch, on the back',
      response: '+4 dBu',
      note: 'Out is +4 dBu. Pushed in is −10 dBV.',
    });
    expect(f6.later?.when).toBe('At the changeover');
    const later = f6.later?.steps ?? [];
    expect(later.filter(isLineStep).map((s) => `${s.challenge} ${s.response}`)).toEqual([
      'DriveRack outputs every MUTE button on',
      'DriveRack input switch +4 dBu, out',
      'DriveRack outputs every MUTE button off',
    ]);
    expect(later[0]?.before).toBe('The room goes silent until step 5.');
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
    const f3 = drill('clip').steps[1];
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

  it('take the room up at the amps, a click at a time, and stop at the RIG marks', () => {
    const f4 = drill('not-loud');
    expect(f4.steps[0]).toMatchObject({ challenge: 'Amp gain knobs', response: 'one click up, all four' });
    const ends = branchesOf(f4.steps[0] as Step).filter((b) => b.end);
    expect(ends.map((b) => b.finding)).toEqual(['Already on the RIG marks', 'A red CLIP light on either amp']);
    // At the marks, the crew tell the DJ this is the room's limit.
    for (const b of ends) expect(b.say).toBe('That is the room’s limit.');
    expect(f4.steps.at(-1)).toEqual({ if: 'If the DJ still wants it louder', next: 1 });
    expect(copyOf(f4).join(' ')).not.toMatch(/MASTER LEVEL|TRIM|fully up/);
  });

  it('run a power cut in dbx’s order: amps off first, on last with no track playing, the Howler still recording', () => {
    const cut = drill('power-cut');
    expect(cut.steps[0]).toEqual({ challenge: 'Both amps', response: 'switched off' });
    // HSE GS50 §22: a tripped 30 mA RCD means a fault.
    expect(cut.steps.at(-1)).toEqual({
      if: 'If an RCD or breaker tripped',
      action: 'find the fault before you reset it.',
    });
    expect(cut.later?.when).toBe('When the power is back');
    const later = (cut.later?.steps ?? []).filter(isLineStep);
    expect(later[0]).toMatchObject({ challenge: 'XDJ-RX2 and DriveRack', response: 'switched on' });
    expect(later.find((s) => s.challenge === 'MASTER ATT and BOOTH ATT')?.note).toBe(ATT_NOTE);
    // dbx p.10: 10 seconds is for switching off; for switching on, no audio passing.
    expect(later.at(-1)).toEqual({ challenge: 'Both amps', response: 'switched on last, with no track playing' });
    expect(cut.why).toMatch(/^dbx says to switch the amps on last, with no audio playing, and off first \(p\. 10\)\./);
    expect(cut.why).toMatch(/The Howler MK1 records for about 30 hours/);
  });

  it('find a recording’s crunch by where its flat tops sit, without blaming the DJ for the track', () => {
    const [look, where, track] = drill('crunch').steps;
    // After the converters a clipped top ripples and leans.
    expect(look && !isIfStep(look) ? look.note : '').toBe('In the file, flat tops can ripple or lean a little.');
    expect(branchesOf(look as Step).map((b) => b.finding)).toEqual([
      'Flat tops at the top of the file',
      'Flat tops lower down',
      'No flat tops',
    ]);
    // The Howler clipping can hide the mixer clipping under it.
    expect(branchesOf(look as Step)[0]?.action).toMatch(/^The Howler clipped, and the mixer may have clipped too\./);
    expect(branchesOf(where as Step)).toEqual([
      { finding: 'On the blends', to: 'Tell that DJ:', say: MASTER_METERS_WORDS, end: true },
      { finding: 'All through one track', next: 3 },
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

  it('never cure hum by disconnecting an earth, and keep “Warning.” for that one hazard to people', () => {
    const hum = drill('hum');
    // An audio transformer, a ground-loop isolator, never a mains one. Only T2's fixed attenuator may share the lead.
    expect(hum.steps[0]).toEqual({
      challenge: 'Audio isolation transformer',
      response: 'on the Howler’s lead',
      note: 'It is a ground-loop isolator for RCA leads, never a mains isolating transformer. The lead stays under 3\u00a0m, with nothing else in it but the fixed attenuator from T2.',
    });
    // UK wording: the ways an earth goes missing here, and what the earth does.
    expect(hum.warning).toBe(
      'Never disconnect a mains earth. Do not use an earth-lift adapter, a two-core extension lead or a plug with its earth wire off. Do not tape over or cut an earth pin. If a fault makes a case live, the earth lets the fuse or RCD cut the power.',
    );
    expect(FIXES.filter((f) => f.warning).map((f) => f.id)).toEqual(['hum']);
    // The DriveRack's switch, named as printed (dbx p.6), lifts only pin 1 of its XLR inputs (p.7).
    expect(copyOf(hum).join(' ')).toMatch(/press in the DriveRack’s PIN 1 LIFT switch, with its outputs muted\./);
    expect(copyOf(hum).join(' ')).toMatch(/It lifts only pin 1 of its XLR inputs, never the mains earth/);
    // The lead first, then the supply, all of it on one distribution board and never one strip for both amps.
    expect(
      allSteps(hum)
        .filter(isIfStep)
        .map((s) => s.if),
    ).toEqual(['If it is only on one side or it crackles', 'If the hum is still there', 'If the PA hums too']);
    expect(all.join(' ')).not.toMatch(/GROUND LIFT|ground-lift|one power strip|if the load allows/i);
    expect(all.join(' ')).not.toMatch(/\bcaution\b/i);
  });

  it('keep the Howler on MASTER 2, RCA to RCA, with only the audio transformer or T2’s attenuator in its lead', () => {
    const text = all.join(' ');
    expect(text).not.toMatch(/proposed|Master 2 wiring|REC on BOOTH|BOOTH MONITOR (?:is|sets) the recording/i);
    expect(text).not.toMatch(/MASTER REC|USB backup|USB stick/);
    const hollow = drill('hollow');
    expect(copyOf(hollow).join(' ')).toMatch(/RCA lead from MASTER 2/);
    expect(hollow.steps[0]).toMatchObject({
      response: 'one stereo RCA lead, under 3 m',
      note: 'Nothing goes in it except an audio isolation transformer if F10 found hum, or the fixed attenuator from T2.',
    });
    expect(branches(hollow).find((b) => b.finding === 'A splitter or an adapter')?.action).toBe(
      'Take it out, and use one RCA lead from MASTER 2. The audio isolation transformer and the fixed attenuator can stay.',
    );
    // An unbalanced RCA output cannot reverse a side: that takes an adapter on a balanced one.
    expect(hollow.why).toBe(
      'An adapter on BOOTH or MASTER 1 can record one side twice, one copy reversed, which sounds hollow. On MASTER 2, a loose or broken RCA lead loses a side.',
    );
  });
});

describe('drill copy follows the house style', () => {
  it('keeps every sentence to 20 words or fewer', () => {
    for (const text of all) for (const s of sentences(text)) expect(words(s), s).toBeLessThanOrEqual(20);
  });

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
