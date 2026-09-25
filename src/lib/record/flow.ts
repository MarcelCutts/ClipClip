/**
 * The read-then-do sequence for setting the record level, as a pure reducer: the island dispatches
 * what the reader does, and gets back the next state. Nothing here touches the DOM.
 *
 * The steps, for the Howler on MASTER 2: MASTER LEVEL fully up and taped, the loudest blend, MASTER
 * ATT down a step at a time while the light is red, MASTER LEVEL down only if it's still red, then
 * a test recording. The practice round runs the same steps from a random start, without the
 * instructions.
 */

import { formatDb } from '../dsp/db';
import {
  ATT_LOWEST,
  ATT_VALUES,
  type AttDb,
  attMessage,
  type Feed,
  HOWLER_LIMIT,
  holdMessage,
  judgeAtt,
  judgeHold,
  judgeLevel,
  judgePlay,
  judgeUp,
  LEVEL,
  type Light,
  levelMessage,
  MARGIN,
  MATERIAL_IDS,
  type MaterialId,
  material,
  NOTCH_DB,
  nearestNotch,
  playMessage,
  type Rig,
  randomFound,
  recordedMessage,
  shuffledOrder,
  upMessage,
} from './model';

export type Mode = 'worked' | 'practice';
export type StepId = 'up' | 'play' | 'att' | 'level' | 'test';
export type CheckId = 'level' | 'hum' | 'sides';
/** The rig's controls: what's playing, MASTER LEVEL and MASTER ATT. */
export type Control = 'play' | 'level' | 'att';

export interface Step {
  id: StepId;
  /** The challenge, as it appears on the checklist: what to look at, named as on the gear. */
  label: string;
  /** What the checklist response should read once it's done: a target state, not "checked". */
  target: string;
  /** The read-then-do line: what to do, and what to look for. */
  instruction: string;
  /** The key that says the step is done. */
  action: string;
  /** The control the step works, if any. */
  control: Control | null;
}

const db = (v: number) => formatDb(v, { signed: false });
const meter = (v: number) => formatDb(v, { unit: '' });
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const STEPS: readonly Step[] = [
  {
    id: 'up',
    label: 'MASTER LEVEL',
    target: 'Fully up, taped REC',
    instruction:
      'Turn MASTER LEVEL fully up. Tape it there and write REC on the tape. Fully up, the middle meters show the mix itself.',
    action: 'Tape it',
    control: 'level',
  },
  {
    // Hotter than the DJs' rule (first or second orange) on purpose, and it says so.
    id: 'play',
    label: 'Loudest blend',
    target: 'Playing, light checked',
    instruction: `Play a blend hotter than any DJ should send, both decks at ${meter(material('loud').mixDb)} with the kicks lined up. The middle meters touch red on purpose. Watch the Howler light.`,
    action: 'Check the light',
    control: 'play',
  },
  {
    // Worded in what the booth shows. The Howler has one light and no readout, so nobody can aim
    // for a dBFS number on the night. The file's numbers come afterwards, as the result.
    id: 'att',
    label: 'MASTER ATT',
    target: 'A step down while red',
    instruction: `If the light blinks red, set MASTER ATT in UTILITY down a step, to ${db(ATT_VALUES[1])}. If it’s still red, set it to ${db(ATT_LOWEST)}. Once it’s green, leave it there.`,
    action: 'Set it here',
    control: 'att',
  },
  {
    // Only if MASTER ATT ran out of steps: a condition, as a quick reference handbook words one.
    id: 'level',
    label: 'MASTER LEVEL, if still red',
    target: capitalise(MARGIN),
    instruction: `If the light is still red with MASTER ATT at ${db(ATT_LOWEST)}, turn MASTER LEVEL down a notch at a time to the ${MARGIN}. Re-mark the REC tape. The middle meters then read low, so a blend can clip before they go red. If the light was green, leave MASTER LEVEL fully up.`,
    action: 'Mark it here',
    control: 'level',
  },
  {
    id: 'test',
    label: 'Test recording',
    target: 'Heard on headphones',
    instruction: 'Record 2\u00a0minutes and listen on headphones for the level, any hum and both sides.',
    action: 'Record 2\u00a0minutes',
    control: null,
  },
];

