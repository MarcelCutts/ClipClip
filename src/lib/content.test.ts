import { describe, expect, it } from 'vitest';
import * as BLEND_COPY from './blend/copy';
import { CHECKLISTS } from './checklists';
import { drillAnchor, FIXES } from './fixes';
import { GLOSSARY } from './glossary';
import * as HEAR_COPY from './hear/copy';
import * as LAB_COPY from './lab/copy';
import { chatMessages } from './messages';
import { KICKS_TOGETHER_DB, TARGET_PEAK_DB } from './model';
import { MYTHS } from './myths';
import { CARDS } from './quiz/cards';
import { STEPS } from './record/flow';
import { COPY as RIG_COPY } from './rig';
import { CREW_RULES, DJ_RULES } from './rules';
import { SOURCES } from './sources';
import { MASTER_TAG, SHORT_TAGS } from './tags';
import { CEILING_DB, litCount, METER_SEGMENTS, scaleLabel } from './xdj';

const words = (s: string) => s.trim().split(/\s+/).length;
const MESSAGES = chatMessages((path) => `https://crew.example${path}`);

/** The shared copy this workstream owns: what the booth, the night page and the print kit say. */
const SHARED = { GLOSSARY, MYTHS, SHORT_TAGS, MASTER_TAG, CHECKLISTS, FIXES, CARDS, MESSAGES };

