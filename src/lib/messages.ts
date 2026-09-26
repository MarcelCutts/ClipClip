/**
 * Messages for the group chat, with copy buttons on /print/. Written for WhatsApp, which turns
 * *stars* into bold, _underscores_ into italics and lines starting "- " into a bulleted list.
 *
 * House style for every message: short enough to read on one phone screen (90 words or fewer), a
 * bold first line, the link last, and plain statements, with "If …" for a condition rather than a
 * question and its answer. The DJ briefing carries the three DJ lines word for word as the "Know by
 * heart" boxes set them, notes and all, and the crew's check the doors checklist, so neither can
 * drift from the pages or the printed cards. Nothing here promises a DJ their recording: every set
 * is recorded, and that is all it says.
 */

import { CHECKLISTS } from './checklists';
import { CARDS } from './quiz/cards';
import { DJ_RULES, type Rule } from './rules';
import { section } from './sections';

export type MessageId = 'dj-briefing' | 'crew-setup' | 'review';

export interface ChatMessage {
  id: MessageId;
  /** What it is, for the heading above it. */
  title: string;
  /** Who it goes to, and when. */
  when: string;
  /** The message itself, ready to paste. */
  text: string;
}

/** Turns a site path like "/night/" into the full address people can tap. */
export type LinkTo = (path: string) => string;

/**
 * The most words a message may have: about one phone screen in the chat, rules and link included.
 * It was 80 until the DJ lines named their lights (first orange, top orange): the three lines alone
 * are 71 words, and the briefing's own words (the recording, who is on crew, the link) can't come
 * under 11 without losing one of them.
 */
export const MAX_WORDS = 90;

/** Where the guide starts on playing a set: setting TRIM. The booth card's QR code goes here too. */
export const GUIDE_PATH = `/#${section('trim').id}`;

/** The meter check's heading in the guide, so the link lands on its title, not its first question. */
export const REVIEW_PATH = `/#${section('check').id}`;

/** The doors checklist on the night page. */
export const DOORS_PATH = `/night/#${CHECKLISTS.doors.anchor}`;

/** Where the sender writes the crew member's name before sending the briefing. */
export const NAME_BLANK = '[name]';

/**
 * A DJ rule as a chat bullet, the way the "Know by heart" boxes set it: what to look at, what it
 * should be, and what to do if it is not so. The MASTER LEVEL line's note is the one place the
 * briefing says BOOTH MONITOR is the DJ's.
 */
export function ruleLine({ challenge, response, note }: Rule): string {
  return `- ${challenge}: ${response}. ${note}`;
}

/** The doors checklist as chat bullets: the control, then the state it should be in. */
function doorsLines(): string[] {
  return CHECKLISTS.doors.items.map(({ check, target }) => `- ${check}: ${target}`);
}

/** A small count in words, as a sentence would say it: "four questions". */
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const inWords = (n: number): string => COUNT_WORDS[n] ?? String(n);

export function chatMessages(link: LinkTo): ChatMessage[] {
  const doors = CHECKLISTS.doors;
  return [
    {
      id: 'dj-briefing',
      title: 'DJ briefing',
      when: 'To the DJs, before the night.',
      text: [
        // What a DJ needs first: the recording, then who to ask. Then the rules, then the link.
        `*Every set here is recorded.* ${NAME_BLANK} is on crew tonight.`,
        ...DJ_RULES.map(ruleLine),
        `How and why: ${link(GUIDE_PATH)}`,
      ].join('\n'),
    },
    {
      id: 'crew-setup',
      title: 'Crew doors check',
      when: 'To the crew, before the doors open.',
      text: [
        // Titled as its laminated card is, code first: *C1 Doors open*.
        `*${doors.code} ${doors.title}*`,
        ...doorsLines(),
        'Reply “done”.',
        `Checklist: ${link(DOORS_PATH)}`,
      ].join('\n'),
    },
    {
      id: 'review',
      title: 'Meter check reminder',
      when: 'To the DJs, a day or two before the next night.',
      text: [
        `*If you’re playing at the next night*, try the meter check first. It’s ${inWords(CARDS.length)} questions.`,
        `Meter check: ${link(REVIEW_PATH)}`,
      ].join('\n'),
    },
  ];
}

/** Words as a chat app would count them: anything between spaces, the link included. */
export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

// ---- A preview of how WhatsApp will show a message --------------------------------------------

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'link'; text: string };

export type Block = { kind: 'line'; inlines: Inline[] } | { kind: 'list'; items: Inline[][] };

// Like WhatsApp: a *bold* or _italic_ marker sits at a word edge with a non-space just inside it.
// Links run to the next space.
const INLINE =
  /(?<=^|[\s(])(?:(\*[^*\s](?:[^*]*[^*\s])?\*)|(_[^_\s](?:[^_]*[^_\s])?_))(?=$|[\s.,:;?!)])|(https?:\/\/\S+)/g;

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: line.slice(last, at) });
    const [whole, bold, italic, url] = match;
    if (bold) out.push({ kind: 'bold', text: bold.slice(1, -1) });
    else if (italic) out.push({ kind: 'italic', text: italic.slice(1, -1) });
    else if (url) out.push({ kind: 'link', text: url });
    last = at + whole.length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}

/** Split a message into lines and bulleted lists, the way WhatsApp lays it out. */
export function parseMessage(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) {
      const inlines = parseInline(line.slice(2));
      const previous = blocks.at(-1);
      if (previous?.kind === 'list') previous.items.push(inlines);
      else blocks.push({ kind: 'list', items: [inlines] });
    } else {
      blocks.push({ kind: 'line', inlines: parseInline(line) });
    }
  }
  return blocks;
}
