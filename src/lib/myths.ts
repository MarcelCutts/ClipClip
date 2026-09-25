/**
 * Things DJs say about the red, with the part that's true and what actually happens.
 * The heading is always the correction, never the myth on its own, so a reader who only
 * skims the headings takes away the right idea.
 *
 * Where a myth leans on what a manufacturer says, `actually` quotes it word for word with the
 * page, and `source` points at the document (it's in sources.ts too).
 */

const XDJ_MANUAL = {
  title: 'XDJ-RX2 Operating Instructions',
  url: 'https://downloads.support.alphatheta.com/manuals/all-in-one-dj-systems/XDJ-RX2/XDJ-RX2_DRI1479A_manual.pdf',
} as const;

export interface Myth {
  id: string;
  /** The correction, used as the heading. */
  truth: string;
  /** What people say. */
  claim: string;
  /** The part of the claim that's right. Admitting it keeps the rest credible. */
  fair: string;
  /** What actually happens. */
  actually: string;
  /** What to do instead. */
  instead: string;
  /** The manufacturer's document behind `actually`, with the page quoted there. */
  source?: { title: string; url: string; page?: number };
}

export const MYTHS: Myth[] = [
  {
    id: 'room',
    truth: 'Crunch the room covers up is still in the recording.',
    claim: 'It sounded fine in the room, so it’s fine.',
    fair: 'On the night a lot gets covered up: the speakers add their own grit, the room is loud, and nobody is listening closely.',
    actually:
      'By midnight your ears are tired too, so the booth is the worst place to judge. The recording gets played on headphones in a quiet room, again and again, with nothing covering it.',
    instead: 'Trust the meters over your ears late in the night.',
  },
  {
    id: 'headroom',
    truth: 'You can’t see how much room is left above the red.',
    claim: 'Pioneer red isn’t really red. There’s loads of headroom up there.',
    fair: 'Some mixers do have a margin above the first red light.',
    // Pioneer manual p.31: "Make sure that the red indicator does not lights up, or the sound may be distorted."
    // p.27: CLIP "Blinking fast: indicates that the sound is distorted." Neither page gives a margin.
    actually:
      'Pioneer publishes no margin for the XDJ-RX2. Its manual says to keep the red light dark, “or the sound may be distorted” (page 31). When CLIP blinks fast, it “indicates that the sound is distorted” (page 27). A blend or an EQ boost can use up any margin in one bar, and the recorder has its own limit on top.',
    instead: 'Keep the loudest parts on the first or second orange light, with red dark.',
    source: { ...XDJ_MANUAL, page: 31 },
  },
  {
    id: 'louder',
    truth: 'A louder room comes from the amps, and a clean kick hits harder than a clipped one.',
    claim: 'Louder is more energy. It doesn’t smack unless it’s loud.',
    fair: 'Louder does sound better when you compare the same thing at two volumes.',
    actually:
      'Past the mixer’s ceiling the peaks get flattened, and a kick needs its peak to hit. The loudness you want comes from the amps, not from the mixer’s red lights.',
    instead: 'Keep it clean and ask the crew to turn the amps up.',
  },
  {
    id: 'limiter',
    truth: 'The DriveRack’s limiter protects the speakers, and the recording doesn’t pass through it.',
    claim: 'The limiter will catch it.',
    fair: 'There is a limiter, in the DriveRack between the mixer and the amps.',
    // The DriveRack's wizard only sets its limiters for an amp on its list; our QSC GX7s are (dbx manual p.43,
    // PA2 tuning list). The limiters sit on its outputs, on the PA's branch; the Howler is on MASTER 2.
    // Pioneer's UTILITY settings (manual p.32) have MASTER and BOOTH attenuators and no limiter, and no
    // firmware up to 1.43 adds one.
    actually:
      'Once it’s set up for our amps, it holds the speakers back when you push too hard, so the room stops getting louder. It can’t undo clipping that arrives from the mixer, and the recorder doesn’t go through it. Pioneer lists no limiter on the XDJ-RX2 either: its settings have attenuators, not a limiter (page 32). So nothing protects the recording but your meters.',
    instead:
      'If pushing harder stops making the room louder, that’s the limiter. Ease back to orange and ask the crew.',
    source: { ...XDJ_MANUAL, page: 32 },
  },
  {
    id: 'post',
    truth: 'A quiet file can be turned up afterwards, but no tool can put back the tops clipping cut off.',
    claim: 'I’ll fix it afterwards.',
    fair: 'A recording that’s too quiet takes a minute to fix: turn the whole file up.',
    actually:
      'A clipped recording has lost the tops of its waves. Repair tools redraw them with a guess, which works for a few clicks and fails on a whole set. You can’t record Saturday night again.',
    instead: 'Keep the mixer clean and turn the file up afterwards.',
  },
  {
    id: 'videos',
    truth: 'Big stages have an engineer you can’t see.',
    claim: 'The big names play in the red.',
    fair: 'You’ll see red lights in some festival videos.',
    actually:
      'At festivals and big clubs there’s an engineer and a rack of processing between the DJ and the speakers, often cleaning up after them. Our recording has none of that. And many big names stay out of the red.',
    instead: 'Play to this rig, which has no engineer after the mixer.',
  },
  {
    id: 'quiet-file',
    truth: 'Recordings get their loudness afterwards.',
    claim: 'My recordings sound quieter than sets online, so I should play hotter.',
    fair: 'A clean recording does sound quieter than a finished upload before anyone turns it up.',
    actually:
      'Published mixes are turned up after the set. SoundCloud and others turn loud uploads down anyway, so a clipped mix ends up no louder than a clean one, and sounds worse.',
    instead: 'Record clean, then turn the file up.',
  },
  {
    id: 'digital',
    truth: 'Digital gear has a ceiling too.',
    claim: 'It’s digital, so it can’t clip.',
    fair: 'Some digital mixers can carry levels above their meters inside.',
    actually:
      'Somewhere the sound leaves the mixer as a real electrical signal with a real top: the output, the lead, the recorder’s input. There’s always a ceiling.',
    instead: 'Keep red dark on every mixer.',
  },
];
