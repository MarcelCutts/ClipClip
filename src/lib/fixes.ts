/**
 * "Something's wrong": what the crew do when a light goes red or a recording sounds wrong, set as the
 * drills of a quick reference handbook. The booth's drills are on /night/ and the next day's on
 * /recordings/ (`where`). Each drill is linkable as #fix-<id>, and each step as #fix-<id>-step-<n>.
 *
 * A drill has:
 * - a title: the light as printed, where a light prompts it ("Howler LEVEL light: red"), or else the
 *   symptom in sentence case;
 * - a condition, only where it adds to the title, and an objective;
 * - numbered steps. A booth drill splits them into "Now" and a later block for what waits, usually
 *   "At the changeover", so nothing that moves the room's volume happens mid-set unless the recording
 *   is clipping. A drill for the recording, done the next day, has one block;
 * - "Why", in one or two sentences, which never has to be read to do the drill.
 *
 * A step is one instruction, with its condition first: a control and the state to leave it in, joined
 * by leader dots ("CLIP light …… dark"); an instruction ("Find where it crunches in the set.");
 * the exact words to say to the DJ; or a line that starts "If". A consequence someone must know before a
 * step is a plain sentence before it. "Choose one" lists what you can see at that step, and each finding
 * ends the drill (■ ■ ■ ■) or goes to a step or another drill. Values, never "down a step".
 *
 * Signal words: "Warning." is only for injury, and no drill has one: the site's one warning is about
 * hearing, on Playing. The site uses no CAUTION: in ANSI Z535 and ISO 3864 it means minor injury, in
 * Boeing's QRH and ASD-STE100 damage to equipment, and ANSI's word for property damage is NOTICE. A
 * consequence that is not an injury is a plain sentence instead.
 *
 * The rig, one way only: MASTER 1 (XLR) → DriveRack PA2 → two QSC GX7 amps → PA; MASTER 2 (RCA) → Howler;
 * BOOTH → booth monitors. MASTER LEVEL sets MASTER 1 and MASTER 2 (Pioneer manual p.27). The crew set it
 * by the MASTER meters at soundcheck (C1; Pioneer p.31) and it stays there, so the MASTER meters, which
 * read after it, show the mix. The room's volume comes from the amps' gain knobs, and an amp's CLIP
 * light is its limit (QSC p.5). The gear carries no tape and no marks, and nobody can listen to a
 * recording at the event (the owner, 28 September 2026), so a drill goes by the lights and never sends
 * anyone to a mark or a test recording. Both attenuators are UTILITY settings (p.32). Pioneer does not
 * say which sockets MASTER ATT reaches, and no drill changes it: the recording comes down at MASTER
 * LEVEL, and the room comes back up at the amps.
 *
 * A drill that opens on a light closes on it: after its last change, a step looks at that light again,
 * and goes back to the start if it is still lit. The tests walk every path to make sure.
 *
 * Facts come from the documents in sources.ts, with page numbers in the comments:
 * - Pioneer, XDJ-RX2 Operating Instructions (DRI1479A) and Quick Start Guide (DRH1447A);
 * - QSC, GX3, GX5 and GX7 user manual;
 * - dbx, DriveRack PA2 Owner's Manual (printed page numbers);
 * - Howler, Recorder+Streamer MK1 manual and FAQ; Rane Note 110.
 * Hum, earthing and the supply's protection are not this guide's subject (the owner).
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes and quotes are curly.
 */

import { CHANNEL_METERS_WORDS, FADER_DOWN, MASTER_METERS_WORDS, RECORDING_DOWN } from './checklists';

/** A light drawn lit beside a drill's title, in its real colour: the one you're looking at. */
export type DrillLight = 'howler-red' | 'meters-red' | 'clip' | 'driverack-clip';

/** Where to go next: a step number in the same drill, another drill by its id, or a step of another drill. */
export type Next = number | string | { drill: string; step: number };

