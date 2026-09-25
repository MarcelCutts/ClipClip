/**
 * The rig as a signal graph: every knob, meter, socket and box between the decks and the three
 * places the music ends up. MASTER 1 feeds the PA through the DriveRack PA2 and the amps, MASTER 2
 * feeds the Howler, and BOOTH feeds the booth monitors. The SignalPath island draws this; every
 * highlight and sentence it shows comes from here, so the tests beside it are the fact check.
 *
 * Facts, from the manuals in sources.ts:
 * - Signal order: TRIM, then EQ, then the channel fader, then the mix.
 * - Channel meters read before the fader; the middle (MASTER) meters read after MASTER LEVEL.
 *   Pioneer doesn't say whether the channel meters read after the EQ. The drawing assumes they do,
 *   and modelNote() says so.
 * - MASTER LEVEL sets MASTER 1 and MASTER 2 together. BOOTH MONITOR sets BOOTH alone. The
 *   attenuators in UTILITY (ATT) turn those outputs down further. Pioneer says MASTER ATT "sets the
 *   master output attenuator" without naming the sockets, so the drawing doesn't show it, and the
 *   MASTER 2 caption says it isn't published whether it reaches MASTER 2.
 * - The DriveRack's limiters sit on its outputs, and the amps after it: both on the PA branch only.
 * - Pioneer doesn't publish where the XDJ clips inside, so the whole mixer counts as ceiling 1.
 *   The Howler's limit isn't published either; its input is ceiling 2.
 */

export type Variant = 'full' | 'dj';

export type NodeKind = 'source' | 'control' | 'meter' | 'bus' | 'output' | 'processor' | 'device';

export type NodeId =
  | 'deck1'
  | 'trim1'
  | 'eq1'
  | 'meter1'
  | 'fader1'
  | 'deck2'
  | 'trim2'
  | 'eq2'
  | 'meter2'
  | 'fader2'
  | 'mix'
  | 'masterLevel'
  | 'masterMeter'
  | 'booth'
  | 'master1'
  | 'master2'
  | 'boothOut'
  | 'driverack'
  | 'limiter'
  | 'amps'
  | 'pa'
  | 'monitor'
  | 'howler';

/** The drawing on each node. */
export type Glyph =
  | 'deck'
  | 'knob'
  | 'eq'
  | 'fader'
  | 'meter'
  | 'meter-stereo'
  | 'sum'
  | 'xlr'
  | 'rca'
  | 'trs'
  | 'rack'
  | 'limiter'
  | 'amp'
  | 'pa'
  | 'monitor'
  | 'howler';

export interface RigNode {
  id: NodeId;
  kind: NodeKind;
  /** The name on the node. */
  label: string;
  /** True when the label is printed on the real gear, so it gets the silk-screen style. */
  printed: boolean;
  /** A second, smaller line: the socket type, or what the box is. */
  sub?: string;
  /** Read after the label by screen readers: context that the drawing gives sighted readers. */
  context?: string;
  glyph: Glyph;
  /** Knobs and faders only: whose they are to turn. */
  owner?: 'yours' | 'crew';
  /** Taped on the real gear, so the DJ view tapes it too, saying whose it is. */
  taped?: boolean;
  /** A place where the sound can clip: 1 inside the mixer, 2 at the Howler's input. */
  ceiling?: 1 | 2;
  /** Drawn only in the full (crew) view. */
  fullOnly?: boolean;
  /** Meters only: the controls people expect this meter to show, which it can't see. */
  blindSpots?: readonly NodeId[];
  /** Knobs only: where the pointer sits in the drawing, in degrees from 12 o'clock. */
  angle?: number;
}