describe('content guards', () => {
  it('keeps every glossary gloss to 15 words or fewer', () => {
    for (const [key, g] of Object.entries(GLOSSARY)) expect(words(g.gloss), key).toBeLessThanOrEqual(15);
  });

  it('keeps each line to know by heart short: its note to 20 words, and a tape’s sentence to 10', () => {
    for (const rule of [...DJ_RULES, ...CREW_RULES]) {
      expect(words(rule.note), rule.challenge).toBeLessThanOrEqual(20);
      if (rule.text) expect(words(rule.text), rule.text).toBeLessThanOrEqual(10);
    }
  });

  it('sets each box as three lines: the printed name, the state you can see, and what to do if not', () => {
    // UK CAA CAP 676 prefers fewer than four items (Ch. 7 §2.6). The DJ's box is the booth card's too.
    expect(DJ_RULES).toHaveLength(3);
    expect(CREW_RULES).toHaveLength(3);
    for (const rule of [...DJ_RULES, ...CREW_RULES]) {
      // A state to see, never an instruction to look.
      expect(rule.response, rule.challenge).not.toMatch(/\b(?:check|set|watch|as required)\b/i);
      // The note starts with its condition: "If red, …", "For a louder room, …".
      expect(rule.note, rule.challenge).toMatch(/^(?:If|For) [^,.]+, /);
    }
  });

  it('names the DJ’s lines as the mixer prints them, and gives the DJ the knob for a louder booth', () => {
    expect(DJ_RULES.map((r) => r.challenge)).toEqual([
      'Channel meters',
      'MASTER meters (the pair in the middle)',
      'MASTER LEVEL',
    ]);
    // TRIM's first mention says what it is, for DJs who learned on GAIN.
    expect(DJ_RULES[0]?.note).toContain('TRIM (the gain knob)');
    const master = DJ_RULES[2];
    expect(master?.note).toMatch(/For a louder booth, turn up BOOTH MONITOR\.$/);
    // The tape under MASTER LEVEL prints the note's first sentence, so the two can't disagree.
    expect(master?.text && master.note.startsWith(master.text)).toBe(true);
  });

  it('names the DJ’s targets by the light and its mark, as the model sets them', () => {
    const [channel, master] = DJ_RULES;
    const orange = METER_SEGMENTS.filter((s) => s.zone === 'orange');
    // The aim is the first orange light, 0. The MASTER meters keep the top orange, +9, dark.
    expect(TARGET_PEAK_DB.aim).toBe(orange[0]?.db);
    expect(TARGET_PEAK_DB.top).toBe(orange.at(-1)?.db);
    expect(channel?.response).toBe(`first orange (${scaleLabel(TARGET_PEAK_DB.aim)}) at the loudest part`);
    expect(channel?.note).toMatch(/^If the second orange lights on every kick, turn TRIM/);
    expect(master?.response).toBe('top orange dark');
    expect(master?.note).toMatch(/^If the top orange lights, pull a channel fader down/);
    // Lined-up kicks can add up to 6 dB, two lights. From the aim, a blend stays under the top orange.
    expect(TARGET_PEAK_DB.blend).toBe(TARGET_PEAK_DB.aim + KICKS_TOGETHER_DB);
    expect(litCount(TARGET_PEAK_DB.blend) - litCount(TARGET_PEAK_DB.aim)).toBe(2);
    expect(litCount(TARGET_PEAK_DB.blend)).toBeLessThan(litCount(TARGET_PEAK_DB.top));
    // A light is a threshold: a channel just under the second orange still keeps a lined-up blend
    // under the top orange. From the top orange, a blend passes red.
    expect((orange[1]?.db ?? 0) - 0.1 + KICKS_TOGETHER_DB).toBeLessThan(TARGET_PEAK_DB.top);
    expect(TARGET_PEAK_DB.top + KICKS_TOGETHER_DB).toBeGreaterThan(CEILING_DB);
    // The old target, which let a blend reach red, is gone from the shared words.
    expect(JSON.stringify({ DJ_RULES, CREW_RULES, MYTHS, GLOSSARY })).not.toMatch(/first or second orange/);
  });

  it('keeps the room’s volume at the amps, no higher than the RIG marks', () => {
    const crew = CREW_RULES.find((r) => r.challenge === 'MASTER LEVEL');
    expect(crew?.response).toBe('fully up, on the REC mark');
    expect(crew?.note).toBe('If a DJ wants a louder room, turn up the amps, no higher than the RIG marks.');
  });

  it('points each crew line at its drill on the night page', () => {
    for (const rule of CREW_RULES)
      expect(
        FIXES.some((f) => f.id === rule.drill),
        rule.challenge,
      ).toBe(true);
  });

  it('writes the myths as short corrections, each ending on its own action', () => {
    const ids = new Set<string>();
    for (const m of MYTHS) {
      expect(ids.has(m.id), m.id).toBe(false);
      ids.add(m.id);
      for (const part of [m.truth, m.claim, m.answer, m.action]) expect(part.length).toBeGreaterThan(10);
      // The heading is the correction, never the myth restated.
      expect(m.truth).not.toEqual(m.claim);
      // Short enough to read as a pair: the answer and its action in 50 words.
      expect(words(`${m.answer} ${m.action}`), m.id).toBeLessThanOrEqual(50);
    }
    // Each ends on something to do about that belief, not the same rule again.
    expect(new Set(MYTHS.map((m) => m.action)).size).toBe(MYTHS.length);
    for (const rule of DJ_RULES) expect(MYTHS.map((m) => m.action)).not.toContain(rule.note);
  });

  it('quotes Pioneer word for word, with the page, where a myth leans on the manual', () => {
    const headroom = MYTHS.find((m) => m.id === 'headroom');
    // Pioneer gives output levels (Quick Start Guide p. 20), but no margin above the red light.
    expect(headroom?.answer).toMatch(/^Pioneer publishes no headroom figure above the red light\./);
    expect(headroom?.answer).toContain('“or the sound may be distorted” (p. 31)');
    // The big names: nobody after the mixer takes its crunch out. Another Pioneer mixer's room above
    // its meter is published, in AlphaTheta's words; none is published for ours.
    const videos = MYTHS.find((m) => m.id === 'videos');
    expect(videos?.truth).not.toMatch(/engineer/);
    expect(videos?.answer).toContain('“up to 21\u00a0dB”');
    expect(videos?.answer).toMatch(/no such figure for the XDJ-RX2\./);
    const limiter = MYTHS.find((m) => m.id === 'limiter');
    // Pioneer lists no limiter; it never says there is none, so neither do we.
    expect(limiter?.answer).toMatch(/Pioneer lists no limiter/);
    expect(limiter?.answer).not.toMatch(/has no limiter/);
    expect(limiter?.answer).toMatch(/\(p\. 32\)\.$/);
  });

  it('links every source over https, and every myth’s source is on the sources list', () => {
    const urls = new Set<string>();
    for (const group of SOURCES) {
      for (const s of group.sources) {
        expect(new URL(s.url).protocol, s.title).toBe('https:');
        urls.add(s.url);
      }
    }
    for (const m of MYTHS) if (m.source) expect(urls.has(m.source.url), m.id).toBe(true);
  });

  it('names only the streaming service whose loudness normalisation it can cite', () => {
    // SoundCloud's help page says it "applies Loudness Normalization to your tracks as they're played". It
    // does not say whether it turns quiet tracks up, so the claim is SoundCloud's own words, and no more.
    const quiet = MYTHS.find((m) => m.id === 'quiet-file');
    expect(quiet?.answer).toContain('SoundCloud “applies Loudness Normalization” as it plays tracks.');
    expect(quiet?.answer).not.toMatch(/turns loud tracks down|no louder/);
    expect(quiet?.source?.url).toMatch(/^https:\/\/help\.soundcloud\.com\//);
    const text = JSON.stringify(MYTHS);
    expect(text).not.toMatch(/and others|Spotify|Apple Music|YouTube|Mixcloud/);
  });

  it('lists every manual the fixes lean on', () => {
    const titles = SOURCES.flatMap((g) => g.sources.map((s) => s.title)).join('\n');
    for (const doc of [
      'XDJ-RX2 Operating Instructions',
      'Recorder+Streamer MK1 manual',
      'DriveRack PA2 Owner’s Manual',
      'GX3, GX5 and GX7 user manual',
      'Sound System Interconnection (RaneNote 110)',
    ]) {
      expect(titles).toContain(doc);
    }
  });

  it('keeps every number on the same line as its unit', () => {
    // "6 dB" needs a no-break space (or formatDb), or the number and unit can wrap apart. The copy modules'
    // functions drop out of the JSON, so this checks their fixed strings.
    const text = JSON.stringify({
      ...SHARED,
      DJ_RULES,
      CREW_RULES,
      SOURCES,
      STEPS,
      RIG_COPY,
      LAB_COPY,
      BLEND_COPY,
      HEAR_COPY,
    });
    expect(text).not.toMatch(/\d (?:dB|dBFS|dBTP|dBu|dBV|Hz|kHz)\b/);
    // The copy this workstream owns joins times and lengths to their numbers too.
    expect(JSON.stringify(SHARED)).not.toMatch(/\d (?:m|seconds?|minutes?|hours?)\b/);
  });

  it('uses true minus signs and curly quotes in the shared copy', () => {
    const strings = JSON.stringify(SHARED).match(/"(?:[^"\\]|\\.)*"/g) ?? [];
    for (const s of strings) {
      expect(s, s).not.toMatch(/(^"|[\s(])-\d/);
      // JSON escapes straight double quotes; a straight apostrophe would show as it is.
      expect(s, s).not.toMatch(/'|\\"/);
    }
  });

  it('uses UK spelling and the words on the hardware', () => {
    const text = JSON.stringify({ ...SHARED, DJ_RULES, CREW_RULES });
    // A name keeps its maker's spelling, capitalised as printed: Audacity's Normalize, SoundCloud's
    // “Loudness Normalization”, AlphaTheta's Help Center. Our own words are normalise, colour and centre.
    expect(text).not.toMatch(/\bnormaliz|\bcolor\b|\bcenter\b/);
    // The LEDs are orange, whatever the case.
    expect(text).not.toMatch(/\byellow\b/i);
    expect(text).not.toMatch(/\bTHD\b/);
  });

  it('names things as the gear prints them, one word per meaning', () => {
    const text = JSON.stringify({ GLOSSARY, MYTHS, DJ_RULES, CREW_RULES });
    // Channel meters and the MASTER meters, as the panel prints MASTER; Pioneer's own names only in brackets.
    expect(text).not.toMatch(/side meters?|side ones|middle meters?/i);
    expect(GLOSSARY.masterMeters.gloss).toContain('(Pioneer: master level indicator)');
    // BOOTH is the output socket; BOOTH MONITOR is the knob.
    expect(GLOSSARY.booth.gloss).toMatch(/^The output sockets for the booth monitors\./);
    // "Recording level", Pioneer's word: to a DJ a record is a track. No idioms, no negative contractions.
    expect(text).not.toMatch(/record level|on cue|for good|ease (?:TRIM )?back|a notch|n’t\b/i);
    // Loud, not "hot", in the guide's own words.
    expect(JSON.stringify({ GLOSSARY, DJ_RULES, CREW_RULES })).not.toMatch(/\bhot(ter)?\b/i);
  });

  it('lists the glossary in alphabetical order, so a reader can find a word', () => {
    const terms = Object.values(GLOSSARY).map((g) => g.term.toLowerCase());
    expect(terms).toEqual([...terms].sort());
  });

  it('prints the meter’s scale as the panel does: a true minus, a plus sign, a bare 0', () => {
    expect(METER_SEGMENTS.map((s) => scaleLabel(s.db))).toEqual([
      '−24',
      '−18',
      '−15',
      '−12',
      '−9',
      '−6',
      '−3',
      '0',
      '+3',
      '+6',
      '+9',
      '+12',
    ]);
  });

  it('describes one wiring: the Howler on MASTER 2, the monitors on BOOTH', () => {
    const text = JSON.stringify(SHARED);
    expect(text).not.toMatch(/proposed|Master 2 wiring|old wiring|rewire|moves to BOOTH/i);
    expect(text).not.toMatch(/REC on BOOTH|BOOTH = REC|BOOTH (?:MONITOR )?(?:is|sets|feeds) the rec/i);
    expect(text).not.toMatch(/\/(?:dj|crew|lab|why)\//);
  });

  it('gives every drill, and every step of one, a unique id that works as an anchor', () => {
    const ids = FIXES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const anchors = FIXES.flatMap((f) => [drillAnchor(f.id), ...f.steps.map((_, i) => drillAnchor(f.id, i + 1))]);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const anchor of anchors) expect(anchor).toMatch(/^fix-[a-z][a-z0-9-]*$/);
    // Linked from the chat, the night page and the guide: /night/#fix-howler-red.
    expect(ids).toContain('howler-red');
    expect(drillAnchor('howler-red')).toBe('fix-howler-red');
  });
});
