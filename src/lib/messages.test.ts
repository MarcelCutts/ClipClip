import { describe, expect, it } from 'vitest';
import { CHECKLISTS } from './checklists';
import {
  CHANGEOVER_LINE,
  chatMessages,
  DOORS_PATH,
  firstSentence,
  GUIDE_PATH,
  parseInline,
  parseMessage,
  REVIEW_PATH,
  ruleLine,
  wordCount,
} from './messages';
import { DJ_RULES } from './rules';
import { MONITOR_TAG } from './tags';

const BASE = 'https://crew.example/out-of-the-red';
const messages = chatMessages((path) => `${BASE}${path}`);
const textOf = (id: string) => messages.find((m) => m.id === id)?.text ?? '';

describe('chat messages', () => {
  it('has the four messages', () => {
    expect(messages.map((m) => m.id)).toEqual(['dj-briefing', 'crew-setup', 'changeover', 'review']);
  });

  it.each(messages)('$title is 60 words or fewer', ({ text }) => {
    expect(wordCount(text)).toBeLessThanOrEqual(60);
  });

  it.each(messages)('$title opens in bold and ends on its link', ({ text }) => {
    expect(text).toMatch(/^\*[^*\s][^*]*\*/);
    const lastWord = text.split(/\s+/).at(-1) ?? '';
    expect(lastWord.startsWith(`${BASE}/`)).toBe(true);
    expect(text.indexOf('https://')).toBe(text.lastIndexOf('https://'));
  });

  it.each(messages)('$title says no please, and never shouts', ({ text }) => {
    expect(text).not.toMatch(/\bplease\b/i);
    expect(text).not.toContain('!');
  });

  it.each(messages)('$title links into the new site: the guide or the night page', ({ text }) => {
    expect(text).not.toMatch(/\/(dj|crew|lab|why)\//);
    expect(text).toMatch(new RegExp(`${BASE}/(#[a-z-]+|night/#[a-z-]+)$`));
  });

  it('says things plainly: no question-and-answer lead-ins', () => {
    for (const { title, text } of messages) {
      // "Playing soon? Test yourself…" is a question nobody asked. A condition starts with "If".
      expect(text, title).not.toMatch(/\?\s+\p{Lu}/u);
    }
  });

  it('briefs DJs with the rules as the “Know by heart” boxes set them', () => {
    const briefing = textOf('dj-briefing');
    for (const rule of DJ_RULES) {
      expect(briefing).toContain(`- ${rule.challenge}: ${rule.response}.`);
      // What to do if the rule isn't met: the note's first sentence. The rest is on the page.
      if (rule.note) expect(briefing).toContain(`${rule.response}. ${firstSentence(rule.note)}`);
      expect(briefing.split('\n')).toContain(ruleLine(rule));
    }
    expect(firstSentence('If red, ease TRIM back. Set it on cue.')).toBe('If red, ease TRIM back.');
  });

  it('tells DJs what they get before the rules, and which knob is theirs', () => {
    const briefing = textOf('dj-briefing');
    const [first = ''] = briefing.split('\n');
    expect(first).toMatch(/Every set here is recorded/);
    // MASTER LEVEL is the crew’s (the rule says so); BOOTH MONITOR is the DJ’s, as its tape says.
    expect(briefing).toContain(`- BOOTH MONITOR is ${MONITOR_TAG.owner}.`);
    expect(briefing).toMatch(/MASTER LEVEL is the crew’s/);
    expect(briefing.endsWith(`${BASE}${GUIDE_PATH}`)).toBe(true);
  });

  it('builds the crew’s check from the doors checklist, so the two can’t disagree', () => {
    const check = textOf('crew-setup');
    const bullets = check.split('\n').filter((line) => line.startsWith('- '));
    expect(bullets).toEqual(CHECKLISTS.doors.items.map((i) => `- ${i.check}: ${i.target}`));
    // Titled as its laminated card is: *C1 Doors open*.
    expect(check.split('\n')[0]).toBe(`*${CHECKLISTS.doors.code} ${CHECKLISTS.doors.title}*`);
    expect(check.endsWith(`${BASE}${DOORS_PATH}`)).toBe(true);
    expect(DOORS_PATH).toBe('/night/#doors');
  });

  it('sends the reminder to the meter check, by the name the guide gives it', () => {
    expect(textOf('review')).toContain(`${BASE}${REVIEW_PATH}`);
    expect(REVIEW_PATH).toBe('/#check');
    expect(textOf('review')).toMatch(/the meter check/);
    // The middle meters and the channel meters are named as such: never "the XDJ meters".
    expect(textOf('review')).not.toMatch(/XDJ meters/);
  });

  it('gives the next DJ a meter position, not just a colour', () => {
    // Orange runs from 0 to +9, and a blend adds up to two more lights.
    expect(CHANGEOVER_LINE).toMatch(/first or second orange/);
    // Who to ask for more, in the rule's own words.
    expect(CHANGEOVER_LINE).toMatch(/For a louder room, ask us\./);
  });

  it('keeps the changeover line to about a dozen speakable words', () => {
    expect(textOf('changeover')).toContain(CHANGEOVER_LINE);
    expect(wordCount(CHANGEOVER_LINE)).toBeLessThanOrEqual(14);
    for (const sentence of CHANGEOVER_LINE.split(/(?<=\.)\s+/)) {
      expect(wordCount(sentence)).toBeLessThanOrEqual(8);
    }
  });
});

describe('WhatsApp preview', () => {
  it('reads bold, italic and links', () => {
    expect(parseInline('*Heads up* and _this_: https://x.example/night/')).toEqual([
      { kind: 'bold', text: 'Heads up' },
      { kind: 'text', text: ' and ' },
      { kind: 'italic', text: 'this' },
      { kind: 'text', text: ': ' },
      { kind: 'link', text: 'https://x.example/night/' },
    ]);
  });

  it('leaves markers inside words and loose stars alone', () => {
    expect(parseInline('snake_case_word 2 * 3 * 4')).toEqual([{ kind: 'text', text: 'snake_case_word 2 * 3 * 4' }]);
  });

  it('groups "- " lines into one list', () => {
    const blocks = parseMessage('*Title*\n- one\n- *two*\nLast line');
    expect(blocks.map((b) => b.kind)).toEqual(['line', 'list', 'line']);
    const list = blocks[1];
    expect(list?.kind === 'list' && list.items.length).toBe(2);
  });

  it('parses every real message without losing text', () => {
    for (const { text } of messages) {
      const flat = parseMessage(text)
        .flatMap((b) => (b.kind === 'list' ? b.items.flat() : b.inlines))
        .map((i) => i.text)
        .join('');
      const stripped = text.replace(/^- /gm, '').replace(/\n/g, '').replace(/[*_]/g, '');
      expect(flat.replace(/[*_]/g, '')).toBe(stripped);
    }
  });
});
