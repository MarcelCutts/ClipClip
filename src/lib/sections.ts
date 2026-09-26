/**
 * The guide's sections, in order, with the numbers a quick reference handbook gives them. One
 * list, so the index, the headings, the tabs and every "See 2.1" cross-reference agree.
 */
export interface Section {
  id: string;
  number: string;
  title: string;
  /** A short name for the index rail, where B612 has room for about 20 characters. */
  short?: string;
}

export interface GuidePart extends Section {
  /** One word for the part's thumb tab on phones, under its number. */
  tab: string;
  /** Reading time for the index, labs included. */
  minutes?: number;
  sections: Section[];
}

export const GUIDE: GuidePart[] = [
  {
    id: 'why',
    number: '1',
    title: 'Why it matters',
    tab: 'Why',
    minutes: 3,
    sections: [{ id: 'hear', number: '1.1', title: 'A blind listening test', short: 'Listening test' }],
  },
  {
    id: 'playing',
    number: '2',
    title: 'Playing a set',
    tab: 'Playing',
    minutes: 7,
    sections: [
      { id: 'trim', number: '2.1', title: 'Set TRIM in your headphones', short: 'Set TRIM' },
      { id: 'meters', number: '2.2', title: 'Read the right meter', short: 'The meters' },
      { id: 'knobs', number: '2.3', title: 'Whose knobs are whose', short: 'Whose knobs' },
      { id: 'blends', number: '2.4', title: 'Keep the MASTER meters below red in a blend', short: 'Blends' },
      { id: 'check', number: '2.5', title: 'Meter check' },
      { id: 'myths', number: '2.6', title: 'What people say about the red', short: 'What people say' },
    ],
  },
  {
    id: 'rig',
    number: '3',
    title: 'The rig and the recording',
    tab: 'Rig',
    minutes: 4,
    sections: [
      { id: 'signal', number: '3.1', title: 'What goes where' },
      { id: 'two-ceilings', number: '3.2', title: 'Two ceilings' },
    ],
  },
  {
    // The id is the old part's, so links to /#hood still land here.
    id: 'hood',
    number: '4',
    title: 'How it works',
    tab: 'How',
    minutes: 3,
    sections: [
      { id: 'worse', number: '4.1', title: 'Why the recording sounds worse', short: 'Why it sounds worse' },
      { id: 'undo', number: '4.2', title: 'Why clipping cannot be undone', short: 'Why clipping stays' },
      { id: 'quiet', number: '4.3', title: 'Why a quiet recording loses nothing', short: 'Why quiet is fine' },
      {
        id: 'red-top',
        number: '4.4',
        title: 'What the makers publish, and what we assume',
        short: 'What makers publish',
      },
    ],
  },
];

/**
 * Old section ids that the drills and the clip checker still link to, with the section that holds
 * that topic now. The guide keeps an element with the old id where it can, so the link lands there.
 */
const MOVED: Readonly<Record<string, string>> = { 'record-level': 'two-ceilings', loud: 'myths' };

/**
 * The guide's parts as thumb tabs (Tabs.astro): the part's number over its one word, named in
 * full for screen readers. The drills have no tab here: they're on the crew page.
 */
export const GUIDE_TABS = GUIDE.map((p) => ({
  code: p.number,
  label: p.tab,
  title: p.title,
  href: `#${p.id}`,
  target: p.id,
}));

const all = GUIDE.flatMap((p) => [p, ...p.sections]);

/** A section by its anchor, with or without the '#': its number and title. */
export function section(anchor: string): Section {
  const asked = anchor.replace(/^#/, '');
  const id = MOVED[asked] ?? asked;
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error(`No guide section with the id "${asked}"`);
  return found;
}