/** One of the things you can see after a step, under "Choose one". */
export interface Branch {
  /** What you see, set in bold before a colon: "Below red". */
  finding: string;
  /** What to do about it, in plain sentences. */
  action?: string;
  /** The exact words to say, as a quote after `to`. */
  say?: string;
  /** Who hears `say`, and when: "Say to the DJ:" unless it says otherwise. */
  to?: string;
  /** Go to this step, or to another drill. */
  next?: Next;
  /** The drill ends here. Every finding either ends or goes somewhere. */
  end?: true;
}

interface StepBase {
  /** What someone must know before the step, said in a plain sentence before it. */
  before?: string;
  /** Information about the step, read after it: never an instruction. */
  note?: string;
  /** "Choose one": the things you can see after the step. */
  choose?: readonly Branch[];
}

/** A control and the state to leave it in, joined by leader dots. */
export interface LineStep extends StepBase {
  /** The control or the thing to look at, named as printed on the gear: "MASTER LEVEL". */
  challenge: string;
  /** The state it should end in, or its value: "blinking green", "−6 dB". Set in the action colour. */
  response: string;
}

/** One instruction as a sentence, for a step with no state to leave: "Find where it crunches in the set." */
export interface DoStep extends StepBase {
  do: string;
}

/** The exact words to say to the DJ. */
export interface SayStep extends StepBase {
  say: string;
  /** Who hears it, and when: "Say to the DJ:" unless it says otherwise. */
  to?: string;
}

/** A step that only applies sometimes: "If the DJ wants it louder, go to F4." */
export interface IfStep {
  before?: string;
  /** The condition, without its comma: "If the DJ wants it louder". */
  if: string;
  /** What to do, carrying on the sentence: "plug all the sound gear into one supply." */
  action?: string;
  /** Words to say after `action`, as a quote. */
  say?: string;
  next?: Next;
  end?: true;
}

export type Step = LineStep | DoStep | SayStep | IfStep;

/** The steps that wait: at the changeover, or until the power is back. */
export interface Later {
  /** Its heading: "At the changeover". */
  when: string;
  steps: readonly Step[];
}

export interface Fix {
  /** Stable and link-safe: the drill's anchor is fix-<id>. Change it and links from the chat break. */
  id: string;
  /** The drill's number, on the right of its title strip: F1, F2… Numbers are never reused. */
  code: string;
  /** Where it's used: in the booth on the night, or on the recordings the next day. */
  where: 'booth' | 'recording';
  /**
   * The drill's title. When a light prompts it, the light as printed, then its state: "Howler LEVEL
   * light: red". Otherwise the symptom, in sentence case: "The room is not loud enough".
   */
  title: string;
  /**
   * The index rail's name for it, on one line after its code: about 17 characters of B612. A light as
   * its title has it, "Howler LEVEL: red"; otherwise the symptom in a few words, "Room too quiet".
   */
  short: string;
  /** The light you're looking at, drawn lit beside the title. */
  light?: DrillLight;
  /** What you see, only where it adds to the title. */
  condition?: string;
  /** What the drill achieves, as one plain sentence. */
  objective: string;
  /** The steps, numbered from 1. A booth drill heads them "Now". */
  steps: readonly Step[];
  /** The steps that wait, numbered on from the first block. */
  later?: Later;
  /** Why the drill works, in one or two sentences. */
  why: string;
  /** Where the guide explains it: a section's anchor, like '#trim'. */
  see?: string;
  /** A place inside that section to land on instead of its heading, like '#myth-limiter'. */
  seeAt?: string;
}

export const isIfStep = (step: Step): step is IfStep => 'if' in step;
export const isSayStep = (step: Step): step is SayStep => 'say' in step && !isIfStep(step);
export const isDoStep = (step: Step): step is DoStep => 'do' in step;
export const isLineStep = (step: Step): step is LineStep => 'challenge' in step;

