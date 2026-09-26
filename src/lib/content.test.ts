import { describe, expect, it } from 'vitest';
import * as BLEND_COPY from './blend/copy';
import { CHECKLISTS } from './checklists';
import { drillAnchor, FIXES } from './fixes';
import { GLOSSARY } from './glossary';
import * as HEAR_COPY from './hear/copy';
import * as LAB_COPY from './lab/copy';
import { chatMessages } from './messages';
import { MYTHS } from './myths';
import { CARDS } from './quiz/cards';
import { CHECKS, STEPS } from './record/flow';
import { COPY as RIG_COPY } from './rig';
import { CREW_RULES, DJ_BOX_RULES, DJ_RULES } from './rules';
import { SOURCES } from './sources';
import { MASTER_TAG, SHORT_TAGS } from './tags';
import { METER_SEGMENTS, scaleLabel } from './xdj';

const words = (s: string) => s.trim().split(/\s+/).length;
const MESSAGES = chatMessages((path) => `https://crew.example${path}`);

/** The shared copy this workstream owns: what the booth, the night page and the print kit say. */
const SHARED = { GLOSSARY, MYTHS, SHORT_TAGS, MASTER_TAG, CHECKLISTS, FIXES, CARDS, MESSAGES };

describe('content guards', () => {
  it('keeps every glossary gloss to 15 words or fewer', () => {
    for (const [key, g] of Object.entries(GLOSSARY)) expect(words(g.gloss), key).toBeLessThanOrEqual(15);
  });

  it('keeps the rules short enough to read on a strip of tape', () => {
    // Ten words lets the rule be a plain sentence: "Keep the channel meters on the first or second orange."
    for (const rule of [...DJ_BOX_RULES, ...CREW_RULES]) {
      expect(words(rule.text), rule.text).toBeLessThanOrEqual(10);
      expect(words(rule.note ?? ''), rule.text).toBeLessThanOrEqual(20);
    }
    expect(DJ_RULES).toHaveLength(3);
  });

  it('keeps each box to know by heart to four items or fewer, the DJ’s own knob included', () => {
    // UK CAA CAP 676: four items or fewer. The crew box is the same three on the guide and the night page.
    expect(DJ_BOX_RULES.length).toBeLessThanOrEqual(4);
    expect(CREW_RULES).toHaveLength(3);
    expect(DJ_BOX_RULES.slice(0, DJ_RULES.length)).toEqual(DJ_RULES);
    const booth = DJ_BOX_RULES.at(-1);
    expect(booth?.response).toMatch(/BOOTH MONITOR/);
    // In the booth card's words: it's the DJ's, and it's only the monitors.
    expect(booth?.note).toMatch(/^It’s yours\./);
    expect(booth?.note).toMatch(/not the room or the recording/);
  });

  it('writes the myths as corrections, with every part filled in', () => {
    const ids = new Set<string>();
    for (const m of MYTHS) {
      expect(ids.has(m.id), m.id).toBe(false);
      ids.add(m.id);
      for (const part of [m.truth, m.claim, m.fair, m.actually, m.instead]) expect(part.length).toBeGreaterThan(10);
      // The heading is the correction, never the myth restated.
      expect(m.truth).not.toEqual(m.claim);
    }
  });

  it('quotes Pioneer word for word, with the page, where a myth leans on the manual', () => {
    const headroom = MYTHS.find((m) => m.id === 'headroom');
    expect(headroom?.actually).toContain('“or the sound may be distorted” (page 31)');
    expect(headroom?.actually).toContain('“indicates that the sound is distorted” (page 27)');
    const limiter = MYTHS.find((m) => m.id === 'limiter');
    // Pioneer lists no limiter; it never says there is none, so neither do we.
    expect(limiter?.actually).toMatch(/Pioneer lists no limiter/);
    expect(limiter?.actually).not.toMatch(/has no limiter/);
    expect(limiter?.actually).toMatch(/\(page 32\), so only your meters protect the recording\.$/);
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
    // SoundCloud's help page says it "applies Loudness Normalization to your tracks as they're played".
    const quiet = MYTHS.find((m) => m.id === 'quiet-file');
    expect(quiet?.actually).toMatch(/SoundCloud turns loud tracks down/);
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
      DJ_BOX_RULES,
      CREW_RULES,
      SOURCES,
      STEPS,
      CHECKS,
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
    const text = JSON.stringify({ ...SHARED, DJ_BOX_RULES, CREW_RULES });
    expect(text).not.toMatch(/\bnormaliz|\bcolor\b|\bcenter\b|\byellow\b/i);
    expect(text).not.toMatch(/\bTHD\b/);
  });

  it('names the meters as the guide does, and says where Pioneer is silent', () => {
    const text = JSON.stringify({ GLOSSARY, MYTHS, DJ_BOX_RULES, CREW_RULES });
    // Channel meters and middle meters; Pioneer's own names only in brackets.
    expect(text).not.toMatch(/side meters?|side ones|master meters?/i);
    expect(GLOSSARY.middleMeter.gloss).toContain('(Pioneer: master level indicator)');
    // Pioneer doesn't say whether MASTER ATT reaches MASTER 2, so the gloss hedges and points at the test.
    expect(GLOSSARY.att.gloss).toMatch(/MASTER ATT may lower the recording too \(test T2\)/);
    // Loud, not "hot", in the guide's own words.
    expect(JSON.stringify({ GLOSSARY, DJ_BOX_RULES, CREW_RULES })).not.toMatch(/\bhot(ter)?\b/i);
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
