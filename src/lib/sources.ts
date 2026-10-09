/**
 * Where the facts on this site come from: the makers' documents, then what backs the claims about
 * sound and hearing. Primary sources first in each group. The guide lists them, folded, under Sources.
 */

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
        note: 'The BOOTH terminals (p. 10), MASTER LEVEL, the CLIP light and the printed scales (p. 27), HEADPHONES LEVEL (p. 28), setting TRIM and MASTER LEVEL (p. 31), the UTILITY attenuators and MY SETTINGS (pp. 31–32), the fix for distorted sound (p. 34), settings that are not stored (p. 35).',
      },
      {
        title: 'XDJ-RX2 Quick Start Guide and specifications',
        publisher: 'Pioneer DJ',
        url: 'https://downloads.support.alphatheta.com/manuals/all-in-one-dj-systems/XDJ-RX2/XDJ-RX2_DRH1447A_quickstart_manual.pdf',
        note: 'Setting TRIM and MASTER LEVEL (p. 15), the fix for distorted sound (p. 17), output levels and noise figures (p. 20).',
      },
      {
        title: 'XDJ-RX2 FAQ: setting TRIM and MASTER LEVEL',
        publisher: 'AlphaTheta (Pioneer DJ) Help Center',
        url: 'https://support.alphatheta.com/en-US/articles/4408624717465',
        note: 'Start TRIM at 12 o’clock; MASTER LEVEL rarely needs changing after it is set.',
      },
      {
        title: 'XDJ-RX2 FAQ: BOOTH output wiring',
        publisher: 'AlphaTheta (Pioneer DJ) Help Center',
        url: 'https://support.alphatheta.com/en-US/articles/4408442652825',
        note: 'Tip hot, ring cold, sleeve ground.',
      },
      {
        title: 'DJM-750MK2 FAQ: the level indicators, and output without distortion',
        publisher: 'AlphaTheta (Pioneer DJ) Help Center',
        url: 'https://support.alphatheta.com/en-US/articles/4408734012953',
        note: 'For comparison: another Pioneer mixer’s room above its meter, 21 dB.',
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
        note: 'Fixed recording level, 24-bit/48 kHz WAV, normalising afterwards, and the firmware 1.2 update for MK1s made before October 2023.',
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
        note: 'The input switch, the input CLIP and TH lights, where the limiters sit, the STORE light, and amps on last and off first.',
      },
      {
        title: 'GX3, GX5 and GX7 user manual',
        publisher: 'QSC',
        url: 'https://www.qscaudio.com/resource-files/productresources/amp/gx/q_amp_gx_usermanual.pdf',
        note: 'The front-panel gain knobs and CLIP lights, the speaker sockets and how a plug locks (p. 7), the CROSSOVER switch and its FULL RANGE position, and current draw (p. 11).',
      },
      {
        title: 'Club Series V owner’s manual',
        publisher: 'Yamaha',
        url: 'https://usa.yamaha.com/files/download/other_assets/5/335145/s112v_en_om_e0.pdf',
        note: 'The top speakers: a stand’s legs fully opened (p. 2).',
      },
      {
        title: 'Sound System Interconnection (RaneNote 110)',
        publisher: 'Rane',
        url: 'https://www.ranecommercial.com/legacy/note110.html',
        note: 'Wiring a balanced output into an unbalanced input.',
      },
      {
        title: 'Multi-Cart R12RT instruction sheet',
        publisher: 'RocknRoller (Ace Products Group)',
        url: 'https://cdn.shopify.com/s/files/1/0153/4715/files/RnR_insert_R12RT_1710.pdf',
        note: 'The trolley: its two frame lengths, the wingbolts that hold them, raising the sides, and the caster brakes. The R12 Stealth is the same cart in black.',
      },
      {
        title: 'Achat 104 A user manual',
        publisher: 'the box pro (Thomann)',
        url: 'https://images.thomann.de/pics/atg/atgdata/document/manual/325264_c_325264_v2_r1_en_online.pdf',
        note: 'The booth monitors: powered, with an XLR INPUT above a parallel OUTPUT.',
      },
      {
        title: 'Announcing Howler recorder+streamer MK2: Record and livestream at the same time',
        publisher: 'Howler Audio',
        url: 'https://howler-audio.com/blogs/news/announcing-howler-recorder-streamer-mk2-a-new-iteration-built-on-your-feedback',
        note: 'That the MK1’s file dates are not set correctly, so split files go in order by name.',
      },
      {
        title: 'Audacity manual: Amplify and the View menu',
        publisher: 'Audacity',
        url: 'https://manual.audacityteam.org/man/amplify.html',
        note: 'Reading a file’s peak, and Show Clipping, which is off until you turn it on.',
      },
      {
        title: 'XDJ-RX3 Instruction Manual',
        publisher: 'AlphaTheta (Pioneer DJ)',
        url: 'https://downloads.support.alphatheta.com/manuals/all-in-one-dj-systems/XDJ-RX3/XDJ-RX3_DRI1702C_manual.pdf',
        note: 'The model that followed the XDJ-RX2. Its channel meters read before the channel fader (p. 86). Pioneer does not say so for the XDJ-RX2.',
      },
      {
        title: 'XDJ-RX2 mixer layout',
        publisher: 'VirtualDJ',
        url: 'https://virtualdj.com/manuals/hardware/pioneer/xdjrx2/layout/mixer.html',
        note: 'That the channel meters show each channel before its fader. Pioneer does not say.',
      },
      {
        title: 'XDJ-RX2 recording levels',
        publisher: 'Pioneer DJ Community',
        url: 'https://community.pioneerdj.com/hc/en-us/community/posts/22976408344345-XDJ-RX2-Recording-levels',
        note: 'An official reply on how two tracks sum in a blend. The thread is about the unit’s own USB recorder, which this rig does not use.',
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
        note: 'The −1 dB true-peak ceiling in production, and why data-reduced files may need a lower one.',
      },
      {
        title: 'Adding coherent and incoherent sound levels',
        publisher: 'sengpielaudio',
        url: 'https://sengpielaudio.com/calculator-coherentsources.htm',
        note: 'Why lined-up kicks can add up to 6 dB.',
      },
      {
        title: 'RX 11 De-clip',
        publisher: 'iZotope',
        url: 'https://docs.izotope.com/rx11/en/de-clip.html',
        note: 'What repair tools can and cannot do.',
      },
      {
        title: 'A survey and an extensive evaluation of popular audio declipping methods',
        publisher: 'Záviška, Rajmic, Ozerov and Rencker, IEEE Journal of Selected Topics in Signal Processing, 2021',
        url: 'https://arxiv.org/abs/2007.07663',
        note: 'How far repair tools restore clipped audio, measured, and where they fall short.',
      },
      {
        title: '32-bit float files explained',
        publisher: 'Sound Devices',
        url: 'https://www.sounddevices.com/32-bit-float-files-explained/',
      },
      {
        title: 'The audibility of distortion at bass frequencies',
        publisher: 'Audioholics, 2015',
        url: 'https://www.audioholics.com/loudspeaker-design/audibility-of-distortion-at-bass',
        note: 'Why loud bass hides distortion, and how much speakers add.',
      },
      {
        title: 'Will SoundCloud play my track at the level it’s mastered?',
        publisher: 'SoundCloud Help',
        url: 'https://help.soundcloud.com/hc/en-us/articles/360053660014-Will-SoundCloud-play-my-track-at-the-level-it-s-mastered',
        note: 'Loudness normalisation as tracks play, and the true-peak limits it asks of masters: −1 dB, or −2 dB for loud ones.',
      },
      {
        title: 'A club designer sounds off',
        publisher: 'DJ Times, 2020',
        url: 'https://www.djtimes.com/2020/03/dj-sound-redlining-booth-levels/',
        note: 'Monitoring, ear fatigue and why DJs push levels.',
      },
    ],
  },
];
