/**
 * Plain meanings for every technical word on the site, each 15 words or fewer. Shown on tap
 * wherever a term appears, and listed in full in the guide's reference (/#glossary).
 *
 * Written for the one wiring: MASTER LEVEL feeds the speakers and the Howler, BOOTH the booth monitors.
 */
export const GLOSSARY = {
  clipping: {
    term: 'Clipping',
    gloss: 'The signal is too big for the next stage, so its peaks get cut flat.',
  },
  crunch: {
    term: 'Crunch',
    gloss: 'Harsh, crackly sound added when a signal is pushed too far. Clipping makes it.',
  },
  headroom: {
    term: 'Headroom',
    gloss: 'The empty space between your loudest peaks and the point where clipping starts.',
  },
  level: {
    term: 'Level',
    gloss: 'The signal’s size at one point. The room’s volume is set at the amps.',
  },
  meter: {
    term: 'Meter',
    gloss: 'The column of lights showing how big the signal is.',
  },
  channelMeter: {
    term: 'Channel meter',
    gloss: 'The meter on each channel, showing that deck before its fader (Pioneer: channel level indicator).',
  },
  middleMeter: {
    term: 'Middle meters',
    gloss: 'The pair between the channels. They show the mix, blends included (Pioneer: master level indicator).',
  },
  peak: {
    term: 'Peak',
    gloss: 'The loudest instant, such as a kick hitting.',
  },
  trim: {
    term: 'TRIM',
    gloss: 'Top knob on each channel (GAIN on some mixers). Sets how loud tracks come in.',
  },
  eq: {
    term: 'EQ',
    gloss: 'HI, MID and LOW knobs. Turning one up adds level too, up to 6 dB.',
  },
  blend: {
    term: 'Blend',
    gloss: 'Two tracks playing together during a mix.',
  },
  bassSwap: {
    term: 'Bass swap',
    gloss: 'Turning one track’s LOW down as the other comes in, so only one bassline plays.',
  },
  masterLevel: {
    term: 'MASTER LEVEL',
    gloss: 'Sets the speakers and the recording together. Taped fully up and marked REC.',
  },
  booth: {
    term: 'BOOTH',
    gloss: 'Short for BOOTH MONITOR, the DJ’s own knob for the booth monitors.',
  },
  monitor: {
    term: 'Monitor',
    gloss: 'A speaker in the booth, pointed at the DJ. BOOTH MONITOR sets it.',
  },
  pa: {
    term: 'PA',
    gloss: 'The main speakers for the crowd.',
  },
  db: {
    term: 'dB',
    gloss: 'Decibels, a way to compare levels. +6 dB is about double the signal size.',
  },
  dbfs: {
    term: 'dBFS',
    gloss: 'Level below a recording’s digital ceiling. 0 is the top; everything else is minus.',
  },
  howler: {
    term: 'Howler',
    gloss: 'The small box that records every set to a memory card.',
  },
  driveRack: {
    term: 'DriveRack PA2',
    gloss: 'Sits between the mixer and the amps. Tunes the speakers, and can protect them.',
  },
  amps: {
    term: 'Amps',
    gloss: 'The two QSC GX7 power amplifiers. Their gain knobs set the room’s volume.',
  },
  limiter: {
    term: 'Limiter',
    gloss: 'An automatic brake on peaks. Ours, in the DriveRack, guards the speakers only.',
  },
  normalise: {
    term: 'Normalise',
    gloss: 'Turn the whole file up afterwards until its loudest peak nearly touches the top.',
  },
  bitDepth: {
    term: '24-bit',
    gloss: 'How finely the recorder stores sound. Enough room to record quietly.',
  },
  noiseFloor: {
    term: 'Noise floor',
    gloss: 'The faint hiss every piece of gear makes, far below the music.',
  },
  att: {
    term: 'ATT',
    gloss: 'Turns an output down, in UTILITY. MASTER ATT may lower the recording too (test T2).',
  },
  balanced: {
    term: 'Balanced lead',
    gloss: 'XLR or TRS lead that cancels hum when both ends are balanced. RCA is unbalanced.',
  },
  ceiling: {
    term: 'Ceiling',
    gloss: 'A point where the sound can clip, inside the mixer or at the recorder’s input.',
  },
} as const satisfies Record<string, { term: string; gloss: string }>;

export type GlossaryKey = keyof typeof GLOSSARY;
