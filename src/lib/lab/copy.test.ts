import { describe, expect, it } from 'vitest';
import { KICKS_TOGETHER_DB } from '../model';
import { DJ_RULES } from '../rules';
import { section } from '../sections';
import { METER_SEGMENTS } from '../xdj';
import { goalMet, KNOB, labSignal, type Reading, readLab, STEP_SETUP } from './ceilings';
import * as copy from './copy';

const track = labSignal();
const at = (channels: number, knob: number): Reading => readLab(track, channels, knob);

/** Every reading worth describing: each combination of stage states the lab can reach. */
const READINGS = [at(18, -12), at(18, 0), at(18, -6), at(9, 0), at(9, -3), at(12, -12), at(3, -9), at(-6, -24)];

/** Every string the lab can show, in every state. */
function allText(): string[] {
  const texts: string[] = [
    ...Object.values(copy.STEPS).flatMap((s) => [s.title, s.body]),
    ...Object.values(copy.SOUND),
    ...Object.values(copy.CONTROLS).flatMap((c) => Object.values(c)),
    ...Object.values(copy.STAGE_WORDS),
    ...Object.values(copy.NAV),
    ...Object.values(copy.READOUTS),
    ...Object.values(copy.CRUNCH_WORDS),
    ...Object.values(copy.HOWLER_WORDS).flatMap((h) => [h.state, h.meaning]),
    copy.CHAIN.label,
    copy.CHAIN.knob.name,
    copy.SCOPES.zoom,
    ...Object.values(copy.SCOPES.legend),
    copy.MODEL_NOTE.text,
    copy.MODEL_NOTE.link,
    copy.NO_SCRIPT,
  ];
  for (const r of READINGS) {
    texts.push(copy.stateSentence(r));
    for (const teach of [true, false]) texts.push(...Object.values(copy.scopeClaims(r, teach)));
    const reveal = copy.revealFeedback(r);
    texts.push(reveal.title, ...reveal.lines);
    for (const step of [2, 3] as const) {
      const s = copy.successFeedback(step, r);
      if (s) texts.push(s.title, ...s.lines, s.next ?? '');
    }
  }
  return texts.filter(Boolean);
}

const sentences = (text: string) => text.split(/(?<=[.?])\s+/);

