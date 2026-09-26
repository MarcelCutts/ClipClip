import { describe, expect, it } from 'vitest';
import {
  BARELY_OVER_NOTE,
  blendSentence,
  CHALLENGE_PROMPT,
  challengeMessage,
  explainBlend,
  GUESS_LEGEND,
  GUESS_PROMPT,
  guessNote,
  guessReveal,
  guessSpot,
  HINT,
  LISTEN_NOTE,
  MODEL_NOTES,
  MODEL_NOTES_TITLE,
  mixReadout,
  NO_SOUND,
  PRESET_GROUPS,
  plain,
  presetLine,
  speakFader,
  statusLamp,
  trimHint,
  verdictLine,
  WAVEFORM_TOGGLE,
  WAYS_OUT_SHOW,
  WAYS_OUT_WAIT,
  zonePhrase,
} from './copy';
import {
  analyseBlend,
  type BlendSettings,
  type ChallengeStatus,
  challengeStatus,
  cloneSettings,
  displayDb,
  FADER,
  PRESETS,
  type PresetId,
  preset,
  START,
} from './model';

/** Normalise the no-break space formatDb puts between number and unit, for readable expectations. */
const text = (s: string) => s.replaceAll(/[\u00a0\u2009\u00a0]/g, ' ');
const settingsOf = (id: PresetId) => cloneSettings(preset(id).settings);
const sentence = (s: BlendSettings) => text(plain(blendSentence(s, analyseBlend(s))));
const explain = (s: BlendSettings) => explainBlend(s, analyseBlend(s));
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** The challenge as the reader first meets it: deck 2 brought fully up from the start. */
const challenge = (() => {
  const s = cloneSettings(START);
  s.deck2.fader = FADER.max;
  return s;
})();
const verdict = (s: BlendSettings) => {
  const r = analyseBlend(s);
  return verdictLine(r, challengeStatus(s, r));
};

describe('reactive sentence', () => {
  it('says the headline case in the spec’s words', () => {
    expect(sentence(challenge)).toBe(
      'Each deck peaks at +6 dB on its own. Together, the mix peaks at +12 dB, in the red.',
    );
  });

  it('says how far past the red two tracks on the top orange light go', () => {
    expect(sentence(settingsOf('hot'))).toBe(
      'Each deck peaks at +9 dB on its own. Together, the mix would peak at +15 dB, 3 dB over the red.',
    );
  });

  it('starts with deck 2 cued and its fader down', () => {
    expect(sentence(START)).toBe(
      'Each deck peaks at +6 dB on its own. Deck 2’s fader is down. The mix is deck 1 alone. It peaks at +6 dB, in the orange.',
    );
  });

  it('follows the channel meters when the decks differ', () => {
    expect(sentence(settingsOf('swap'))).toBe(
      'On its own, deck 1 peaks at +1 dB and deck 2 at +6 dB. Together, the mix peaks at +8 dB, in the orange.',
    );
  });

  it('names a lowered fader, since the channel meters won’t show it', () => {
    expect(sentence(settingsOf('ease'))).toBe(
      'Each deck peaks at +6 dB on its own. Together, with deck 1’s fader at −6 dB, the mix peaks at +10 dB, in the orange.',
    );
    const both = cloneSettings(challenge);
    both.deck1.fader = 8;
    both.deck2.fader = 8;
    expect(sentence(both)).toMatch(/Together, with both faders lowered, the mix peaks at \+\d+ dB, in the orange\.$/);
  });

  it('says how far past the red a blend would go', () => {
    expect(sentence(settingsOf('boost'))).toBe(
      'On its own, deck 1 peaks at +6 dB and deck 2 at +11 dB. Together, the mix would peak at +15 dB, 3 dB over the red.',
    );
  });

  it('covers closed faders', () => {
    const silent = cloneSettings(START);
    silent.deck1.fader = 0;
    expect(sentence(silent)).toContain('Both faders are down. The mix is silent.');
  });

  it('marks the numbers and the colour word for styling', () => {
    const segs = blendSentence(challenge, analyseBlend(challenge));
    expect(segs.filter((x) => x.kind === 'value').map((x) => text(x.text))).toEqual(['+6 dB', '+12 dB']);
    expect(segs.find((x) => x.kind === 'zone')).toMatchObject({ text: 'in the red', zone: 'red' });
  });

  it('keeps each sentence short', () => {
    const all = [START, challenge, settingsOf('hot'), settingsOf('swap'), settingsOf('ease'), settingsOf('boost')];
    for (const s of all) for (const one of sentence(s).split(/(?<=\.)\s/)) expect(words(one)).toBeLessThanOrEqual(22);
  });
});

