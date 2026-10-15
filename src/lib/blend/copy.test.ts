import { describe, expect, it } from 'vitest';
import { DJ_RULES } from '../rules';
import {
  BARELY_OVER_NOTE,
  coach,
  GUESS_LEGEND,
  GUESS_PROMPT,
  guessNote,
  guessSpot,
  lightPhrase,
  MODEL_NOTES,
  MODEL_NOTES_TITLE,
  mixReadout,
  NAV,
  NO_SCRIPT,
  READOUT_LABEL,
  RESULT_CONTEXT,
  SOUND,
  STEPS,
  SUMMARY,
  speakFader,
  stepCounter,
  stepResult,
  trimHint,
  verdictLine,
  WAVEFORM_TOGGLE,
  zonePhrase,
} from './copy';
import {
  analyseBlend,
  type BlendSettings,
  cloneSettings,
  displayDb,
  FADER,
  LISTEN_REFERENCE,
  LOW,
  STEP_COUNT,
  STEP_START,
  type Step,
  stepDone,
  TRIM,
} from './model';

/** Normalise the no-break space formatDb puts between number and unit, for readable expectations. */
const text = (s: string) => s.replaceAll(/[   ]/g, ' ');
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const STEP_LIST: Step[] = [1, 2, 3, 4];

const withDeck = (s: BlendSettings, deck: 'deck1' | 'deck2', change: Partial<BlendSettings['deck1']>) => {
  const next = cloneSettings(s);
  next[deck] = { ...next[deck], ...change };
  return next;
};
const both = (s: BlendSettings, change: Partial<BlendSettings['deck1']>) =>
  withDeck(withDeck(s, 'deck1', change), 'deck2', change);

/** Step 1's blend: deck 2 brought all the way up, both tracks on the second orange. */
const challenge = withDeck(STEP_START[1], 'deck2', { fader: FADER.max });
const named = {
  hot: both(challenge, { trim: 9 }),
  sixes: both(challenge, { trim: 6 }),
  boost: withDeck(challenge, 'deck2', { low: LOW.max }),
  ease: withDeck(challenge, 'deck1', { fader: FADER.max - FADER.step }),
  orange: cloneSettings(LISTEN_REFERENCE),
  redChannel: withDeck(challenge, 'deck1', { trim: 12, low: 3 }),
  silent: withDeck(STEP_START[1], 'deck1', { fader: FADER.min }),
};

const coachOf = (step: Step, s: BlendSettings) => text(coach(step, s, analyseBlend(s)));
const resultOf = (step: Step, s: BlendSettings, guess: number | null = null) => {
  const f = stepResult(step, s, analyseBlend(s), guess);
  return { ...f, title: text(f.title), lines: f.lines.map(text) };
};

/** Every state worth describing: each step's start, the blends the steps walk through, and a grid. */
const STATES: BlendSettings[] = [...STEP_LIST.map((step) => STEP_START[step]), challenge, ...Object.values(named)];
for (const trim of [TRIM.min, 0, TRIM.initial, 6, 9, TRIM.max])
  for (const fader of [FADER.min, 4, 9, FADER.max])
    STATES.push(both({ ...challenge, deck2: { ...challenge.deck2, fader } }, { trim }));

/** Every line the lab can show, in every state. */
function allText(): string[] {
  const texts: string[] = [
    ...Object.values(STEPS).flatMap((s) => [s.title, s.body]),
    ...Object.values(NAV),
    ...Object.values(SOUND),
    SUMMARY.title,
    ...SUMMARY.lines,
    READOUT_LABEL,
    RESULT_CONTEXT,
    GUESS_PROMPT,
    guessNote(9, true),
    guessNote(9, false),
    trimHint(1, 3),
    trimHint(2, 15),
    WAVEFORM_TOGGLE,
    NO_SCRIPT,
    BARELY_OVER_NOTE,
    MODEL_NOTES_TITLE,
    ...MODEL_NOTES,
  ];
  for (const s of STATES) {
    const r = analyseBlend(s);
    texts.push(verdictLine(r), mixReadout(r).words);
    for (const step of STEP_LIST) {
      texts.push(coach(step, s, r));
      const f = stepResult(step, s, r, 6);
      texts.push(f.title, ...f.lines, f.next ?? '');
    }
  }
  return texts.filter(Boolean).map(text);
}

