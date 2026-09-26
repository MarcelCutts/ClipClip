import { describe, expect, it } from 'vitest';
import { labSignal, type Prediction, type Reading, readLab } from './ceilings';
import * as copy from './copy';

const track = labSignal('track');
const at = (channels: number, knob: number): Reading => readLab(track, channels, knob);

/** Every reading worth describing: each combination of stage states the lab can reach. */
const READINGS = [at(18, -12), at(18, 0), at(18, -6), at(9, 0), at(9, -3), at(12, -12), at(3, -9), at(-6, -24)];

function allText(): string[] {
  const texts: string[] = [
    ...Object.values(copy.STEPS).flatMap((s) => [s.title, s.body]),
    copy.PREDICT.question,
    copy.PREDICT.sure,
    copy.PREDICT.waiting,
    ...Object.values(copy.SOUND),
    ...Object.values(copy.CONTROLS).flatMap((c) => Object.values(c)),
    ...Object.values(copy.STAGE_WORDS),
    copy.DETAILS.distortionNote,
    copy.DETAILS.peakNote,
    copy.DETAILS.mixerNote,
    ...Object.values(copy.NAV),
    copy.DETAILS.engineerNote,
    copy.SCOPES.zoom,
    ...Object.values(copy.SCOPES.legend),
    ...Object.values(copy.WAITING),
    copy.ON_THE_NIGHT,
    copy.MODEL_NOTE.text,
    copy.NO_SCRIPT,
    copy.CHECK.title,
    copy.CHECK.question,
    ...Object.values(copy.CHECK.rows),
    ...Object.values(copy.CHECK.why),
  ];
  for (const r of READINGS) {
    texts.push(copy.stateSentence(r), copy.stateSentence(r, false));
    for (const teach of [true, false]) texts.push(...Object.values(copy.scopeClaims(r, teach)));
    const reveal = copy.revealFeedback(r, 'goes-away', 'certain');
    texts.push(reveal.title, ...reveal.lines);
    for (const step of [3, 4] as const) {
      const s = copy.successFeedback(step, r);
      if (s) texts.push(s.title, ...s.lines);
    }
  }
  return texts;
}

