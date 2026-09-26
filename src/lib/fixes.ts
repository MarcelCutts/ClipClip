/**
 * "Something's wrong": what the crew do when a light goes red or a recording sounds wrong, set as the
 * drills of a quick reference handbook on /night/. Each drill is linkable as /night/#fix-<id>, and
 * each step as /night/#fix-<id>-step-<n>.
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
 * by leader dots ("MASTER ATT …… as on the REC tape"); an instruction ("Look at MASTER ATT in UTILITY.");
 * the exact words to say to the DJ; or a line that starts "If". A consequence someone must know before a
 * step is a plain sentence before it. "Choose one" lists what you can see at that step, and each finding
 * ends the drill (■ ■ ■ ■) or goes to a step or another drill. Values, never "down a step".
 *
 * Signal words: "Warning." is only for injury, the mains earth in F10. The site uses no CAUTION: in ANSI
 * Z535 and ISO 3864 it means minor injury, in Boeing's QRH and ASD-STE100 damage to equipment, and ANSI's
 * word for property damage is NOTICE. A consequence that is not an injury is a plain sentence instead.
 *
 * The rig, one way only: MASTER 1 (XLR) → DriveRack PA2 → two QSC GX7 amps → PA; MASTER 2 (RCA) → Howler;
 * BOOTH → booth monitors. MASTER LEVEL sets MASTER 1 and MASTER 2 (Pioneer manual p.27) and is taped fully
 * up on the REC mark, so the MASTER meters, which read after it (p.31), show the mix itself. The room's
 * volume comes from the amps' gain knobs, never above the RIG marks that S4 finds. Both attenuators are
 * UTILITY settings (p.32), written on the REC tape at setup (S1, S3). Pioneer does not say which sockets
 * MASTER ATT reaches: T2 finds out on the kit, and the drills never count on it turning the room down.
 *
 * Facts come from the documents in sources.ts, with page numbers in the comments:
 * - Pioneer, XDJ-RX2 Operating Instructions (DRI1479A) and Quick Start Guide (DRH1447A);
 * - QSC, GX3, GX5 and GX7 user manual;
 * - dbx, DriveRack PA2 Owner's Manual (printed page numbers);
 * - Howler, Recorder+Streamer MK1 manual and FAQ; Rane Note 110;
 * - HSE, Electrical safety at places of entertainment (GS50) and Electrical safety for entertainers
 *   (INDG247), for the earth, the generator and RCDs.
 *
 * Typography: numbers and units are joined by a no-break space (U+00A0), minus signs are true minus
 * signs (−, U+2212), apostrophes and quotes are curly.
 */

import {
  ATT_NOTE,
  CHANNEL_METERS_WORDS,
  FADER_DOWN,
  LEVEL_FALLBACK,
  MASTER_METERS_WORDS,
  OPEN_UTILITY,
} from './checklists';

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
  /** The control or the thing to look at, named as printed on the gear: "MASTER ATT". */
  challenge: string;
  /** The state it should end in, or its value: "as on the REC tape", "−6 dB". Set in the action colour. */
  response: string;
}

/** One instruction as a sentence, for a step with no state to leave: "Look at MASTER ATT in UTILITY." */
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
  /** Said before the steps, when a step could hurt someone. */
  warning?: string;
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

/** Who hears the words, unless a step says otherwise. */
export const SAY_TO = 'Say to the DJ:';

/**
 * Said to the DJ before MASTER ATT or MASTER LEVEL turns the recording down, so a DJ who hears the room
 * drop doesn't push TRIM to get it back. MASTER LEVEL sets MASTER 1 as well (Pioneer p.27). Whether MASTER
 * ATT does is not published (T2 finds out), so the room "may" go quieter.
 */
const ROOM_MAY_DROP = 'The room may go quieter for a few seconds. Keep your levels as they are.';

/** At the RIG marks, the amps have no more to give: S4 found the highest click with both CLIP lights dark. */
const RIG_LIMIT = 'That is the room’s limit.';

/**
 * F1's first step that turns the recording down: the words to the DJ, then MASTER ATT. F6 sends the crew
 * there when the DriveRack clips on its +4 dBu setting.
 */
export const F1_TURN_DOWN = 2;

