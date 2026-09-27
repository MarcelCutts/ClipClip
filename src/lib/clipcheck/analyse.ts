/**
 * How clipped a recording is, read from its samples. Clipping leaves two different marks:
 *
 * - **Runs at the file's peak.** A converter that runs out of numbers holds the same value for
 *   several samples in a row, at the highest (or lowest) value in the file. In the file as the
 *   recorder wrote it, that is full scale. A copy turned up or down keeps the runs, at its new peak.
 *   The analogue stages add noise, so clipping that happened before them never repeats a value.
 * - **Flat tops piled up at one level.** Something before the recorder clipped, such as the mixer
 *   past its red, and the tops were turned down on the way. The analogue stages in between tilt them
 *   and add noise, so this looks for tops that are straight lines rather than curves, then for many
 *   of them at the same level. A flat top and its neighbour of the other polarity are averaged,
 *   which cancels the drift the stages add.
 *
 * Tracks clipped in their own mastering have flat tops too, at whatever level the DJ played them,
 * and many tracks have a sound with flat tops of its own under louder drums. Samples alone cannot
 * say which stage clipped: the report says what the file shows, and what that can mean. Every
 * count covers the whole file, however long; only the examples kept are capped.
 */
import { TARGET } from '../model';

export interface ClipCheckOptions {
  /**
   * Identical samples in a row, at the file's peak, that count as clipping. Audacity's Find Clipping
   * also wants 3 in a row, but only at full scale, where a copy turned down has none.
   */
  runSamples?: number;
  /** Tops quieter than this aren't checked, in dBFS: below it, noise hides them. */
  gateDbfs?: number;
  /** The shortest flat top that counts, in seconds (0.25 ms is 12 samples at 48 kHz). */
  minFlatSeconds?: number;
  /** How closely a straight line must fit a top for it to count as flat, as a share of its level. */
  flatness?: number;
  /** Flat tops within this many dB of each other count as the same level. */
  sameLevelDb?: number;
  /**
   * The share of all flat tops that a pile below the file's loudest level must hold. Each track with
   * flat tops of its own adds a small pile at the level it was played.
   */
  pileShare?: number;
  /** Runs and flat tops kept as examples, of each kind. Every one is counted; only the examples are capped. */
  maxEvents?: number;
}

export const CLIPCHECK_DEFAULTS: Required<ClipCheckOptions> = {
  runSamples: 3,
  gateDbfs: -30,
  minFlatSeconds: 0.00025,
  flatness: 0.0005,
  sameLevelDb: 0.5,
  pileShare: 1 / 3,
  maxEvents: 200_000,
};

/** A top is the part of a half-wave within this many dB of its peak. */
const TOP_DB = 0.5;
/** The share of a top, from its middle, that the straight-line test uses (away from the edges). */
const MIDDLE = 0.4;
/** Half-waves longer than this, in seconds, are too slow to be sound and aren't checked. */
const LONGEST_HALF_WAVE = 0.1;
/** Seconds whose peak is below this, in dBFS, are silence or a gap between sets. */
export const MUSIC_DBFS = -45;
/**
 * A pile is many flat tops at one level: at least `count` of them, packed at least `clear` times as
 * densely, per dB, as those in the `gapDb` just below. One within `topDb` of the file's largest swing
 * (see SWING_SECONDS) is at the file's loudest level, where a ceiling in the rig shows. One further
 * down counts only flat tops within `topDb` of the largest swing in the `recentSeconds` before them,
 * where clipping a whole channel or mix puts them, and it must also hold `pileShare` of all the flat
 * tops: tracks with flat tops of their own leave small piles at many levels.
 */
const PILE = { count: 8, topDb: 1.5, clear: 3, gapDb: 2, recentSeconds: 2 } as const;
/**
 * Flat tops within this many dB of full scale, or of the level the runs sit at, are the clipping at
 * the file's peak itself. They aren't a pile below it.
 */
