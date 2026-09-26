/**
 * Messages for the group chat, with copy buttons on /print/. Written for WhatsApp, which turns
 * *stars* into bold, _underscores_ into italics and lines starting "- " into a bulleted list.
 *
 * House style for every message: 60 words or fewer, a bold first line, the link last, and plain
 * statements, with "If …" for a condition rather than a question and its answer. The DJ briefing is
 * built from the DJ rules as the "Know by heart" boxes set them, and the crew's check from the doors
 * checklist, so neither can drift from the pages or the printed cards.
 */

import { CHECKLISTS } from './checklists';
import { DJ_RULES, type Rule } from './rules';
import { MONITOR_TAG } from './tags';

export type MessageId = 'dj-briefing' | 'crew-setup' | 'changeover' | 'review';

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

/** Where the guide starts on playing a set: setting TRIM. The booth card's QR code goes here too. */
export const GUIDE_PATH = '/#trim';

/** Where the five-question meter check lives in the guide. */
export const REVIEW_PATH = '/#check';

/** The doors checklist on the night page. */
export const DOORS_PATH = `/night/#${CHECKLISTS.doors.anchor}`;

/**
 * What crew say to the next DJ at a changeover, in about a dozen words: where the meters should
 * sit, and who to ask for more. Also on /night/.
 */
export const CHANGEOVER_LINE = 'Channel meters on first or second orange. For a louder room, ask us.';

/** The first sentence of a note: what to do if the rule isn't met. */
export const firstSentence = (text: string): string => text.split(/(?<=[.?!])\s+/)[0] ?? '';

/**
 * A DJ rule as a chat bullet, the way the "Know by heart" boxes set it: what to look at, what it
 * should be, and the first sentence of what to do if it isn't. The rest is on the page.
 */
export function ruleLine({ challenge, response, note }: Rule): string {
  return `- ${challenge}: ${response}.${note ? ` ${firstSentence(note)}` : ''}`;
}

/** The doors checklist as chat bullets: the control, then the state it should be in. */
function doorsLines(): string[] {
  return CHECKLISTS.doors.items.map(({ check, target }) => `- ${check}: ${target}`);
}

export function chatMessages(link: LinkTo): ChatMessage[] {
  const doors = CHECKLISTS.doors;
  return [
    {
      id: 'dj-briefing',
      title: 'DJ briefing',
      when: 'To the DJs, before the night.',
      text: [
        // What the DJ gets comes first (dj-culture §0.3), then the rules, then the link.
        '*Every set here is recorded.* Here’s how to keep yours clean.',
        ...DJ_RULES.map(ruleLine),
        // The one knob that's theirs, as its tape says: MASTER LEVEL is the crew's, BOOTH MONITOR the DJ's.
        `- BOOTH MONITOR is ${MONITOR_TAG.owner}.`,
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
      id: 'changeover',
      title: 'Changeover line',
      when: 'To the next DJ at the changeover. Say it, or send it.',
      text: [`*You’re on next.* ${CHANGEOVER_LINE}`, `How and why: ${link(GUIDE_PATH)}`].join('\n'),
    },
    {
      id: 'review',
      title: 'Meter check reminder',
      when: 'To the DJs, a day or two before the next night.',
      text: [
        '*If you’re playing at the next night*, try the meter check first. It’s five questions about the meters and takes about a minute.',
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
