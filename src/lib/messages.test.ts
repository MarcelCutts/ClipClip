import { describe, expect, it } from 'vitest';
import { CHECKLISTS } from './checklists';
import {
  chatMessages,
  DOORS_PATH,
  GUIDE_PATH,
  MAX_WORDS,
  NAME_BLANK,
  parseInline,
  parseMessage,
  REVIEW_PATH,
  ruleLine,
  wordCount,
} from './messages';
import { CARDS } from './quiz/cards';
import { DJ_RULES } from './rules';

const BASE = 'https://crew.example/out-of-the-red';
const messages = chatMessages((path) => `${BASE}${path}`);
const textOf = (id: string) => messages.find((m) => m.id === id)?.text ?? '';

describe('chat messages', () => {
  it('has three messages: the words for the next DJ are said at the booth (C2), not sent', () => {
    expect(messages.map((m) => m.id)).toEqual(['dj-briefing', 'crew-setup', 'review']);
  });

  it.each(messages)('$title fits one phone screen: 90 words or fewer', ({ text }) => {
    expect(MAX_WORDS).toBe(90);
    expect(wordCount(text)).toBeLessThanOrEqual(MAX_WORDS);
  });

  it('keeps the briefing’s own words to the few it needs: the recording, who is on crew, and the link', () => {
    // The limit went from 80 to 90 for the DJ lines, not for anything added around them.
    const own = textOf('dj-briefing')
      .split('\n')
      .filter((line) => !DJ_RULES.some((r) => line === ruleLine(r)));
    expect(own.map(wordCount)).toEqual([10, 4]);
  });

  it('adds few words of its own to what the pages say', () => {
    // The briefing is the three DJ lines plus one line before them and the link after: 15 words at most.
    const briefing = textOf('dj-briefing');
    const own = briefing
      .split('\n')
      .filter((line) => !DJ_RULES.some((r) => line === ruleLine(r)))
      .join(' ');
    expect(wordCount(own)).toBeLessThanOrEqual(15);
    // The reminder is one sentence of its own and the link.
    expect(wordCount(textOf('review'))).toBeLessThanOrEqual(25);
  });

  it.each(messages)('$title opens in bold and ends on its link', ({ text }) => {
    expect(text).toMatch(/^\*[^*\s][^*]*\*/);
    const lastWord = text.split(/\s+/).at(-1) ?? '';
    expect(lastWord.startsWith(`${BASE}/`)).toBe(true);
    expect(text.indexOf('https://')).toBe(text.lastIndexOf('https://'));
  });

  it.each(messages)('$title says no please, never shouts, and spells out its negatives', ({ text }) => {
    expect(text).not.toMatch(/\bplease\b/i);
    expect(text).not.toContain('!');
    expect(text).not.toMatch(/n’t\b|n't\b/);
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

  it('briefs DJs with the rules as the “Know by heart” boxes set them, notes and all', () => {
    const briefing = textOf('dj-briefing');
    for (const rule of DJ_RULES) {
      expect(briefing.split('\n')).toContain(`- ${rule.challenge}: ${rule.response}. ${rule.note}`);
      expect(briefing.split('\n')).toContain(ruleLine(rule));
    }
    expect(DJ_RULES).toHaveLength(3);
    expect(briefing).toMatch(/MASTER LEVEL: leave it fully up\./);
    expect(briefing.endsWith(`${BASE}${GUIDE_PATH}`)).toBe(true);
    expect(GUIDE_PATH).toBe('/#trim');
  });

  it('tells DJs that BOOTH MONITOR is theirs, once', () => {
    const briefing = textOf('dj-briefing');
    expect(briefing).toContain('For a louder booth, turn up BOOTH MONITOR.');
    expect(briefing.match(/BOOTH MONITOR/g)).toHaveLength(1);
  });

  it('tells DJs the set is recorded and who is on crew, and promises nothing more', () => {
    const [first = ''] = textOf('dj-briefing').split('\n');
    expect(first).toBe(`*Every set here is recorded.* ${NAME_BLANK} is on crew tonight.`);
    const all = messages.map((m) => m.text).join('\n');
    expect(all).not.toMatch(/sent (you )?your set|you(’ll| will) (get|be sent)|get your set/i);
  });

  it('builds the crew’s check from the doors checklist, so the two cannot disagree', () => {
    const check = textOf('crew-setup');
    const bullets = check.split('\n').filter((line) => line.startsWith('- '));
    expect(bullets).toEqual(CHECKLISTS.doors.items.map((i) => `- ${i.check}: ${i.target}`));
    // Titled as its laminated card is: *C1 Doors open*.
    expect(check.split('\n')[0]).toBe(`*${CHECKLISTS.doors.code} ${CHECKLISTS.doors.title}*`);
    expect(check.endsWith(`${BASE}${DOORS_PATH}`)).toBe(true);
    expect(DOORS_PATH).toBe('/night/#doors');
  });

  it('sends the reminder to the meter check’s heading, with its number of questions', () => {
    const reminder = textOf('review');
    expect(reminder).toContain(`${BASE}${REVIEW_PATH}`);
    expect(REVIEW_PATH).toBe('/#check');
    expect(reminder).toMatch(/the meter check/);
    expect(CARDS).toHaveLength(4);
    expect(reminder).toContain('four questions');
    // No time the check was never timed to.
    expect(reminder).not.toMatch(/minute|second/);
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