const PEAK_DB = 0.15;
/**
 * The file's largest swing is half the distance from its highest to its lowest point within this
 * many seconds, at its largest. Unlike the peak, it isn't thrown by the drift the analogue stages
 * add, which lifts one side of the wave while it lowers the other.
 */
const SWING_SECONDS = 0.02;
/** A flat top pairs with one of the other polarity that starts within this many seconds. */
const PAIR_SECONDS = 0.03;
/** Flat tops in a pile more than this far apart, in seconds, are separate stretches. */
const STRETCH_GAP = 180;
/** Weights for smoothing a top: they take out ringing near half the sample rate, not a curve. */
const SMOOTH = [1, 6, 15, 20, 15, 6, 1].map((w) => w / 64);
/** Flat tops are counted by level in bins this many dB wide, minute by minute, for the whole file. */
const BIN_DB = 0.05;
/** The top bin's upper edge, in dBFS. Flat tops above it, which only a float file holds, go in the top bin. */
const BINS_TOP_DB = 0.5;

/** Identical samples in a row at the file's peak. */
export interface Run {
  /** First sample of the run, counted per channel from the start of the file. */
  at: number;
  channel: number;
  /** How many samples in a row held the value. */
  samples: number;
}

export interface FlatTop {
  at: number;
  channel: number;
  /** +1 for a flat top, −1 for a flat bottom. */
  sign: 1 | -1;
  /** Where the top sits, in dBFS. */
  levelDb: number;
  /**
   * The level averaged with the neighbouring flat top of the other polarity, in dBFS: the drift
   * that AC coupling adds pushes one up and the other down by the same amount, so this is steadier.
   */
  pairedDb?: number;
  /** How many samples long the top is. */
  samples: number;
}

/** Flat tops piled up at one level. */
export interface Pile {
  /** The level they pile up at, in dBFS. */
  levelDb: number;
  /** The range that counts as that level, in dBFS. */
  fromDb: number;
  toDb: number;
  /** Flat tops at that level. */
  count: number;
  /** Flat tops in the 2 dB just below it, for comparison. */
  justBelow: number;
  /** Its share of all the flat tops below the file's peak. */
  share: number;
  /**
   * Within 1.5 dB of the file's largest swing: at the file's loudest level. A pile further down
   * counts only the flat tops at the loudest level of the 2 seconds before them.
   */
  atTop: boolean;
  /** First and last, in samples. */
  firstAt: number;
  lastAt: number;
  /** Minutes of the file with at least one. */
  minutes: number;
  /** Stretches of the file they come in, split where 3 minutes pass without one. */
  stretches: number;
  /** How many were tops and how many bottoms. */
  tops: number;
  bottoms: number;
  /** How many on each channel. */
  perChannel: number[];
}

export interface MinuteSummary {
  minute: number;
  peakDb: number;
  /** Runs at the file's peak. */
  runs: number;
  flatTops: number;
  /** Flat tops in a pile. */
  atPile: number;
  /** First run, or else first flat top in a pile, in this minute, in samples: somewhere to listen. */
  firstAt?: number;
}

/**
 * - `runs`: identical samples in a row at the file's peak, full scale in the file as the recorder wrote it.
 * - `pile`: no runs, and flat tops pile up at one level (or two) below full scale.
 * - `none`: neither.
 * - `too-quiet`: nothing reaches the level the check looks at.
 */
export type Verdict = 'runs' | 'pile' | 'none' | 'too-quiet';

