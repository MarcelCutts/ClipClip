/**
 * Plain meanings for the technical words on the site, each 15 words or fewer, in alphabetical
 * order. Shown on tap wherever a term appears, and listed in full under Words
 * (/learn/#glossary). Everyday words and DJ words every DJ knows aren't here.
 *
 * Written for the one wiring: MASTER LEVEL feeds the speakers and the Howler, BOOTH the booth monitors.
 */
export const GLOSSARY = {
  bitDepth: {
    term: '24-bit',
    gloss: 'How finely the Howler stores each sample. Enough range to record quietly.',
  },
  amps: {
    term: 'Amps',
    gloss: 'The two QSC GX7 power amplifiers. Their gain knobs set the room’s volume.',
  },
  att: {
    term: 'ATT',
    gloss: 'An attenuator in UTILITY. MASTER ATT and BOOTH ATT each turn an output down.',
  },
  balanced: {
    term: 'Balanced lead',
    gloss: 'XLR or TRS lead that cancels hum when both ends are balanced. RCA is unbalanced.',
  },
  booth: {
    term: 'BOOTH',
    gloss: 'The output sockets for the booth monitors. BOOTH MONITOR is the DJ’s knob for them.',
  },
  ceiling: {
    term: 'Ceiling',
    gloss: 'A point where the sound can clip: in the mixer, or at the Howler’s input.',
  },
  channelMeter: {
    term: 'Channel meter',
    gloss: 'The meter on each channel, showing that deck’s level (Pioneer: channel level indicator).',
  },
  clipping: {
    term: 'Clipping',
    gloss: 'The signal is too big for the next stage. Its peaks are cut flat.',
  },
  crunch: {
    term: 'Crunch',
    gloss: 'The harsh sound of distortion. Clipping puts it in the recording.',
  },
  db: {
    term: 'dB',
    gloss: 'Decibels, a way to compare levels. 6 dB more is about double the signal size.',
  },
  dbfs: {
    term: 'dBFS',
    gloss: 'Level compared with a recording’s digital ceiling. In the Howler’s files, 0 is the top.',
  },
  dbu: {
    term: 'dBu',
    gloss: 'A decibel scale for voltage. The DriveRack’s input switch reads +4 dBu or −10 dBV.',
  },
  driveRack: {
    term: 'DriveRack PA2',
    gloss: 'Sits between the mixer and the amps. Tunes the speakers, and can protect them.',
  },
  eq: {
    term: 'EQ',
    gloss: 'HI, MID and LOW knobs. Turning one up adds level too, up to 6 dB.',
  },
  headroom: {
    term: 'Headroom',
    gloss: 'The space between your loudest peaks and the point where clipping starts.',
  },
  howler: {
    term: 'Howler',
    gloss: 'The small box that records every set to a microSD card.',
  },
  limiter: {
    term: 'Limiter',
    gloss: 'A fast, automatic volume control that holds peaks down. Ours protects only the speakers.',
  },
  masterLevel: {
    term: 'MASTER LEVEL',
    gloss: 'Sets the speakers and the recording together. It stays as soundcheck left it.',
  },
  masterMeters: {
    term: 'MASTER meters',
    gloss: 'The pair in the middle, printed MASTER. They show the mix (Pioneer: master level indicator).',
  },
  normalise: {
    term: 'Normalise',
    gloss: 'Turn the whole file up afterwards until its loudest peak nearly touches the top.',
  },
  recordingLevel: {
    term: 'Recording level',
    gloss: 'How loud the mix goes into the Howler, which has no input knob.',
  },
  trim: {
    term: 'TRIM',
    gloss: 'Each channel’s gain knob, at the top. It sets how loud a track comes in.',
  },
} as const satisfies Record<string, { term: string; gloss: string }>;

export type GlossaryKey = keyof typeof GLOSSARY;
