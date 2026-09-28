/**
 * C1's drawings, by what each says above it. The drawings are components (components/figures); their
 * captions live here, so the Crew page, the print kit's drawings card and the printed revision
 * (revision.ts) share one wording.
 */
import type { FigureId } from './checklists';

export interface FigureCaption {
  /** Where a link lands on the Crew page: /night/#rack. */
  anchor: string;
  /** What the drawing shows, as a short name. */
  title: string;
  /** The one thing to take from it, as a sentence or two. */
  note: string;
}

export const FIGURES: Readonly<Record<FigureId, FigureCaption>> = {
  table: {
    anchor: 'table',
    title: 'The trolley becomes the table',
    note: 'Shorten the frame until the holes in the top meet the holes in the handles. One bolt at each end holds the monitor, the top and the handle.',
  },
  booth: {
    anchor: 'booth',
    title: 'Where everything goes',
    note: 'The rack sits under the table. Its knobs face the crowd and its sockets face the DJ.',
  },
  rackRear: {
    anchor: 'rack',
    title: 'Back of the rack, on the DJ’s side',
    note: 'Four speaker leads, three power leads and the two leads from MASTER 1. The leads between the three units stay in.',
  },
  mixerRear: {
    anchor: 'mixer-rear',
    title: 'Back of the mixer',
    note: 'From behind, the three outputs sit together at the left end. All the other round sockets are inputs.',
  },
  rackFront: {
    anchor: 'rack-front',
    title: 'Front of the rack, on the crowd’s side',
    note: 'Each amp has a POWER switch and two gain knobs, with its CLIP lights between them.',
  },
};

/**
 * What the booth card prints beside the lights of its drawing of the meters, top down. The card is
 * A6, so each is a few words: the two meter rules name their meter as the mixer letters it (CH1, CH2,
 * MASTER), and the rule itself is beside the drawing in full. A ring on the drawing goes round the
 * lights each is about.
 */
export const CARD_METER_PLACES = {
  red: 'May distort',
  master: 'MASTER: dark',
  blend: 'Blend room',
  channels: 'CH1, CH2: aim',
} as const;

/** The drawings in the order C1 meets them. */
export const FIGURE_ORDER: readonly FigureId[] = ['table', 'booth', 'rackRear', 'mixerRear', 'rackFront'];