export interface ClipCheckResult {
  sampleRate: number;
  channels: number;
  frames: number;
  seconds: number;
  peakDb: number;
  peakAt: number;
  peakChannel: number;
  /** Half the file's largest swing, in dBFS: its loudest level, steadier than its peak. */
  swingDb: number;
  /** Tops quieter than this weren't checked, in dBFS. */
  gateDb: number;
  /** Samples beyond full scale, which only a float file can hold. */
  overs: number;
  runs: {
    /** The fewest samples in a row that count. */
    minSamples: number;
    count: number;
    samples: number;
    longest: number;
    /** Where the runs sit, in dBFS: the file's peak. */
    levelDb?: number;
    events: Run[];
  };
  flatTops: {
    count: number;
    /** The level with the most flat tops, in any 0.5 dB, whether or not they make a pile. */
    densest?: { levelDb: number; count: number; share: number };
    /** No 0.5 dB holds the share of them that a pile below the file's loudest level needs. */
    spread: boolean;
    events: FlatTop[];
  };
  /** At most two: one at the file's loudest level, and the one with the most flat tops below it. */
  piles: Pile[];
  /** Second-by-second peaks while music plays, against the site's target (model.ts). */
  levels: {
    musicSeconds: number;
    /** Half the seconds peak above this, in dBFS. */
    typicalDb: number;
    /** One second in twenty peaks above this, in dBFS. */
    loudDb: number;
    /** Seconds peaking above the target's limit for the loudest blend. */
    secondsAboveLimit: number;
  };
  minutes: MinuteSummary[];
  verdict: Verdict;
}

interface ChannelState {
  sign: number;
  start: number;
  length: number;
  peak: number;
  overflow: boolean;
  buffer: Float32Array;
  /** The value the samples hold, and for how many in a row. */
  value: number;
  run: number;
  runStart: number;
  /**
   * The last flat top on this channel, which the next one may pair with. It's counted once the next
   * one comes, when its paired level can't change any more. `recent` is the largest swing in the
   * seconds before it.
   */
  lastFlat: { event: FlatTop; level: number; recent: number } | undefined;
  /** The highest and lowest points in the current swing window. */
  up: number;
  down: number;
}

/** The file's highest (or lowest) value so far, and the runs that sit at it. */
interface Side {
  value: number;
  count: number;
  samples: number;
  longest: number;
  /** Runs per minute of the file, and the first in each, in samples. */
  perMinute: number[];
  firstAt: number[];
  events: Run[];
}

/** Flat tops in one minute of the file, by level bin, with the first and last in each bin, in samples. */
interface MinuteBins {
  count: Uint32Array;
  first: Float64Array;
  last: Float64Array;
}

/** Flat tops counted by level: minute by minute, and for the whole file by polarity and channel. */
interface Tally {
  minutes: (MinuteBins | undefined)[];
  signs: [Uint32Array, Uint32Array];
  channels: Uint32Array[];
}

/** A window of level bins, from one bin to another, and the flat tops in it. */
interface Band {
  from: number;
  to: number;
  count: number;
}

const toDb = (v: number): number => (v > 0 ? 20 * Math.log10(v) : Number.NEGATIVE_INFINITY);

/** Feed it interleaved samples (−1 to 1) as they're read, then call `finish`. */
export class ClipCheck {
  readonly sampleRate: number;
  readonly channels: number;
  readonly #options: Required<ClipCheckOptions>;
  readonly #state: ChannelState[];
  readonly #gate: number;
  readonly #minFlat: number;
  readonly #smoothed: Float32Array;
  readonly #swingFrames: number;
  readonly #minuteFrames: number;
  /** The bottom bin's lower edge, in dBFS, and how many bins there are. */
  readonly #binsFromDb: number;
  readonly #bins: number;
  #swing = 0;
  #swingFill = 0;
  /** The swing of each of the last few windows, oldest overwritten first. */
  readonly #recent: Float32Array;
  #recentAt = 0;
  #frame = 0;
  #peak = 0;
  #peakAt = 0;
  #peakChannel = 0;
  #overs = 0;
  readonly #high: Side;
  readonly #low: Side;
  #flat: FlatTop[] = [];
  #flatCount = 0;
  /** Every flat top, and the ones at the loudest level of the seconds before them. */
  readonly #all: Tally;
  readonly #onTop: Tally;
  #secondPeaks: number[] = [];
  #secondPeak = 0;
  #secondFill = 0;