describe('house style', () => {
  it('uses short sentences, no exclamations, no em dashes and no please', () => {
    for (const text of allText()) {
      expect(text, text).not.toMatch(/[!—]|please/i);
      for (const sentence of text.split(/(?<=[.?])\s+/)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20);
      }
    }
  });

  it('says things plainly: no question-and-answer lead-ins, no two-beat slogans, no colon slogans', () => {
    for (const text of allText()) {
      // "Want to hear the crunch first? Press Listen."
      expect(text, text).not.toMatch(/(^|\. )[^.?]{1,40}\? [A-Z]/);
      // "X. Not Y."
      expect(text, text).not.toMatch(/\. Not [a-z]/);
      // A short label, a colon, then the point.
      expect(text, text).not.toMatch(/^[^:.]{1,16}: [a-z]/);
    }
  });

  it('uses curly apostrophes and the typographic minus', () => {
    for (const text of allText()) {
      expect(text, text).not.toMatch(/['"]/);
      expect(text, text).not.toMatch(/(^|\s)-\d/);
    }
  });

  it('labels the zoom the way the brief asks', () => {
    expect(copy.SCOPES.zoom).toBe('Zoomed in to about 30 thousandths of a second');
  });

  it('keeps numbers and their units together', () => {
    expect(copy.DETAILS.distortionNote).toContain('at\u00a05%');
    for (const text of allText()) expect(text, text).not.toMatch(/\d[ \u2009\u202f](dB|Hz|kHz|%)/);
  });

  it('never points up or down the page: each step carries its own keys', () => {
    // "Below ceiling 2" is a place on a screen, not on the page.
    for (const text of allText()) expect(text, text).not.toMatch(/\b(below|above)\b(?! ceiling)/i);
  });

  it('states the model’s caveat once, as an assumption, and points to About the demos', () => {
    // Howler publishes no maximum input level, so ceiling 2 is an assumption (model.ts).
    expect(allText().filter((t) => /we assume/i.test(t))).toEqual([copy.MODEL_NOTE.text]);
    expect(copy.MODEL_NOTE).toMatchObject({ link: 'About the demos', href: '#model' });
  });
});

describe('our wiring', () => {
  it('names MASTER LEVEL as the record level, never BOOTH', () => {
    expect(copy.CONTROLS.knob.label).toBe('Record level (MASTER LEVEL)');
    expect(copy.CHAIN.knob).toEqual({ name: 'Record level', sub: 'MASTER LEVEL' });
    // BOOTH as printed on the mixer. The booth itself, where DJs play, is fine.
    expect(`${JSON.stringify(copy)} ${allText().join(' ')}`).not.toMatch(/BOOTH|[Rr]ecorder knob/);
  });

  it('keeps MASTER LEVEL up on the night and turns the recording down with MASTER ATT', () => {
    expect(copy.ON_THE_NIGHT).toMatch(/MASTER LEVEL stays fully up/);
    expect(copy.ON_THE_NIGHT).toMatch(/MASTER ATT in UTILITY/);
    // Pioneer doesn't say whether MASTER ATT reaches MASTER 2, so it's never stated as fact.
    expect(copy.ON_THE_NIGHT).toMatch(/if the setup test shows it reaches MASTER 2/);
    expect(copy.successFeedback(4, at(9, -4))!.lines).toContain(copy.ON_THE_NIGHT);
  });

  it('says first that the knob stands for the record level, since MASTER LEVEL stays taped up', () => {
    expect(copy.CONTROLS.knob.hint).toMatch(
      /^On the night, MASTER LEVEL stays taped fully up\. Here the knob stands for the record level\./,
    );
  });
});

describe('the state sentence', () => {
  it('names where the clipping happened', () => {
    expect(copy.stateSentence(at(18, -12))).toMatch(/^Clipped inside the mixer\./);
    expect(copy.stateSentence(at(18, 0))).toMatch(/^Clipped twice\./);
    expect(copy.stateSentence(at(9, 0))).toMatch(/^Clipped at the Howler’s input only\./);
    expect(copy.stateSentence(at(3, -9))).toMatch(/^Clean all the way through\./);
    expect(copy.stateSentence(at(12, -12))).toMatch(/^Touching the red\./);
  });

  it('keeps the answer to the prediction back until the challenge is over', () => {
    const early = copy.stateSentence(at(18, -12), false);
    expect(early).not.toMatch(/knob|level|quieter/i);
    expect(copy.stateSentence(at(18, -12), true)).toMatch(/quieter/);
    // The line under the recording's screen holds back where its flat tops came from, too.
    for (const knob of [-12, -18, -24]) {
      expect(copy.scopeClaims(at(18, knob), false).recording).not.toMatch(/mixer|knob|level/i);
      expect(copy.scopeClaims(at(18, knob), true).recording).toMatch(/cut in the mixer/);
    }
  });
});

describe('the scope lines', () => {
  it('say what each screen shows, with no answer to give away once the mixer is clean', () => {
    expect(copy.scopeClaims(at(18, -12)).mixer).toMatch(/cut flat/);
    expect(copy.scopeClaims(at(12, -12)).mixer).toMatch(/just touch ceiling 1/);
    expect(copy.scopeClaims(at(3, -9)).mixer).toMatch(/fits under ceiling 1/);
    expect(copy.scopeClaims(at(18, 0)).recording).toMatch(/again/);
    expect(copy.scopeClaims(at(9, 0)).recording).toMatch(/cut flat at ceiling 2/);
    expect(copy.scopeClaims(at(9, -3)).recording).toMatch(/just touch ceiling 2/);
    expect(copy.scopeClaims(at(3, -9), false)).toEqual(copy.scopeClaims(at(3, -9), true));
  });
});

describe('the guided steps', () => {
  it('asks for everything step 3 checks: Clean, the red light dark and the Howler green', () => {
    expect(copy.STEPS[3].body).toMatch(/Clean/);
    expect(copy.STEPS[3].body).toMatch(/red light dark/);
    expect(copy.STEPS[3].body).toMatch(/Howler’s LEVEL light green/);
  });

  it('never calls the top orange light fine', () => {
    expect(copy.STEPS[4].body).not.toMatch(/fine/);
  });

  it('asks for the listen where the Listen key is, and for the knob by name in the challenge', () => {
    expect(copy.STEPS[1].body).toMatch(/Press Listen to hear the crunch first\.$/);
    expect(copy.STEPS[2].body).toMatch(/^The channels are locked in the red\. Turn the record level/);
  });
});

describe('the quick check', () => {
  it('gives each place the answer canFix gives, in words', () => {
    // Only the channel for the mixer; both for the recorder.
    expect(copy.CHECK.why.mixer).toMatch(/^Only the channel\./);
    expect(copy.CHECK.why.recorder).toMatch(/^Both\./);
    expect(copy.CHECK.why.recorder).toMatch(/MASTER ATT/);
  });
});

describe('readouts', () => {
  it('says what waits for a guess, and what to do once there is one', () => {
    expect(copy.WAITING).toEqual({ before: 'Guess first', after: 'Press Next' });
  });

  it('names the last step plainly, and says what still works without sound', () => {
    expect(copy.STEPS[5].title).toBe('Free play');
    expect(copy.NAV).toMatchObject({ skip: 'Skip to free play', restart: 'Start the lab again' });
    expect(copy.SOUND.unavailable).toBe(
      'This browser can’t play the sound. Everything else works; try another browser to hear it.',
    );
    expect(copy.HOWLER_WORDS.red.meaning).toBe('Level too high');
  });

  it('puts the channel meter into words beside its lights', () => {
    expect(copy.levelWords(18)).toBe('In the red');
    expect(copy.levelWords(12)).toBe('In the red');
    expect(copy.levelWords(3)).toBe('In the orange');
    expect(copy.levelWords(-6)).toBe('In the green');
  });

  it('puts the recording peak into words', () => {
    expect(copy.peakWords(0)).toBe('Hitting the top');
    expect(copy.peakWords(-1)).toBe('Close to the top');
    expect(copy.peakWords(-6)).toBe('Comfortable');
    expect(copy.peakWords(-12)).toBe('Comfortable');
    expect(copy.peakWords(-18)).toBe('Low, that’s fine');
    expect(copy.peakWords(-36)).toBe('Very low');
  });

  it('writes the numbers for the curious', () => {
    expect(copy.percentText(0)).toBe('0%');
    expect(copy.percentText(0.004)).toBe('0.40%');
    expect(copy.percentText(0.14995)).toBe('15.0%');
    expect(copy.dbfsText(-6)).toBe('−6.0\u00a0dBFS');
    // The channel meter tops out at +12, so a level past it is never called a reading on it.
    expect(copy.mixerPeakText(at(18, -12))).toBe('+18 dB, 6 dB past ceiling 1');
    expect(copy.mixerPeakText(at(3, -9))).toBe('+3 dB, 9 dB under ceiling 1');
    expect(copy.DETAILS.mixerNote).toMatch(/stops at \+12, its red light/);
  });
});

describe('feedback', () => {
  it('answers the prediction, and singles out confident mistakes', () => {
    const cases: Array<[Prediction | null, RegExp | null]> = [
      ['quieter-stays', /^You predicted this\./],
      ['not-sure', null],
      [null, null],
    ];
    for (const [p, expected] of cases) {
      const note = copy.predictionNote(p, 'certain');
      if (expected) expect(note).toMatch(expected);
      else expect(note).toBeNull();
    }
    expect(copy.predictionNote('goes-away', 'certain')).toMatch(/^You were certain/);
    expect(copy.predictionNote('goes-away', 'guessing')).toMatch(/^You predicted it would go away\./);
  });

  it('points out the green Howler light only when it is green', () => {
    expect(copy.revealFeedback(at(18, -12), null, null).lines.join(' ')).toMatch(/LEVEL light stayed green/);
    expect(copy.revealFeedback(at(18, 0), null, null).lines.join(' ')).not.toMatch(/stayed green/);
  });

  it('adds the house tip when the channels are still high in the orange', () => {
    expect(copy.successFeedback(3, at(3, -9))!.lines[1]).toMatch(/leaves room for a blend/);
    expect(copy.successFeedback(3, at(9, -12))!.lines[1]).toMatch(/first orange light/);
    expect(copy.successFeedback(4, at(9, -4))!.lines[1]).toMatch(/close to the top/);
    expect(copy.successFeedback(4, at(9, -12))!.lines).toEqual([
      expect.stringMatching(/record level can fix/),
      copy.ON_THE_NIGHT,
    ]);
    expect(copy.successFeedback(2, at(9, -12))).toBeNull();
  });

  it('never lets one track out of the red pass for a safe blend', () => {
    for (let channels = -6; channels <= 11; channels++) {
      const text = copy.successFeedback(3, at(channels, -12))!.lines.join(' ');
      expect(text, `channels ${channels}`).toMatch(/A blend can add two more|room for a blend/);
      expect(text).not.toMatch(/the channels out of the red/);
    }
  });
});