describe('house style', () => {
  it('uses short sentences, no exclamations, no em dashes and no please', () => {
    for (const text of allText()) {
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

  it('writes like a reference: no ", so" chains, no negative contractions, no tutor’s asides', () => {
    for (const text of allText()) {
      expect(text, text).not.toMatch(/, so\b/);
      expect(text, text).not.toMatch(/n’t\b/);
      expect(text, text).not.toMatch(/\bremember\b|\bfor real\b|\bfor the curious\b|\bguess\b|\bpredict/i);
    }
  });

  it('uses curly apostrophes and the typographic minus', () => {
    for (const text of allText()) {
      expect(text, text).not.toMatch(/['"]/);
      expect(text, text).not.toMatch(/(^|\s)-\d/);
    }
  });

  it('keeps numbers and their units together', () => {
    for (const text of allText()) expect(text, text).not.toMatch(/\d[   ](dB|Hz|kHz|%)/);
  });

  it('never points up or down the page: each step carries its own keys', () => {
    // "Below ceiling 2" is a place on a screen, not on the page.
    for (const text of allText()) expect(text, text).not.toMatch(/\b(below|above)\b(?! ceiling)/i);
  });

  it('points to the guide’s one home for what the makers leave out, and states the gap only there', () => {
    // Howler publishes no maximum input level, so ceiling 2 is an assumption (model.ts).
    const makers = section('red-top');
    expect(copy.MODEL_NOTE).toEqual({
      text: 'Ceiling 2 is an assumption.',
      link: `See ${makers.number}`,
      href: `#${makers.id}`,
    });
    expect(allText().filter((t) => /publish|assum/i.test(t))).toEqual([copy.MODEL_NOTE.text]);
  });
});

describe('the words the guide uses', () => {
  it('calls the knob the recording level, and never names the knobs taped on the night', () => {
    expect(copy.CONTROLS.knob.label).toBe('Recording level');
    expect(copy.CHAIN.knob).toEqual({ name: 'Recording level' });
    // MASTER LEVEL stays taped fully up, so the lab never turns it, and never has to explain why.
    const all = `${JSON.stringify(copy)} ${allText().join(' ')}`;
    expect(all).not.toMatch(/MASTER LEVEL|MASTER ATT|UTILITY|BOOTH|\brecord level\b|middle meters/);
  });

  it('reuses the DJ rule’s own words for where a channel should peak', () => {
    const line = copy
      .successFeedback(2, at(9, -12))!
      .lines.join(' ')
      .replace(/\u00a0/g, ' ');
    expect(DJ_RULES.some((r) => line.includes(r.response))).toBe(true);
  });
});

describe('the state sentence', () => {
  it('names where the clipping happened', () => {
    expect(copy.stateSentence(at(18, -12))).toBe('Clipped in the mixer.');
    expect(copy.stateSentence(at(18, 0))).toMatch(/^Clipped in the mixer and at the Howler’s input\./);
    expect(copy.stateSentence(at(18, -6))).toMatch(/^Clipped in the mixer\. The flat tops touch the Howler’s limit\./);
    expect(copy.stateSentence(at(9, 0))).toBe('Clipped at the Howler’s input.');
    expect(copy.stateSentence(at(9, -3))).toMatch(/^Touching the Howler’s limit\./);
    expect(copy.stateSentence(at(12, -12))).toMatch(/^Touching the red\./);
    expect(copy.stateSentence(at(3, -9))).toBe('Clean at both ceilings.');
  });

  it('gives nothing away in step 1: it says where, not what the recording level can do', () => {
    for (let knob = KNOB.min; knob <= KNOB.max; knob++) {
      expect(copy.stateSentence(at(18, knob))).not.toMatch(/recording level|quieter|fix/i);
    }
  });
});

describe('the scope lines', () => {
  it('say what each screen shows', () => {
    expect(copy.scopeClaims(at(18, -12)).mixer).toMatch(/cut flat/);
    expect(copy.scopeClaims(at(12, -12)).mixer).toMatch(/just touch ceiling 1/);
    expect(copy.scopeClaims(at(3, -9)).mixer).toMatch(/fits under ceiling 1/);
    expect(copy.scopeClaims(at(18, 0)).recording).toMatch(/again/);
    expect(copy.scopeClaims(at(9, 0)).recording).toMatch(/cut flat at ceiling 2/);
    expect(copy.scopeClaims(at(9, -3)).recording).toMatch(/just touch ceiling 2/);
    expect(copy.scopeClaims(at(3, -9), false)).toEqual(copy.scopeClaims(at(3, -9), true));
  });

  it('keep back where the recording’s flat tops came from until step 1 is over', () => {
    for (const knob of [-12, -18, -24]) {
      expect(copy.scopeClaims(at(18, knob), false).recording).not.toMatch(/mixer|level/i);
      expect(copy.scopeClaims(at(18, knob), true).recording).toMatch(/cut in the mixer/);
    }
  });
});

describe('the steps', () => {
  it('asks for the recording level by name in step 1, with the channel locked in the red', () => {
    expect(copy.STEPS[1].body).toBe(
      'The channel is locked in the red. Try to remove the crunch with the recording level.',
    );
  });

  it('asks for everything step 2 checks: Clean, the red light dark and the Howler green', () => {
    expect(copy.STEPS[2].body).toMatch(/Clean/);
    expect(copy.STEPS[2].body).toMatch(/red light is dark/);
    expect(copy.STEPS[2].body).toMatch(/LEVEL light is green/);
  });

  it('never calls the top orange light fine, or holds it up as the channel’s level', () => {
    for (const s of Object.values(copy.STEPS)) expect(s.body).not.toMatch(/fine|out of the red/);
    // Step 3 opens on the top orange: its words are about the mixer’s ceiling, not the channel.
    expect(copy.STEPS[3].body).toMatch(/^The mixer is clean\./);
  });

  it('counts the steps in words', () => {
    expect(copy.stepCounter(2, 3)).toBe('Step 2 of 3');
  });
});

describe('readouts', () => {
  it('puts the channel meter into words beside its lights', () => {
    expect(copy.levelWords(18)).toBe('In the red');
    expect(copy.levelWords(12)).toBe('In the red');
    expect(copy.levelWords(3)).toBe('In the orange');
    expect(copy.levelWords(-6)).toBe('In the green');
  });

  it('names the Howler’s light by what it does, and says what works without sound', () => {
    expect(copy.HOWLER_WORDS.red).toEqual({ state: 'Blinking red', meaning: 'Level too high' });
    expect(copy.SOUND.unavailable).toBe(
      'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
    );
  });
});

describe('feedback', () => {
  it('ends step 1 on what happened, with a way on to the channel', () => {
    const reveal = copy.revealFeedback(at(18, -12));
    expect(reveal.title).toBe('The crunch is still there');
    expect(reveal.lines[0]).toMatch(/^The recording level comes after the mixer’s ceiling\./);
    expect(reveal.next).toBe(`Next: ${copy.STEPS[2].title.toLowerCase()}`);
  });

  it('points out the green LEVEL light only when it is green', () => {
    expect(copy.revealFeedback(at(18, -12)).lines.join(' ')).toMatch(/LEVEL light stayed green/);
    expect(copy.revealFeedback(at(18, 0)).lines.join(' ')).not.toMatch(/stayed green/);
  });

  it('counts a blend as two more lights, the gap the model puts between kicks and their blend', () => {
    const orange = METER_SEGMENTS.filter((s) => s.zone !== 'green').map((s) => s.db);
    expect(orange[2]! - orange[0]!).toBe(KICKS_TOGETHER_DB);
  });

  it('never lets one track out of the red pass for a safe blend', () => {
    for (let channels = -6; channels <= 11; channels++) {
      const r = at(channels, STEP_SETUP[2].start.knob);
      expect(goalMet(2, r), `channels ${channels}`).toBe(true);
      const text = copy
        .successFeedback(2, r)!
        .lines.join(' ')
        .replace(/\u00a0/g, ' ');
      expect(text, `channels ${channels}`).toMatch(/A blend can add up to two more lights/);
      // A blend lands up to KICKS_TOGETHER_DB higher: from +6 it can reach the red light, and from
      // +3 the MASTER meters' top orange, which the DJ box keeps dark.
      if (channels + KICKS_TOGETHER_DB >= 12) expect(text).toMatch(/reach the red\. Keep CH1 on the first orange/);
      else if (channels + KICKS_TOGETHER_DB >= 9)
        expect(text).toMatch(/reach the top orange on the MASTER meters\. Keep CH1 on the first orange/);
      else expect(text).toMatch(/leave the top orange on the MASTER meters dark\.$/);
    }
  });

  it('names the tips cut on the first dB over, and crunch only from the second', () => {
    expect(copy.CRUNCH_WORDS).toEqual({
      clean: 'Clean',
      tips: 'Tips cut',
      some: 'Some crunch',
      heavy: 'Heavy crunch',
    });
    expect(at(13, -12).crunch).toBe('tips');
    expect(at(14, -12).crunch).toBe('some');
  });

  it('says a recording close to the top leaves no headroom for a blend, and ends the lab after step 3', () => {
    expect(copy.successFeedback(3, at(9, -4))!.lines[1]).toMatch(/close to the top/);
    expect(copy.successFeedback(3, at(9, -12))!.lines).toEqual([
      'The recording level comes before the Howler’s input.',
    ]);
    expect(copy.successFeedback(3, at(9, -12))!.next).toBeNull();
    expect(copy.successFeedback(1, at(9, -12))).toBeNull();
  });
});
