/**
 * How clipped a recording is, read from its samples. Clipping leaves two different marks:
 *
 * - **The recorder overloading.** Its converter runs out of numbers, so the file sits at full
 *   scale, 0 dBFS, for several samples in a row. Unmistakable.
 * - **Something before the recorder clipping**, such as the mixer past its red. The tops were
 *   flattened first and then turned down on the way, so they sit flat at one level below full
 *   scale. The analogue stages in between tilt them and add noise, so this looks for tops that
 *   are straight lines rather than curves, then for many of them at the same level. A flat top and
 *   its neighbour of the other polarity are averaged, which cancels the drift the stages add.
 *
 * Tracks clipped in their own mastering have flat tops too, at whatever level the DJ played them.
 * A ceiling in the rig shows as one level, at the top of the file, again and again.
 */
import { TARGET } from '../model';

export interface ClipCheckOptions {
  /** Samples in a row at full scale that count as the recorder overloading. Audacity uses 3. */
  overloadRun?: number;
  /** How close to full scale counts as full scale, in dB (0.09 dB is within 1%). */
  fullScaleWithinDb?: number;
  /** Tops quieter than this aren't checked for flatness, in dBFS: below it, noise hides them. */
  gateDbfs?: number;
  /** The shortest flat top that counts, in seconds (0.25 ms is 12 samples at 48 kHz). */
  minFlatSeconds?: number;
  /** How closely a straight line must fit a top for it to count as flat, as a share of its level. */
  flatness?: number;
  /** Flat tops within this many dB of each other count as the same level. */
  sameLevelDb?: number;
}

export const CLIPCHECK_DEFAULTS: Required<ClipCheckOptions> = {
  overloadRun: 3,
  fullScaleWithinDb: 0.09,
  gateDbfs: -30,
  minFlatSeconds: 0.00025,
  flatness: 0.0005,
  sameLevelDb: 0.5,
};

/** A top is the part of a half-wave within this many dB of its peak. */
const TOP_DB = 0.5;
/** The share of a top, from its middle, that the straight-line test uses (away from the edges). */
const MIDDLE = 0.4;
/** Half-waves longer than this, in seconds, are too slow to be sound and aren't checked. */
const LONGEST_HALF_WAVE = 0.1;
/** Events kept for the report. More are counted but not kept. */
const MAX_EVENTS = 200_000;
/** Seconds whose peak is below this, in dBFS, are silence or a gap between sets. */
const MUSIC_DBFS = -45;
/**
 * A ceiling is a pile of flat tops at one level: at least `count` of them, within `belowPeakDb` of
 * the file's largest swing (see SWING_SECONDS), and packed at least `clear` times as densely, per
 * dB, as those in the `gapDb` just below. Tracks mastered with flat tops of their own scatter them
 * over many levels instead.
 */
const CEILING = { count: 8, belowPeakDb: 1.5, clear: 3, gapDb: 2 } as const;
/**
 * The file's largest swing is half the distance from its highest to its lowest point within this
 * many seconds, at its largest. Unlike the peak, it isn't thrown by the drift the analogue stages
 * add, which lifts one side of the wave while it lowers the other.
 */
const SWING_SECONDS = 0.02;
/** A flat top pairs with one of the other polarity that starts within this many seconds. */
const PAIR_SECONDS = 0.03;
/** Flat tops at the ceiling more than this far apart, in seconds, are separate stretches. */
const STRETCH_GAP = 180;
/** Weights for smoothing a top: they take out ringing near half the sample rate, not a curve. */
const SMOOTH = [1, 6, 15, 20, 15, 6, 1].map((w) => w / 64);