export const STEP_IDS: readonly StepId[] = STEPS.map((s) => s.id);

export const step = (id: StepId): Step => STEPS.find((s) => s.id === id)!;

/** After the steps: what every turn-down costs the room, and where to get it back. */
export const ROOM_NOTE =
  'MASTER ATT and MASTER LEVEL turn the speakers down too, so bring the room back up at the amps.';

export const CHECKS: readonly { id: CheckId; label: string }[] = [
  { id: 'level', label: 'Clean level, no crunch' },
  { id: 'hum', label: 'No hum or buzz' },
  { id: 'sides', label: 'Sound on the left and the right' },
];

export interface Feedback {
  tone: 'good' | 'fix';
  text: string;
  /** The step it's about. */
  step: StepId;
  /** The rig it was about. Once the rig moves on, the words may be out of date. */
  rig: Rig;
}

export interface Flow {
  mode: Mode;
  /** The order the three things to play are offered in. */
  order: readonly MaterialId[];
  /** The Howler's limit (see model.ts). Always the site's assumption here; tests can try others. */
  limit: number;
  /** The rig as found, so "Start again" only shows once something has changed. */
  found: Feed;
  rig: Rig;
  /** The step being worked on. */
  step: StepId;
  kept: {
    /** Where the REC tape sits on MASTER LEVEL, once taped. */
    tape: number | null;
    /** What the Howler light did on the loudest blend at step 2. */
    seen: Light | null;
    /** The MASTER ATT step that step 3 left. */
    att: AttDb | null;
  };
  /** Step 5: the test clip has been made. */
  recorded: boolean;
  heard: Record<CheckId, boolean>;
  /** What the last press of this step's key said, if it didn't finish the step. */
  note: Feedback | null;
  /** The last step finished, and what its key said. */
  last: Feedback | null;
  complete: boolean;
}

export type Action =
  | { type: 'play'; material: MaterialId }
  | { type: 'level'; db: number }
  | { type: 'att'; db: AttDb }
  | { type: 'commit' }
  | { type: 'heard'; check: CheckId; value: boolean };

/**
 * The worked example starts the way the booth is often found: MASTER LEVEL three notches down,
 * where a DJ turned the room down with it, MASTER ATT at its factory 0 dB, and nothing playing.
 */
export const WORKED_FOUND: Feed = { level: LEVEL.max - 3 * NOTCH_DB, att: ATT_VALUES[0] };

export function workedStart(limit = HOWLER_LIMIT): Flow {
  return {
    mode: 'worked',
    order: MATERIAL_IDS,
    limit,
    found: WORKED_FOUND,
    rig: { material: null, ...WORKED_FOUND },
    step: 'up',
    kept: { tape: null, seen: null, att: null },
    recorded: false,
    heard: { level: false, hum: false, sides: false },
    note: null,
    last: null,
    complete: false,
  };
}

/** Your turn: the same job from a random start, with the choices shuffled. */
export function practiceStart(rand: () => number = Math.random, limit = HOWLER_LIMIT): Flow {
  const found = randomFound(rand);
  return {
    ...workedStart(limit),
    mode: 'practice',
    order: shuffledOrder(rand),
    found,
    rig: { material: null, ...found },
  };
}

const good = (text: string, step: StepId, rig: Rig): Feedback => ({ tone: 'good', text, step, rig });
const fix = (text: string, step: StepId, rig: Rig): Feedback => ({ tone: 'fix', text, step, rig });

export function reduce(flow: Flow, action: Action): Flow {
  switch (action.type) {
    case 'play':
      return { ...flow, rig: { ...flow.rig, material: action.material } };
    case 'level':
      return { ...flow, rig: { ...flow.rig, level: nearestNotch(action.db) } };
    case 'att':
      return { ...flow, rig: { ...flow.rig, att: action.db } };
    case 'heard': {
      const heard = { ...flow.heard, [action.check]: action.value };
      const complete = flow.recorded && Object.values(heard).every(Boolean);
      if (complete) return { ...flow, heard, complete, note: null };
      // Un-ticking a check after finishing takes you back to listening.
      const note = flow.complete ? good(recordedMessage(flow.rig, flow.limit), 'test', flow.rig) : flow.note;
      return { ...flow, heard, complete, note };
    }
    case 'commit':
      return commit(flow);
  }
}

