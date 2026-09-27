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
        note: 'The BOOTH terminals (p. 10), the CLIP light and the printed scales (p. 27), HEADPHONES LEVEL (p. 28), setting TRIM and MASTER LEVEL (p. 31), the UTILITY attenuators and MY SETTINGS (pp. 31–32), the fix for distorted sound (p. 34), settings that are not stored (p. 35).',
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
        note: 'The input switch, input CLIP and TH lights, the crossover’s high-pass, where the limiters sit and when they are set, setting the amps’ gains and limiters with the speakers disconnected (pp. 19–21), amps on last and off first.',
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
        note: 'The front-panel gain knobs and CLIP lights, the FULL RANGE switch, current draw, earthing, and the GX7’s 725 W into 8 Ω (p. 11).',
      },
      {
        title: 'Club Series V owner’s manual',
        publisher: 'Yamaha',
        url: 'https://usa.yamaha.com/files/download/other_assets/5/335145/s112v_en_om_e0.pdf',
        note: 'The top speakers’ power capacity, 250 W noise and 500 W programme into 8 Ω (p. 6), and matching an amp to it (p. 3).',
      },
      {
        title: 'EKX passive loudspeakers user manual',
        publisher: 'Electro-Voice',
        url: 'https://products.electrovoice.com/binary/EKX_Passive_F01U318953_en.pdf',
        note: 'The EKX-18S subs: 400 W continuous into 8 Ω, and a recommended high-pass at 30 Hz (p. 23).',
      },
      {
        title: 'Sound System Interconnection (RaneNote 110)',
        publisher: 'Rane',
        url: 'https://www.ranecommercial.com/legacy/note110.html',
        note: 'Wiring a balanced output into an unbalanced input.',
      },
      {
        title: 'Electrical safety at places of entertainment (GS50)',
        publisher: 'HSE',
        url: 'https://www.hse.gov.uk/pubns/gs50.pdf',
        note: 'A generator earthed by a competent person, sockets with 30 mA RCDs, enough power for the load.',
      },
      {
        title: 'Electrical safety for entertainers (INDG247)',
        publisher: 'HSE',
        url: 'https://www.hse.gov.uk/pubns/indg247.pdf',
        note: 'Cables, reels and distribution for temporary power.',
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
        title: 'Global standard for safe listening venues and events',
        publisher: 'World Health Organization, 2022',
        url: 'https://www.who.int/publications/i/item/9789240043114',
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
      {
        title:
          'Noise induced hearing loss in dance music disc jockeys and an examination of sound levels in nightclubs',
        publisher: 'Bray et al., Journal of Laryngology and Otology, 2004',
        url: 'https://pubmed.ncbi.nlm.nih.gov/14979949/',
      },
    ],
  },
];