export interface Overload {
  /** First sample of the run, counted per channel from the start of the file. */
  at: number;
  channel: number;
  /** How many samples in a row sat at full scale. */
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

export interface Ceiling {
  /** The level the flat tops pile up at, in dBFS. */
  levelDb: number;
  /** The range that counts as that level, in dBFS. */
  fromDb: number;
  toDb: number;
  /** Flat tops at that level. */
  count: number;
  /** Flat tops in the few dB just below it, for comparison. */
  justBelow: number;
  /** First and last, in samples. */
  firstAt: number;
  lastAt: number;
  /** Minutes of the file with at least one. */
  minutes: number;
  /** Separate stretches of the file they come in: one track or blend, or right across the night. */
  stretches: number;
  /** How many were tops and how many bottoms: a ceiling in the rig flattens both. */
  tops: number;
  bottoms: number;
  /** How many on each channel. */
  perChannel: number[];
}

export interface MinuteSummary {
  minute: number;
  peakDb: number;
  overloads: number;
  flatTops: number;
  /** Flat tops at the ceiling, if there is one. */
  atCeiling: number;
  /** First overload or flat top at the ceiling in this minute, in samples: somewhere to listen. */
  firstAt?: number;
}

export type Verdict = 'recorder' | 'before-recorder' | 'clean';

export interface ClipCheckResult {
  sampleRate: number;
  channels: number;
  frames: number;
  seconds: number;
  peakDb: number;
  peakAt: number;
  peakChannel: number;
  /** Samples beyond full scale, which only a float file can hold. */
  overs: number;
  overloads: { count: number; samples: number; longest: number; events: Overload[] };
  flatTops: { count: number; events: FlatTop[] };
  ceiling?: Ceiling;
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
  run: number;
  runStart: number;
  /** The last flat top on this channel, for pairing. */
  lastFlat: { at: number; sign: number; level: number; index: number } | undefined;
  /** The highest and lowest points in the current swing window. */
  up: number;
  down: number;
}

const toDb = (v: number): number => (v > 0 ? 20 * Math.log10(v) : Number.NEGATIVE_INFINITY);

/** Feed it interleaved samples (−1 to 1) as they're read, then call `finish`. */
export class ClipCheck {
  readonly sampleRate: number;
  readonly channels: number;
  readonly #options: Required<ClipCheckOptions>;
  readonly #state: ChannelState[];
  readonly #fullScale: number;
  readonly #gate: number;
  readonly #minFlat: number;
  readonly #smoothed: Float32Array;
  readonly #swingFrames: number;
  #swing = 0;
  #swingFill = 0;
  #frame = 0;
  #peak = 0;
  #peakAt = 0;
  #peakChannel = 0;
  #overs = 0;
  #overloads: Overload[] = [];
  #overloadCount = 0;
  #overloadSamples = 0;
  #longestOverload = 0;
  #flat: FlatTop[] = [];
  #flatCount = 0;
  #secondPeaks: number[] = [];
  #secondPeak = 0;
  #secondFill = 0;