export const NODES: Readonly<Record<NodeId, RigNode>> = {
  deck1: { id: 'deck1', kind: 'source', label: 'DECK 1', printed: true, glyph: 'deck' },
  trim1: {
    id: 'trim1',
    kind: 'control',
    label: 'TRIM',
    printed: true,
    context: 'channel 1',
    glyph: 'knob',
    owner: 'yours',
    angle: 0,
  },
  eq1: { id: 'eq1', kind: 'control', label: 'EQ', printed: true, context: 'channel 1', glyph: 'eq', owner: 'yours' },
  meter1: {
    id: 'meter1',
    kind: 'meter',
    label: 'CH1',
    printed: true,
    context: 'meter',
    glyph: 'meter',
    blindSpots: ['fader1'],
  },
  fader1: {
    id: 'fader1',
    kind: 'control',
    label: 'Fader',
    printed: false,
    context: 'channel 1',
    glyph: 'fader',
    owner: 'yours',
  },
  deck2: { id: 'deck2', kind: 'source', label: 'DECK 2', printed: true, glyph: 'deck' },
  trim2: {
    id: 'trim2',
    kind: 'control',
    label: 'TRIM',
    printed: true,
    context: 'channel 2',
    glyph: 'knob',
    owner: 'yours',
    angle: 0,
  },
  eq2: { id: 'eq2', kind: 'control', label: 'EQ', printed: true, context: 'channel 2', glyph: 'eq', owner: 'yours' },
  meter2: {
    id: 'meter2',
    kind: 'meter',
    label: 'CH2',
    printed: true,
    context: 'meter',
    glyph: 'meter',
    blindSpots: ['fader2'],
  },
  fader2: {
    id: 'fader2',
    kind: 'control',
    label: 'Fader',
    printed: false,
    context: 'channel 2',
    glyph: 'fader',
    owner: 'yours',
  },
  mix: {
    id: 'mix',
    kind: 'bus',
    label: 'Mix',
    printed: false,
    context: 'where both channels add up',
    glyph: 'sum',
    ceiling: 1,
  },
  // Fully up, as it's taped.
  masterLevel: {
    id: 'masterLevel',
    kind: 'control',
    label: 'MASTER LEVEL',
    printed: true,
    glyph: 'knob',
    owner: 'crew',
    taped: true,
    angle: 135,
  },
  masterMeter: {
    id: 'masterMeter',
    kind: 'meter',
    label: 'MASTER',
    printed: true,
    context: 'meters in the middle',
    glyph: 'meter-stereo',
    blindSpots: ['booth', 'amps'],
  },
  booth: {
    id: 'booth',
    kind: 'control',
    label: 'BOOTH MONITOR',
    printed: true,
    glyph: 'knob',
    owner: 'yours',
    taped: true,
    angle: 45,
  },
  master1: { id: 'master1', kind: 'output', label: 'MASTER 1', printed: true, sub: 'XLR', glyph: 'xlr' },
  master2: { id: 'master2', kind: 'output', label: 'MASTER 2', printed: true, sub: 'RCA', glyph: 'rca' },
  boothOut: { id: 'boothOut', kind: 'output', label: 'BOOTH', printed: true, sub: 'TRS', glyph: 'trs' },
  driverack: { id: 'driverack', kind: 'processor', label: 'DriveRack PA2', printed: false, glyph: 'rack' },
  limiter: {
    id: 'limiter',
    kind: 'processor',
    label: 'Limiter',
    printed: false,
    context: 'inside the DriveRack',
    glyph: 'limiter',
    fullOnly: true,
  },
  // A box, but what matters is its gain knobs: they set the room's volume.
  amps: {
    id: 'amps',
    kind: 'control',
    label: 'Amps',
    printed: false,
    sub: 'QSC GX7',
    glyph: 'amp',
    owner: 'crew',
    taped: true,
  },
  pa: { id: 'pa', kind: 'device', label: 'PA speakers', printed: false, glyph: 'pa' },
  monitor: { id: 'monitor', kind: 'device', label: 'Booth monitors', printed: false, glyph: 'monitor' },
  howler: {
    id: 'howler',
    kind: 'device',
    label: 'Howler',
    printed: false,
    sub: 'recorder',
    glyph: 'howler',
    ceiling: 2,
  },
};

/** The three places the music ends up. */
export const LISTENERS = ['pa', 'monitor', 'howler'] as const satisfies readonly NodeId[];
export type Listener = (typeof LISTENERS)[number];

const LISTENER_NAME: Readonly<Record<Listener, string>> = {
  pa: 'PA speakers',
  monitor: 'booth monitors',
  howler: 'recorder',
};

// ---------------------------------------------------------------------------------------------
// The graph
// ---------------------------------------------------------------------------------------------

/** signal: inside the mixer. tap: a meter reading the signal. cable: a lead between boxes. */
export type EdgeKind = 'signal' | 'tap' | 'cable';

export interface Edge {
  id: string;
  from: NodeId;
  to: NodeId;
  kind: EdgeKind;
}

const edge = (from: NodeId, to: NodeId, kind: EdgeKind): Edge => ({ id: `${from}>${to}`, from, to, kind });

const EDGES: readonly Edge[] = [
  edge('deck1', 'trim1', 'signal'),
  edge('trim1', 'eq1', 'signal'),
  edge('eq1', 'fader1', 'signal'),
  edge('eq1', 'meter1', 'tap'),
  edge('fader1', 'mix', 'signal'),
  edge('deck2', 'trim2', 'signal'),
  edge('trim2', 'eq2', 'signal'),
  edge('eq2', 'fader2', 'signal'),
  edge('eq2', 'meter2', 'tap'),
  edge('fader2', 'mix', 'signal'),
  edge('mix', 'masterLevel', 'signal'),
  edge('mix', 'booth', 'signal'),
  edge('masterLevel', 'masterMeter', 'tap'),
  edge('masterLevel', 'master1', 'signal'),
  edge('masterLevel', 'master2', 'signal'),
  edge('booth', 'boothOut', 'signal'),
  edge('master1', 'driverack', 'cable'),
  edge('amps', 'pa', 'cable'),
  edge('master2', 'howler', 'cable'),
  edge('boothOut', 'monitor', 'cable'),
];

/** Every connection in a view. The DJ view hides the DriveRack's limiter. */
export function edgesFor(variant: Variant = 'full'): Edge[] {
  const toAmps =
    variant === 'full'
      ? [edge('driverack', 'limiter', 'signal'), edge('limiter', 'amps', 'cable')]
      : [edge('driverack', 'amps', 'cable')];
  return [...EDGES, ...toAmps];
}

/** The tape the DJ view puts on a part, as crew tape the real knobs: whose it is to turn. */
export function tapeFor(id: NodeId, variant: Variant): 'Crew' | 'Yours' | undefined {
  const { taped, owner } = NODES[id];
  if (variant !== 'dj' || !taped) return undefined;
  return owner === 'crew' ? 'Crew' : 'Yours';
}