export const FIXES: Fix[] = [
  // ---- In the booth, on the night ----------------------------------------------------------------
  {
    // Howler doesn't publish where its light turns red (MK1 manual: blinking red means the volume is too high,
    // so turn the source down). Its BATTERY indicator is "red when charging", which is not this drill. Pioneer's
    // fixes for distortion are MASTER LEVEL, then the attenuator (manual p.34; UTILITY table p.32, settings 0,
    // −6 and −12 dB), but Pioneer doesn't say which sockets MASTER ATT reaches (setup test T2), so MASTER LEVEL
    // is the last resort, worded once in checklists.ts, and the room comes back up at the amps only if it went
    // quieter. A change in UTILITY is stored when the rotary selector is pressed (p.31). The MASTER meters read
    // after MASTER LEVEL (p.31). Mid-set, because a clipped recording cannot be put right later; the tape can
    // wait.
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
          { finding: 'Red', say: FADER_DOWN, end: true },
          { finding: 'Below red', next: 2 },
        ],
      },
      { say: ROOM_MAY_DROP },
      { if: 'If the REC tape says MASTER ATT does not reach the Howler (T2)', next: 5 },
      {
        do: 'Look at MASTER ATT in UTILITY.',
        note: OPEN_UTILITY,
        choose: [
          {
            finding: '0 dB',
            action: 'Set it to −6 dB. Press the rotary selector. The changed settings are stored.',
            next: 6,
          },
          {
            finding: '−6 dB',
            action: 'Set it to −12 dB. Press the rotary selector. The changed settings are stored.',
            next: 6,
          },
          { finding: '−12 dB', next: 5 },
        ],
      },
      { before: LEVEL_FALLBACK.consequence, challenge: LEVEL_FALLBACK.challenge, response: LEVEL_FALLBACK.response },
      {
        if: 'If the room went quieter',
        action: 'turn the four amp gain knobs back up, no higher than the RIG marks.',
      },
    ],
    later: { when: 'At the changeover', steps: [{ challenge: 'REC tape', response: 're-marked' }] },
    why: 'If the MASTER meters are below red, a red LEVEL light means the recording level is too high. Pioneer does not say which sockets MASTER ATT reaches: T2 finds out.',
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
        if: 'If it blinks on every blend',
        action: 'say to the DJ between tracks:',
        // On every blend, the channels are hot: two on the first orange stay under the top orange.
        say: `${MASTER_METERS_WORDS} ${CHANNEL_METERS_WORDS}`,
      },
    ],
    why: 'Pioneer: CLIP blinks slowly when the sound is about to be distorted, and fast when it is distorted (p. 27). With MASTER LEVEL fully up, only the DJ’s faders and TRIMs bring the mix down.',
    see: '#meters',
  },
  {
    // QSC GX manual: gain controls CH1 and CH2 on the front, marked in dB of attenuation (p.5), with 21 detents
    // (p.11). Red CLIP LEDs flash when the amp is overdriven, and heavy overdrive makes it turn itself down (p.5).
    // dbx sets the limiters "based on where you have set your amplifier attenuators" (p.44), and raising them past
    // that point "will cause the amplifiers to clip" (p.22). dbx doesn't say which GX7 gain the wizard assumes, so
    // S4 finds the RIG marks: the highest click with both CLIP lights dark on the loudest blend. The loop ends in
    // step 1: on the RIG marks, or at the first red CLIP light.
    id: 'not-loud',
    code: 'F4',
    where: 'booth',
    title: 'The room is not loud enough',
    short: 'Room too quiet',
    objective: 'Make the room louder at the amps, with the mixer as it is.',
    steps: [
      {
        challenge: 'Amp gain knobs',
        response: 'one click up, all four',
        note: 'Each GX7 has two, CH1 and CH2, on the front. The RIG marks are as high as they go.',
        choose: [
          { finding: 'Already on the RIG marks', say: RIG_LIMIT, end: true },
          {
            finding: 'A red CLIP light on either amp',
            action: 'Turn all four back one click.',
            say: RIG_LIMIT,
            end: true,
          },
          { finding: 'Neither', next: 2 },
        ],
      },
      { to: 'After a few bars, ask the DJ:', say: 'Is that loud enough?' },
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
    // dbx manual p.5: the input CLIP LEDs light when the inputs are overdriven; reduce the mixer's output. On
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
      {
        challenge: 'MASTER meters',
        response: 'below red',
        choose: [
          { finding: 'Red', say: FADER_DOWN, end: true },
          { finding: 'Below red', next: 2 },
        ],
      },
      {
        challenge: 'DriveRack input switch, on the back',
        response: '+4 dBu',
        note: 'Out is +4 dBu. Pushed in is −10 dBV.',
        choose: [
          { finding: '+4 dBu', next: { drill: 'howler-red', step: F1_TURN_DOWN } },
          { finding: '−10 dBV', next: 3 },
        ],
      },
    ],
    later: {
      when: 'At the changeover',
      steps: [
        {
          before: 'The room goes silent until step 5.',
          challenge: 'DriveRack outputs',
          response: 'every MUTE button on',
        },
        {
          challenge: 'DriveRack input switch',
          response: '+4 dBu, out',
          note: 'It sits deep in the panel: a pen tip reaches it.',
        },
        {
          challenge: 'DriveRack outputs',
          response: 'every MUTE button off',
          note: 'A MUTE button left on stays on, even after the power goes off and on.',
        },
        { if: 'If the room is now too quiet', next: 'not-loud' },
      ],
    },
    why: 'On −10 dBV the DriveRack’s input clips about 10 dB early (dbx p. 5). dbx says to turn the mixer’s output down when these lights come on.',
    see: '#two-ceilings',
  },
  {
    // Pioneer manual p.31: "[UTILITY] settings and other settings stored on a USB device can be called out" with
    // MY SETTINGS; both attenuators are UTILITY settings (p.32). Pioneer doesn't list what a stick carries, so it
    // may change them, and doesn't say which sockets MASTER ATT reaches (T2). A change is stored when the rotary
    // selector is pressed (p.31), and can be lost if the mixer goes off within 10 s of it (p.35); C3 switches the
    // mixer off at its own switch.
    id: 'my-settings',
    code: 'F7',
    where: 'booth',
    title: 'A DJ loaded MY SETTINGS from USB',
    short: 'MY SETTINGS',
    objective: 'Get MASTER ATT and BOOTH ATT back to the REC tape.',
    steps: [
      {
        challenge: 'Howler LEVEL light',
        response: 'blinking green',
        choose: [
          { finding: 'Blinking green', next: 2 },
          { finding: 'Red', next: 'howler-red' },
        ],
      },
    ],
    later: {
      when: 'At the changeover',
      steps: [{ challenge: 'MASTER ATT and BOOTH ATT', response: 'as on the REC tape', note: ATT_NOTE }],
    },
    why: 'Pioneer says MY SETTINGS can call out UTILITY settings, and both ATTs are UTILITY settings (pp. 31–32). A change to MASTER ATT may change the room’s volume too: Pioneer does not say which sockets it reaches.',
    see: '#two-ceilings',
  },
  {
    // dbx manual p.10: amps last on, and "ensure you're not passing audio to the mixer's outputs … before applying
    // power to the amplifiers"; amps first off, then "wait about 10 seconds". HSE GS50 §22: "If a 30 mA RCD trips,
    // it is an indication that there is a fault. Do not ignore it." INDG247 p.3: "Never bypass the RCD". On a
    // generator a trip can also be an overload: two GX7s can draw about 26 A in full-power bursts (QSC p.11). Howler
    // MK1 manual: about 30 hours on its battery, and it saves the file before the battery runs flat. The XDJ-RX2 has
    // no battery, and a cut is no switch-off at its own switch (Pioneer p.35), so step 6 checks both ATTs.
    id: 'power-cut',
    code: 'F8',
    where: 'booth',
    title: 'Power cut',
    short: 'Power cut',
    objective: 'Bring the rig back in the order dbx gives, with the Howler still recording.',
    steps: [
      { challenge: 'Both amps', response: 'switched off' },
      { challenge: 'Howler', response: 'still recording, RECORD blinking', note: 'It runs on its own battery.' },
      { if: 'If an RCD or breaker tripped', action: 'find the fault before you reset it.' },
    ],
    later: {
      when: 'When the power is back',
      steps: [
        { challenge: 'XDJ-RX2 and DriveRack', response: 'switched on' },
        { challenge: 'MASTER LEVEL', response: 'fully up, on the REC mark' },
        { challenge: 'MASTER ATT and BOOTH ATT', response: 'as on the REC tape', note: ATT_NOTE },
        { challenge: 'Both amps', response: 'switched on last, with no track playing' },
      ],
    },
    why: 'dbx says to switch the amps on last, with no audio playing, and off first (p. 10). The Howler MK1 records for about 30 hours on its battery, and saves its file before the battery runs flat.',
  },

  // ---- On the recordings, the next day ------------------------------------------------------------
  {
    // Two ceilings, as the guide's 4.4 has them: Howler publishes no input limit, so we assume the Howler clips at
    // the top of its file; a mixer that clips arrives turned down by MASTER ATT and the recording level, so its flat
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
        do: 'Zoom in on a loud part that crunches.',
        note: 'In the file, flat tops can ripple or lean a little.',
        choose: [
          {
            finding: 'Flat tops at the top of the file',
            action:
              'The Howler clipped, and the mixer may have clipped too. Set the recording level again with S3 before the next event.',
            end: true,
          },
          { finding: 'Flat tops lower down', next: 2 },
          {
            finding: 'No flat tops',
            action: 'Listen to the track on its own. It may be distorted itself.',
            end: true,
          },
        ],
      },
      {
        do: 'Find where it crunches in the set.',
        choose: [
          { finding: 'On the blends', to: 'Tell that DJ:', say: MASTER_METERS_WORDS, end: true },
          { finding: 'All through one track', next: 3 },
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
  {
    // HSE INDG247 p.4: "don't remove protective earth connections"; GS50 §54: for mains hum, "do not remove
    // protective earth connections"; GS50 §41: with Class I equipment the earth makes the fuse blow if a fault makes
    // the case live; GS50 §22: 30 mA RCDs. QSC GX manual p.2: never defeat the grounding-type plug; p.10: one supply
    // for everything often helps with hum. GS50 §47: keep the sound supply apart from the lighting. Rane Note 110:
    // transformer isolation is the cure for an unbalanced link. This is a line-level audio transformer, a
    // ground-loop isolator, never a mains isolating transformer (GS50 §39–40). The Howler's lead is one RCA lead
    // under 3 m, with nothing in it but this transformer, or the fixed attenuator T2 may call for (S2). dbx manual
    // p.7: the rear panel's PIN 1 LIFT switch "lifts the pin 1 chassis ground on both input XLR connectors", with the
    // amps off or the outputs muted.
    id: 'hum',
    code: 'F10',
    where: 'recording',
    title: 'Hum or buzz on the recording',
    short: 'Hum or buzz',
    objective: 'Stop the hum, with every earth still connected.',
    warning:
      'Never disconnect a mains earth. Do not use an earth-lift adapter, a two-core extension lead or a plug with its earth wire off. Do not tape over or cut an earth pin. If a fault makes a case live, the earth lets the fuse or RCD cut the power.',
    steps: [
      {
        challenge: 'Audio isolation transformer',
        response: 'on the Howler’s lead',
        note: 'It is a ground-loop isolator for RCA leads, never a mains isolating transformer. The lead stays under 3 m, with nothing else in it but the fixed attenuator from T2.',
      },
      { if: 'If it is only on one side or it crackles', action: 'swap the Howler’s lead.' },
      {
        if: 'If the hum is still there',
        action:
          'plug all the sound gear into one distribution board, away from the lighting. Each amp keeps its own socket.',
      },
      {
        if: 'If the PA hums too',
        action:
          'press in the DriveRack’s PIN 1 LIFT switch, with its outputs muted. It lifts only pin 1 of its XLR inputs, never the mains earth (dbx p. 7).',
      },
    ],
    why: 'Hum is usually an earth loop between pieces of gear. The transformer breaks it in the audio lead, and every earth stays connected.',
  },
  {
    // Pioneer Quick Start Guide p.20: MASTER 2 is RCA, "for an unbalanced input (such as RCA)", and an unbalanced
    // output can't reverse a side. Recording one side twice, one copy reversed, needs a balanced output wired into a
    // stereo input: a jack-to-RCA lead in a BOOTH socket, or an XLR-to-RCA adapter on MASTER 1 (Pioneer warns of
    // noise there, p.20). On a phone speaker the two copies cancel. Only the audio isolation transformer from F10, or
    // the fixed attenuator T2 may call for, goes in the lead (S2).
    id: 'hollow',
    code: 'F11',
    where: 'recording',
    title: 'The recording sounds hollow or one-sided',
    short: 'Hollow sound',
    objective: 'Get both sides of the mix into the Howler unchanged.',
    steps: [
      {
        challenge: 'The Howler’s lead, from MASTER 2',
        response: 'one stereo RCA lead, under 3 m',
        note: 'Nothing goes in it except an audio isolation transformer if F10 found hum, or the fixed attenuator from T2.',
        choose: [
          { finding: 'A plug half out', action: 'Push all four plugs fully in.', end: true },
          {
            finding: 'A splitter or an adapter',
            action:
              'Take it out, and use one RCA lead from MASTER 2. The audio isolation transformer and the fixed attenuator can stay.',
            end: true,
          },
          { finding: 'Neither', action: 'Swap the lead.', end: true },
        ],
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
