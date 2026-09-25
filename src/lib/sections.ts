/**
 * The guide's sections, in order, with the numbers a quick reference handbook gives them. One
 * list, so the index, the headings and every "See 2.1" cross-reference agree.
 */
export interface Section {
  id: string;
  number: string;
  title: string;
  /** A short name for the index rail, where B612 has room for about 20 characters. */
  short?: string;
}

export interface GuidePart extends Section {
  minutes?: number;
  sections: Section[];
}

export const GUIDE: GuidePart[] = [
  { id: 'why', number: '1', title: 'Why it matters', minutes: 1, sections: [] },
  {
    id: 'playing',
    number: '2',
    title: 'Playing a set',
    minutes: 5,
    sections: [
      { id: 'trim', number: '2.1', title: 'Set TRIM on cue' },
      { id: 'meters', number: '2.2', title: 'Read the right meter', short: 'The meters' },
      { id: 'blends', number: '2.3', title: 'Watch the middle meters in a blend', short: 'Blends' },
      { id: 'knobs', number: '2.4', title: 'Whose knobs are whose', short: 'Whose knobs' },
      { id: 'self-check', number: '2.5', title: 'Check yourself' },
      { id: 'myths', number: '2.6', title: 'What people say about the red', short: 'What people say' },
    ],
  },
  {
    id: 'rig',
    number: '3',
    title: 'The rig and the recording',
    minutes: 8,
    sections: [
      { id: 'signal', number: '3.1', title: 'What goes where' },
      { id: 'two-ceilings', number: '3.2', title: 'Two ceilings' },
      { id: 'hear', number: '3.3', title: 'Can you hear it?' },
      { id: 'record-level', number: '3.4', title: 'The record level', short: 'Record level' },
    ],
  },
  {
    id: 'hood',
    number: '4',
    title: 'Under the hood',
    minutes: 10,
    sections: [
      { id: 'worse', number: '4.1', title: 'Why the recording sounds worse', short: 'Why it sounds worse' },
      { id: 'undo', number: '4.2', title: 'Why clipping can’t be undone', short: 'No undo' },
      { id: 'quiet', number: '4.3', title: 'Why recording quietly is free', short: 'Quiet is free' },
      { id: 'loud', number: '4.4', title: 'Loudness and clipping' },
      { id: 'red-top', number: '4.5', title: 'Is red really the top?', short: 'Is red the top?' },
      { id: 'float', number: '4.6', title: 'Float recorders' },
      { id: 'ears', number: '4.7', title: 'Look after your ears', short: 'Your ears' },
      { id: 'model', number: '4.8', title: 'About the demos' },
    ],
  },
];

const all = GUIDE.flatMap((p) => [p, ...p.sections]);

/** A section by its anchor, with or without the '#': its number and title. */
export function section(anchor: string): Section {
  const id = anchor.replace(/^#/, '');
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error(`No guide section with the id "${id}"`);
  return found;
}