/**
 * A node's name for screen readers: the text on it, then the context the drawing gives sighted
 * readers ("TRIM, channel 1", "BOOTH MONITOR, yours"). It starts with the visible words, so voice
 * control can use them.
 */
export function accessibleName(id: NodeId, variant: Variant = 'full'): string {
  const node = NODES[id];
  const second = node.ceiling ? `Ceiling ${node.ceiling}` : node.sub;
  const visible = node.glyph === 'eq' ? 'EQ HI MID LOW' : [node.label, second].filter(Boolean).join(' ');
  const tape = tapeFor(id, variant);
  const context = [
    node.ceiling ? node.sub : undefined,
    node.context,
    tape === 'Crew' ? 'crew’s' : tape === 'Yours' ? 'yours' : undefined,
  ].filter(Boolean);
  return [visible, ...context].join(', ').replace(/ /g, ' ');
}

/** The nodes drawn in a view. */
export function visibleNodes(variant: Variant): NodeId[] {
  return (Object.keys(NODES) as NodeId[]).filter((id) => variant === 'full' || !NODES[id].fullOnly);
}

/**
 * What starts picked. Crew start at the recorder, to see what reaches the file. DJs start at
 * MASTER LEVEL, the crew's knob that sets the speakers and the recording at once.
 */
export const DEFAULT_SELECTION: Readonly<Record<Variant, NodeId>> = { full: 'howler', dj: 'masterLevel' };

/** A node the view can show, or the view's default if it can't (the limiter in the DJ view). */
export function resolveSelection(id: NodeId | null | undefined, variant: Variant): NodeId | null {
  if (id === null) return null;
  return id !== undefined && visibleNodes(variant).includes(id) ? id : DEFAULT_SELECTION[variant];
}

/**
 * Nodes in reading order: each channel top to bottom, then the mix, then each branch from its
 * knob to the box at the end of it. This is the DOM order, and so the order the arrow keys take.
 */
const FLOW: readonly NodeId[] = [
  'deck1',
  'trim1',
  'eq1',
  'meter1',
  'fader1',
  'deck2',
  'trim2',
  'eq2',
  'meter2',
  'fader2',
  'mix',
  'masterLevel',
  'masterMeter',
  'master1',
  'driverack',
  'limiter',
  'amps',
  'pa',
  'master2',
  'howler',
  'booth',
  'boothOut',
  'monitor',
];

export function flowOrder(variant: Variant = 'full'): NodeId[] {
  const shown = visibleNodes(variant);
  return FLOW.filter((id) => shown.includes(id));
}

function walk(start: NodeId, next: (id: NodeId) => NodeId[]): Set<NodeId> {
  const seen = new Set<NodeId>();
  const queue = [...next(start)];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...next(id));
  }
  return seen;
}

/** Everything a node's signal reaches: what turning it changes. Meters reach nothing. */
export function downstreamOf(id: NodeId, variant: Variant = 'full'): Set<NodeId> {
  const edges = edgesFor(variant);
  return walk(id, (n) => edges.filter((e) => e.from === n).map((e) => e.to));
}

/** Everything that feeds a node. */
export function upstreamOf(id: NodeId, variant: Variant = 'full'): Set<NodeId> {
  const edges = edgesFor(variant);
  return walk(id, (n) => edges.filter((e) => e.to === n).map((e) => e.from));
}

/** The knobs and faders whose turn changes what `target` gets, in signal order. */
export function controlsFor(target: NodeId, variant: Variant = 'full'): NodeId[] {
  const up = upstreamOf(target, variant);
  return flowOrder(variant).filter((id) => up.has(id) && NODES[id].kind === 'control');
}

/** Which of the PA, the booth monitors and the Howler a node's signal ends up in. */
export function listenersReached(id: NodeId, variant: Variant = 'full'): Listener[] {
  const down = downstreamOf(id, variant);
  return LISTENERS.filter((l) => l === id || down.has(l));
}

/**
 * Which way a selection lights the drawing. A knob, fader or deck lights what it touches
 * (downstream). A meter or a box at the end lights what feeds it (upstream). The mix, the
 * sockets and the DriveRack sit mid-path, so they light the whole route through them.
 */
export type Direction = 'down' | 'up' | 'through';

export function directionFor(id: NodeId): Direction {
  const { kind } = NODES[id];
  if (kind === 'source' || kind === 'control') return 'down';
  if (kind === 'meter' || kind === 'device') return 'up';
  return 'through';
}

export interface Highlight {
  direction: Direction;
  nodes: Set<NodeId>;
  edges: Set<string>;
}