  constructor(sampleRate: number, channels: number, options: ClipCheckOptions = {}) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.#options = { ...CLIPCHECK_DEFAULTS, ...options };
    this.#gate = 10 ** (this.#options.gateDbfs / 20);
    this.#minFlat = Math.max(12, Math.round(this.#options.minFlatSeconds * sampleRate));
    const longest = Math.ceil(LONGEST_HALF_WAVE * sampleRate);
    this.#smoothed = new Float32Array(longest);
    this.#swingFrames = Math.max(1, Math.round(SWING_SECONDS * sampleRate));
    this.#recent = new Float32Array(Math.round(PILE.recentSeconds / SWING_SECONDS));
    this.#minuteFrames = sampleRate * 60;
    // A top's level is at most TOP_DB under its peak, which is over the gate.
    this.#binsFromDb = Math.floor(this.#options.gateDbfs - 1);
    this.#bins = Math.round((BINS_TOP_DB - this.#binsFromDb) / BIN_DB);
    const tally = (): Tally => ({
      minutes: [],
      signs: [new Uint32Array(this.#bins), new Uint32Array(this.#bins)],
      channels: Array.from({ length: channels }, () => new Uint32Array(this.#bins)),
    });
    this.#all = tally();
    this.#onTop = tally();
    // Only a value past the gate can be the peak the runs are looked for at.
    this.#high = this.#side(this.#gate);
    this.#low = this.#side(-this.#gate);
    this.#state = Array.from({ length: channels }, () => ({
      sign: 0,
      start: 0,
      length: 0,
      peak: 0,
      overflow: false,
      buffer: new Float32Array(longest),
      value: Number.NaN,
      run: 0,
      runStart: 0,
      lastFlat: undefined,
      up: 0,
      down: 0,
    }));
  }

