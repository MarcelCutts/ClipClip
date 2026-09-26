/**
 * The rig as a signal graph: every knob, meter, socket and box between the decks and the three
 * places the music ends up. MASTER 1 feeds the PA through the DriveRack PA2 and the amps, MASTER 2
 * feeds the Howler, and BOOTH feeds the booth monitors. The SignalPath island draws this; every
 * highlight and sentence it shows comes from here, so the tests beside it are the fact check. The
 * setup page's wiring table reads the same nodes and edges.
 *
 * Facts, from the manuals in sources.ts:
 * - Signal order: TRIM, then EQ, then the channel fader, then the mix.
 * - Channel meters read before the fader; the MASTER meters read after MASTER LEVEL.
 *   Pioneer does not say whether the channel meters read after the EQ. The drawing assumes they
 *   do, and the guide's section on what the makers publish says so.
 * - MASTER LEVEL sets MASTER 1 and MASTER 2 together. BOOTH MONITOR sets BOOTH alone. The
 *   attenuators in UTILITY (ATT) turn those outputs down further. Pioneer says MASTER ATT "sets the
 *   master output attenuator" without naming the sockets, so the drawing does not show it, and the
 *   MASTER 2 caption says it may reach it (test T2).
 * - The DriveRack's limiters sit on its outputs, and the amps after it: both on the PA branch only.
 * - Pioneer does not publish where the XDJ clips inside, so the whole mixer counts as ceiling 1.
 *   The Howler's limit is not published either; its input is ceiling 2.
 */
import { section } from './sections';

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
  /** Taped on the real gear. The setup page's wiring table prints the tape. */
  taped?: boolean;
  /** A place where the sound can clip: 1 inside the mixer, 2 at the Howler's input. */
  ceiling?: 1 | 2;
  /** Meters only: the controls people expect this meter to show, which it cannot see. */
  blindSpots?: readonly NodeId[];
  /** Knobs only: where the pointer sits in the drawing, in degrees from 12 o'clock. */
  angle?: number;
}

export const NODES: Readonly<Record<NodeId, RigNode>> = {
  deck1: { id: 'deck1', kind: 'source', label: 'DECK 1', printed: true, glyph: 'deck' },
  trim1: { id: 'trim1', kind: 'control', label: 'TRIM', printed: true, context: 'channel 1', glyph: 'knob', angle: 0 },
  eq1: { id: 'eq1', kind: 'control', label: 'EQ', printed: true, context: 'channel 1', glyph: 'eq' },
  meter1: {
    id: 'meter1',
    kind: 'meter',
    label: 'CH1',
    printed: true,
    context: 'meter',
    glyph: 'meter',
    blindSpots: ['fader1'],
  },
  fader1: { id: 'fader1', kind: 'control', label: 'Fader', printed: false, context: 'channel 1', glyph: 'fader' },
  deck2: { id: 'deck2', kind: 'source', label: 'DECK 2', printed: true, glyph: 'deck' },
  trim2: { id: 'trim2', kind: 'control', label: 'TRIM', printed: true, context: 'channel 2', glyph: 'knob', angle: 0 },
  eq2: { id: 'eq2', kind: 'control', label: 'EQ', printed: true, context: 'channel 2', glyph: 'eq' },
  meter2: {
    id: 'meter2',
    kind: 'meter',
    label: 'CH2',
    printed: true,
    context: 'meter',
    glyph: 'meter',
    blindSpots: ['fader2'],
  },
  fader2: { id: 'fader2', kind: 'control', label: 'Fader', printed: false, context: 'channel 2', glyph: 'fader' },
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
    taped: true,
    angle: 45,
  },
  master1: { id: 'master1', kind: 'output', label: 'MASTER 1', printed: true, sub: 'XLR', glyph: 'xlr' },
  master2: { id: 'master2', kind: 'output', label: 'MASTER 2', printed: true, sub: 'RCA', glyph: 'rca' },
  boothOut: { id: 'boothOut', kind: 'output', label: 'BOOTH', printed: true, sub: 'TRS', glyph: 'trs' },
  driverack: { id: 'driverack', kind: 'processor', label: 'DriveRack PA2', printed: false, glyph: 'rack' },
  limiter: {
    id: 'limiter',
    kind: 'processor',
    label: 'Limiter',
    printed: false,
    context: 'inside the DriveRack',
    glyph: 'limiter',
  },
  // A box, but what matters is its gain knobs: they set the room's volume.
  amps: { id: 'amps', kind: 'control', label: 'Amps', printed: false, sub: 'QSC GX7', glyph: 'amp', taped: true },
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

/** signal: inside a box. tap: a meter reading the signal. cable: a lead between boxes. */
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
  edge('driverack', 'limiter', 'signal'),
  edge('limiter', 'amps', 'cable'),
  edge('amps', 'pa', 'cable'),
  edge('master2', 'howler', 'cable'),
  edge('boothOut', 'monitor', 'cable'),
];