describe('zone words', () => {
  it('match the meter', () => {
    expect(zonePhrase(-3)).toBe('in the green');
    expect(zonePhrase(0)).toBe('in the orange');
    expect(zonePhrase(9)).toBe('in the orange');
    expect(zonePhrase(12)).toBe('in the red');
    expect(text(zonePhrase(14))).toBe('2 dB over the red');
  });
});

describe('explanation line', () => {
  it('gives one reason per state', () => {
    expect(explain(START)).toBe('Bring deck 2’s fader up. Watch the MASTER meters.');
    expect(text(explain(challenge))).toBe(
      'When the kicks land together, their peaks add. Two equal kicks make a peak 6 dB higher, two lights up the meter.',
    );
    expect(explain(settingsOf('hot'))).toMatch(/two lights up the meter/);
    expect(explain(settingsOf('swap'))).toBe('Only one bassline plays at full. The kicks barely stack.');
    expect(explain(settingsOf('ease'))).toBe('Deck 1 sits lower in the mix. Its kicks add less.');
    expect(explain(settingsOf('boost'))).toBe('The LOW boost makes one kick louder before the two stack.');
    expect(text(explain(settingsOf('orange')))).toBe(
      'Tracks that peak on the first orange light sit 12 dB under the red. That leaves room for the 6 dB a blend adds.',
    );
  });

  it('talks about deck 2 coming in while its fader is on the way up', () => {
    const coming = cloneSettings(START);
    coming.deck2.fader = 9;
    expect(explain(coming)).toBe('The kicks stack higher as deck 2 comes in.');
    // Just under the red, with CLIP lit…
    const lowered = cloneSettings(challenge);
    lowered.deck1.fader = 9;
    expect(explain(lowered)).toBe('Deck 1 is only a little lower. The kicks still stack close to the red.');
    // …and from the top orange light, where one mark down isn't enough to leave the red.
    const hot = cloneSettings(preset('hot').settings);
    hot.deck1.fader = 9;
    expect(explain(hot)).toBe('Deck 1 is only a little lower. The kicks still stack into the red.');
  });
});

describe('a channel meter in the red', () => {
  const hot: BlendSettings = {
    deck1: { trim: 12, low: 0, fader: 6 },
    deck2: { trim: 6, low: 0, fader: 10 },
    aligned: true,
  };

  it('is named first, with the fix, since its fader comes too late', () => {
    expect(explain(hot)).toBe('Deck 1 hits the red before its fader. Turn its TRIM down.');
    const boosted = { ...hot, deck1: { ...hot.deck1, low: 6 } };
    expect(explain(boosted)).toBe('Deck 1 hits the red before its fader. Turn its LOW or TRIM down.');
    const both: BlendSettings = {
      deck1: { trim: 12, low: 0, fader: 10 },
      deck2: { trim: 12, low: 0, fader: 10 },
      aligned: true,
    };
    expect(explain(both)).toBe('Both decks hit the red before their faders. Turn the TRIM down on each.');
  });

  it('says "would peak" for a track past the red, as the mix sentence does', () => {
    const over = { ...hot, deck1: { ...hot.deck1, low: 6 } };
    expect(sentence(over)).toMatch(/^On its own, deck 1 would peak at \+17 dB, and deck 2 peaks at \+6 dB\. /);
    expect(sentence(hot)).toMatch(/^On its own, deck 1 peaks at \+12 dB and deck 2 at \+6 dB\. /);
  });

  it('keeps the challenge open with its own message', () => {
    expect(challengeMessage('hot1')).toBe(
      'The MASTER meters are clear, but deck 1’s channel meter is in the red. That deck distorts before its fader.',
    );
    expect(challengeMessage('hot2')).toMatch(/deck 2’s channel meter/);
  });
});