/** Every step of a drill, in order: the first block, then the one that waits. */
export const allSteps = (fix: Fix): readonly Step[] => [...fix.steps, ...(fix.later?.steps ?? [])];

/** The anchor of a drill, or of one of its steps (numbered from 1). */
export const drillAnchor = (id: string, step?: number): string =>
  step === undefined ? `fix-${id}` : `fix-${id}-step-${step}`;

/** Where a drill is: with the crew's lists for the booth's, with the files for the next day's. */
export const drillPath = (id: string, step?: number): string =>
  `${drill(id).where === 'recording' ? '/recordings/' : '/night/'}#${drillAnchor(id, step)}`;

/** Who hears the words, unless a step says otherwise. */
export const SAY_TO = 'Say to the DJ:';

/**
 * Said to the DJ before MASTER LEVEL turns the recording down, so a DJ who hears the room drop doesn't
 * push TRIM to get it back. MASTER LEVEL sets MASTER 1 as well (Pioneer p.27), so the room goes quieter
 * until the amps make it up.
 */
const ROOM_WILL_DROP = 'The room will go quieter until the amps are turned up. Keep your levels as they are.';

/** At the first red CLIP light, or with the knobs fully up, the amps have no more to give. */
const RIG_LIMIT = 'That is the room’s limit.';

/**
 * Said to the DJ after MASTER LEVEL comes down: the MASTER meters read after it (Pioneer p.31), so they
 * now read low, and the channel meters are the rule to go by.
 */
const METERS_READ_LOW = `The MASTER meters now read low. ${CHANNEL_METERS_WORDS}`;

