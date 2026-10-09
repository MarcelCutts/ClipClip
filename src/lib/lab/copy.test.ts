import { describe, expect, it } from 'vitest';
import { KICKS_TOGETHER_DB } from '../model';
import { DJ_RULES } from '../rules';
import { section } from '../sections';
import { METER_SEGMENTS } from '../xdj';
import { CHANNELS, goalMet, KNOB, labSignal, type Reading, readLab, STEP_COUNT, STEP_SETUP } from './ceilings';
import * as copy from './copy';

const track = labSignal();
const at = (channels: number, knob: number): Reading => readLab(track, channels, knob);
const START = STEP_SETUP[1].start;
const spaces = (text: string) => text.replace(/ /g, ' ');

/** Every reading worth describing: each combination of stage states the lab can reach. */
const READINGS = [
  at(18, -9),
  at(18, -12),
  at(18, 0),
  at(18, -6),
  at(9, 0),
  at(9, -3),
  at(12, -12),
  at(3, -9),
  at(-6, -24),
];

/** The two questions the lab puts to the reader: the only text with a question mark. */
const LEGENDS = [copy.QUESTIONS.light.legend, copy.QUESTIONS.knob.legend];

/** Every string the lab can show, in every state, but its two questions. */
function allText(): string[] {
  const texts: string[] = [
    ...Object.values(copy.STEPS).flatMap((s) => [s.title, s.body]),
    ...Object.values(copy.SOUND),
    ...Object.values(copy.CONTROLS).flatMap((c) => Object.values(c)),
    ...Object.values(copy.NAV),
    ...Object.values(copy.READOUTS),
    ...Object.values(copy.CRUNCH_WORDS),
    ...Object.values(copy.HOWLER_WORDS).map((h) => h.state),
    copy.STAGES.label,
    ...[copy.STAGES.mixer, copy.STAGES.howler].flatMap((s) => [s.name, s.ceiling]),
    copy.STAGES.file.name,
    copy.STAGES.file.note,
    ...Object.values(copy.QUESTIONS.light.choices),
    ...Object.values(copy.QUESTIONS.knob.choices),
    copy.QUESTIONS.skip,
    copy.QUESTIONS.covered,
    copy.TRY,
    copy.LIGHT_NOTE,
    copy.SUMMARY.title,
    ...copy.SUMMARY.lines,
    copy.SCOPES.mixer,
    copy.SCOPES.howler,
    copy.SCOPES.before,
    copy.SCOPES.zoom,
    copy.SCOPES.scale,
    ...Object.values(copy.SCOPES.legend),
    copy.MODEL_NOTE.text,
    copy.MODEL_NOTE.link,
    copy.NO_SCRIPT,
  ];
  for (const r of READINGS) {
    texts.push(
      copy.stateSentence(r),
      copy.howlerMeaning(r),
      copy.fileOrigin(r),
      ...Object.values(copy.scopeClaims(r)),
      copy.moveSentence(-6, r),
      copy.moveSentence(3, r),
    );
    for (const step of [3, 4] as const) {
      const s = copy.successFeedback(step, r);
      if (s) texts.push(s.title, ...s.lines, s.next ?? '');
    }
  }
  for (const guess of ['green', 'red', null] as const) {
    const a = copy.answerFeedback(guess, at(START.channels, START.knob));
    texts.push(a.title, ...a.lines, a.next ?? '');
  }
  for (const said of ['yes', 'no', null] as const) {
    const r = copy.revealFeedback(said);
    texts.push(r.title, ...r.lines, r.next ?? '');
  }
  return texts.filter(Boolean);
}

const sentences = (text: string) => text.split(/(?<=[.?])\s+/);