/** Finish this step: its words move to its line on the checklist, and the next step starts. */
function advance(flow: Flow, next: StepId, text: string, kept: Flow['kept']): Flow {
  return { ...flow, step: next, kept, note: null, last: good(text, flow.step, flow.rig) };
}

const stay = (flow: Flow, text: string): Flow => ({ ...flow, note: fix(text, flow.step, flow.rig) });

function commit(flow: Flow): Flow {
  const { rig, kept, limit } = flow;
  if (flow.complete) return flow;
  switch (flow.step) {
    case 'up': {
      const v = judgeUp(rig);
      if (v.kind !== 'taped') return stay(flow, upMessage(v));
      return advance(flow, 'play', upMessage(v), { ...kept, tape: rig.level });
    }
    case 'play': {
      const v = judgePlay(rig, kept.tape ?? LEVEL.max, limit);
      if (v.kind !== 'seen') return stay(flow, playMessage(v));
      return advance(flow, 'att', playMessage(v), { ...kept, seen: v.light });
    }
    case 'att': {
      const v = judgeAtt(rig, kept.tape ?? LEVEL.max, limit);
      if (v.kind !== 'set' && v.kind !== 'lowest-red') return stay(flow, attMessage(v));
      return advance(flow, 'level', attMessage(v), { ...kept, att: rig.att });
    }
    case 'level': {
      const v = judgeLevel(rig, kept.att ?? ATT_LOWEST, limit);
      if (v.kind !== 'stays-up' && v.kind !== 'set') return stay(flow, levelMessage(v));
      return advance(flow, 'test', levelMessage(v), { ...kept, tape: rig.level });
    }
    case 'test': {
      if (flow.recorded) return flow;
      const v = judgeHold(rig, kept.tape ?? LEVEL.max, kept.att ?? ATT_LOWEST);
      if (v.kind !== 'held') return stay(flow, holdMessage(v));
      return { ...flow, recorded: true, note: good(recordedMessage(rig, limit), 'test', rig) };
    }
  }
}

export type StepState = 'done' | 'current' | 'todo';

export function stepState(flow: Flow, id: StepId): StepState {
  if (flow.complete) return 'done';
  const at = STEP_IDS.indexOf(flow.step);
  const i = STEP_IDS.indexOf(id);
  return i < at ? 'done' : i === at ? 'current' : 'todo';
}

/** The checklist response: what was achieved once a step is done, the target state before. */
export function stepResponse(flow: Flow, id: StepId): string {
  if (stepState(flow, id) !== 'done') return step(id).target;
  const { kept } = flow;
  switch (id) {
    case 'up':
      return 'Taped REC, fully up';
    case 'play':
      return kept.seen === 'red' ? 'Light blinking red' : 'Light blinking green';
    case 'att':
      return kept.att === null ? step(id).target : `At ${db(kept.att)}`;
    case 'level':
      return kept.tape === null || kept.tape === LEVEL.max ? 'Stays fully up' : `Marked REC at ${db(kept.tape)}`;
    case 'test':
      return 'Heard on headphones';
  }
}

/**
 * A control that has left its tape or its set step, where that's a slip rather than the job in
 * hand. Step 4's job can be moving MASTER LEVEL, so it only watches MASTER ATT.
 */
export function offMark(flow: Flow): Control | null {
  const { tape, att } = flow.kept;
  const levelOff = tape !== null && flow.rig.level !== tape;
  const attOff = att !== null && flow.rig.att !== att;
  if (flow.complete || flow.step === 'test') return levelOff ? 'level' : attOff ? 'att' : null;
  if (flow.step === 'play' || flow.step === 'att') return levelOff ? 'level' : null;
  if (flow.step === 'level') return attOff ? 'att' : null;
  return null;
}

/** What the live region says once a step is finished: its result, then which step is next. */
export function doneAnnouncement(flow: Flow): string {
  if (!flow.last) return '';
  const i = STEP_IDS.indexOf(flow.step);
  const { label } = step(flow.step);
  return `${flow.last.text} Step ${i + 1} of ${STEPS.length}: ${label}${/[?.!]$/.test(label) ? '' : '.'}`;
}
