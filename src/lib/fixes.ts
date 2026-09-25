/**
 * "Something's wrong": what the crew do when a light goes red or a recording sounds off, written as
 * the drills of a quick reference handbook for /night/#fixes. Each drill is linkable as
 * /night/#fix-<id>, and its steps as /night/#fix-<id>-step-<n>.
 *
 * A drill has a title (the light as printed and where it is, when a light prompts it; otherwise the
 * symptom, in sentence case), a condition (what you see), an objective (what the drill achieves), then
 * numbered steps. A step is a control and what to do with it, joined by leader dots ("MASTER ATT ……
 * down a step"), or a line that starts "If". After a step, "Choose one" lists what you might find, each
 * branch ending the drill (■ ■ ■ ■), jumping to a step or another drill, or carrying on to the next
 * step. `why` is additional information: it never has to be read to do the drill.
 *
 * The rig, one way only: MASTER 1 (XLR) → DriveRack PA2 → two QSC GX7 amps → PA; MASTER 2 (RCA) →
 * Howler; BOOTH → booth monitors. MASTER LEVEL is taped fully up (REC), so the middle meters show the
 * mix itself, and the room's volume comes from the amps' gain knobs (RIG), never the mixer.
 *
 * Facts come from the documents in sources.ts, with page numbers in the comments:
 * - Pioneer, XDJ-RX2 Operating Instructions (DRI1479A);
 * - QSC, GX3, GX5 and GX7 user manual;
 * - dbx, DriveRack PA2 Owner's Manual (printed page numbers);
 * - Howler, Recorder+Streamer MK1 manual; Rane Note 110.
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes and quotes are curly.
 */

/** A light drawn lit beside a drill's title, in its real colour: the one you're looking at. */
export type DrillLight = 'howler-red' | 'meters-red' | 'clip' | 'driverack-clip';

/** Where to go next: a step number in the same drill, or another drill's id. */
export type Next = number | string;

/** One of the things you might find after a step, under "Choose one". */
export interface Branch {
  /** What you find, set in bold before a colon: "Middle meters red too". */
  finding: string;
  /** What to do about it, in plain sentences. */
  action?: string;
  /** Go to this step, or to another drill. */
  next?: Next;
  /** The drill ends here. Without `next` or `end`, carry on with the next step. */
  end?: true;
}

/** A step as a challenge and its response: the control, and what to do with it or the state it ends in. */
export interface ActionStep {
  /** The control or the thing to look at, named as printed on the gear: "MASTER ATT". */
  challenge: string;
  /** What to do with it, or the state it should end in: "down a step". Set in the action colour. */
  response: string;
  /** How, in a sentence or two, read after the step. */
  note?: string;
  /** "Choose one": two or more branches for what you might find next. */
  choose?: readonly Branch[];
}

/** A step that only applies sometimes, written as sentences starting "If": "If the DJ wants it louder, …". */
export interface IfStep {
  if: string;
  next?: Next;
  end?: true;
}

export type Step = ActionStep | IfStep;

export interface Fix {
  /** Stable and link-safe: the drill's anchor is fix-<id>. Change it and links from the chat break. */
  id: string;
  /** The drill's number, on the right of its title strip: F1, F2… Numbers are never reused. */
  code: string;
  /** Where it shows up: in the booth on the night, or in the recording afterwards. */
  where: 'booth' | 'recording';
  /**
   * The drill's title. When a light prompts it, the light as printed and where it is, then its state:
   * "LEVEL light on the Howler: red". Otherwise the symptom, in sentence case: "The room isn’t loud enough".
   */
  title: string;
  /** The light you're looking at, drawn lit beside the title. */
  light?: DrillLight;
  /** What you see or hear, as one sentence. */
  condition: string;
  /** What the drill achieves, as one plain sentence. */
  objective: string;
  /** Said before the steps, when a step could hurt someone. */
  warning?: string;
  steps: readonly Step[];
  /** Additional information: why the drill works. */
  why?: string;
  /** Where the guide explains it: an anchor on the guide, like '#record-level'. */
  see?: string;
}

