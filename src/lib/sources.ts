/** Where the facts on this site come from. Primary sources first in each group. */

export interface Source {
  title: string;
  publisher: string;
  url: string;
  /** What we used it for. */
  note?: string;
}

export interface SourceGroup {
  title: string;
  sources: Source[];
}

export const SOURCES: SourceGroup[] = [
  {
    title: 'The gear',
    sources: [
      {
        title: 'XDJ-RX2 Operating Instructions',
        publisher: 'Pioneer DJ',
        url: 'https://downloads.support.alphatheta.com/manuals/all-in-one-dj-systems/XDJ-RX2/XDJ-RX2_DRI1479A_manual.pdf',
        note: 'Setting TRIM and MASTER LEVEL (p. 31), the CLIP light (p. 27), UTILITY attenuators and MY SETTINGS (pp. 31–32), MASTER REC, switching off mid-write.',
      },
      {
        title: 'XDJ-RX2 Quick Start Guide and specifications',
        publisher: 'Pioneer DJ',
        url: 'https://downloads.support.alphatheta.com/manuals/all-in-one-dj-systems/XDJ-RX2/XDJ-RX2_DRH1447A_quickstart_manual.pdf',
        note: 'Setting TRIM and MASTER LEVEL, the fix for distorted sound, output levels, noise figures.',
      },
      {
        title: 'XDJ-RX2 FAQ: recording with MASTER REC',
        publisher: 'AlphaTheta (Pioneer DJ) Help Center',
        url: 'https://support.alphatheta.com/en-US/articles/4408616633881',
        note: 'Records before MASTER LEVEL; files split every three hours.',
      },
      {
        title: 'XDJ-RX2 FAQ: setting TRIM and MASTER LEVEL',
        publisher: 'AlphaTheta (Pioneer DJ) Help Center',
        url: 'https://support.alphatheta.com/en-US/articles/4408624717465',
        note: 'Start TRIM at 12 o’clock; MASTER LEVEL rarely needs changing once set.',
      },
      {
        title: 'XDJ-RX2 FAQ: BOOTH output wiring',
        publisher: 'AlphaTheta (Pioneer DJ) Help Center',
        url: 'https://support.alphatheta.com/en-US/articles/4408442652825',
        note: 'Tip hot, ring cold, sleeve ground.',
      },
      {
        title: 'Recorder+Streamer MK1 manual',
        publisher: 'Howler Audio',
        url: 'https://howler-audio.com/pages/manual-mk1',
        note: 'Inputs, the LEVEL light, file lengths, the battery.',
      },
      {
        title: 'FAQ',
        publisher: 'Howler Audio',
        url: 'https://howler-audio.com/pages/faq',
        note: 'Fixed recording level, 24-bit/48 kHz WAV, normalising afterwards.',
      },
      {
        title: 'How to record DJ sets without clipping',
        publisher: 'Howler Audio',
        url: 'https://howler-audio.com/blogs/tutorials/how-to-record-dj-sets-without-clipping',
      },
      {
        title: 'DriveRack PA2 Owner’s Manual',
        publisher: 'dbx',
        url: 'https://dbxpro.com/en-US/product_documents/driverack_pa2_manual_5044138-apdf',
        note: 'The input switch, input CLIP and TH lights, where the limiters sit and when they are set, amps on last and off first.',
      },
      {
        title: 'DriveRack PA2 speaker and amplifier tunings',
        publisher: 'dbx',
        url: 'https://dbxpro.com/en/product_documents/pa2_tuning_listpdf',
        note: 'Lists the Yamaha S/C115V and the QSC GX7; no EV EKX subs.',
      },
      {
        title: 'GX3, GX5 and GX7 user manual',
        publisher: 'QSC',
        url: 'https://www.qscaudio.com/resource-files/productresources/amp/gx/q_amp_gx_usermanual.pdf',
        note: 'The front-panel gain knobs and CLIP lights, the FULL RANGE switch, current draw, earthing.',
      },
      {
        title: 'Sound System Interconnection (RaneNote 110)',
        publisher: 'Rane',
        url: 'https://www.ranecommercial.com/legacy/note110.html',
        note: 'Wiring a balanced output into an unbalanced input.',
      },
      {
        title: 'XDJ-RX2 mixer layout',
        publisher: 'VirtualDJ',
        url: 'https://virtualdj.com/manuals/hardware/pioneer/xdjrx2/layout/mixer.html',
        note: 'Side meters show each channel before its fader.',
      },
      {
        title: 'XDJ-RX2 recording levels',
        publisher: 'Pioneer DJ Community',
        url: 'https://community.pioneerdj.com/hc/en-us/community/posts/22976408344345-XDJ-RX2-Recording-levels',
        note: 'Recordings jumping during blends; an official comment on channel levels and EQ.',
      },
    ],
  },
  {
    title: 'Sound and hearing',
    sources: [
      {
        title: 'ISO 226:2023, equal-loudness contours',
        publisher: 'ISO',
        url: 'https://www.iso.org/standard/83117.html',
        note: 'How much quieter bass sounds at low volume.',
      },
      {
        title: 'ITU-R BS.1770-5, loudness measurement',
        publisher: 'ITU',
        url: 'https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en',
        note: 'How the demos match clean and clipped versions for loudness.',
      },
      {
        title: 'EBU R 128',
        publisher: 'EBU',
        url: 'https://tech.ebu.ch/docs/r/r128.pdf',
        note: 'The −1 dB true-peak ceiling for finished files.',
      },
      {
        title: 'Adding coherent and incoherent sound levels',
        publisher: 'sengpielaudio',
        url: 'https://sengpielaudio.com/calculator-coherentsources.htm',
        note: 'Why lined-up kicks add 6 dB and unrelated sounds about 3 dB.',
      },
      {
        title: 'Aliasing reduction in clipped signals',
        publisher: 'Esqueda, Bilbao and Välimäki, IEEE Transactions on Signal Processing, 2016',
        url: 'https://www.pure.ed.ac.uk/ws/files/26997332/07499828.pdf',
      },
      {
        title: 'RX 11 De-clip',
        publisher: 'iZotope',
        url: 'https://docs.izotope.com/rx11/en/de-clip.html',
        note: 'What repair tools can and can’t do.',
      },
      {
        title: '32-bit float files explained',
        publisher: 'Sound Devices',
        url: 'https://www.sounddevices.com/32-bit-float-files-explained/',
      },
      {
        title: 'F3 Operation Manual',
        publisher: 'Zoom',
        url: 'https://zoomcorp.com/manuals/f3-en/',
        note: 'How a two-converter float recorder works, and its input limits.',
      },
      {
        title: 'What are reference levels in digital audio systems?',
        publisher: 'Sound on Sound, 2007',
        url: 'https://www.soundonsound.com/sound-advice/q-what-are-reference-levels-digital-audio-systems',
      },
      {
        title: 'The audibility of distortion at bass frequencies',
        publisher: 'Audioholics, 2015',
        url: 'https://www.audioholics.com/loudspeaker-design/audibility-of-distortion-at-bass',
        note: 'Why loud bass hides distortion, and how much speakers add.',
      },
      {
        title: 'Global standard for safe listening venues and events',
        publisher: 'World Health Organization, 2022',
        url: 'https://www.who.int/publications/i/item/9789240043114',
      },
      {
        title: 'Will SoundCloud play my track at the level it’s mastered?',
        publisher: 'SoundCloud Help',
        url: 'https://help.soundcloud.com/hc/en-us/articles/360053660014-Will-SoundCloud-play-my-track-at-the-level-it-s-mastered',
      },
    ],
  },
  {
    title: 'DJs, crews and teaching',
    sources: [
      {
        title: 'Gain structure for DJs',
        publisher: 'Serato',
        url: 'https://support.serato.com/hc/en-us/articles/202538480-Gain-Structure-for-DJs',
      },
      {
        title: 'Setting Rane mixer level controls (RaneNote 171)',
        publisher: 'Rane',
        url: 'https://www.ranecommercial.com/legacy/pdf/ranenotes/Setting_Rane_Mixer_Level_Controls.pdf',
      },
      {
        title: 'Gain staging for DJs and staying out of the red',
        publisher: 'DJ TechTools, 2015',
        url: 'https://djtechtools.com/2015/10/11/gain-staging-for-djs-staying-out-of-the-red/',
      },
      {
        title: 'A club designer sounds off',
        publisher: 'DJ Times, 2020',
        url: 'https://www.djtimes.com/2020/03/dj-sound-redlining-booth-levels/',
        note: 'Monitoring, ear fatigue and why DJs push levels.',
      },
      {
        title: 'Noise induced hearing loss in dance music disc jockeys',
        publisher: 'Bray et al., Journal of Laryngology and Otology, 2004',
        url: 'https://pubmed.ncbi.nlm.nih.gov/14979949/',
      },
      {
        title: 'Classroom demonstrations: learning tools or entertainment?',
        publisher: 'Crouch, Fagen, Callan and Mazur, 2004',
        url: 'https://www.otffeo.on.ca/wp-content/uploads/sites/2/2014/11/Mazur_demo-article.pdf',
        note: 'Why the lab asks you to predict first.',
      },
      {
        title: 'Nine ways to reduce cognitive load in multimedia learning',
        publisher: 'Mayer and Moreno, 2003',
        url: 'https://www.uky.edu/~gmswan3/544/9_ways_to_reduce_CL.pdf',
      },
      {
        title: 'Human factors of flight-deck checklists',
        publisher: 'Degani and Wiener, NASA, 1990',
        url: 'https://ntrs.nasa.gov/api/citations/19910017830/downloads/19910017830.pdf',
        note: 'How the crew checklists are written.',
      },
      {
        title: 'Let’s learn about waveforms',
        publisher: 'Josh W. Comeau, The Pudding, 2018',
        url: 'https://pudding.cool/2018/02/waveforms/',
      },
      {
        title: 'Sound',
        publisher: 'Bartosz Ciechanowski, 2022',
        url: 'https://ciechanow.ski/sound/',
      },
    ],
  },
];