/** Every connection in the drawing. The setup page's wiring table reads what feeds each box. */
export function edgesFor(): Edge[] {
  return [...EDGES];
}

/**
 * A node's name for screen readers: the text on it, then the context the drawing gives sighted
 * readers ("TRIM, channel 1"). It starts with the visible words, so voice control can use them.
 */
export function accessibleName(id: NodeId): string {
  const node = NODES[id];
  const second = node.ceiling ? `Ceiling ${node.ceiling}` : node.sub;
  const visible = node.glyph === 'eq' ? 'EQ HI MID LOW' : [node.label, second].filter(Boolean).join(' ');
  const context = [node.ceiling ? node.sub : undefined, node.context].filter(Boolean);
  return [visible, ...context].join(', ').replace(/ /g, ' ');
}

/** What starts picked: the recorder, to see what reaches the file. */
export const DEFAULT_SELECTION: NodeId = 'howler';

/**
 * Nodes in reading order: each channel top to bottom, then the mix, then each branch from its
 * knob to the box at the end of it. This is the DOM order, and so the order the arrow keys take.
 */
export const FLOW: readonly NodeId[] = [
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
export function downstreamOf(id: NodeId): Set<NodeId> {
  return walk(id, (n) => EDGES.filter((e) => e.from === n).map((e) => e.to));
}

/** Everything that feeds a node. */
export function upstreamOf(id: NodeId): Set<NodeId> {
  return walk(id, (n) => EDGES.filter((e) => e.to === n).map((e) => e.from));
}

/** The knobs and faders whose turn changes what `target` gets, in signal order. */
export function controlsFor(target: NodeId): NodeId[] {
  const up = upstreamOf(target);
  return FLOW.filter((id) => up.has(id) && NODES[id].kind === 'control');
}

/** Which of the PA, the booth monitors and the Howler a node's signal ends up in. */
export function listenersReached(id: NodeId): Listener[] {
  const down = downstreamOf(id);
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

export function highlightFor(id: NodeId): Highlight {
  const direction = directionFor(id);
  const nodes = new Set<NodeId>([id]);
  if (direction !== 'up') for (const n of downstreamOf(id)) nodes.add(n);
  if (direction !== 'down') for (const n of upstreamOf(id)) nodes.add(n);
  const edges = new Set(EDGES.filter((e) => nodes.has(e.from) && nodes.has(e.to)).map((e) => e.id));
  return { direction, nodes, edges };
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

export interface Caption {
  title: string;
  /** Only what the summary under it (Reaches, Set by, Shows) does not already say. */
  text?: string;
}

/**
 * One title per node, and a line only where there's something the computed summary does not say.
 * The ceilings are named on the drawing, and the reasons live in the guide's prose.
 */
export const COPY: Readonly<Record<NodeId, Caption>> = {
  deck1: { title: 'Where DECK 1 goes' },
  deck2: { title: 'Where DECK 2 goes' },
  trim1: { title: 'What TRIM touches' },
  trim2: { title: 'What TRIM touches' },
  eq1: { title: 'What EQ touches' },
  eq2: { title: 'What EQ touches' },
  meter1: { title: 'What the CH1 meter can see' },
  meter2: { title: 'What the CH2 meter can see' },
  fader1: { title: 'What the fader touches' },
  fader2: { title: 'What the fader touches' },
  mix: { title: 'Ceiling 1, inside the mixer', text: 'Both channels add up here.' },
  masterLevel: { title: 'What MASTER LEVEL touches' },
  masterMeter: { title: 'What the MASTER meters can see' },
  booth: { title: 'What BOOTH MONITOR touches', text: 'It’s the DJ’s knob.' },
  master1: { title: 'What MASTER 1 feeds', text: 'MASTER ATT, in UTILITY, also sets its level.' },
  master2: { title: 'What MASTER 2 feeds', text: 'MASTER ATT may lower it too (test T2).' },
  boothOut: { title: 'What the BOOTH sockets feed', text: 'BOOTH ATT, in UTILITY, also sets their level.' },
  driverack: { title: 'What the DriveRack does', text: 'It tunes the PA.' },
  limiter: { title: 'What the limiter protects', text: 'It works only when switched on.' },
  amps: { title: 'What the amps touch', text: 'Their gain knobs set the room’s volume.' },
  pa: { title: 'What the crowd hears' },
  monitor: { title: 'What the booth monitors play' },
  howler: { title: 'What the recorder hears', text: 'Its input is ceiling 2.' },
};

/** The drawing's name for screen readers. */
export const DRAWING_NAME = 'Which knob touches what';

/**
 * The drawing's caveat. What the makers leave out is stated once, in the guide's section on what
 * they publish (the mixer as one ceiling, the Howler's limit, the channel meters after the EQ).
 */
const MAKERS = section('red-top');

export const MODEL_NOTE = {
  text: 'Parts of this drawing are assumptions.',
  link: `See ${MAKERS.number}`,
  href: `#${MAKERS.id}`,
} as const;

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
export function summaryFor(id: NodeId): Summary {
  const direction = directionFor(id);
  const { kind, blindSpots } = NODES[id];
  if (kind === 'meter') {
    const summary: Summary = { label: 'Shows', items: listText(controlNames(controlsFor(id))) };
    if (blindSpots && blindSpots.length > 0) {
      summary.notLabel = 'Cannot see';
      summary.notItems = listText(controlNames(blindSpots), 'or');
    }
    return summary;
  }
  if (direction === 'up' || kind === 'output') {
    const controls = controlsFor(id);
    const summary: Summary = { label: 'Set by', items: listText(controlNames(controls)) };
    // Knobs on other branches. Those further down this one (the amps, after MASTER 1) go unsaid.
    const down = downstreamOf(id);
    const missing = BRANCH_KNOBS.filter((k) => !controls.includes(k) && !down.has(k));
    if (missing.length > 0) {
      summary.notLabel = 'Not by';
      summary.notItems = listText(controlNames(missing), 'or');
    }
    return summary;
  }
  const reached = listenersReached(id);
  const summary: Summary = { label: 'Reaches', items: listText(reached.map((l) => LISTENER_NAME[l])) };
  const missed = LISTENERS.filter((l) => !reached.includes(l));
  if (missed.length > 0) {
    summary.notLabel = 'Does not reach';
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

/** A lead's name, drawn next to its wire. */
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
  rects: Record<NodeId, Rect>;
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

function finish(name: LayoutName, draft: Draft): Layout {
  const wires: Wire[] = EDGES.map((e) => {
    const points = draft.routes[e.id];
    if (!points) throw new Error(`No route for ${e.id} in the ${name} layout`);
    return { edge: e.id, points, d: roundedPath(points), arrow: arrowHead(points) };
  });
  return {
    name,
    width: draft.width,
    height: draft.height,
    chassis: draft.chassis,
    rects: draft.rects,
    wires,
    dots: draft.dots,
    labels: draft.labels,
  };
}

/**
 * Part names are set at 15 px or more at every width (DESIGN.md: anything someone acts on), with
 * the part's drawing above the name. Each layout is drawn so that its narrowest screen still fits
 * them: the widest words ("DriveRack", "MASTER 1", "monitors") and two lines of name, or a name
 * and its second line, under the drawing.
 *
 * The tall drawing's narrowest stage is 258 px, on a 320 px phone, so one unit is 0.86 px there and
 * 15 px of type is about 17.5 units. The wide drawing takes over from `WIDE_FROM_PX` of panel,
 * where one unit is at least 1 px (SignalPath.svelte's container query uses the same number).
 */
export const WIDE_FROM_PX = 900;

/** Heights of a tall drawing's parts: a name on one line, or two lines (a long name, or a name and its second line). */
const TALL_ONE = 54;
const TALL_TWO = 74;

/**
 * How far past its edge each part catches taps in the tall drawing, in drawing units. On a 320 px
 * phone the narrowest parts (the channel meters) draw at about 41 px wide, and this brings every
 * hit area to 44 px or more. The tall layout keeps neighbours at least twice this far apart, so
 * no two hit areas overlap.
 */
export const TALL_HIT_PAD = { x: 2, y: 4 } as const;

/** Phones: both channels side by side, the signal running down the screen. */
function tallLayout(): Layout {
  const L = { x: 4, w: 92 };
  const M = { x: 104, w: 92 };
  const R = { x: 204, w: 92 };
  const at = (col: { x: number; w: number }, y: number, h = TALL_ONE): Rect => ({ x: col.x, y, w: col.w, h });
  // Under the XDJ the PA branch runs down the left: DriveRack, the limiter, amps.
  const ampsY = 814;
  // The three places the music ends up share the bottom row.
  const yEnd = ampsY + TALL_TWO + 16;

  const r: Record<NodeId, Rect> = {
    deck1: at(L, 30),
    deck2: at(R, 30),
    trim1: at(L, 100),
    trim2: at(R, 100),
    // HI, MID and LOW, one knob a line.
    eq1: at(L, 170, 76),
    eq2: at(R, 170, 76),
    // As wide as the gap between the channels allows, so they stay easy to tap.
    meter1: { x: 100, y: 225, w: 48, h: 62 },
    meter2: { x: 152, y: 225, w: 48, h: 62 },
    fader1: at(L, 266),
    fader2: at(R, 266),
    mix: at(M, 352, TALL_TWO),
    masterLevel: at(M, 458, TALL_TWO),
    booth: at(R, 458, TALL_TWO),
    // Wide enough for its name, over MASTER 1.
    masterMeter: { x: L.x, y: 458, w: L.w, h: 62 },
    master1: at(L, 564, TALL_TWO),
    master2: at(M, 564, TALL_TWO),
    boothOut: at(R, 564, TALL_TWO),
    driverack: at(L, 654, TALL_TWO),
    limiter: at(L, 744),
    amps: at(L, ampsY, TALL_TWO),
    pa: at(L, yEnd, TALL_TWO),
    howler: at(M, yEnd, TALL_TWO),
    monitor: at(R, yEnd, TALL_TWO),
  };

  const tapY = 256;
  const mergeY = 336;
  const splitY = 442;
  const busY = 548;
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
    'amps>pa': down(r.amps, r.pa),
    'master2>howler': down(r.master2, r.howler),
    'boothOut>monitor': down(r.boothOut, r.monitor),
  };

  return finish('tall', {
    width: 300,
    height: yEnd + TALL_TWO + 6,
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
  });
}

/**
 * Wider screens: the two channels as rows, the signal running left to right. The MASTER meters sit
 * over MASTER LEVEL, tapping the wire that rises from it to MASTER 1, so the drawing needs no
 * column of its own for them and fits the widest names at 15 px from `WIDE_FROM_PX` up.
 */
function wideLayout(): Layout {
  // Row A starts under the XDJ-RX2's printed name, in the chassis's top corner.
  const A = 56;
  const B = 156;
  const C = 256;
  const H = 66;
  const at = (x: number, w: number, row: number, h = H): Rect => ({ x, y: row - h / 2, w, h });
  // The PA branch runs along the top row: DriveRack, the limiter, amps.
  const ampsX = 736;
  // The three places the music ends up share the last column.
  const xEnd = ampsX + 66 + 14;

  const r: Record<NodeId, Rect> = {
    deck1: at(6, 56, A),
    deck2: at(6, 56, C),
    trim1: at(76, 50, A),
    trim2: at(76, 50, C),
    // HI, MID and LOW, one knob a line.
    eq1: at(140, 62, A),
    eq2: at(140, 62, C),
    // Between the rows, under and over the wires they tap.
    meter1: { x: 187, y: A + 40, w: 48, h: 56 },
    meter2: { x: 187, y: C - 96, w: 48, h: 56 },
    fader1: at(220, 50, A),
    fader2: at(220, 50, C),
    mix: at(292, 68, B),
    masterLevel: at(382, 72, B),
    booth: at(382, 72, C),
    masterMeter: at(382, 72, A),
    master1: at(480, 74, A),
    master2: at(480, 74, B),
    boothOut: at(480, 74, C),
    driverack: at(568, 80, A),
    limiter: at(662, 60, A),
    amps: at(ampsX, 66, A),
    pa: at(xEnd, 74, A),
    howler: at(xEnd, 74, B),
    monitor: at(xEnd, 74, C),
  };

  const tapX = 211;
  const mergeX = 280;
  const splitX = 370;
  const riserX = 466;
  // Where the middle meters tap the riser to MASTER 1: level with the meters, clear of the corner.
  const meterTapY = A + 20;
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
      [riserX, meterTapY],
      [right(r.masterMeter), meterTapY],
    ],
    'masterLevel>master1': across(r.masterLevel, r.master1, riserX),
    'masterLevel>master2': across(r.masterLevel, r.master2),
    'booth>boothOut': across(r.booth, r.boothOut),
    'master1>driverack': across(r.master1, r.driverack),
    'driverack>limiter': across(r.driverack, r.limiter),
    'limiter>amps': across(r.limiter, r.amps),
    'amps>pa': across(r.amps, r.pa),
    'master2>howler': across(r.master2, r.howler),
    'boothOut>monitor': across(r.boothOut, r.monitor),
  };

  return finish('wide', {
    width: xEnd + 74 + 6,
    height: bottom(r.deck2) + 8,
    chassis: { x: 0.5, y: 0.5, w: cx(r.master1) - 0.5, h: bottom(r.deck2) + 7 },
    rects: r,
    routes,
    dots: [
      { x: tapX, y: A, edges: ['eq1>fader1', 'eq1>meter1'] },
      { x: tapX, y: C, edges: ['eq2>fader2', 'eq2>meter2'] },
      { x: mergeX, y: B, edges: ['fader1>mix', 'fader2>mix'] },
      { x: splitX, y: B, edges: ['mix>masterLevel', 'mix>booth'] },
      { x: riserX, y: B, edges: ['masterLevel>master1', 'masterLevel>master2'] },
      { x: riserX, y: meterTapY, edges: ['masterLevel>master1', 'masterLevel>masterMeter'] },
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
  });
}

export function layoutFor(name: LayoutName): Layout {
  return name === 'tall' ? tallLayout() : wideLayout();
}