export const isIfStep = (step: Step): step is IfStep => 'if' in step;

/** The anchor of a drill, or of one of its steps (numbered from 1). */
export const drillAnchor = (id: string, step?: number): string =>
  step === undefined ? `fix-${id}` : `fix-${id}-step-${step}`;

export const FIXES: Fix[] = [
  // ---- In the booth, on the night ----------------------------------------------------------------
  {
    // Howler doesn't publish where its light turns red (MK1 manual, FAQ): red means turn the source down.
    // Pioneer's fix for distortion is MASTER ATT (manual p.34; UTILITY table p.32), but Pioneer doesn't say
    // MASTER ATT reaches MASTER 2, so MASTER LEVEL is the fallback. The middle meters read after it (p.31).
    // Both turn the PA down too, so the room comes back up at the amps.
    id: 'howler-red',
    code: 'F1',
    where: 'booth',
    title: 'LEVEL light on the Howler: red',
    light: 'howler-red',
    condition: 'The Howler’s LEVEL light blinks red.',
    objective: 'Find where the overload starts, and fix it there.',
    steps: [
      {
        challenge: 'Middle meters',
        response: 'check',
        note: 'Look before you touch anything.',
        choose: [
          {
            finding: 'Middle meters red too',
            action: 'It’s the mix. A quiet word with the DJ: TRIM down. Leave the record level alone.',
            end: true,
          },
          { finding: 'A DJ just loaded MY SETTINGS', next: 2 },
          { finding: 'Neither', next: 3 },
        ],
      },
      {
        challenge: 'MASTER ATT and BOOTH ATT',
        response: 'as on the tape',
        note: 'In UTILITY. Set back any that changed.',
        choose: [
          { finding: 'Green again', end: true },
          { finding: 'Still red', next: 3 },
        ],
      },
      {
        challenge: 'MASTER ATT',
        response: 'down a step',
        note: 'In UTILITY: −6 dB, then −12 dB.',
        choose: [
          { finding: 'Green through the loudest blend', next: 5 },
          { finding: 'Still red, or no change', next: 4 },
        ],
      },
      {
        challenge: 'MASTER LEVEL',
        response: 'down a notch at a time',
        note: 'Use it instead of MASTER ATT, until the light stays green through the loudest blend. The middle meters then read low, so a blend can crunch before they go red.',
      },
      { challenge: 'REC tape', response: 're-marked' },
      { challenge: 'Room volume', response: 'back up at the amps', note: 'The speakers dropped too.' },
    ],
    why: 'Turning the recording down can’t take out crunch that’s already in the mix. It only records the crunch more quietly.',
    see: '#record-level',
  },
  {
    // Pioneer manual p.31: make sure the red indicator doesn't light, "or the sound may be distorted".
    id: 'channels-red',
    code: 'F2',
    where: 'booth',
    title: 'Channel meters: red',
    light: 'meters-red',
    condition: 'A channel meter reaches its red light.',
    objective: 'Stop the channel clipping, and take any extra volume from the amps.',
    steps: [
      {
        challenge: 'TRIM',
        response: 'eased back by the DJ',
        note: 'Have a quiet word. The loudest bits go on the first or second orange light, and red stays dark.',
      },
      {
        if: 'If the DJ wants it louder, offer the amps instead. Turn the amps up, never their channels.',
        next: 'not-loud',
      },
    ],
    why: 'Pioneer says a red channel light means the sound may be distorted. Anything that clips in the channel stays in the recording.',
    see: '#trim',
  },
  {
    // Pioneer manual p.27: CLIP blinks when the output level is too high. Blinking slowly: the sound is about to
    // be distorted. Blinking fast: the sound is distorted.
    id: 'clip',
    code: 'F3',
    where: 'booth',
    title: 'CLIP light above the middle meters: blinking',
    light: 'clip',
    condition: 'The CLIP light above the middle meters blinks.',
    objective: 'Bring the mix back down from the top with the DJ’s faders or TRIMs.',
    steps: [
      {
        challenge: 'A fader or a TRIM',
        response: 'down now, by the DJ',
        choose: [
          {
            finding: 'Blinking slowly',
            action: 'Pioneer says the sound is about to distort. A notch down on the loudest channel is enough.',
          },
          {
            finding: 'Blinking fast',
            action:
              'Pioneer says the sound is distorted, and the recording has it. Faders or TRIMs down until it stops.',
          },
        ],
      },
      {
        if: 'If it blinks on every blend, have a word between tracks. Remind the DJ to watch the middle meters when blending, and to play one bassline at a time.',
      },
    ],
    why: 'MASTER LEVEL is fully up, so CLIP means the mix itself is at the top. Only the DJ’s TRIMs and faders bring it down.',
    see: '#meters',
  },
  {
    // QSC GX manual: gain controls CH1 and CH2 on the front, marked in dB of attenuation (p.5), with 21 detents
    // (p.11). Red CLIP LEDs flash when the amp is overdriven, and heavy overdrive makes it turn itself down (p.5).
    id: 'not-loud',
    code: 'F4',
    where: 'booth',
    title: 'The room isn’t loud enough',
    condition: 'A DJ says the room isn’t loud enough.',
    objective: 'Turn the room up at the amps, and leave the mixer alone.',
    steps: [
      {
        challenge: 'Both amps',
        response: 'up one click',
        note: 'The gain knobs, 1 and 2, on the front of each GX7. Turn all four by the same number of clicks, so the subs and tops stay in balance.',
        choose: [
          {
            finding: 'Knobs already at 0, fully up',
            action: 'That’s all the amps have. Tell the DJ kindly, and keep their channels where they are.',
            end: true,
          },
          {
            finding: 'A red CLIP light on either amp',
            action: 'Stop there, and turn back one click. That’s as loud as this rig goes.',
            end: true,
          },
          { finding: 'Neither', next: 2 },
        ],
      },
      {
        challenge: 'The DJ',
        response: 'asked, after a few bars',
        note: 'If they want it louder yet, turn another click, as in step 1.',
      },
    ],
    why: 'Pushing the mixer into the red only adds crunch. The amps feed the speakers alone, so turning them up never reaches the recording.',
    see: '#knobs',
  },
  {
    // dbx manual: the TH lights turn red when a limiter is limiting (p.5); the PeakPlus output limiters protect
    // the amps and speakers (p.43). QSC GX manual p.5 and p.10: an overdriven GX turns itself down.
    id: 'no-louder',
    code: 'F5',
    where: 'booth',
    title: 'The DJ pushes harder, but the room gets no louder',
    condition: 'The DJ turns the mix up, and the room stays as loud as it was.',
    objective: 'Stop the crunch, and find which part of the rig is at its limit.',
    steps: [
      {
        challenge: 'The DJ',
        response: 'eased back to orange',
        note: 'Past the rig’s limit, the extra is only crunch.',
      },
      {
        challenge: 'DriveRack and amp lights',
        response: 'check',
        choose: [
          {
            finding: 'DriveRack TH lights red',
            action: 'Its limiters are holding the speakers at their limit. A hotter mix only means more limiting.',
            end: true,
          },
          {
            finding: 'DriveRack input CLIP lights on',
            action: 'Its input is overloaded. Check its input switch is on +4 dBu.',
            next: 'driverack-clip',
          },
          {
            finding: 'A red CLIP light on the amps',
            action: 'The amps are overdriven and turning themselves down. Turn them back a click.',
            end: true,
          },
        ],
      },
    ],
    why: 'Once the rig is at its limit, the room can’t get any louder. Pushing the mix harder only puts crunch in the recording.',
    see: '#loud',
  },
  {
    // dbx manual p.5: the input CLIP LEDs light when the inputs are overdriven; if they light, reduce the mixer's
    // output. On −10 dBV a +4 dBu source lights them early (0 dBFS at about +9.9 dBu, not +19.9 dBu); mute the
    // outputs before switching to +4 dBu.
    id: 'driverack-clip',
    code: 'F6',
    where: 'booth',
    title: 'CLIP lights on the DriveRack: lit',
    light: 'driverack-clip',
    condition: 'The CLIP lights by the DriveRack’s INPUT meters come on.',
    objective: 'Stop the DriveRack’s input clipping, and keep MASTER LEVEL fully up.',
    steps: [
      {
        challenge: 'Its input switch, on the back',
        response: '+4 dBu',
        choose: [
          {
            finding: 'On −10 dBV',
            action:
              'Mute the DriveRack’s outputs, flip the switch to +4 dBu, then unmute. On −10 dBV its input clips about 10 dB early.',
            end: true,
          },
          { finding: 'On +4 dBu', next: 2 },
        ],
      },
      {
        challenge: 'Middle meters',
        response: 'check',
        choose: [
          { finding: 'Middle meters red', action: 'It’s the mix. A quiet word with the DJ: TRIM down.', end: true },
          { finding: 'Not red', next: 3 },
        ],
      },
      { challenge: 'MASTER ATT', response: 'down a step', note: 'In UTILITY.' },
      { challenge: 'REC tape', response: 're-marked' },
      { challenge: 'Room volume', response: 'back up at the amps' },
    ],
    why: 'dbx says to turn the mixer’s output down when these light. MASTER ATT does that and leaves MASTER LEVEL fully up.',
    see: '#record-level',
  },
  {
    // Pioneer manual p.31: MY SETTINGS on a USB stick calls out the DJ's UTILITY settings; both attenuators are
    // UTILITY settings (p.32). Settings are stored 10 s after a change (p.35).
    id: 'my-settings',
    code: 'F7',
    where: 'booth',
    title: 'A DJ loaded MY SETTINGS from USB',
    condition: 'A DJ loaded their own settings from a USB stick, with MY SETTINGS.',
    objective: 'Get both ATTs back to the tape, without making the room jump.',
    steps: [
      {
        challenge: 'MASTER ATT and BOOTH ATT',
        response: 'check against the tape',
        note: 'In UTILITY.',
        choose: [
          { finding: 'Both as on the tape', end: true },
          { finding: 'Either changed', next: 2 },
        ],
      },
      {
        if: 'If a set is playing, leave it for the changeover, or the room would jump. Watch the Howler light till then.',
      },
      {
        challenge: 'The ATT that changed',
        response: 'set back to the tape',
        note: 'Then wait 10 seconds before anyone switches off, so it saves.',
      },
    ],
    why: 'MY SETTINGS brings back a DJ’s own UTILITY settings, and both ATTs are UTILITY settings.',
    see: '#record-level',
  },
  {
    // dbx manual p.10: amps last on, first off, about 10 seconds apart. Howler MK1 manual: about 30 hours on its
    // battery, and it saves the file before the battery runs flat. Pioneer manual p.30: switching off while the
    // USB indicator is lit or flashing can leave the stick unreadable.
    id: 'power-cut',
    code: 'F8',
    where: 'booth',
    title: 'The generator cut out',
    condition: 'The generator stops, and the rig loses power.',
    objective: 'Bring the rig back in the order dbx gives, and keep the recording.',
    steps: [
      { challenge: 'Both amps', response: 'off, now' },
      { challenge: 'Howler', response: 'left recording', note: 'It runs on its own battery and keeps its file.' },
      {
        challenge: 'Mixer and DriveRack',
        response: 'on, once the power is back',
        note: 'Check MASTER LEVEL on its REC mark, both ATTs against the tape, and the Howler still recording.',
      },
      { challenge: 'Amps', response: 'on last, about 10 seconds later' },
      { if: 'If MASTER REC was running, press it again for a new file. The one from before the cut may not open.' },
    ],
    why: 'dbx says the amps go on last and off first. Switched off, they can’t come back on before the gear that feeds them.',
  },

  // ---- In the recording, afterwards ----------------------------------------------------------------
  {
    // Howler doesn't publish its light's threshold, hence "most likely".
    id: 'crunch',
    code: 'F9',
    where: 'recording',
    title: 'The recording crunches, but the Howler light stayed green',
    condition: 'You hear crunch on a recording, and the Howler’s LEVEL light stayed green.',
    objective: 'Find where the crunch came in, so the next set is clean.',
    steps: [
      { challenge: 'Record level', response: 'leave it alone', note: 'The crunch came from the mix.' },
      {
        challenge: 'The recording',
        response: 'find where it crunches',
        choose: [
          {
            finding: 'On the blends',
            action:
              'Two tracks added up past the top. Remind that DJ: watch the middle meters, one bassline at a time.',
          },
          {
            finding: 'All through a track',
            action: 'A hot TRIM or an EQ boost. Remind them: first or second orange on the channel meters.',
          },
          {
            finding: 'The meters stayed out of the red',
            action: 'The track itself may be distorted. Listen to the original on headphones.',
          },
        ],
      },
    ],
    why: 'A green light means the Howler most likely had room, so the crunch arrived with the mix. Turning the recording down would only make it quieter.',
    see: '#two-ceilings',
  },
  {
    // QSC GX manual p.2: never defeat the grounding-type plug; p.10: plugging everything into the same supply
    // often helps with hum. Rane Note 110: an isolation transformer is the most reliable cure.
    id: 'hum',
    code: 'F10',
    where: 'recording',
    title: 'Hum or buzz on the recording',
    condition: 'You hear hum or buzz under the music on a recording.',
    objective: 'Get rid of the hum, with every earth still connected.',
    warning: 'Never lift an earth. The mains earth is what stops a faulty case giving someone a shock.',
    steps: [
      { challenge: 'Isolation transformer', response: 'on the Howler’s lead' },
      { if: 'If it’s still there, plug all the sound gear into one supply, one power strip if the load allows.' },
      { if: 'If it’s only on one side, or crackling, it’s a faulty lead or plug. Swap the Howler’s lead.' },
    ],
    why: 'Hum is usually an earth loop between bits of gear. The transformer breaks it in the audio lead, so every earth stays connected.',
  },
  {
    // Rane Note 110 and verify-gear-facts K12: a stereo jack-to-twin-RCA lead in one BOOTH socket records one
    // channel twice, one copy upside down, which cancels on a phone speaker. MASTER 2 is RCA, like the Howler.
    id: 'hollow',
    code: 'F11',
    where: 'recording',
    title: 'The recording sounds hollow or one-sided',
    condition: 'A recording sounds hollow, or one side is quiet or missing.',
    objective: 'Get both sides of the mix into the Howler, the right way up.',
    steps: [
      {
        challenge: 'The Howler’s lead, from MASTER 2',
        response: 'check',
        choose: [
          {
            finding: 'One side quiet or missing',
            action: 'A plug half out, or a broken lead. Push all four RCA plugs home, or swap the lead.',
          },
          {
            finding: 'Hollow, and thin or near-silent on a phone',
            action:
              'One side is upside down, from a jack splitter or an adapter. Use one plain RCA lead from MASTER 2.',
          },
        ],
      },
    ],
    why: 'MASTER 2 and the Howler are both RCA, so one plain stereo lead is all it takes.',
    see: '#signal',
  },
];

/** A drill by its id. */
export function drill(id: string): Fix {
  const found = FIXES.find((f) => f.id === id);
  if (!found) throw new Error(`No drill with the id "${id}"`);
  return found;
}