  constructor(sampleRate: number, channels: number, options: ClipCheckOptions = {}) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.#options = { ...CLIPCHECK_DEFAULTS, ...options };
    this.#fullScale = 10 ** (-this.#options.fullScaleWithinDb / 20);
    this.#gate = 10 ** (this.#options.gateDbfs / 20);
    this.#minFlat = Math.max(12, Math.round(this.#options.minFlatSeconds * sampleRate));
    const longest = Math.ceil(LONGEST_HALF_WAVE * sampleRate);
    this.#smoothed = new Float32Array(longest);
    this.#swingFrames = Math.max(1, Math.round(SWING_SECONDS * sampleRate));
    this.#state = Array.from({ length: channels }, () => ({
      sign: 0,
      start: 0,
      length: 0,
      peak: 0,
      overflow: false,
      buffer: new Float32Array(longest),
      run: 0,
      runStart: 0,
      lastFlat: undefined,
      up: 0,
      down: 0,
    }));
  }

  /** Adds interleaved samples, whole frames. */
  push(samples: Float32Array): void {
    const c = this.channels;
    const frames = Math.floor(samples.length / c);
    const fullScale = this.#fullScale;
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

        if (a >= fullScale) {
          if (st.run === 0) st.runStart = frame;
          st.run++;
        } else if (st.run > 0) {
          this.#closeRun(ch, st);
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

  #closeSwing(): void {
    for (const st of this.#state) {
      if (st.up > 0 && st.down > 0) this.#swing = Math.max(this.#swing, (st.up + st.down) / 2);
      st.up = 0;
      st.down = 0;
    }
    this.#swingFill = 0;
  }

  #closeRun(channel: number, st: ChannelState): void {
    if (st.run >= this.#options.overloadRun) {
      this.#overloadCount++;
      this.#overloadSamples += st.run;
      if (st.run > this.#longestOverload) this.#longestOverload = st.run;
      if (this.#overloads.length < MAX_EVENTS) this.#overloads.push({ at: st.runStart, channel, samples: st.run });
    }
    st.run = 0;
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
    if (last && last.sign !== sign && at - last.at <= PAIR_SECONDS * this.sampleRate) {
      const paired = toDb((level + last.level) / 2);
      event.pairedDb = paired;
      const previous = this.#flat[last.index];
      if (previous && previous.pairedDb === undefined) previous.pairedDb = paired;
    }
    let index = -1;
    if (this.#flat.length < MAX_EVENTS) index = this.#flat.push(event) - 1;
    st.lastFlat = { at, sign, level, index };
  }

  /** Ends the file and works out what the marks mean. */
  finish(): ClipCheckResult {
    this.#state.forEach((st, ch) => {
      if (st.run > 0) this.#closeRun(ch, st);
      this.#closeHalfWave(ch, st);
      st.sign = 0;
    });
    if (this.#secondFill > 0) this.#secondPeaks.push(this.#secondPeak);
    this.#closeSwing();

    const sr = this.sampleRate;
    const peakDb = toDb(this.#peak);
    const ceiling = this.#findCeiling(toDb(this.#swing || this.#peak));
    const levels = this.#levels();

    const minutes: MinuteSummary[] = [];
    const minute = (at: number): MinuteSummary => {
      const i = Math.floor(at / (sr * 60));
      for (let k = minutes.length; k <= i; k++) {
        const seconds = this.#secondPeaks.slice(k * 60, k * 60 + 60);
        minutes.push({ minute: k, peakDb: toDb(Math.max(0, ...seconds)), overloads: 0, flatTops: 0, atCeiling: 0 });
      }
      return minutes[i]!;
    };
    minute(Math.max(0, this.#frame - 1));
    for (const o of this.#overloads) {
      const m = minute(o.at);
      m.overloads++;
      m.firstAt = Math.min(m.firstAt ?? o.at, o.at);
    }
    for (const t of this.#flat) {
      const m = minute(t.at);
      m.flatTops++;
      const l = t.pairedDb ?? t.levelDb;
      if (ceiling && l >= ceiling.fromDb && l <= ceiling.toDb) {
        m.atCeiling++;
        if (m.overloads === 0) m.firstAt = Math.min(m.firstAt ?? t.at, t.at);
      }
    }

    const verdict: Verdict = this.#overloadCount > 0 ? 'recorder' : ceiling ? 'before-recorder' : 'clean';

    return {
      sampleRate: sr,
      channels: this.channels,
      frames: this.#frame,
      seconds: this.#frame / sr,
      peakDb,
      peakAt: this.#peakAt,
      peakChannel: this.#peakChannel,
      overs: this.#overs,
      overloads: {
        count: this.#overloadCount,
        samples: this.#overloadSamples,
        longest: this.#longestOverload,
        events: this.#overloads,
      },
      flatTops: { count: this.#flatCount, events: this.#flat },
      ...(ceiling ? { ceiling } : {}),
      levels,
      minutes,
      verdict,
    };
  }

  /** The level flat tops pile up at, if they do so at the top of the file. */
  #findCeiling(swingDb: number): Ceiling | undefined {
    const fullScale = -this.#options.fullScaleWithinDb - 0.05;
    const level = (t: FlatTop) => t.pairedDb ?? t.levelDb;
    const near = this.#flat
      .map(level)
      .filter((l) => l < fullScale && l >= swingDb - CEILING.belowPeakDb)
      .sort((a, b) => a - b);
    if (near.length < CEILING.count) return undefined;

    // The densest `sameLevelDb` of levels near the top.
    const width = this.#options.sameLevelDb;
    let count = 0;
    let from = 0;
    for (let i = 0, j = 0; i < near.length; i++) {
      while (near[i]! - near[j]! > width) j++;
      if (i - j + 1 > count) {
        count = i - j + 1;
        from = j;
      }
    }
    const fromDb = near[from]!;
    const toDb = near[from + count - 1]!;
    const justBelow = this.#flat.filter((t) => level(t) < fromDb && level(t) >= fromDb - CEILING.gapDb).length;
    if (count < CEILING.count || count / width < (CEILING.clear * justBelow) / CEILING.gapDb) return undefined;

    const inside = this.#flat.filter((t) => level(t) >= fromDb && level(t) <= toDb).sort((a, b) => a.at - b.at);
    const minutes = new Set(inside.map((t) => Math.floor(t.at / (this.sampleRate * 60))));
    let stretches = inside.length > 0 ? 1 : 0;
    for (let i = 1; i < inside.length; i++) {
      if (inside[i]!.at - inside[i - 1]!.at > STRETCH_GAP * this.sampleRate) stretches++;
    }
    const perChannel = Array.from({ length: this.channels }, (_, ch) => inside.filter((t) => t.channel === ch).length);
    return {
      levelDb: near[from + Math.floor(count / 2)]!,
      fromDb,
      toDb,
      count,
      justBelow,
      firstAt: inside[0]?.at ?? 0,
      lastAt: inside[inside.length - 1]?.at ?? 0,
      minutes: minutes.size,
      stretches,
      tops: inside.filter((t) => t.sign > 0).length,
      bottoms: inside.filter((t) => t.sign < 0).length,
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