describe('house style', () => {
  it('uses short sentences, no exclamations, no em dashes and no please', () => {
    for (const text of [...allText(), ...LEGENDS]) {
      expect(text, text).not.toMatch(/[!—]|please/i);
      for (const sentence of sentences(text)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20);
      }
    }
  });

  it('says things plainly: no question-and-answer lead-ins, no two-beat slogans, no colon slogans', () => {
    for (const text of allText()) {
      // "Want to hear the crunch first? Press Listen."
      expect(text, text).not.toMatch(/\?/);
      // "X. Not Y."
      expect(text, text).not.toMatch(/\. Not [a-z]/);
      // A short label, a colon, then the point. "Next: …" keys name the step they lead to.
      if (!text.startsWith('Next: ')) expect(text, text).not.toMatch(/^[^:.]{1,16}: [a-z]/);
    }
  });

  it('asks two questions, for the reader to answer, and answers each only once they have', () => {
    // Questions put to the reader, as the meter check's are. Neither is a lead-in: nothing follows it.
    expect(copy.QUESTIONS.light.legend).toBe('What colour is the Howler’s LEVEL light?');
    expect(copy.QUESTIONS.knob.legend).toBe('Can the recording level remove the crunch?');
    for (const legend of LEGENDS) expect(legend.match(/\?/g)).toHaveLength(1);
    expect(Object.keys(copy.QUESTIONS.light.choices)).toEqual(['green', 'red']);
    expect(Object.keys(copy.QUESTIONS.knob.choices)).toEqual(['yes', 'no']);
    // Nothing the reader sees before answering says which: not the step, not the covered screen.
    for (const text of [copy.STEPS[1].title, copy.STEPS[1].body, copy.QUESTIONS.covered, copy.QUESTIONS.skip]) {
      expect(text, text).not.toMatch(/green|\bred light|under its|clear/i);
    }
    for (const text of [copy.STEPS[2].title, copy.STEPS[2].body, copy.QUESTIONS.skip]) {
      expect(text, text).not.toMatch(/cannot|still flat|stay flat|smaller/i);
    }
  });

  it('writes like a reference: no ", so" chains, no negative contractions, no tutor’s asides', () => {
    for (const text of [...allText(), ...LEGENDS]) {
      expect(text, text).not.toMatch(/, so\b/);
      expect(text, text).not.toMatch(/n’t\b/);
      expect(text, text).not.toMatch(
        /\bremember\b|\bfor real\b|\bfor the curious\b|\bguess\b|\bpredict|\bwell done\b/i,
      );
    }
  });

  it('uses curly apostrophes and the typographic minus', () => {
    for (const text of [...allText(), ...LEGENDS]) {
      expect(text, text).not.toMatch(/['"]/);
      expect(text, text).not.toMatch(/(^|\s)-\d/);
    }
  });

  it('keeps numbers and their units together', () => {
    for (const text of allText()) expect(text, text).not.toMatch(/\d[ {3}](dB|Hz|kHz|%)/);
  });

  it('never points up or down the page: each stage carries its own words', () => {
    for (const text of allText()) expect(text, text).not.toMatch(/\b(below|above)\b/i);
  });

  it('points to the guide’s one home for what the makers leave out, and states the gap only there', () => {
    // Pioneer says only that red "may" distort, and Howler publishes no maximum input level: both ceilings
    // are assumptions (model.ts).
    const makers = section('red-top');
    expect(copy.MODEL_NOTE).toEqual({
      text: 'Where each ceiling sits is an assumption.',
      link: `See ${makers.number}`,
      href: `#${makers.id}`,
    });
    expect(allText().filter((t) => /publish|assum/i.test(t))).toEqual([copy.MODEL_NOTE.text]);
  });
});

describe('the words the guide uses', () => {
  it('calls the knob the recording level, and never names the mixer’s own output controls', () => {
    expect(copy.CONTROLS.knob.label).toBe('Recording level');
    // On the rig the recording level is MASTER LEVEL, set at soundcheck. The lab folds whatever sets the level
    // into one knob, and never has to explain which.
    const all = `${JSON.stringify(copy)} ${allText().join(' ')}`;
    expect(all).not.toMatch(/MASTER LEVEL|MASTER ATT|UTILITY|BOOTH|\brecord level\b|middle meters/);
  });

  it('names each ceiling by whose it is, never by a number to be looked up', () => {
    expect(copy.STAGES.mixer.ceiling).toBe('Mixer’s ceiling');
    expect(copy.STAGES.howler.ceiling).toBe('Howler’s ceiling');
    for (const text of allText()) expect(text, text).not.toMatch(/ceiling\s[12]\b/i);
  });

  it('reuses the DJ rule’s own words for where a channel should peak', () => {
    const line = spaces(copy.successFeedback(3, at(9, START.knob))!.lines.join(' '));
    expect(DJ_RULES.some((r) => line.includes(r.response))).toBe(true);
  });
});

describe('the file', () => {
  it('says where its crunch was made, and how much was cut, in dB', () => {
    expect(spaces(copy.fileOrigin(at(18, -9)))).toBe('Made in the mixer. Tops cut by 6 dB.');
    expect(spaces(copy.fileOrigin(at(9, 0)))).toBe('Made at the Howler. Tops cut by 3 dB.');
    expect(spaces(copy.fileOrigin(at(18, 0)))).toBe('Made in the mixer and at the Howler. Tops cut by 12 dB in all.');
    expect(copy.fileOrigin(at(3, -9))).toBe('Nothing was cut.');
    // Touching a ceiling cuts nothing yet.
    expect(copy.fileOrigin(at(12, -12))).toBe('Nothing was cut.');
    expect(copy.fileOrigin(at(9, -3))).toBe('Nothing was cut.');
  });

  it('keeps the same cut whatever the recording level does to crunch made in the mixer', () => {
    for (let knob = KNOB.min; knob <= -6; knob++) {
      expect(spaces(copy.fileOrigin(at(18, knob))), `knob ${knob}`).toBe('Made in the mixer. Tops cut by 6 dB.');
    }
  });

  it('names crunch and never grades it: nothing published says how much is heavy', () => {
    expect(copy.CRUNCH_WORDS).toEqual({ clean: 'Clean', tips: 'Tips cut', crunch: 'Crunchy' });
    for (const text of allText()) expect(text, text).not.toMatch(/\b(heavy|mild|slight|severe|some) crunch/i);
  });
});

describe('the Howler’s light', () => {
  it('is never called OK, fine or good: it says what it measures, the level into the Howler', () => {
    for (const text of allText()) expect(text, text).not.toMatch(/\bOK\b|\bokay\b|\bfine\b|\bgood\b/i);
    expect(copy.HOWLER_WORDS).toEqual({ green: { state: 'Blinking green' }, red: { state: 'Blinking red' } });
    expect(spaces(copy.howlerMeaning(at(18, -9)))).toBe('Input 3 dB under its ceiling');
    expect(spaces(copy.howlerMeaning(at(18, -24)))).toBe('Input 18 dB under its ceiling');
    expect(copy.howlerMeaning(at(18, -6))).toBe('Input at its ceiling');
    expect(spaces(copy.howlerMeaning(at(18, 0)))).toBe('Input 6 dB over its ceiling');
    expect(spaces(copy.howlerMeaning(at(9, 0)))).toBe('Input 3 dB over its ceiling');
  });

  it('says what it leaves out', () => {
    expect(copy.LIGHT_NOTE).toBe('It does not show crunch made before it.');
  });

  it('follows the recording level, and says nothing of the crunch', () => {
    for (let knob = KNOB.min; knob <= KNOB.max; knob++) {
      expect(copy.howlerMeaning(at(18, knob)), `knob ${knob}`).not.toMatch(/crunch|clean|clip/i);
    }
  });
});

describe('the state sentence', () => {
  it('names where the clipping happened', () => {
    expect(copy.stateSentence(at(18, -12))).toBe('Clipped in the mixer.');
    expect(copy.stateSentence(at(18, 0))).toMatch(/^Clipped in the mixer and at the Howler’s input\./);
    expect(copy.stateSentence(at(18, -6))).toMatch(
      /^Clipped in the mixer\. The flat tops touch the Howler’s ceiling\./,
    );
    expect(copy.stateSentence(at(9, 0))).toBe('Clipped at the Howler’s input.');
    expect(copy.stateSentence(at(9, -3))).toMatch(/^Touching the Howler’s ceiling\./);
    expect(copy.stateSentence(at(12, -12))).toMatch(/^Touching the red\./);
    expect(copy.stateSentence(at(3, -9))).toBe('Clean at both ceilings.');
  });

  it('gives nothing away in step 2: it says where, not what the recording level can do', () => {
    for (let knob = KNOB.min; knob <= KNOB.max; knob++) {
      expect(copy.stateSentence(at(18, knob))).not.toMatch(/recording level|quieter|fix/i);
    }
  });
});

describe('the scope lines', () => {
  it('say what each screen shows', () => {
    expect(copy.scopeClaims(at(18, -12)).mixer).toMatch(/cut flat/);
    expect(copy.scopeClaims(at(12, -12)).mixer).toMatch(/just touch the mixer’s ceiling/);
    expect(copy.scopeClaims(at(3, -9)).mixer).toMatch(/fits under the mixer’s ceiling/);
    expect(copy.scopeClaims(at(18, 0)).howler).toMatch(/again/);
    expect(copy.scopeClaims(at(9, 0)).howler).toMatch(/pass the Howler’s ceiling and are cut flat/);
    expect(copy.scopeClaims(at(9, -3)).howler).toMatch(/just touch the Howler’s ceiling/);
    expect(copy.scopeClaims(at(3, -9)).howler).toMatch(/fits under the Howler’s ceiling/);
  });

  it('say of flat tops from the mixer that they arrive the same, made smaller', () => {
    for (const knob of [-9, -12, -18, -24]) {
      expect(copy.scopeClaims(at(18, knob)).howler).toBe(
        'The same flat tops, made smaller. They fit under the Howler’s ceiling.',
      );
    }
  });
});

describe('the steps', () => {
  it('opens on the channel in the red and the recording level turned down, in numbers', () => {
    expect(spaces(copy.STEPS[1].body)).toBe(
      'CH1 peaks 6 dB past the red, and the mixer cuts its tops flat. The recording level is 9 dB down.',
    );
  });

  it('asks for the reader’s view of the recording level in step 2, then for a try', () => {
    expect(copy.STEPS[2].body).toBe(
      'The crunch was made in the mixer. Say what you expect of the recording level, then try it.',
    );
    expect(copy.TRY).toBe('Try it. Turn the recording level down, then up.');
  });

  it('ends step 3 on what can be seen beside the channel: the red light dark and the flat tops gone', () => {
    expect(copy.STEPS[3].body).toBe('Turn the channel down until CH1’s red light is dark and the flat tops are gone.');
    // That is all step 3 checks: at the step's recording level, the light is green once they are.
    for (let channels = CHANNELS.min; channels <= CHANNELS.max; channels++) {
      const r = at(channels, STEP_SETUP[3].start.knob);
      expect(goalMet(3, r), `channels ${channels}`).toBe(r.mixer === 'clear' && r.crunch === 'clean');
    }
  });

  it('says in step 4 that Howler puts the mixer first, and that this step shows the other case', () => {
    expect(copy.STEPS[4].body).toMatch(/Howler says the mixer distorts first\. Here the Howler does\.$/);
  });

  it('never calls the top orange light fine, or holds it up as the channel’s level', () => {
    for (const s of Object.values(copy.STEPS)) expect(s.body).not.toMatch(/fine|out of the red/);
    // Step 4 opens on the top orange: its words are about the mixer’s ceiling, not the channel.
    expect(copy.STEPS[4].body).toMatch(/^The mixer is clean\./);
  });

  it('counts the steps in words', () => {
    expect(copy.stepCounter(2, STEP_COUNT)).toBe('Step 2 of 4');
  });
});

describe('readouts', () => {
  it('puts the channel meter into words beside its lights', () => {
    expect(copy.levelWords(18)).toBe('In the red');
    expect(copy.levelWords(12)).toBe('In the red');
    expect(copy.levelWords(3)).toBe('In the orange');
    expect(copy.levelWords(-6)).toBe('In the green');
  });

  it('says what works without sound, and gives the lesson where the question cannot be asked', () => {
    expect(copy.SOUND.unavailable).toBe(
      'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
    );
    expect(copy.NO_SCRIPT).toMatch(/^The lab needs JavaScript to move\./);
    expect(copy.NO_SCRIPT).toMatch(/The light is green, and the file is crunchy\./);
  });
});

describe('feedback', () => {
  const start = at(START.channels, START.knob);

  it('says back what the reader said, then what is so', () => {
    expect(copy.answerFeedback('green', start).title).toBe('You said green. It is green');
    expect(copy.answerFeedback('red', start).title).toBe('You said red. It is green');
    expect(copy.answerFeedback(null, start).title).toBe('It is green');
  });

  it('says the light is right, then gives the cause in the order it happens, in three lines', () => {
    const lines = copy.answerFeedback('red', start).lines.map(spaces);
    expect(lines).toEqual([
      'The light is right. The level into the Howler is 3 dB under its ceiling.',
      'The mixer cut the tops flat, and CH1’s red light showed it. The recording level then made the wave smaller.',
      'A green light does not mean a clean recording.',
    ]);
    // The same reason whether the answer was right, wrong or not given.
    expect(copy.answerFeedback('green', start).lines).toEqual(copy.answerFeedback('red', start).lines);
    expect(copy.answerFeedback(null, start).next).toBe(`Next: ${copy.STEPS[2].title.toLowerCase()}`);
  });

  it('gives the same distance from the Howler’s ceiling as the light’s own reading, whatever the reading', () => {
    for (const r of [start, at(18, -6), at(18, 0), at(9, 0)]) {
      const said = copy.answerFeedback('red', r).lines[0];
      expect(said, said).toBe(`The light is right. The level into the Howler is ${copy.marginWords(r)}.`);
      expect(copy.howlerMeaning(r)).toBe(`Input ${copy.marginWords(r)}`);
    }
    expect(spaces(copy.marginWords(at(18, -6)))).toBe('at its ceiling');
    expect(spaces(copy.marginWords(at(18, 0)))).toBe('6 dB over its ceiling');
  });

  it('answers each try in step 2 at once, with what it did to the flat tops', () => {
    expect(spaces(copy.moveSentence(-6, at(18, -15)))).toBe(
      'You turned it down 6 dB. The flat tops are smaller. They are still flat.',
    );
    expect(spaces(copy.moveSentence(3, at(18, -12)))).toBe(
      'You turned it up 3 dB. The flat tops are bigger. They are still flat.',
    );
    expect(spaces(copy.moveSentence(12, at(18, -3)))).toBe(
      'You turned it up 12 dB. The flat tops pass the Howler’s ceiling as well, and the LEVEL light is red.',
    );
    expect(spaces(copy.moveSentence(3, at(18, -6)))).toBe(
      'You turned it up 3 dB. The flat tops touch the Howler’s ceiling, and the LEVEL light is red.',
    );
  });

  it('ends step 2 on its answer, said back, with a way on to the channel', () => {
    expect(copy.revealFeedback('yes').title).toBe('You said yes. It cannot');
    expect(copy.revealFeedback('no').title).toBe('You said no. It cannot');
    expect(copy.revealFeedback(null).title).toBe('It cannot remove the crunch');
    const { lines, next } = copy.revealFeedback('yes');
    expect(lines).toEqual([
      'The recording level comes after the mixer’s ceiling. It makes the flat tops smaller or bigger. They stay flat.',
      'The LEVEL light follows the recording level. The crunch does not.',
    ]);
    expect(copy.revealFeedback(null).lines).toEqual(lines);
    expect(next).toBe(`Next: ${copy.STEPS[3].title.toLowerCase()}`);
  });

  it('keeps every answer to three lines at most', () => {
    const start = at(START.channels, START.knob);
    const all = [
      copy.answerFeedback('red', start),
      copy.revealFeedback('yes'),
      ...READINGS.flatMap((r) => [copy.successFeedback(3, r), copy.successFeedback(4, r)]),
    ];
    for (const f of all) if (f) expect(f.lines.length, f.title).toBeLessThanOrEqual(3);
  });

  it('counts a blend as two more lights, the gap the model puts between kicks and their blend', () => {
    const orange = METER_SEGMENTS.filter((s) => s.zone !== 'green').map((s) => s.db);
    expect(orange[2]! - orange[0]!).toBe(KICKS_TOGETHER_DB);
  });

  it('never lets one track out of the red pass for a safe blend', () => {
    for (let channels = -6; channels <= 11; channels++) {
      const r = at(channels, STEP_SETUP[3].start.knob);
      expect(goalMet(3, r), `channels ${channels}`).toBe(true);
      const text = spaces(copy.successFeedback(3, r)!.lines.join(' '));
      // A blend lands up to KICKS_TOGETHER_DB higher: from +6 it can reach the red light, and from
      // +3 the MASTER meters' top orange, which the DJ box keeps dark. Lower, there is room, and
      // the lab says nothing more of blends.
      if (channels + KICKS_TOGETHER_DB >= 12) expect(text).toMatch(/reach the red\. Keep CH1 on the first orange/);
      else if (channels + KICKS_TOGETHER_DB >= 9)
        expect(text).toMatch(/reach the top orange on the MASTER meters\. Keep CH1 on the first orange/);
      else expect(text, `channels ${channels}`).not.toMatch(/blend/);
    }
  });

  it('names the tips cut on the first dB over, and crunch from the second', () => {
    expect(at(13, -12).crunch).toBe('tips');
    expect(at(14, -12).crunch).toBe('crunch');
  });

  it('says of the last step that the light showed this crunch, in Howler’s own words, and ends the lab', () => {
    expect(copy.successFeedback(4, at(9, -4))!.lines.at(-1)).toMatch(/close to the top/);
    // A green light with no room for a blend is only the overload stopped, not the job done.
    expect(copy.successFeedback(4, at(9, -4))!.title).toBe('Overload stopped');
    expect(copy.successFeedback(4, at(9, -12))!.title).toBe('Fixed with the recording level');
    expect(copy.successFeedback(4, at(9, -12))!.lines).toEqual([
      'The recording level comes before the Howler’s ceiling. Crunch made at the Howler is fixed with it.',
      'The LEVEL light showed this crunch. In Howler’s manual, red “means your volume is too high”.',
    ]);
    expect(copy.successFeedback(4, at(9, -12))!.next).toBeNull();
    expect(copy.successFeedback(1, at(9, -12))).toBeNull();
    expect(copy.successFeedback(2, at(9, -12))).toBeNull();
  });

  it('closes on the two ceilings side by side: each light, what fixes what it shows, and both to check', () => {
    expect(copy.SUMMARY.title).toBe('Each light watches its own ceiling');
    expect(copy.SUMMARY.lines).toHaveLength(3);
    expect(copy.SUMMARY.lines[0]).toMatch(/^CH1’s red light .* Only the channel fixes it\.$/);
    expect(copy.SUMMARY.lines[1]).toMatch(/^The Howler’s LEVEL light .* The recording level fixes it\.$/);
    expect(copy.SUMMARY.lines[2]).toBe('For a clean recording, check both.');
  });
});