export function highlightFor(id: NodeId, variant: Variant = 'full'): Highlight {
  const direction = directionFor(id);
  const nodes = new Set<NodeId>([id]);
  if (direction !== 'up') for (const n of downstreamOf(id, variant)) nodes.add(n);
  if (direction !== 'down') for (const n of upstreamOf(id, variant)) nodes.add(n);
  const edges = new Set(
    edgesFor(variant)
      .filter((e) => nodes.has(e.from) && nodes.has(e.to))
      .map((e) => e.id),
  );
  return { direction, nodes, edges };
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

interface Copy {
  title: string;
  text: string;
  /** Replaces `text` in the DJ view. */
  dj?: string;
}

/** A no-break space, so "6 dB" never splits across lines. */
const NB = ' ';

/** Both channels share these. The DJ view names the DJ's own controls, as it names the crew's. */
const TRIM_COPY: Copy = {
  title: 'What TRIM touches',
  text: 'TRIM reaches every output: PA, booth monitors and recording. Set it so the loudest bits peak at the first or second orange light.',
  dj: 'TRIM is yours. It reaches every output, the recording included. Set it so the loudest bits peak at the first or second orange light.',
};

const EQ_COPY: Copy = {
  title: 'What EQ touches',
  text: `EQ reaches every output. Each knob can add up to 6${NB}dB, so cut rather than boost.`,
  dj: `The EQ knobs are yours. They reach every output, and each can add up to 6${NB}dB, so cut rather than boost.`,
};

const METER_TEXT =
  'Channel meters show each track before its fader, so a blend doesn’t show on them. The middle meters show the mix.';
/** Ends on the DJ rule's own challenge and response (rules.ts): "In a blend, watch the middle meters." */
const METER_DJ =
  'Channel meters show each track before its fader, so a blend doesn’t show on them. In a blend, watch the middle meters.';

const FADER_COPY: Copy = {
  title: 'What the fader touches',
  text: 'The fader reaches every output. The channel meter reads before it, so watch the middle meters as you blend.',
  dj: 'The fader is yours, and it reaches every output. The channel meter reads before it, so watch the middle meters as you blend.',
};

/**
 * One title and one caption per node (widget captions stay under 25 words). The titles work in
 * both views, so the same drawing can sit in a DJ's guide and on the crew's setup page. The
 * ceilings are named on the drawing; the captions say what each part does to the music.
 */
export const COPY: Readonly<Record<NodeId, Copy>> = {
  deck1: {
    title: 'Where DECK 1 goes',
    text: 'DECK 1 plays into channel 1, and from there into every output: PA, booth monitors and recording.',
  },
  deck2: {
    title: 'Where DECK 2 goes',
    text: 'DECK 2 plays into channel 2, and from there into every output: PA, booth monitors and recording.',
  },
  trim1: TRIM_COPY,
  trim2: TRIM_COPY,
  eq1: EQ_COPY,
  eq2: EQ_COPY,
  meter1: { title: 'What the CH1 meter can see', text: METER_TEXT, dj: METER_DJ },
  meter2: { title: 'What the CH2 meter can see', text: METER_TEXT, dj: METER_DJ },
  fader1: FADER_COPY,
  fader2: FADER_COPY,
  mix: {
    title: 'Ceiling 1, inside the mixer',
    text: 'Both channels add up here. Anything that clips up to this point reaches every output, and no later knob can fix it.',
    dj: 'Both channels add up here, so a blend peaks higher than either track. Crunch made here reaches every output, and no later knob removes it.',
  },
  masterLevel: {
    title: 'What MASTER LEVEL touches',
    text: 'MASTER LEVEL sets the PA and the recording together, so it stays fully up and marked REC. Set the room’s volume at the amps.',
    dj: 'MASTER LEVEL is the crew’s knob, marked REC. It sets the PA and the recording together. For more volume, the crew turn up the amps.',
  },
  masterMeter: {
    title: 'What the middle meters can see',
    text: 'The middle meters show the whole mix after MASTER LEVEL, so blends show up here. Keep MASTER LEVEL fully up, or they read low.',
    dj: 'The middle meters show the whole mix, so blends show up here. Keep them out of the red.',
  },
  booth: {
    title: 'What BOOTH MONITOR touches',
    text: 'BOOTH MONITOR sets the booth monitors. It doesn’t reach the PA or the recording, so it’s the DJ’s knob.',
    dj: 'BOOTH MONITOR is yours, marked MONITOR. It sets the booth monitors, and the PA and the recording don’t hear it.',
  },
  master1: {
    title: 'What MASTER 1 feeds',
    text: 'MASTER 1 feeds the PA through the DriveRack and the amps. MASTER LEVEL and MASTER ATT, in UTILITY, set its level.',
    dj: 'MASTER 1 feeds the PA through the DriveRack and the amps. MASTER LEVEL sets its level.',
  },
  master2: {
    title: 'What MASTER 2 feeds',
    text: 'MASTER 2 feeds the recorder, so MASTER LEVEL sets the record level. Pioneer doesn’t say whether MASTER ATT reaches it. Test it once.',
    dj: 'MASTER 2 feeds the recorder. It follows MASTER LEVEL, like the PA, which is why that knob is the crew’s.',
  },
  boothOut: {
    title: 'What the BOOTH sockets feed',
    text: 'The BOOTH sockets feed the booth monitors. BOOTH MONITOR and BOOTH ATT, in UTILITY, set their level.',
    dj: 'The BOOTH sockets feed the booth monitors, and nothing else. Your BOOTH MONITOR knob sets their level.',
  },
  driverack: {
    title: 'What the DriveRack does',
    text: `The DriveRack tunes the PA, and protects it if its limiters are set. Keep its input switch on +4${NB}dBu, or its input clips early.`,
    dj: 'The DriveRack tunes the PA. Its limiter is only there for the speakers, so it can’t save the recording.',
  },
  limiter: {
    title: 'What the limiter protects',
    text: 'The DriveRack’s limiter works on the PA branch alone, and only when switched on. The recorder is on another branch, so nothing limits it.',
  },
  amps: {
    title: 'What the amps touch',
    text: 'The amps’ gain knobs, marked RIG, set the room’s volume. When a DJ wants more, turn these up. The recording never hears them.',
    dj: 'The amps’ gain knobs are the crew’s, marked RIG. They set the room’s volume without touching the recording, so ask the crew for more.',
  },
  pa: {
    title: 'What the crowd hears',
    text: 'The crowd hears the channels, then MASTER LEVEL, the DriveRack and the amps. BOOTH MONITOR doesn’t reach the PA.',
    dj: 'The crowd hears your channels through MASTER LEVEL, the DriveRack and the amps. For a louder room, ask the crew.',
  },
  monitor: {
    title: 'What the booth monitors play',
    text: 'The booth monitors play the channels, then BOOTH MONITOR. MASTER LEVEL and the amps don’t change them.',
    dj: 'The booth monitors play your channels through BOOTH MONITOR, your knob. Turn it up to hear more in the booth.',
  },
  howler: {
    title: 'What the recorder hears',
    text: 'The recorder hears the channels, then MASTER LEVEL. BOOTH MONITOR and the amps don’t reach it. Its input is ceiling 2.',
    dj: 'The recorder hears your channels, then MASTER LEVEL. BOOTH MONITOR and the amps don’t reach it. Its input is ceiling 2.',
  },
};

/**
 * Each view's name: the drawing's label for screen readers, and its title when nothing is picked.
 * The guide shows both views, so the names differ.
 */
export const VIEW_NAME: Readonly<Record<Variant, string>> = {
  full: 'Which knob touches what',
  dj: 'Whose knob is whose',
};

/** The readout when nothing is picked. */
export function idleCaption(variant: Variant = 'full'): { title: string; text: string } {
  return { title: VIEW_NAME[variant], text: 'Pick any knob, meter, socket or box to light up its path.' };
}

/**
 * The DJ view's key: whose knobs are whose. The drawing tapes the ones in the middle and the amps;
 * UTILITY is a settings screen, not a knob, so only the key names it.
 */
export const WHOSE = {
  yours: 'TRIM, EQ, faders and BOOTH MONITOR',
  crew: 'MASTER LEVEL, UTILITY and the amps',
} as const;

/** The model's honest limits, printed under the drawing. Crew also get the Howler's. */
export function modelNote(variant: Variant = 'full'): string {
  const mixer = 'Where exactly the XDJ clips inside isn’t published, so the mixer counts as one ceiling.';
  const howler = 'Howler doesn’t publish its input limit either. Its LEVEL light is the only guide.';
  // The drawing taps the channel meters after the EQ (the eq>meter edges), so it says "Shows TRIM and EQ".
  const meters = 'Pioneer doesn’t say whether the channel meters read after the EQ. This drawing assumes they do.';
  return variant === 'full' ? `${mixer} ${howler} ${meters}` : `${mixer} ${meters}`;
}

export function captionFor(id: NodeId, variant: Variant = 'full'): { title: string; text: string } {
  const copy = COPY[id];
  return { title: copy.title, text: variant === 'dj' && copy.dj !== undefined ? copy.dj : copy.text };
}

/** "A", "A and B", "A, B and C" (UK style: no serial comma). */
export function listText(items: readonly string[], joiner: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`;
}

/** Control names for a sentence, with both channels folded together: "TRIM, EQ and faders". */
export function controlNames(ids: readonly NodeId[]): string[] {
  const has = (id: NodeId) => ids.includes(id);
  const names: string[] = [];
  if (has('trim1') || has('trim2')) names.push('TRIM');
  if (has('eq1') || has('eq2')) names.push('EQ');
  if (has('fader1') && has('fader2')) names.push('faders');
  else if (has('fader1') || has('fader2')) names.push('fader');
  if (has('masterLevel')) names.push('MASTER LEVEL');
  if (has('booth')) names.push('BOOTH MONITOR');
  if (has('amps')) names.push('amp gain');
  return names;
}

export interface Summary {
  label: string;
  items: string;
  notLabel?: string;
  notItems?: string;
}

/** The knobs after the split. Each reaches some outputs and misses others. */
const BRANCH_KNOBS: readonly NodeId[] = ['masterLevel', 'booth', 'amps'];

/**
 * The highlight in words, worked out from the graph: what a knob reaches, what sets a socket or
 * a box, what a meter shows. It sits under the caption so the drawing never relies on colour.
 */
export function summaryFor(id: NodeId, variant: Variant = 'full'): Summary {
  const direction = directionFor(id);
  const { kind, blindSpots } = NODES[id];
  if (kind === 'meter') {
    const summary: Summary = { label: 'Shows', items: listText(controlNames(controlsFor(id, variant))) };
    if (blindSpots && blindSpots.length > 0) {
      summary.notLabel = 'Can’t see';
      summary.notItems = listText(controlNames(blindSpots), 'or');
    }
    return summary;
  }
  if (direction === 'up' || kind === 'output') {
    const controls = controlsFor(id, variant);
    const summary: Summary = { label: 'Set by', items: listText(controlNames(controls)) };
    // Knobs on other branches. Those further down this one (the amps, after MASTER 1) go unsaid.
    const down = downstreamOf(id, variant);
    const missing = BRANCH_KNOBS.filter((k) => !controls.includes(k) && !down.has(k));
    if (missing.length > 0) {
      summary.notLabel = 'Not by';
      summary.notItems = listText(controlNames(missing), 'or');
    }
    return summary;
  }
  const reached = listenersReached(id, variant);
  const summary: Summary = { label: 'Reaches', items: listText(reached.map((l) => LISTENER_NAME[l])) };
  const missed = LISTENERS.filter((l) => !reached.includes(l));
  if (missed.length > 0) {
    summary.notLabel = 'Doesn’t reach';
    summary.notItems = listText(
      missed.map((l) => LISTENER_NAME[l]),
      'or',
    );
  }
  return summary;
}

// ---------------------------------------------------------------------------------------------
// Drawing: two hand-placed layouts sharing one set of nodes
// ---------------------------------------------------------------------------------------------

export type LayoutName = 'tall' | 'wide';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Point = readonly [number, number];

export interface Wire {
  /** The edge this wire draws. */
  edge: string;
  points: Point[];
  /** SVG path with rounded corners. */
  d: string;
  /** Arrowhead at the far end, as a closed SVG path. */
  arrow: string;
}

/** A junction: where one wire splits into two, or two join. */
export interface Dot {
  x: number;
  y: number;
  /** Lit when any of these edges is lit. */
  edges: string[];
}

/** A lead's name, drawn next to its wire in the full view. */
export interface WireLabel {
  edge: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  lines: string[];
}

export interface Layout {
  name: LayoutName;
  width: number;
  height: number;
  /** The XDJ-RX2 itself. The output sockets sit on its edge. */
  chassis: Rect;
  rects: Partial<Record<NodeId, Rect>>;
  wires: Wire[];
  dots: Dot[];
  labels: WireLabel[];
}

const cx = (r: Rect) => r.x + r.w / 2;
const cy = (r: Rect) => r.y + r.h / 2;
const bottom = (r: Rect) => r.y + r.h;
const right = (r: Rect) => r.x + r.w;

const round1 = (n: number) => String(Math.round(n * 10) / 10);

/** An orthogonal polyline as an SVG path, with each corner rounded. */
export function roundedPath(points: readonly Point[], radius = 7): string {
  const [first] = points;
  if (!first) return '';
  let d = `M${round1(first[0])} ${round1(first[1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [x, y] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    if (inLen === 0 || outLen === 0) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = x - ((x - px) / inLen) * r;
    const ay = y - ((y - py) / inLen) * r;
    const bx = x + ((nx - x) / outLen) * r;
    const by = y + ((ny - y) / outLen) * r;
    d += `L${round1(ax)} ${round1(ay)}Q${round1(x)} ${round1(y)} ${round1(bx)} ${round1(by)}`;
  }
  const last = points.at(-1)!;
  if (points.length > 1) d += `L${round1(last[0])} ${round1(last[1])}`;
  return d;
}

/** A small arrowhead whose tip sits on the last point, pointing along the last segment. */
export function arrowHead(points: readonly Point[], length = 6.5, halfWidth = 3.6): string {
  const tip = points.at(-1);
  const prev = points.at(-2);
  if (!tip || !prev) return '';
  const len = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
  const ux = (tip[0] - prev[0]) / len;
  const uy = (tip[1] - prev[1]) / len;
  const bx = tip[0] - ux * length;
  const by = tip[1] - uy * length;
  const p = (x: number, y: number) => `${round1(x)} ${round1(y)}`;
  return `M${p(tip[0], tip[1])}L${p(bx - uy * halfWidth, by + ux * halfWidth)}L${p(bx + uy * halfWidth, by - ux * halfWidth)}Z`;
}

/** Down from the bottom of `a` into the top of `b`, turning once at `bendY` if they don't line up. */
function down(a: Rect, b: Rect, bendY = (bottom(a) + b.y) / 2): Point[] {
  const x1 = cx(a);
  const x2 = cx(b);
  if (Math.abs(x1 - x2) < 0.5)
    return [
      [x1, bottom(a)],
      [x1, b.y],
    ];
  return [
    [x1, bottom(a)],
    [x1, bendY],
    [x2, bendY],
    [x2, b.y],
  ];
}

/** Right from the side of `a` into the side of `b`, turning once at `bendX` if they don't line up. */
function across(a: Rect, b: Rect, bendX = (right(a) + b.x) / 2): Point[] {
  const y1 = cy(a);
  const y2 = cy(b);
  if (Math.abs(y1 - y2) < 0.5)
    return [
      [right(a), y1],
      [b.x, y1],
    ];
  return [
    [right(a), y1],
    [bendX, y1],
    [bendX, y2],
    [b.x, y2],
  ];
}

interface Draft {
  width: number;
  height: number;
  chassis: Rect;
  rects: Record<NodeId, Rect>;
  routes: Partial<Record<string, Point[]>>;
  dots: Dot[];
  labels: WireLabel[];
}

function finish(name: LayoutName, draft: Draft, variant: Variant): Layout {
  const wires: Wire[] = edgesFor(variant).map((e) => {
    const points = draft.routes[e.id];
    if (!points) throw new Error(`No route for ${e.id} in the ${name} layout`);
    return { edge: e.id, points, d: roundedPath(points), arrow: arrowHead(points) };
  });
  const shown = visibleNodes(variant);
  return {
    name,
    width: draft.width,
    height: draft.height,
    chassis: draft.chassis,
    rects: Object.fromEntries(shown.map((id) => [id, draft.rects[id]])),
    wires,
    dots: draft.dots,
    // The DJ view leaves the leads unnamed.
    labels: variant === 'full' ? draft.labels : [],
  };
}

/**
 * How far past its edge each part catches taps in the tall drawing, in drawing units. On a 320 px
 * phone the parts draw at about 38 px, and this brings every hit area to 44 px or more. The tall
 * layout keeps neighbours at least twice this far apart, so no two hit areas overlap.
 */
export const TALL_HIT_PAD = { x: 2, y: 4 } as const;

/** Phones: both channels side by side, the signal running down the screen. */
function tallLayout(variant: Variant): Layout {
  const L = { x: 8, w: 88 };
  const M = { x: 106, w: 88 };
  const R = { x: 204, w: 88 };
  const at = (col: { x: number; w: number }, y: number, h = 44): Rect => ({ x: col.x, y, w: col.w, h });
  // Under the XDJ the PA branch runs down the left: DriveRack, the limiter (full view only), amps.
  const ampsY = variant === 'full' ? 730 : 664;
  // The three places the music ends up share the bottom row.
  const yEnd = ampsY + 72;

  const r: Record<NodeId, Rect> = {
    deck1: at(L, 30),
    deck2: at(R, 30),
    trim1: at(L, 90),
    trim2: at(R, 90),
    eq1: at(L, 150, 82),
    eq2: at(R, 150, 82),
    // As wide as the gap between the channels allows, so they stay easy to tap.
    meter1: { x: 100, y: 218, w: 48, h: 58 },
    meter2: { x: 152, y: 218, w: 48, h: 58 },
    fader1: at(L, 264),
    fader2: at(R, 264),
    mix: { x: 102, y: 342, w: 96, h: 46 },
    masterLevel: at(M, 420),
    booth: at(R, 420),
    masterMeter: { x: 28, y: 408, w: 48, h: 60 },
    master1: at(L, 526),
    master2: at(M, 526),
    boothOut: at(R, 526),
    driverack: at(L, 598),
    limiter: at(L, 664),
    amps: at(L, ampsY),
    pa: at(L, yEnd, 48),
    howler: at(M, yEnd, 48),
    monitor: at(R, yEnd, 48),
  };

  const tapY = 247;
  const mergeY = 324;
  const splitY = 404;
  const busY = 488;
  const routes: Partial<Record<string, Point[]>> = {
    'deck1>trim1': down(r.deck1, r.trim1),
    'trim1>eq1': down(r.trim1, r.eq1),
    'eq1>fader1': down(r.eq1, r.fader1),
    'eq1>meter1': [
      [cx(r.eq1), tapY],
      [r.meter1.x, tapY],
    ],
    'fader1>mix': down(r.fader1, r.mix, mergeY),
    'deck2>trim2': down(r.deck2, r.trim2),
    'trim2>eq2': down(r.trim2, r.eq2),
    'eq2>fader2': down(r.eq2, r.fader2),
    'eq2>meter2': [
      [cx(r.eq2), tapY],
      [right(r.meter2), tapY],
    ],
    'fader2>mix': down(r.fader2, r.mix, mergeY),
    'mix>masterLevel': down(r.mix, r.masterLevel),
    'mix>booth': down(r.mix, r.booth, splitY),
    'masterLevel>masterMeter': [
      [cx(r.masterLevel), bottom(r.masterLevel)],
      [cx(r.masterLevel), busY],
      [cx(r.masterMeter), busY],
      [cx(r.masterMeter), bottom(r.masterMeter)],
    ],
    'masterLevel>master1': down(r.masterLevel, r.master1, busY),
    'masterLevel>master2': down(r.masterLevel, r.master2),
    'booth>boothOut': down(r.booth, r.boothOut),
    'master1>driverack': down(r.master1, r.driverack),
    'driverack>limiter': down(r.driverack, r.limiter),
    'limiter>amps': down(r.limiter, r.amps),
    'driverack>amps': down(r.driverack, r.amps),
    'amps>pa': down(r.amps, r.pa),
    'master2>howler': down(r.master2, r.howler),
    'boothOut>monitor': down(r.boothOut, r.monitor),
  };

  return finish(
    'tall',
    {
      width: 300,
      height: yEnd + 48 + 6,
      chassis: { x: 0.5, y: 0.5, w: 299, h: cy(r.master1) - 0.5 },
      rects: r,
      routes,
      dots: [
        { x: cx(r.eq1), y: tapY, edges: ['eq1>fader1', 'eq1>meter1'] },
        { x: cx(r.eq2), y: tapY, edges: ['eq2>fader2', 'eq2>meter2'] },
        { x: cx(r.mix), y: mergeY, edges: ['fader1>mix', 'fader2>mix'] },
        { x: cx(r.mix), y: splitY, edges: ['mix>masterLevel', 'mix>booth'] },
        {
          x: cx(r.masterLevel),
          y: busY,
          edges: ['masterLevel>master2', 'masterLevel>master1', 'masterLevel>masterMeter'],
        },
        { x: cx(r.master1), y: busY, edges: ['masterLevel>master1', 'masterLevel>masterMeter'] },
      ],
      labels: [
        {
          edge: 'master2>howler',
          x: cx(r.master2) + 6,
          y: (bottom(r.master2) + yEnd) / 2 - 4,
          anchor: 'start',
          lines: ['RCA', 'lead'],
        },
      ],
    },
    variant,
  );
}

/** Wider screens: the two channels as rows, the signal running left to right. */
function wideLayout(variant: Variant): Layout {
  const A = 52;
  const B = 150;
  const C = 248;
  const at = (x: number, w: number, row: number, h = 56): Rect => ({ x, y: row - h / 2, w, h });
  // The PA branch runs along the top row: DriveRack, the limiter (full view only), amps.
  const ampsX = variant === 'full' ? 870 : 798;
  // The three places the music ends up share the last column.
  const xEnd = ampsX + 72;

  const r: Record<NodeId, Rect> = {
    deck1: at(8, 64, A),
    deck2: at(8, 64, C),
    trim1: at(86, 64, A),
    trim2: at(86, 64, C),
    eq1: at(164, 92, A, 64),
    eq2: at(164, 92, C, 64),
    meter1: { x: 246, y: 90, w: 48, h: 54 },
    meter2: { x: 246, y: 156, w: 48, h: 54 },
    fader1: at(284, 64, A),
    fader2: at(284, 64, C),
    mix: at(376, 72, B),
    masterLevel: at(474, 76, B),
    booth: at(474, 76, C),
    masterMeter: { x: 556, y: 184, w: 48, h: 54 },
    master1: at(630, 70, A),
    master2: at(630, 70, B),
    boothOut: at(630, 70, C),
    driverack: at(714, 70, A),
    limiter: at(798, 58, A),
    amps: at(ampsX, 58, A),
    pa: at(xEnd, 76, A),
    howler: at(xEnd, 76, B),
    monitor: at(xEnd, 76, C),
  };

  const tapX = 270;
  const mergeX = 362;
  const splitX = 461;
  const meterX = cx(r.masterMeter);
  const riserX = 616;
  const routes: Partial<Record<string, Point[]>> = {
    'deck1>trim1': across(r.deck1, r.trim1),
    'trim1>eq1': across(r.trim1, r.eq1),
    'eq1>fader1': across(r.eq1, r.fader1),
    'eq1>meter1': [
      [tapX, A],
      [tapX, r.meter1.y],
    ],
    'fader1>mix': across(r.fader1, r.mix, mergeX),
    'deck2>trim2': across(r.deck2, r.trim2),
    'trim2>eq2': across(r.trim2, r.eq2),
    'eq2>fader2': across(r.eq2, r.fader2),
    'eq2>meter2': [
      [tapX, C],
      [tapX, bottom(r.meter2)],
    ],
    'fader2>mix': across(r.fader2, r.mix, mergeX),
    'mix>masterLevel': across(r.mix, r.masterLevel),
    'mix>booth': across(r.mix, r.booth, splitX),
    'masterLevel>masterMeter': [
      [right(r.masterLevel), B],
      [meterX, B],
      [meterX, r.masterMeter.y],
    ],
    'masterLevel>master1': across(r.masterLevel, r.master1, riserX),
    'masterLevel>master2': across(r.masterLevel, r.master2),
    'booth>boothOut': across(r.booth, r.boothOut),
    'master1>driverack': across(r.master1, r.driverack),
    'driverack>limiter': across(r.driverack, r.limiter),
    'limiter>amps': across(r.limiter, r.amps),
    'driverack>amps': across(r.driverack, r.amps),
    'amps>pa': across(r.amps, r.pa),
    'master2>howler': across(r.master2, r.howler),
    'boothOut>monitor': across(r.boothOut, r.monitor),
  };

  return finish(
    'wide',
    {
      width: xEnd + 76 + 6,
      height: 300,
      chassis: { x: 0.5, y: 0.5, w: cx(r.master1) - 0.5, h: 299 },
      rects: r,
      routes,
      dots: [
        { x: tapX, y: A, edges: ['eq1>fader1', 'eq1>meter1'] },
        { x: tapX, y: C, edges: ['eq2>fader2', 'eq2>meter2'] },
        { x: mergeX, y: B, edges: ['fader1>mix', 'fader2>mix'] },
        { x: splitX, y: B, edges: ['mix>masterLevel', 'mix>booth'] },
        { x: meterX, y: B, edges: ['masterLevel>masterMeter', 'masterLevel>master1', 'masterLevel>master2'] },
        { x: riserX, y: B, edges: ['masterLevel>master1', 'masterLevel>master2'] },
      ],
      labels: [
        {
          edge: 'master2>howler',
          x: (right(r.master2) + xEnd) / 2,
          y: B - 8,
          anchor: 'middle',
          lines: ['RCA lead'],
        },
      ],
    },
    variant,
  );
}

export function layoutFor(name: LayoutName, variant: Variant = 'full'): Layout {
  return name === 'tall' ? tallLayout(variant) : wideLayout(variant);
}