  #side(value: number): Side {
    return { value, count: 0, samples: 0, longest: 0, perMinute: [], firstAt: [], events: [] };
  }

  /** Adds interleaved samples, whole frames. */
  push(samples: Float32Array): void {
    const c = this.channels;
    const frames = Math.floor(samples.length / c);
    const high = this.#high;
    const low = this.#low;
    const runSamples = this.#options.runSamples;
    for (let f = 0; f < frames; f++) {
      const frame = this.#frame + f;
      for (let ch = 0; ch < c; ch++) {
        const x = samples[f * c + ch]!;
        const a = x < 0 ? -x : x;
        const st = this.#state[ch]!;

        if (a > this.#peak) {
          this.#peak = a;
          this.#peakAt = frame;
          this.#peakChannel = ch;
        }
        if (a > this.#secondPeak) this.#secondPeak = a;
        if (a > 1) this.#overs++;
        if (x > st.up) st.up = x;
        else if (-x > st.down) st.down = -x;

        // A new peak: runs at the old one no longer sit at the file's peak.
        if (x > high.value) this.#raise(high, x);
        else if (x < low.value) this.#raise(low, x);
        if (x === st.value) st.run++;
        else {
          if (st.run >= runSamples) this.#closeRun(ch, st);
          st.value = x;
          st.run = 1;
          st.runStart = frame;
        }

        const sign = x > 0 ? 1 : x < 0 ? -1 : 0;
        if (sign !== st.sign) {
          this.#closeHalfWave(ch, st);
          st.sign = sign;
          st.start = frame;
          st.length = 0;
          st.peak = 0;
          st.overflow = false;
        }
        if (st.length < st.buffer.length) st.buffer[st.length] = a;
        else st.overflow = true;
        st.length++;
        if (a > st.peak) st.peak = a;
      }
      if (++this.#swingFill === this.#swingFrames) this.#closeSwing();
      if (++this.#secondFill === this.sampleRate) {
        this.#secondPeaks.push(this.#secondPeak);
        this.#secondPeak = 0;
        this.#secondFill = 0;
      }
    }
    this.#frame += frames;
  }

  #raise(side: Side, value: number): void {
    side.value = value;
    if (side.count > 0) Object.assign(side, this.#side(value));
  }

  /** The current window's swing so far: half its highest-to-lowest distance, on the widest channel. */
  #windowSwing(): number {
    let s = 0;
    for (const st of this.#state) if (st.up > 0 && st.down > 0) s = Math.max(s, (st.up + st.down) / 2);
    return s;
  }

  #closeSwing(): void {
    const s = this.#windowSwing();
    if (s > this.#swing) this.#swing = s;
    this.#recent[this.#recentAt] = s;
    this.#recentAt = (this.#recentAt + 1) % this.#recent.length;
    for (const st of this.#state) {
      st.up = 0;
      st.down = 0;
    }
    this.#swingFill = 0;
  }

  /** Counts a run that just ended, if it sat at the file's highest or lowest value so far. */
  #closeRun(channel: number, st: ChannelState): void {
    const v = st.value;
    const side =
      v === this.#high.value && v > this.#gate
        ? this.#high
        : v === this.#low.value && v < -this.#gate
          ? this.#low
          : undefined;
    if (!side) return;
    side.count++;
    side.samples += st.run;
    if (st.run > side.longest) side.longest = st.run;
    const m = Math.floor(st.runStart / this.#minuteFrames);
    side.perMinute[m] = (side.perMinute[m] ?? 0) + 1;
    side.firstAt[m] = Math.min(side.firstAt[m] ?? st.runStart, st.runStart);
    if (side.events.length < this.#options.maxEvents) side.events.push({ at: st.runStart, channel, samples: st.run });
  }

  /** Checks the half-wave that just ended for a flat top: a long top that a straight line fits. */
  #closeHalfWave(channel: number, st: ChannelState): void {
    if (st.sign === 0 || st.overflow || st.peak < this.#gate || st.length < this.#minFlat) return;
    const buffer = st.buffer;
    const n = st.length;
    const limit = st.peak * 10 ** (-TOP_DB / 20);

    // The longest stretch within TOP_DB of the peak.
    let bestStart = 0;
    let bestLength = 0;
    let from = -1;
    for (let i = 0; i <= n; i++) {
      if (i < n && buffer[i]! >= limit) {
        if (from < 0) from = i;
      } else if (from >= 0) {
        if (i - from > bestLength) {
          bestLength = i - from;
          bestStart = from;
        }
        from = -1;
      }
    }
    if (bestLength < this.#minFlat) return;

    // A straight line through its middle. A curved top (a sine's) fits badly; a flat top fits to
    // within the noise, even after the analogue stages have tilted it. The top is smoothed first,
    // because the converters' filters leave ringing near its corners.
    const m = Math.max(6, Math.round(bestLength * MIDDLE));
    const first = bestStart + Math.floor((bestLength - m) / 2);
    const half = (SMOOTH.length - 1) / 2;
    const top = this.#smoothed;
    for (let i = 0; i < m; i++) {
      let y = 0;
      for (let k = 0; k < SMOOTH.length; k++) {
        const j = Math.min(n - 1, Math.max(0, first + i + k - half));
        y += SMOOTH[k]! * buffer[j]!;
      }
      top[i] = y;
    }
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < m; i++) {
      const y = top[i]!;
      sx += i;
      sy += y;
      sxx += i * i;
      sxy += i * y;
    }
    const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
    const intercept = (sy - slope * sx) / m;
    let squares = 0;
    for (let i = 0; i < m; i++) {
      const r = top[i]! - (intercept + slope * i);
      squares += r * r;
    }
    const mean = sy / m;
    if (Math.sqrt(squares / m) > this.#options.flatness * mean) return;
    // A flat top sags as the analogue stages' coupling lets it drift back towards zero, so its
    // level is where it starts: the line, followed back to the first sample of the top.
    const level = Math.min(st.peak, Math.max(mean, intercept + slope * (bestStart - first)));

    this.#flatCount++;
    const at = st.start + bestStart;
    const sign = st.sign as 1 | -1;
    const event: FlatTop = { at, channel, sign, levelDb: toDb(level), samples: bestLength };
    const last = st.lastFlat;
    if (last) {
      if (last.event.sign !== sign && at - last.event.at <= PAIR_SECONDS * this.sampleRate) {
        const paired = toDb((level + last.level) / 2);
        event.pairedDb = paired;
        last.event.pairedDb ??= paired;
      }
      this.#count(last.event, last.recent);
    }
    let recent = this.#windowSwing();
    for (const s of this.#recent) if (s > recent) recent = s;
    st.lastFlat = { event, level, recent };
    if (this.#flat.length < this.#options.maxEvents) this.#flat.push(event);
  }

  #binOf(db: number): number {
    const b = Math.floor((db - this.#binsFromDb) / BIN_DB + 1e-9);
    return Math.max(0, Math.min(this.#bins - 1, b));
  }

  #dbOf(bin: number): number {
    return this.#binsFromDb + bin * BIN_DB;
  }

  /** Counts a flat top by the level it settled at, and again if it was at the top of the seconds before it. */
  #count(t: FlatTop, recent: number): void {
    const level = t.pairedDb ?? t.levelDb;
    const b = this.#binOf(level);
    const m = Math.floor(t.at / this.#minuteFrames);
    const tallies = level >= toDb(recent) - PILE.topDb ? [this.#all, this.#onTop] : [this.#all];
    for (const tally of tallies) {
      let bins = tally.minutes[m];
      if (!bins) {
        bins = {
          count: new Uint32Array(this.#bins),
          first: new Float64Array(this.#bins).fill(Number.POSITIVE_INFINITY),
          last: new Float64Array(this.#bins).fill(Number.NEGATIVE_INFINITY),
        };
        tally.minutes[m] = bins;
      }
      bins.count[b]!++;
      if (t.at < bins.first[b]!) bins.first[b] = t.at;
      if (t.at > bins.last[b]!) bins.last[b] = t.at;
      tally.signs[t.sign > 0 ? 0 : 1][b]!++;
      tally.channels[t.channel]![b]!++;
    }
  }

  /** Ends the file and works out what the marks mean. */
  finish(): ClipCheckResult {
    this.#state.forEach((st, ch) => {
      if (st.run >= this.#options.runSamples) this.#closeRun(ch, st);
      st.run = 0;
      st.value = Number.NaN;
      this.#closeHalfWave(ch, st);
      st.sign = 0;
      if (st.lastFlat) this.#count(st.lastFlat.event, st.lastFlat.recent);
      st.lastFlat = undefined;
    });
    if (this.#secondFill > 0) this.#secondPeaks.push(this.#secondPeak);
    this.#closeSwing();

    const sr = this.sampleRate;
    const peakDb = toDb(this.#peak);
    const swingDb = toDb(this.#swing || this.#peak);
    const runs = this.#runs();

    // Everything from the runs' level up is the clipping at the file's peak. Without runs, the
    // same goes for full scale.
    const below = this.#binOf(Math.min(0, runs.levelDb ?? 0) - PEAK_DB);
    const all = this.#sum(this.#all);
    let total = 0;
    for (let b = 0; b < below; b++) total += all[b]!;
    const densest = this.#densest(all, 0, below - 1);
    const found = this.#piles(below, total, swingDb);

    const minutes: MinuteSummary[] = [];
    const count = Math.max(1, Math.ceil(this.#frame / this.#minuteFrames));
    for (let k = 0; k < count; k++) {
      const seconds = this.#secondPeaks.slice(k * 60, k * 60 + 60);
      const summary: MinuteSummary = {
        minute: k,
        peakDb: toDb(Math.max(0, ...seconds)),
        runs: (this.#high.perMinute[k] ?? 0) + (this.#low.perMinute[k] ?? 0),
        flatTops: 0,
        atPile: 0,
      };
      const firstRun = Math.min(
        this.#high.firstAt[k] ?? Number.POSITIVE_INFINITY,
        this.#low.firstAt[k] ?? Number.POSITIVE_INFINITY,
      );
      if (Number.isFinite(firstRun)) summary.firstAt = firstRun;
      const bins = this.#all.minutes[k];
      if (bins) for (let b = 0; b < this.#bins; b++) summary.flatTops += bins.count[b]!;
      for (const { band, tally } of found) {
        const pileBins = tally.minutes[k];
        if (!pileBins) continue;
        for (let b = band.from; b <= band.to; b++) {
          summary.atPile += pileBins.count[b]!;
          if (summary.runs === 0 && pileBins.count[b]! > 0) {
            summary.firstAt = Math.min(summary.firstAt ?? Number.POSITIVE_INFINITY, pileBins.first[b]!);
          }
        }
      }
      minutes.push(summary);
    }

    const verdict: Verdict =
      this.#peak < this.#gate ? 'too-quiet' : runs.count > 0 ? 'runs' : found.length > 0 ? 'pile' : 'none';

    return {
      sampleRate: sr,
      channels: this.channels,
      frames: this.#frame,
      seconds: this.#frame / sr,
      peakDb,
      peakAt: this.#peakAt,
      peakChannel: this.#peakChannel,
      swingDb,
      gateDb: this.#options.gateDbfs,
      overs: this.#overs,
      runs,
      flatTops: {
        count: this.#flatCount,
        ...(densest.count > 0
          ? { densest: { levelDb: this.#median(all, densest), count: densest.count, share: densest.count / total } }
          : {}),
        spread: densest.count < this.#options.pileShare * total,
        events: this.#flat,
      },
      piles: found.map(({ pile }) => pile),
      levels: this.#levels(),
      minutes,
      verdict,
    };
  }

  /** The runs at the file's highest and lowest values, together. */
  #runs(): ClipCheckResult['runs'] {
    const sides = [this.#high, this.#low].filter((s) => s.count > 0);
    const events = sides
      .flatMap((s) => s.events)
      .sort((a, b) => a.at - b.at || a.channel - b.channel)
      .slice(0, this.#options.maxEvents);
    return {
      minSamples: this.#options.runSamples,
      count: sides.reduce((n, s) => n + s.count, 0),
      samples: sides.reduce((n, s) => n + s.samples, 0),
      longest: sides.reduce((n, s) => Math.max(n, s.longest), 0),
      ...(sides.length > 0 ? { levelDb: Math.max(...sides.map((s) => toDb(Math.abs(s.value)))) } : {}),
      events,
    };
  }

  /** A tally's flat tops by level, over the whole file. */
  #sum(tally: Tally): Uint32Array {
    const sum = new Uint32Array(this.#bins);
    for (const m of tally.minutes) if (m) for (let b = 0; b < this.#bins; b++) sum[b]! += m.count[b]!;
    return sum;
  }

  /**
   * The piles: the one at the file's loudest level, if there is one, and the one with the most flat
   * tops anywhere else, if it holds its share of them all.
   */
  #piles(below: number, total: number, swingDb: number): { pile: Pile; band: Band; tally: Tally }[] {
    const found: { pile: Pile; band: Band; tally: Tally }[] = [];
    const test = (tally: Tally, sum: Uint32Array, band: Band) => {
      const gap = Math.round(PILE.gapDb / BIN_DB);
      let under = 0;
      for (let b = Math.max(0, band.from - gap); b < band.from; b++) under += sum[b]!;
      const clear = band.count / this.#options.sameLevelDb >= (PILE.clear * under) / PILE.gapDb;
      return band.count >= PILE.count && clear
        ? { pile: this.#describe(tally, sum, band, under, total, swingDb), band, tally }
        : undefined;
    };

    const all = this.#sum(this.#all);
    const top = test(this.#all, all, this.#densest(all, this.#binOf(swingDb - PILE.topDb), below - 1));
    if (top) found.push(top);
    const onTop = this.#sum(this.#onTop);
    const width = Math.round(this.#options.sameLevelDb / BIN_DB);
    const lower = test(this.#onTop, onTop, this.#densest(onTop, 0, below - 1, top?.band, width));
    if (lower && lower.band.count >= this.#options.pileShare * total) found.push(lower);
    return found;
  }

  /**
   * The `sameLevelDb` of bins, from `lo` to `hi`, with the most flat tops, trimmed to the bins that
   * have any. It keeps `margin` bins clear of `taken`.
   */
  #densest(sum: Uint32Array, lo: number, hi: number, taken?: Band, margin = 0): Band {
    const width = Math.round(this.#options.sameLevelDb / BIN_DB);
    let best: Band = { from: lo, to: lo, count: 0 };
    for (let b = Math.max(0, lo); b <= hi; b++) {
      const to = Math.min(hi, b + width - 1);
      if (taken && to >= taken.from - margin && b <= taken.to + margin) continue;
      let n = 0;
      for (let k = b; k <= to; k++) n += sum[k]!;
      if (n > best.count) best = { from: b, to, count: n };
    }
    while (best.count > 0 && sum[best.from]! === 0) best.from++;
    while (best.count > 0 && sum[best.to]! === 0) best.to--;
    return best;
  }

  /** The level half the band's flat tops are under, in dBFS. */
  #median(sum: Uint32Array, band: Band): number {
    let n = 0;
    for (let b = band.from; b <= band.to; b++) {
      n += sum[b]!;
      if (n * 2 >= band.count) return this.#dbOf(b) + BIN_DB / 2;
    }
    return this.#dbOf(band.to) + BIN_DB / 2;
  }

  #describe(tally: Tally, sum: Uint32Array, band: Band, justBelow: number, total: number, swingDb: number): Pile {
    let firstAt = Number.POSITIVE_INFINITY;
    let lastAt = Number.NEGATIVE_INFINITY;
    let minutes = 0;
    let stretches = 0;
    for (const bins of tally.minutes) {
      if (!bins) continue;
      let n = 0;
      let first = Number.POSITIVE_INFINITY;
      let last = Number.NEGATIVE_INFINITY;
      for (let b = band.from; b <= band.to; b++) {
        n += bins.count[b]!;
        first = Math.min(first, bins.first[b]!);
        last = Math.max(last, bins.last[b]!);
      }
      if (n === 0) continue;
      minutes++;
      if (stretches === 0 || first - lastAt > STRETCH_GAP * this.sampleRate) stretches++;
      firstAt = Math.min(firstAt, first);
      lastAt = last;
    }
    let tops = 0;
    let bottoms = 0;
    const perChannel = tally.channels.map(() => 0);
    for (let b = band.from; b <= band.to; b++) {
      tops += tally.signs[0][b]!;
      bottoms += tally.signs[1][b]!;
      tally.channels.forEach((bins, ch) => {
        perChannel[ch]! += bins[b]!;
      });
    }
    const levelDb = this.#median(sum, band);
    return {
      levelDb,
      fromDb: this.#dbOf(band.from),
      toDb: this.#dbOf(band.to + 1),
      count: band.count,
      justBelow,
      share: band.count / total,
      atTop: levelDb >= swingDb - PILE.topDb,
      firstAt,
      lastAt,
      minutes,
      stretches,
      tops,
      bottoms,
      perChannel,
    };
  }

  #levels(): ClipCheckResult['levels'] {
    const music = this.#secondPeaks.filter((p) => toDb(p) > MUSIC_DBFS).sort((a, b) => a - b);
    const at = (q: number) => toDb(music[Math.min(music.length - 1, Math.floor(q * music.length))] ?? 0);
    return {
      musicSeconds: music.length,
      typicalDb: at(0.5),
      loudDb: at(0.95),
      secondsAboveLimit: music.filter((p) => toDb(p) > TARGET.blendMax).length,
    };
  }
}