export const FIXES: Fix[] = [
  // ---- In the booth, on the night ----------------------------------------------------------------
  {
    // Howler doesn't publish where its light turns red (MK1 manual: blinking red means the volume is too high,
    // so turn the source down). Its BATTERY indicator is "red when charging", which is not this drill. Pioneer's
    // first fix for distortion is MASTER LEVEL (manual p.34), and it sets MASTER 1 and MASTER 2 together (p.27):
    // the recording comes down at the mixer, and the room comes back up at the amps, which come after the
    // Howler's lead. The owner has never seen the Howler's light red with the MASTER meters below red (28
    // September 2026), so the drill leaves MASTER ATT alone: Pioneer doesn't say which sockets it reaches, and it
    // sits in a menu. The MASTER meters read after MASTER LEVEL (p.31). Mid-set, because a clipped recording
    // cannot be put right later.
    id: 'howler-red',
    code: 'F1',
    where: 'booth',
    title: 'Howler LEVEL light: red',
    short: 'Howler LEVEL: red',
    light: 'howler-red',
    condition: 'The LEVEL light blinks red. A steady red BATTERY light means the Howler is charging.',
    objective: 'Find where the sound clips, and stop it there.',
    steps: [
      {
        challenge: 'MASTER meters',
        response: 'below red',
        choose: [
          { finding: 'Red', say: FADER_DOWN, next: 5 },
          { finding: 'Below red', next: 2 },
        ],
      },
      { say: ROOM_WILL_DROP },
      { before: RECORDING_DOWN.consequence, challenge: RECORDING_DOWN.challenge, response: RECORDING_DOWN.response },
      { say: METERS_READ_LOW },
      {
        challenge: 'Howler LEVEL light',
        response: 'blinking green at the next loud part',
        choose: [
          {
            finding: 'Blinking green',
            action: 'If step 3 made the room quieter, turn the amps back up, with their CLIP lights dark.',
            end: true,
          },
          { finding: 'Red', next: 1 },
        ],
      },
    ],
    why: 'If the MASTER meters are below red, a red LEVEL light means the recording level is too high. The Howler’s lead leaves the mixer before the amps, and turning the amps up makes the room louder without changing the recording.',
    see: '#two-ceilings',
  },
  {
    // Pioneer manual p.31: make sure the red indicator doesn't light, "or the sound may be distorted".
    id: 'channels-red',
    code: 'F2',
    where: 'booth',
    title: 'Channel meters: red',
    short: 'Channels: red',
    light: 'meters-red',
    objective: 'Stop the channel clipping.',
    steps: [
      { say: 'Your channel meter is in the red. Turn TRIM down a little.' },
      {
        challenge: 'Channel meter',
        response: 'red dark at the loudest part',
        choose: [
          { finding: 'Red dark', next: 3 },
          { finding: 'Red', next: 1 },
        ],
      },
      { if: 'If the DJ wants it louder', next: 'not-loud' },
    ],
    why: 'Pioneer says that when a channel meter lights red, “the sound may be distorted” (p. 31).',
    see: '#trim',
  },
  {
    // Pioneer manual p.27: CLIP blinks when the output level is too high. Blinking slowly: the sound is about to
    // be distorted. Blinking fast: the sound is distorted. The words between tracks are the DJ box's MASTER line.
    id: 'clip',
    code: 'F3',
    where: 'booth',
    title: 'CLIP light above the MASTER meters: blinking',
    short: 'CLIP: blinking',
    light: 'clip',
    objective: 'Stop the mix clipping.',
    steps: [
      { say: FADER_DOWN },
      {
        challenge: 'CLIP light',
        response: 'dark',
        choose: [
          { finding: 'Dark', next: 3 },
          { finding: 'Blinking', next: 1 },
        ],
      },
      {
        if: 'If it blinks on every blend',
        action: 'say to the DJ between tracks:',
        // On every blend, the channels are hot: two on the first orange stay under the top orange.
        say: `${MASTER_METERS_WORDS} ${CHANNEL_METERS_WORDS}`,
      },
    ],
    why: 'Pioneer: CLIP blinks slowly when the sound is about to be distorted, and fast when it is distorted (p. 27). MASTER LEVEL stays as soundcheck left it, and only the DJ’s faders and TRIMs bring the mix down.',
    see: '#meters',
  },
  {
    // QSC GX manual: gain controls CH1 and CH2 on the front, marked in dB of attenuation (p.5), with 21 detents
    // (p.11). Red CLIP LEDs flash when the amp is overdriven, and heavy overdrive makes it turn itself down (p.5).
    // dbx sets the limiters "based on where you have set your amplifier attenuators" (p.44), and raising them past
    // that point "will cause the amplifiers to clip" (p.22). The knobs carry no marks, so the limit is what the
    // amps show: the loop ends in step 1, with the knobs fully up, or in step 3, at the first red CLIP light.
    // The rack's front, with the knobs and lights, faces the crowd (the owner).
    id: 'not-loud',
    code: 'F4',
    where: 'booth',
    title: 'The room is not loud enough',
    short: 'Room too quiet',
    objective: 'Make the room louder at the amps, with the mixer as it is.',
    steps: [
      {
        challenge: 'Amp gain knobs',
        response: 'below fully up',
        note: 'Each GX7 has two, CH1 and CH2, on the side of the rack that faces the crowd.',
        choose: [
          { finding: 'Fully up', say: RIG_LIMIT, end: true },
          { finding: 'Below', next: 2 },
        ],
      },
      { challenge: 'Amp gain knobs', response: 'one click up, all four' },
      {
        challenge: 'Both amps’ CLIP lights',
        response: 'dark, after a few bars',
        choose: [
          { finding: 'A red CLIP light', action: 'Turn all four back one click.', say: RIG_LIMIT, end: true },
          { finding: 'Dark', next: 4 },
        ],
      },
      { to: 'Ask the DJ:', say: 'Is that loud enough?' },
      { if: 'If the DJ still wants it louder', next: 1 },
    ],
    why: 'The amps feed only the speakers. Turning them up never reaches the recording.',
    see: '#knobs',
  },
  {
    // dbx manual: the TH lights turn red when a limiter is limiting (p.5); the PeakPlus output limiters protect
    // the amps and speakers (p.43). QSC GX manual p.5 and p.10: an overdriven GX turns itself down.
    id: 'no-louder',
    code: 'F5',
    where: 'booth',
    title: 'The DJ pushes harder, but the room gets no louder',
    short: 'Pushed, no louder',
    objective: 'Find which part of the rig is at its limit.',
    steps: [
      { say: CHANNEL_METERS_WORDS },
      {
        do: 'Look at the lights on the DriveRack and the amps.',
        choose: [
          { finding: 'TH lights red on the DriveRack', end: true },
          { finding: 'Input CLIP lights on the DriveRack', next: 'driverack-clip' },
          { finding: 'A red CLIP light on an amp', action: 'Turn all four amp gain knobs back one click.', end: true },
          { finding: 'None of these', next: 'not-loud' },
        ],
      },
    ],
    why: 'The DriveRack’s TH lights turn red when its limiters are working (dbx p. 5). More level from the mixer then adds only crunch.',
    see: '#myths',
    seeAt: '#myth-limiter',
  },
  {
    // dbx manual p.5: the input CLIP LEDs light when the inputs are overdriven, and "you will need to reduce the
    // output" of the mixer; they "remain lit for a short period of time" after a peak, hence the minute. On
    // −10 dBV a +4 dBu source lights them early (0 dBFS at about +9.9 dBu, not +19.9 dBu): set the switch to
    // +4 dBu, muting the outputs first. p.7: the switch is recessed, "+4dBu option (switch out)", "-10dBV option
    // (switch in)", reached with "an object with a pointy tip, such as a pen". p.5: each output MUTE button's state
    // "will be retained after a power cycle". Once on +4 dBu the same input sits about 10 dB lower inside the
    // DriveRack, so the room may need the amps turned up (F4). Pioneer gives MASTER 1 a standard output level of
    // +6 dBu and a rated output of +24 dBu (Quick Start Guide p.20). It doesn't say what level the red light
    // stands for, so we assume that on +4 dBu (clipping at +19.9 dBu) the input clips only once the mix is past red.
    id: 'driverack-clip',
    code: 'F6',
    where: 'booth',
    title: 'DriveRack input CLIP lights: lit',
    short: 'DriveRack CLIP',
    light: 'driverack-clip',
    objective: 'Stop the DriveRack’s input clipping.',
    steps: [
      { say: FADER_DOWN },
      {
        challenge: 'DriveRack input CLIP lights',
        response: 'dark, a minute later',
        note: 'They stay lit for a moment after each peak (dbx p. 5).',
        choose: [
          { finding: 'Dark', next: 3 },
          { finding: 'Lit', next: 1 },
        ],
      },
      {
        challenge: 'DriveRack input switch, on the back',
        response: '+4 dBu',
        note: 'Out is +4 dBu. Pushed in is −10 dBV.',
        choose: [
          { finding: '+4 dBu', end: true },
          { finding: '−10 dBV', next: 4 },
        ],
      },
    ],
    later: {
      when: 'At the changeover',
      steps: [
        {
          before: 'The room goes silent until step 6.',
          challenge: 'DriveRack outputs',
          response: 'every MUTE button on, any lit ones noted',
        },
        {
          challenge: 'DriveRack input switch',
          response: '+4 dBu, out',
          note: 'It sits deep in the panel: a pen tip reaches it.',
        },
        {
          challenge: 'DriveRack MUTE buttons',
          response: 'off, except any noted in step 4',
          note: 'A MUTE button left on stays on, even after the power goes off and on.',
        },
        { if: 'If the room is now too quiet', next: 'not-loud' },
      ],
    },
    why: 'On −10 dBV the DriveRack’s input clips about 10 dB early (dbx p. 5). dbx says to turn the mixer’s output down when these lights come on.',
    see: '#signal',
  },
  {
    // Pioneer manual p.31: "[UTILITY] settings and other settings stored on a USB device can be called out" with
    // MY SETTINGS; both attenuators are UTILITY settings (p.32). Pioneer doesn't list what a stick carries, so it
    // may change them, and doesn't say which sockets MASTER ATT reaches. With no record of either setting to
    // go back to, the drill looks for what a change does: a red LEVEL light, a quieter room, a quieter booth.
    id: 'my-settings',
    code: 'F7',
    where: 'booth',
    title: 'A DJ loaded MY SETTINGS from USB',
    short: 'MY SETTINGS',
    objective: 'Find any change in level at the mixer’s outputs.',
    steps: [
      {
        challenge: 'Howler LEVEL light',
        response: 'blinking green at the next loud part',
        choose: [
          { finding: 'Blinking green', next: 2 },
          { finding: 'Red', next: 'howler-red' },
        ],
      },
      { if: 'If the booth monitors are now quieter', action: 'turn up BOOTH MONITOR.' },
      { if: 'If the room is now quieter', next: 'not-loud' },
    ],
    why: 'Pioneer says MY SETTINGS can call out UTILITY settings, and MASTER ATT and BOOTH ATT are UTILITY settings (pp. 31–32). A change to MASTER ATT may change the room’s volume too: Pioneer does not say which sockets it reaches.',
    see: '#red-top',
  },
  {
    // dbx manual p.10: amps last on, and "ensure you're not passing audio to the mixer's outputs … before applying
    // power to the amplifiers"; amps first off, then "wait about 10 seconds". On a generator a trip can be an
    // overload: two GX7s can draw about 26 A in full-power bursts (QSC p.11). Howler MK1 manual: about 30 hours
    // on its battery, and it saves the file before the battery runs flat. The XDJ-RX2 has no battery, and a cut
    // is no switch-off at its own switch (Pioneer p.35), so a UTILITY change may be lost: the last step looks at
    // the Howler's light again.
    id: 'power-cut',
    code: 'F8',
    where: 'booth',
    title: 'Power cut',
    short: 'Power cut',
    objective: 'Bring the rig back in the order dbx gives, with the Howler still recording.',
    steps: [
      { challenge: 'Both amps', response: 'switched off' },
      { challenge: 'Howler', response: 'still recording, RECORD blinking', note: 'It runs on its own battery.' },
      { if: 'If a breaker tripped', action: 'put each amp on a socket of its own before you reset it.' },
    ],
    later: {
      when: 'When the power is back',
      steps: [
        { challenge: 'XDJ-RX2', response: 'switched on' },
        { challenge: 'DriveRack', response: 'screen lit' },
        { challenge: 'Both amps', response: 'switched on last, with no track playing' },
        {
          challenge: 'Howler LEVEL light',
          response: 'blinking green at the next loud part',
          choose: [
            { finding: 'Blinking green', end: true },
            { finding: 'Red', next: 'howler-red' },
          ],
        },
      ],
    },
    why: 'dbx says to switch the amps on last, with no audio playing, and off first (p. 10). The Howler MK1 records for about 30 hours on its battery, and saves its file before the battery runs flat.',
  },

  // ---- On the recordings, the next day ------------------------------------------------------------
  {
    // Two ceilings, as the guide's 4.4 has them: Howler publishes no input limit, so we assume the Howler clips at
    // the top of its file; a mixer that clips arrives turned down by the recording level, so its flat
    // tops sit lower (the guide's 3.2, and the clip checker's rule). The Howler clipping can hide the mixer clipping
    // under it. After the XDJ's and the Howler's converters a clipped top ripples and leans (Esqueda, Bilbao and
    // Välimäki, 2016). Many commercial tracks are clipped in mastering (Vickers, 2010), so crunch all through one
    // track may have come in with the track.
    id: 'crunch',
    code: 'F9',
    where: 'recording',
    title: 'Crunch in a recording',
    short: 'Crunch in the file',
    objective: 'Find where the crunch came in, and who can stop it.',
    steps: [
      {
        challenge: 'File',
        response: 'the copy kept as the Howler wrote it',
        note: 'Turning a file up moves the top of the file, and any flat tops with it.',
      },
      {
        do: 'Zoom in on a loud part that crunches.',
        note: 'In the file, flat tops can ripple or lean a little.',
        choose: [
          {
            finding: 'Flat tops at the top of the file',
            action:
              'The Howler most likely clipped, and the mixer may have clipped too. Tell the crew before the next event. C1 checks the Howler’s light on a loud blend, and F1 turns the recording down.',
            end: true,
          },
          { finding: 'Flat tops lower down', next: 3 },
          {
            finding: 'No flat tops',
            action: 'Listen to the track on its own. It may be distorted itself, or an effect may have been on.',
            end: true,
          },
        ],
      },
      {
        do: 'Find where it crunches in the set.',
        choose: [
          { finding: 'On the blends', to: 'Tell that DJ:', say: MASTER_METERS_WORDS, end: true },
          { finding: 'All through one track', next: 4 },
        ],
      },
      {
        do: 'Zoom in on the same part of the track’s own file.',
        choose: [
          { finding: 'The same flat tops', action: 'The crunch came in with the track.', end: true },
          { finding: 'No flat tops', to: 'Tell that DJ:', say: CHANNEL_METERS_WORDS, end: true },
        ],
      },
    ],
    why: 'We assume the Howler clips at the top of its file: Howler publishes no input limit. Clipping from the mixer arrives turned down with the rest of the mix, and its flat tops sit lower.',
    see: '#two-ceilings',
  },
  // F10, hum or buzz on the recording, was retired on 28 September 2026. Nobody can hear a recording at
  // the event, and earthing is not this guide's subject (the owner). Its number is not reused.
  {
    // Pioneer Quick Start Guide p.20: MASTER 2 is RCA, "for an unbalanced input (such as RCA)", and an unbalanced
    // output can't reverse a side. Recording one side twice, one copy reversed, needs a balanced output wired into a
    // stereo input: a jack-to-RCA lead in a BOOTH socket, or an XLR-to-RCA adapter on MASTER 1 (Pioneer warns of
    // noise there, p.20). On a phone speaker the two copies cancel. Rane Note 110: an unbalanced lead stays under
    // 3 m. It is found by listening, the day after, so it sits with the recordings. Its steps are done at the rig.
    id: 'hollow',
    code: 'F11',
    where: 'recording',
    title: 'The recording sounds hollow or one-sided',
    short: 'Hollow sound',
    condition: 'Do the steps at the rig, before its next use.',
    objective: 'Get both sides of the mix into the Howler unchanged.',
    steps: [
      {
        challenge: 'The Howler’s lead, from MASTER 2',
        response: 'one stereo RCA lead, under 3 m',
        note: 'Nothing else goes in the lead.',
        choose: [
          { finding: 'A plug half out', action: 'Push all four plugs fully in.', next: 2 },
          {
            finding: 'A splitter or an adapter',
            action: 'Take it out, and use one RCA lead from MASTER 2.',
            next: 2,
          },
          { finding: 'Neither', action: 'Swap the lead.', next: 2 },
        ],
      },
      {
        challenge: 'Next recording, the day after',
        response: 'both sides clear on headphones',
        note: 'If a side is still missing or the sound is hollow, ask the rig owner to investigate before use.',
      },
    ],
    why: 'An adapter on BOOTH or MASTER 1 can record one side twice, one copy reversed, which sounds hollow. On MASTER 2, a loose or broken RCA lead loses a side.',
    see: '#signal',
  },
];

/** A drill by its id. */
export function drill(id: string): Fix {
  const found = FIXES.find((f) => f.id === id);
  if (!found) throw new Error(`No drill with the id "${id}"`);
  return found;
}