describe('house style', () => {
  it('avoids exclamation marks, em dashes and "please"', () => {
    for (const s of allText()) expect(s, s).not.toMatch(/!|—|please/i);
  });

  it('says things plainly: no question-and-answer lead-ins, no two-beat slogans, no colon slogans', () => {
    for (const s of allText()) {
      // "Stuck? Try…", "No sound? Check…"
      expect(s, s).not.toMatch(/(^|\. )[^.?]{1,24}\? [A-Z]/);
      // "X. Not Y."
      expect(s, s).not.toMatch(/\. Not [a-z]/);
      // A short label, a colon, then the point. "Next: …" keys name the step they lead to.
      if (!s.startsWith('Next: ')) expect(s, s).not.toMatch(/^[^:.]{1,16}: [a-z]/);
    }
  });

  it('uses curly apostrophes and the typographic minus', () => {
    for (const s of [...allText(), GUESS_LEGEND]) {
      expect(s, s).not.toMatch(/['"]/);
      expect(s, s).not.toMatch(/(^|\s)-\d/);
    }
  });

  it('keeps every sentence to 20 words or fewer', () => {
    for (const s of allText()) for (const one of s.split(/(?<=\.)\s/)) expect(words(one), one).toBeLessThanOrEqual(20);
  });

  it('calls the stereo pair the MASTER meters, as the unit prints it', () => {
    for (const s of allText()) expect(s, s).not.toMatch(/middle meters?\b/i);
  });

  it('writes the reference register: no negative contractions, no ", so" chains, no idioms', () => {
    for (const s of allText()) {
      expect(s, s).not.toMatch(/n’t\b|n't\b/);
      expect(s, s).not.toMatch(/, so\b/);
      expect(s, s).not.toMatch(/\b(once you|keep an eye|go by|eased?\b|a notch|add up|show up)/i);
    }
  });

  it('never lets a number part from its unit', () => {
    const raw = STATES.flatMap((s) => STEP_LIST.flatMap((step) => stepResult(step, s, analyseBlend(s), 6).lines));
    for (const s of [...raw, ...MODEL_NOTES]) expect(s).not.toMatch(/\d[   ]dB/);
  });
});

describe('the steps', () => {
  it('count themselves in words', () => {
    expect(stepCounter(2, STEP_COUNT)).toBe('Step 2 of 4');
  });

  it('say what to do in the unit’s own names, in the order of the work', () => {
    expect(STEPS[1]).toEqual({
      title: 'Bring deck 2 in',
      body: 'Deck 1 is playing. Both tracks peak on the second orange. Bring deck 2’s fader all the way up, and watch the MASTER meters.',
    });
    expect(STEPS[2].title).toBe('Fix it with a fader');
    expect(STEPS[2].body).toMatch(/Pull deck 1’s fader down until the top orange goes dark\.$/);
    expect(STEPS[3].title).toBe('Push it into the red');
    expect(STEPS[3].body).toBe(
      'Both faders are up. Turn both TRIMs up until each channel meter shows the top orange. Then press Listen.',
    );
    expect(STEPS[4].title).toBe('Leave room with TRIM');
    expect(STEPS[4].body).toMatch(/^Deck 1 peaks on the first orange\./);
  });

  it('describe each step’s opening mixer truly', () => {
    const r = (step: Step) => analyseBlend(STEP_START[step]);
    // Step 1: both on the second orange, deck 2 cued.
    expect(lightPhrase(r(1).channel[0])).toBe('on the second orange');
    expect(STEP_START[1].deck2.fader).toBe(FADER.min);
    // Step 2: the top orange is lit.
    expect(zonePhrase(displayDb(r(2).mix))).toBe('on the top orange');
    // Step 4: deck 1 on the first orange, deck 2 on the second.
    expect(lightPhrase(r(4).channel[0])).toBe('on the first orange');
    expect(lightPhrase(r(4).channel[1])).toBe('on the second orange');
  });

  it('name the next step on the key that moves on, keeping printed names in capitals', () => {
    expect(resultOf(1, challenge).next).toBe('Next: fix it with a fader');
    expect(resultOf(2, named.ease).next).toBe('Next: push it into the red');
    expect(resultOf(3, named.hot).next).toBe('Next: leave room with TRIM');
    expect(resultOf(4, withDeck(both(challenge, { trim: 0 }), 'deck1', {})).next).toBeNull();
  });
});

describe('the line under the meters', () => {
  it('fits two lines on the narrowest phone, whatever it says', () => {
    for (const s of STATES)
      for (const step of STEP_LIST) expect(coachOf(step, s).length, coachOf(step, s)).toBeLessThanOrEqual(80);
    // In place of the line once a step is done: the result's headline.
    for (const s of STATES)
      for (const step of STEP_LIST) {
        const title = resultOf(step, s, 6).title;
        expect(title.length, title).toBeLessThanOrEqual(80);
      }
  });

  it('says what to watch in step 1', () => {
    expect(coachOf(1, STEP_START[1])).toBe('Watch the MASTER meters as deck 2 comes up.');
  });

  it('says in step 2 what is in the way', () => {
    expect(coachOf(2, STEP_START[2])).toBe('The top orange is lit. Pull deck 1’s fader down.');
    // One mark down fixes the lab's own blend; on two hotter tracks it is not enough.
    expect(coachOf(2, withDeck(both(challenge, { trim: 5 }), 'deck1', { fader: 9 }))).toBe(
      'The top orange is still lit. A little further.',
    );
    expect(coachOf(2, withDeck(challenge, 'deck2', { fader: 8 }))).toBe('Keep deck 2 all the way up.');
    expect(coachOf(2, withDeck(challenge, 'deck1', { fader: 2 }))).toBe('Deck 1 is almost silent. Keep it in the mix.');
    expect(coachOf(2, named.redChannel)).toBe('CH1 is in the red. Its fader comes after the cut: turn its TRIM down.');
  });

  it('says in step 3 that the mix reaches the red before either channel does', () => {
    expect(coachOf(3, STEP_START[3])).toBe('Turn both TRIMs up until each channel meter shows the top orange.');
    // Both on the third orange: the red, only just.
    expect(coachOf(3, named.sixes)).toBe(text(BARELY_OVER_NOTE));
    const sevens = both(challenge, { trim: 7 });
    expect(coachOf(3, sevens)).toBe('MASTER is in the red, and neither channel is. Keep going.');
    expect(coachOf(3, withDeck(named.hot, 'deck2', { trim: 12 }))).toBe(
      'CH2 is past the top orange, in the red. Turn its TRIM down one light.',
    );
    expect(coachOf(3, withDeck(named.hot, 'deck1', { fader: 9 }))).toBe('Keep both faders all the way up.');
  });

  it('says in step 4 what the channel meter needs, in the DJ box’s words', () => {
    const s = STEP_START[4];
    expect(coachOf(4, s)).toBe('CH2 peaks on the second orange. Turn deck 2’s TRIM down a little.');
    expect(coachOf(4, withDeck(s, 'deck2', { trim: 0 }))).toBe(
      'CH2 peaks on the first orange. Bring deck 2’s fader all the way up.',
    );
    expect(coachOf(4, withDeck(s, 'deck2', { trim: -3 }))).toBe(
      'CH2 is lower than it needs to be. The first orange is the aim.',
    );
    expect(coachOf(4, withDeck(s, 'deck1', { trim: 3 }))).toBe('Leave deck 1 on the first orange.');
    // The DJ box's line for the channel meters says the same: TRIM down a little.
    const rule = DJ_RULES.find((r) => r.label === 'TRIM')!;
    expect(rule.note).toMatch(/turn TRIM \(the gain knob\) down a little\.$/);
  });
});

describe('the results', () => {
  it('keep to three lines, each step', () => {
    for (const s of STATES)
      for (const step of STEP_LIST) expect(resultOf(step, s, 6).lines.length).toBeLessThanOrEqual(3);
  });

  it('say back the guess beside where MASTER peaked, in step 1', () => {
    expect(resultOf(1, challenge, 6).title).toBe('You guessed +6 dB. MASTER peaks at +9 dB');
    expect(resultOf(1, challenge).title).toBe('MASTER peaks at +9 dB');
    // Past the red the meter cannot show it: "would peak".
    expect(resultOf(1, named.hot, 12).title).toBe('You guessed +12 dB. MASTER would peak at +15 dB');
  });

  it('say in step 1 that the peaks add, and that the channel meters read before the fader', () => {
    expect(resultOf(1, challenge).lines).toEqual([
      'Each track peaks at +3 dB on its own.',
      'When both tracks peak at once, the peaks add. The MASTER meters show the sum, two lights higher.',
      'The channel meters did not move with the fader. They read before it.',
    ]);
    // With deck 1 closed, there is no blend to speak of.
    expect(resultOf(1, withDeck(challenge, 'deck1', { fader: FADER.min })).lines).toEqual([
      'Deck 1’s fader is down. The mix is deck 2 alone.',
    ]);
  });

  it('end step 2 on the DJ box’s own line for the MASTER meters', () => {
    const mix = DJ_RULES.find((r) => r.label === 'MIX')!.note;
    expect(resultOf(2, named.ease)).toEqual({
      title: 'The top orange is dark',
      lines: [
        'Deck 1’s fader takes it down in the mix, and the blend comes down with it.',
        'CH1 did not move. It reads before the fader.',
        mix,
      ],
      next: 'Next: push it into the red',
    });
    // Fixed another way, with TRIM: it says what is so, and the rule.
    const trimmed = both(challenge, { trim: 0 });
    expect(stepDone(2, trimmed, analyseBlend(trimmed))).toBe(true);
    expect(resultOf(2, trimmed).lines).toEqual([
      'Deck 2 is all the way up, and the MASTER meters are under the top orange.',
      mix,
    ]);
  });

  it('say in step 3 that each channel is under the red and the mix is past it, and send the reader to Listen', () => {
    expect(resultOf(3, named.hot)).toEqual({
      title: 'The mix is 3 dB over the red',
      lines: [
        'Each channel is under the red. Together they would peak at +15 dB.',
        'Past the red, the mixer cuts the peaks flat. The room and the recording both get the crunch.',
        `Press ${SOUND.listen}, then ${SOUND.clean}.`,
      ],
      next: 'Next: leave room with TRIM',
    });
  });

  it('say in step 4 how much room the first orange leaves, then close on the two meters', () => {
    const done = withDeck(STEP_START[4], 'deck2', { trim: 0, fader: FADER.max });
    expect(resultOf(4, done)).toEqual({
      title: 'The top orange stays dark',
      lines: [
        'Both tracks peak on the first orange. Together they peak at +6 dB.',
        'The first orange leaves room for what a blend adds, up to 6 dB: two lights.',
      ],
      next: null,
    });
    expect(SUMMARY.title).toBe('What the meters should show');
    expect(SUMMARY.lines).toEqual([
      'Set TRIM so each channel meter peaks on the first orange at the loudest part.',
      `Watch the MASTER meters in a blend. ${DJ_RULES.find((r) => r.label === 'MIX')!.note}`,
    ]);
  });
});

describe('the words for the meters', () => {
  it('name the colour as the meter shows it', () => {
    expect(zonePhrase(-3)).toBe('in the green');
    expect(zonePhrase(0)).toBe('in the orange');
    expect(zonePhrase(8)).toBe('in the orange');
    expect(zonePhrase(9)).toBe('on the top orange');
    expect(zonePhrase(11)).toBe('on the top orange');
    expect(zonePhrase(12)).toBe('in the red');
    expect(text(zonePhrase(14))).toBe('2 dB over the red');
  });

  it('name the light a channel reaches, as the DJ box names the oranges', () => {
    expect(lightPhrase(Number.NEGATIVE_INFINITY)).toBe('dark');
    expect(lightPhrase(-4)).toBe('in the green');
    expect(lightPhrase(0)).toBe('on the first orange');
    expect(lightPhrase(2)).toBe('on the first orange');
    expect(lightPhrase(3)).toBe('on the second orange');
    expect(lightPhrase(6)).toBe('on the third orange');
    expect(lightPhrase(9)).toBe('on the top orange');
    expect(lightPhrase(12)).toBe('in the red');
  });
});

describe('the readout by the MASTER meters', () => {
  const readout = (s: BlendSettings) => {
    const r = mixReadout(analyseBlend(s));
    return { ...r, value: text(r.value), words: text(r.words) };
  };

  it('says where the mix peaks and its colour', () => {
    expect(readout(challenge)).toEqual({ value: '+9 dB', zone: 'orange', words: 'on the top orange' });
    expect(readout(named.hot)).toEqual({ value: '+15 dB', zone: 'red', words: '3 dB over the red' });
    expect(readout(named.ease)).toEqual({ value: '+8 dB', zone: 'orange', words: 'in the orange' });
    expect(readout(STEP_START[1])).toEqual({ value: '+3 dB', zone: 'orange', words: 'in the orange' });
  });

  it('goes dark with the meters', () => {
    expect(readout(named.silent)).toEqual({ value: 'off', zone: null, words: 'dark' });
    // Too quiet to light an LED: dark, whatever the number.
    const quiet = withDeck(STEP_START[1], 'deck1', { fader: 1 });
    expect(readout(quiet).zone).toBeNull();
    expect(readout(quiet).words).toBe('dark');
  });
});

describe('the guess', () => {
  it('asks before deck 2 comes up, and says what to do next once answered', () => {
    expect(GUESS_PROMPT).toBe('Before deck 2 comes up, tap MASTER where you think it will peak.');
    expect(GUESS_LEGEND).toBe('With deck 2 all the way up, where will MASTER peak?');
    expect(text(guessNote(9, true))).toBe('You guessed +9 dB. Now bring deck 2 up.');
    expect(text(guessNote(9, false))).toBe('You guessed +9 dB.');
  });

  it('names each LED in words a screen reader says well', () => {
    expect(guessSpot(12)).toBe('plus 12 decibels, in the red');
    expect(guessSpot(0)).toBe('0 decibels, in the orange');
    expect(guessSpot(-24)).toBe('minus 24 decibels, in the green');
  });
});

describe('the controls', () => {
  it('say under TRIM where the channel meter peaks now, LOW included', () => {
    expect(text(trimHint(2, 8))).toBe('CH2 peaks at +8 dB');
    expect(text(trimHint(1, 15))).toBe('CH1 would peak at +15 dB');
  });

  it('read fader positions with units in words', () => {
    expect(speakFader(10)).toBe('fully up, 0 decibels');
    expect(speakFader(8)).toBe('8 of 10, minus 6 decibels');
    expect(speakFader(0)).toBe('closed, silent');
    expect(speakFader(9.5)).toBe('9.5 of 10, minus 2 decibels');
  });
});

describe('sound', () => {
  it('uses the words every lab uses, and says what the clean version is while it plays', () => {
    expect(SOUND.quiet).toBe('It starts quietly. If you hear nothing, check your volume and silent switch.');
    expect(SOUND.unavailable).toBe(
      'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
    );
    expect(SOUND.clean).toBe('Hear the clean version');
    expect(SOUND.matched).toBe('The clean version is matched to it. Only the crunch changes.');
  });
});

describe('what the lab assumes', () => {
  it('keeps the two notes that change what a DJ does, each opening with the action', () => {
    expect(MODEL_NOTES_TITLE).toBe('What the lab assumes');
    expect(MODEL_NOTES).toHaveLength(6);
    expect(MODEL_NOTES[0]).toMatch(/^On the unit, watch the MASTER meters as you pull a fader down\. /);
    expect(MODEL_NOTES[1]).toMatch(/^If CLIP blinks/);
    expect(MODEL_NOTES.map(text)).toContain(
      'If CLIP blinks, even slowly, pull a channel fader down a little. Pioneer does not say at what level CLIP starts to blink. In this lab it blinks slowly within 1.5 dB of the red light, and fast past it.',
    );
  });

  it('says Pioneer describes its three fader curves in words, with the pages', () => {
    // Operating Instructions p. 27 (the three curves, in words) and p. 32 (CURVE1, CURVE2, CURVE3).
    expect(MODEL_NOTES[0]).toContain(
      'Pioneer describes the XDJ-RX2’s three channel fader curves in words only, with no dB figures (pp. 27 and 32).',
    );
  });

  it('says where the lab clips, and that its loops add the full 6 dB', () => {
    expect(MODEL_NOTES.map(text)).toContain(
      'The lab cuts the peaks flat at the red light. Pioneer says only that the sound “may be distorted” there (p. 31).',
    );
    expect(text(MODEL_NOTES.at(-1) ?? '')).toBe(
      'The two tracks are loops made for the lab, with their kicks in step. A blend of them adds the full 6 dB, the worst case.',
    );
  });

  it('says the lab’s LOW only turns up, and once that it plays as if the crossfader is on THRU', () => {
    // Quick Start Guide, specifications: HI, MID and LOW each −∞ dB to +6 dB.
    expect(MODEL_NOTES.map(text)).toContain(
      'The lab has one EQ knob, LOW, and only the half that turns it up. On the unit, HI, MID and LOW can each boost by as much as 6 dB.',
    );
    // Operating Instructions p. 28: "[THRU]: Select when not using the crossfader."
    expect(MODEL_NOTES.filter((n) => /THRU/.test(n))).toEqual([
      'The lab has no crossfader. It plays like the unit with CROSS FADER CURVE on THRU, Pioneer’s setting for not using it (p. 28).',
    ]);
  });
});

describe('live region', () => {
  const verdict = (s: BlendSettings) => verdictLine(analyseBlend(s));

  it('says the meters in words, never numbers, so a move that changes nothing stays quiet', () => {
    // Deck 2 coming up from the start: the mix climbs, the words do not move until the top.
    const lines = [0.5, 2, 4, 6, 8, 9].map((fader) => verdict(withDeck(STEP_START[1], 'deck2', { fader })));
    expect(new Set(lines)).toEqual(new Set(['The MASTER meters are in the orange.']));
    expect(verdict(challenge)).toBe('The MASTER meters light the top orange.');
    for (const s of STATES) expect(verdict(s)).not.toMatch(/dB|[+−]\d/);
  });

  it('names the meters going dark, CLIP, and a channel going red', () => {
    expect(verdict(named.silent)).toBe('The MASTER meters are dark.');
    expect(verdict(named.hot)).toBe('The MASTER meters are in the red. CLIP is lit.');
    expect(verdict(named.redChannel)).toMatch(/CH1 is in the red\.$/);
    expect(verdict(both(challenge, { trim: 12, low: 3 }))).toMatch(/Both channel meters are in the red\.$/);
  });
});
