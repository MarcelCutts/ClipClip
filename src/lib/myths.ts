/**
 * What DJs say about the red, each with what's true and the one thing to do about it. The heading
 * is always the correction, never the belief on its own, so a reader who only skims the headings
 * takes away the right idea.
 *
 * Where an answer leans on what a maker says, it quotes or reports it with the page, and `source`
 * points at the document (it's in sources.ts too).
 */

/** SoundCloud's help page on loudness: it "applies Loudness Normalization to your tracks as they're played". */
const SOUNDCLOUD_LOUDNESS = {
  publisher: 'SoundCloud Help',
  title: 'Will SoundCloud play my track at the level it’s mastered?',
  url: 'https://help.soundcloud.com/hc/en-us/articles/360053660014-Will-SoundCloud-play-my-track-at-the-level-it-s-mastered',
} as const;

const XDJ_MANUAL = {
  title: 'XDJ-RX2 Operating Instructions',
  url: 'https://downloads.support.alphatheta.com/manuals/all-in-one-dj-systems/XDJ-RX2/XDJ-RX2_DRI1479A_manual.pdf',
} as const;

export interface Myth {
  id: string;
  /** What people say, in their words. */
  claim: string;
  /** What's true, as one statement: the row's heading. */
  truth: string;
  /** Why, in a sentence or two, with the maker's page where one backs it. */
  answer: string;
  /** The one thing to do about this belief: the row's last sentence. */
  action: string;
  /**
   * The maker's document behind `answer`, with the page quoted there. A publisher is named first
   * when the title doesn't say whose it is.
   */
  source?: { title: string; url: string; page?: number; publisher?: string };
}

export const MYTHS: Myth[] = [
  {
    id: 'headroom',
    claim: 'A flash of red is fine. There is loads of headroom up there.',
    truth: 'Even a flash of red may be crunch.',
    // Pioneer manual p.31: "Make sure that the red indicator does not lights up, or the sound may be distorted."
    // No page gives a margin above red, or a time in the red that's safe.
    answer:
      'Pioneer publishes no headroom figure for the XDJ-RX2. Its manual says to keep the red light dark, “or the sound may be distorted” (p. 31).',
    action: 'At the first flash on a channel meter, turn its TRIM down a little.',
    source: { ...XDJ_MANUAL, page: 31 },
  },
  {
    id: 'louder',
    claim: 'Louder is more energy. It has to be loud to hit.',
    truth: 'A louder room comes from the amps.',
    answer: 'At the same peak level, clipping does sound louder. It also flattens the peaks that make a kick hit.',
    action: 'Ask the crew to turn up the amps.',
  },
  {
    id: 'limiter',
    claim: 'The limiter will catch it. Red just means it is working.',
    truth: 'The DriveRack’s limiter protects only the speakers.',
    // The DriveRack's wizard only sets its limiters for an amp on its list; our QSC GX7s are (dbx manual p.43,
    // PA2 tuning list). The limiters sit on its outputs, on the PA's branch; the Howler is on MASTER 2.
    // Pioneer's UTILITY settings (manual p.32) have MASTER and BOOTH attenuators and no limiter, and no
    // firmware up to 1.43 adds one. Pioneer never says there is none, so neither do we.
    answer:
      'It stops the speakers getting louder when the mix is too loud. The Howler records from MASTER 2, which does not go through the DriveRack. Pioneer lists no limiter in the XDJ-RX2 (p. 32).',
    action: 'If pushing harder stops making the room louder, turn the mix back down to orange.',
    source: { ...XDJ_MANUAL, page: 32 },
  },
  {
    id: 'videos',
    claim: 'The big names play in the red.',
    truth: 'Big stages have an engineer after the mixer.',
    answer:
      'At festivals and big clubs, an engineer and a rack of processing sit between the DJ and the speakers. Our rig has neither between the mixer and the Howler.',
    action: 'Set your levels by the meters in front of you.',
  },
  {
    id: 'quiet-file',
    claim: 'My recordings sound quieter than sets online. I should play louder.',
    truth: 'Recordings get their loudness afterwards.',
    // SoundCloud Help (updated September 2026): "SoundCloud applies Loudness Normalization to your
    // tracks as they're played to listeners", aiming at −14 LUFS. Other services aren't on the
    // sources list, so they aren't named.
    answer:
      'Published mixes are turned up after the set. SoundCloud turns loud tracks down as it plays them. A clipped mix ends up no louder than a clean one that was turned up, and it sounds worse.',
    action: 'Before a mix goes online, normalise the clean file.',
    source: SOUNDCLOUD_LOUDNESS,
  },
  {
    id: 'digital',
    claim: 'It is digital, so it cannot clip.',
    truth: 'Digital gear has a ceiling too.',
    // Sound Devices on 32-bit float: the file's range is too high to overload, but it records what it's sent.
    answer:
      'The sound leaves the mixer as an electrical signal. The mixer’s output and the Howler’s input each have a ceiling. A 32-bit float file has no ceiling you can reach, but it keeps flat tops that came from the mixer.',
    action: 'Treat red as the top on digital gear too.',
  },
];