describe('status lamp', () => {
  it('says Done or In the red, and a neutral word for the rest', () => {
    expect(statusLamp('done')).toEqual({ label: 'Done', tone: 'done' });
    expect(statusLamp('red')).toEqual({ label: 'In the red', tone: 'red' });
    for (const s of ['clip', 'hot1', 'hot2'] as const) expect(statusLamp(s).label).toBe('Nearly');
    for (const s of ['waiting', 'apart', 'cut'] as const) expect(statusLamp(s).label).toBe('Not yet');
  });

  it('leaves the verdict word to the lamp, so the message beside it says why instead', () => {
    for (const s of ['clip', 'hot1', 'hot2', 'done'] as const)
      expect(challengeMessage(s)).not.toMatch(/^(Nearly|Done)\b/);
  });
});

describe('the readout by the MASTER meters', () => {
  const readout = (s: BlendSettings) => {
    const r = mixReadout(analyseBlend(s));
    return { ...r, value: text(r.value), words: text(r.words) };
  };

  it('says where the mix peaks and its colour, in the sentence’s words', () => {
    expect(readout(challenge)).toEqual({ value: '+12 dB', zone: 'red', words: 'in the red' });
    expect(readout(settingsOf('hot'))).toEqual({ value: '+15 dB', zone: 'red', words: '3 dB over the red' });
    expect(readout(settingsOf('swap'))).toEqual({ value: '+8 dB', zone: 'orange', words: 'in the orange' });
    expect(readout(START)).toEqual({ value: '+6 dB', zone: 'orange', words: 'in the orange' });
    // The same number as the sentence gives the mix.
    for (const s of [START, challenge, ...PRESETS.map((p) => p.settings)]) {
      const values = blendSentence(s, analyseBlend(s)).filter((x) => x.kind === 'value');
      expect(text(values.at(-1)?.text ?? '')).toBe(readout(s).value);
    }
  });

  it('goes dark with the meters', () => {
    const silent = cloneSettings(START);
    silent.deck1.fader = 0;
    expect(readout(silent)).toEqual({ value: 'off', zone: null, words: 'dark' });
    // Too quiet to light an LED: dark, whatever the number.
    const quiet = cloneSettings(START);
    quiet.deck1.fader = 1;
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

  it('puts the guess beside the peak the meters show', () => {
    const peak = displayDb(analyseBlend(challenge).mix);
    expect(text(guessReveal(9, peak))).toBe('You guessed +9 dB. MASTER peaked at +12 dB.');
    expect(text(guessReveal(12, peak))).toBe('You guessed +12 dB. MASTER peaked at +12 dB.');
    // Past the red the meter can't show it, so the words match the readout's "would peak".
    const past = displayDb(analyseBlend(settingsOf('hot')).mix);
    expect(text(guessReveal(12, past))).toBe('You guessed +12 dB. MASTER would peak at +15 dB.');
  });

  it('names each LED in words a screen reader says well', () => {
    expect(guessSpot(12)).toBe('plus 12 decibels, in the red');
    expect(guessSpot(0)).toBe('0 decibels, in the orange');
    expect(guessSpot(-24)).toBe('minus 24 decibels, in the green');
  });
});

describe('preset sets', () => {
  it('have plain names, and the fixes say when they’ll show', () => {
    expect(PRESET_GROUPS).toEqual({ push: 'Blends that hit the red', out: 'Fixes' });
    expect(WAYS_OUT_WAIT).toBe('They appear after you hit the red.');
    expect(WAYS_OUT_SHOW).toBe('Show them now');
    expect(WAVEFORM_TOGGLE).toBe('Show the waveform');
  });

  it('are named right where the notes send the reader to a pad', () => {
    expect(BARELY_OVER_NOTE).toMatch(new RegExp(`press ${preset('hot').label}\\.$`));
  });
});

describe('challenge copy', () => {
  it('has a message for every outcome the lab can reach', () => {
    expect(challengeMessage('waiting')).toBeNull();
    // Kicks that miss each other: the model has the case, the lab never plays it.
    expect(challengeMessage('apart')).toBeNull();
    const statuses: ChallengeStatus[] = ['red', 'clip', 'hot1', 'hot2', 'cut', 'done'];
    for (const s of statuses) expect(challengeMessage(s)).toBeTruthy();
    // The lamp already says Done, so the message states the result.
    expect(challengeMessage('done')).toBe('Deck 2 is all the way up, and the red light stays dark.');
  });

  it('says what CLIP means, and labels its threshold as the lab’s', () => {
    expect(challengeMessage('clip')).toBe('The red light is dark and CLIP is lit. The mix is about to distort.');
    expect(MODEL_NOTES.map(text)).toContain(
      'If CLIP blinks, even slowly, pull a channel fader down a little. Pioneer does not say at what level CLIP starts to blink. In this lab it blinks slowly within 1.5 dB of the red light, and fast past it.',
    );
  });

  it('keeps only the two model notes that change what a DJ does, each opening with the action', () => {
    expect(MODEL_NOTES_TITLE).toBe('What the lab assumes');
    expect(MODEL_NOTES).toHaveLength(2);
    expect(MODEL_NOTES[0]).toMatch(
      /^On the unit, watch the MASTER meters as you pull a fader down\. Pioneer does not publish/,
    );
    expect(MODEL_NOTES[1]).toMatch(/^If CLIP blinks/);
  });
});

describe('live region', () => {
  it('says the verdict in words, never numbers, so a step that changes nothing stays quiet', () => {
    // Deck 2 coming up from the start: the mix climbs, the verdict doesn’t move until CLIP lights.
    const lines = [0.5, 2, 4, 6, 8].map((fader) => verdict({ ...START, deck2: { ...START.deck2, fader } }));
    expect(new Set(lines)).toEqual(new Set(['The MASTER meters are in the orange.']));
    expect(verdict({ ...START, deck2: { ...START.deck2, fader: 9 } })).toBe(
      'The MASTER meters are in the orange. CLIP is lit.',
    );
    expect(verdict(challenge)).toBe(challengeMessage('red'));
    for (const s of [START, challenge, ...PRESETS.map((p) => p.settings)]) expect(verdict(s)).not.toMatch(/dB|[+−]\d/);
  });

  it('names the meters going dark or a channel going red before the challenge starts', () => {
    const silent = cloneSettings(START);
    silent.deck1.fader = 0;
    expect(verdict(silent)).toBe('The MASTER meters are dark.');
    const hot = cloneSettings(START);
    hot.deck1.trim = 12;
    expect(verdict(hot)).toBe('The MASTER meters are in the red. CLIP is lit. Deck 1’s channel meter is in the red.');
    hot.deck2.trim = 12;
    hot.deck2.fader = 6;
    expect(verdict(hot)).toMatch(/Both channel meters are in the red\.$/);
  });

  it('gives a pad the whole result, numbers and all, without saying the red twice', () => {
    const line = (id: PresetId) => {
      const s = settingsOf(id);
      const r = analyseBlend(s);
      return text(presetLine(s, r, challengeStatus(s, r)));
    };
    expect(line('orange')).toBe(
      'Each deck peaks at 0 dB on its own. Together, the mix peaks at +6 dB, in the orange. Challenge done.',
    );
    expect(line('hot')).toBe(
      'Each deck peaks at +9 dB on its own. Together, the mix would peak at +15 dB, 3 dB over the red.',
    );
    // Three pads land on "done": each still says something different.
    expect(new Set((['swap', 'ease', 'orange'] as const).map(line)).size).toBe(3);
  });
});

describe('house style', () => {
  const all = [
    CHALLENGE_PROMPT,
    HINT,
    LISTEN_NOTE,
    BARELY_OVER_NOTE,
    WAYS_OUT_WAIT,
    WAYS_OUT_SHOW,
    WAVEFORM_TOGGLE,
    NO_SOUND,
    ...Object.values(PRESET_GROUPS),
    GUESS_PROMPT,
    GUESS_LEGEND,
    guessNote(9, true),
    guessReveal(9, 12),
    guessReveal(12, 15),
    trimHint(1),
    MODEL_NOTES_TITLE,
    ...MODEL_NOTES,
    ...(['red', 'clip', 'hot1', 'hot2', 'cut', 'done'] as const).map((s) => challengeMessage(s) ?? ''),
  ];
  /** Every line the lab can show, the explanations and the reactive sentence included. */
  const everything = [
    ...all,
    ...[START, challenge, ...PRESETS.map((p) => p.settings)].flatMap((s) => [explain(s), sentence(s), verdict(s)]),
  ];

  it('avoids exclamation marks, em dashes and "please"', () => {
    for (const s of all) {
      expect(s).not.toMatch(/!|—|please/i);
    }
  });

  it('says things plainly: no question-and-answer lead-ins, no two-beat slogans, no colon slogans', () => {
    const lines = [...all, HINT, ...PRESETS.map((p) => explain(p.settings)), explain(START), explain(challenge)];
    for (const s of lines) {
      // "Stuck? Try…", "No sound? Check…"
      expect(s, s).not.toMatch(/(^|\. )[^.?]{1,24}\? [A-Z]/);
      // "X. Not Y."
      expect(s, s).not.toMatch(/\. Not [a-z]/);
      // A short label, a colon, then the point: "Guess first: tap…"
      expect(s, s).not.toMatch(/^[^:.]{1,16}: [a-z]/);
    }
  });

  it('uses curly apostrophes and the typographic minus', () => {
    for (const s of [...all, ...PRESETS.map((p) => explain(p.settings))]) {
      expect(s, s).not.toMatch(/['"]/);
      expect(s, s).not.toMatch(/(^|\s)-\d/);
    }
  });

  it('keeps every sentence to 20 words or fewer', () => {
    for (const s of everything) for (const one of s.split(/(?<=\.)\s/)) expect(words(one), one).toBeLessThanOrEqual(20);
  });

  it('calls the stereo pair the MASTER meters, as the unit prints it', () => {
    for (const s of everything) expect(s, s).not.toMatch(/middle meters?\b/i);
  });

  it('writes the reference register: no negative contractions, no ", so" chains, no idioms', () => {
    for (const s of everything) {
      expect(s, s).not.toMatch(/n’t\b|n't\b/);
      expect(s, s).not.toMatch(/, so\b/);
      expect(s, s).not.toMatch(/\b(once you|keep an eye|go by|eased?\b|a notch|add up|show up)/i);
    }
  });

  it('keeps the spec’s fixed lines', () => {
    expect(CHALLENGE_PROMPT).toBe('Bring deck 2 all the way up without the MASTER meters going red.');
    expect(NO_SOUND).toBe(
      'This browser cannot play the sound. Everything else works. To hear it, try another browser.',
    );
    expect(trimHint(2)).toBe('Peak on CH2');
  });

  it('never lets a number part from its unit', () => {
    for (const s of [...all, explain(settingsOf('hot'))]) expect(s).not.toMatch(/\d[ \u2009\u202f]dB/);
  });

  it('reads fader positions with units in words', () => {
    expect(speakFader(10)).toBe('fully up, 0 decibels');
    expect(speakFader(8)).toBe('8 of 10, minus 6 decibels');
    expect(speakFader(0)).toBe('closed, silent');
    expect(speakFader(9.5)).toBe('9.5 of 10, minus 2 decibels');
  });
});
