/**
 * The rack as the owner describes it (28 September 2026) and as the photographs show it.
 *
 * The case holds a QSC GX7, the dbx DriveRack PA2 and a second GX7, with the leads between them left
 * in. On the trolley the rack's front, with the knobs and lights, faces the crowd, and its back, with
 * the sockets, faces the DJ. The upper amp drives the tops and the lower amp drives the subs. Which
 * channel drives the left or the right speaker does not matter to the owner, so nothing names one.
 *
 * The gear carries no tape and no marks, and none are planned. The crew set levels by the meters and
 * lights (C1).
 */
export const SPEAKER_PORTS = [
  { amp: 'Top amp', channels: 'CH1 and CH2', destination: 'the two tops' },
  { amp: 'Bottom amp', channels: 'CH1 and CH2', destination: 'the two subs' },
] as const;
