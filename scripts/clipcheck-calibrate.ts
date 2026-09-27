// How well pnpm clipcheck works on real music. It takes 90 seconds from the middle of each of your
// own tracks, plays them into sets the way the guide says (each TRIMmed to the first orange, blends
// where both faders are up, the mixer's red at −6 dBFS in the Howler's file: src/lib/model.ts),
// passes each set through the tests' model of the analogue stages (src/lib/clipcheck/analogue.ts),
// and checks it clean and clipped. It prints the false alarms on clean sets, how often each kind of
// clipping is found at each overdrive, and the smallest overdrive from which every case is found.
// Track orders, levels and noise come from fixed seeds, so a run on the same tracks gives the same
// table. It writes nothing and prints no file names.
//
//   node --import ./scripts/resolve-ts.mjs scripts/clipcheck-calibrate.ts ~/Music/calibration/
//
// It uses the first 10 audio files in the folder, by name, and needs ffmpeg (FFMPEG=/path/to/ffmpeg
// for another copy). Ten tracks take about 15 minutes.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analogue } from '../src/lib/clipcheck/analogue.ts';
import {
  CLIPCHECK_DEFAULTS,
  ClipCheck,
  type ClipCheckOptions,
  type ClipCheckResult,
} from '../src/lib/clipcheck/analyse.ts';
import { dbfs } from '../src/lib/clipcheck/report.ts';
import { prng } from '../src/lib/dsp/synth.ts';
import { MIXER_CEILING_DB, TARGET, TARGET_PEAK_DB } from '../src/lib/model.ts';
import { meterDbToSample } from '../src/lib/xdj.ts';

const SR = 48000;
const EXCERPT_SECONDS = 90;
const BLEND_SECONDS = 8;
const MOST_TRACKS = 10;
const AUDIO = /\.(wav|aiff?|flac|mp3|m4a|aac|ogg|opus)$/i;
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
/** Orders of the tracks, and their levels: 10 clean sets for false alarms, 3 for each overdrive. */
const CLEAN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CLIPPED_SEEDS = [1, 2, 3];
/** How far past the ceiling the loudest moment goes, in dB. */
const OVERDRIVES = [0.5, 1, 2, 3, 4, 6];
/** Where the mixer's red lands in the Howler's file: +6 on the MASTER meters is the guide's normal peak. */
const RED_DBFS = TARGET.normal + MIXER_CEILING_DB - TARGET_PEAK_DB.blend;
/** A channel in the red with its fader this far down. */
const FADER_DOWN_DB = -6;
/** A pile counts as found within this many dB of the level the clipping was put at. */
const WITHIN_DB = 0.5;

const folder = process.argv[2];
if (!folder) {
  console.log('Usage: node --import ./scripts/resolve-ts.mjs scripts/clipcheck-calibrate.ts <folder of tracks>');
  process.exit(1);
}
let names: string[] = [];
try {
  names = readdirSync(folder);
} catch (error) {
  console.error(`${folder}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const files = names
  .filter((f) => AUDIO.test(f))
  .sort()
  .slice(0, MOST_TRACKS);
if (files.length < 4) {
  console.error(`It needs at least 4 tracks, and found ${files.length}.`);
  process.exit(1);
}

const db = (d: number) => 10 ** (d / 20);
const peakOf = (x: Float32Array) => {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p;
};
const flatten = (v: number) => Math.max(-1, Math.min(1, v));

/** 90 seconds from the middle of a track, 48 kHz stereo, as ffmpeg decodes it. */
function excerpt(path: string): Float32Array {
  const bytes = execFileSync(FFMPEG, ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], {
    maxBuffer: 2 ** 30,
  });
  const all = new Float32Array(new Uint8Array(bytes).buffer);
  const frames = EXCERPT_SECONDS * SR;
  const from = Math.max(0, Math.floor((all.length / 2 - frames) / 2));
  return all.slice(from * 2, (from + frames) * 2);
}

/** A channel: TRIM so the track peaks at `meterDb` on its meter, flattened at the red, then its fader. */
function channel(track: Float32Array, meterDb: number, faderDb = 0): Float32Array {
  const trim = meterDbToSample(meterDb) / peakOf(track);
  const fader = db(faderDb);
  return track.map((v) => flatten(v * trim) * fader);
}

/** Two channels at once, for as long as the shorter one lasts. */
function together(a: Float32Array, b: Float32Array): Float32Array {
  return a.subarray(0, Math.min(a.length, b.length)).map((v, i) => v + b[i]!);
}

/** One after another, each blend with both faders up in its middle. */
function play(parts: Float32Array[]): Float32Array {
  const blend = BLEND_SECONDS * SR * 2;
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0) - blend * (parts.length - 1));
  let at = 0;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++)
      out[at + i]! += p[i]! * Math.min(1, (2 * i) / blend, (2 * (p.length - i)) / blend);
    at += p.length - blend;
  }
  return out;
}

/** The master: the mix, `gainDb` louder, flattened at the red, into the Howler with the red at −6 dBFS. */
function master(mix: Float32Array, gainDb = 0): Float32Array {
  const gain = db(gainDb);
  const red = db(RED_DBFS);
  return mix.map((v) => flatten(v * gain) * red);
}

/** A set: the tracks in an order from `seed`, each TRIMmed to the first orange give or take 1.5 dB. */
function set(tracks: Float32Array[], seed: number, red?: { at: number; overDb: number }): Float32Array {
  const random = prng(seed);
  const order = tracks
    .map((track) => ({ track, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ track }) => track);
  return play(
    order.map((track, i) => {
      const meterDb = TARGET_PEAK_DB.aim + random() * 3 - 1.5;
      return red?.at === i ? channel(track, MIXER_CEILING_DB + red.overDb, FADER_DOWN_DB) : channel(track, meterDb);
    }),
  );
}

function check(samples: Float32Array, options: ClipCheckOptions = {}): ClipCheckResult {
  const c = new ClipCheck(SR, 2, { maxEvents: 0, ...options });
  for (let i = 0; i < samples.length; i += 1 << 17) c.push(samples.subarray(i, i + (1 << 17)));
  return c.finish();
}

const pileAt = (r: ClipCheckResult, dbfs: number) =>
  r.verdict === 'pile' && r.piles.some((p) => Math.abs(p.levelDb - dbfs) <= WITHIN_DB);

const started = performance.now();
const tracks = files.map((f) => excerpt(join(folder, f)));
const minutes = (play(tracks).length / 2 / SR / 60).toFixed(1);
console.log(
  `${tracks.length} tracks, ${EXCERPT_SECONDS} s from the middle of each, in sets of ${minutes} min with ${BLEND_SECONDS}-second blends.`,
);

// False alarms: every verdict but "no clipping found". On the sets at the guide's levels, it also
// measures the biggest pile below the loudest level, with the share test turned off.
console.log('\nFalse alarms on clean sets');
let biggest = 0;
const alarms = (label: string, file: (seed: number) => Float32Array, measure = false) => {
  const verdicts = CLEAN_SEEDS.map((seed) => {
    const x = analogue(file(seed), { channels: 2, seed });
    if (measure) {
      const lower = check(x, { pileShare: 0 }).piles.filter((p) => !p.atTop);
      for (const p of lower) biggest = Math.max(biggest, p.share);
    }
    return check(x).verdict;
  });
  const wrong = verdicts.filter((v) => v !== 'none');
  const which = wrong.length > 0 ? ` (${wrong.join(', ')})` : '';
  console.log(`  ${label.padEnd(48)}${wrong.length} of ${verdicts.length}${which}`);
};
alarms('At the guide’s levels', (seed) => master(set(tracks, seed)), true);
alarms('Turned up to peak at −1 dBFS', (seed) => {
  const x = master(set(tracks, seed));
  const gain = db(-1) / peakOf(x);
  return x.map((v) => v * gain);
});
const needs = Math.round(CLIPCHECK_DEFAULTS.pileShare * 100);
console.log(
  `  The biggest pile below the loudest level held ${Math.round(biggest * 100)}% of a clean set’s flat tops. A pile there needs ${needs}%.`,
);

// Sensitivity: how often each kind of clipping is found, by how far past its ceiling it goes, and
// the smallest overdrive from which every case is found.
console.log(`
Found, by how far the loudest moment goes past the ceiling
  Master:   the sets pushed past the mixer’s red. Found: a pile at ${dbfs(RED_DBFS, 0)}.
  Channel:  each track in turn with its channel in the red and its fader ${-FADER_DOWN_DB} dB down, then a
            louder clean blend of two others. Found: a pile at ${dbfs(RED_DBFS + FADER_DOWN_DB, 0)}.
  In a set: one track in the middle of a clean set, played the same way. Found: the same pile.
  Howler:   the sets pushed past full scale. Found: runs at the file’s peak, in the file and in a
            copy normalised to ${dbfs(-2, 0)}.`);
console.log(
  `\n  ${'dB past the ceiling'.padEnd(22)}${OVERDRIVES.map((o) => String(o).padEnd(7)).join('')}every one from`,
);
const row = (label: string, found: (overDb: number) => boolean[]) => {
  const results = OVERDRIVES.map(found);
  const cells = results.map((f) => `${f.filter(Boolean).length}/${f.length}`.padEnd(7));
  const always = OVERDRIVES.findIndex((_, i) => results.slice(i).every((f) => f.every(Boolean)));
  console.log(`  ${label.padEnd(22)}${cells.join('')}${always < 0 ? 'none' : `${OVERDRIVES[always]} dB`}`);
};
row('Master', (overDb) =>
  CLIPPED_SEEDS.map((seed) => {
    const mix = set(tracks, seed);
    const file = analogue(master(mix, overDb - 20 * Math.log10(peakOf(mix))), { channels: 2, seed });
    return pileAt(check(file), RED_DBFS);
  }),
);
row('Channel', (overDb) =>
  tracks.map((track, k) => {
    const blend = together(channel(tracks[(k + 1) % tracks.length]!, 4), channel(tracks[(k + 2) % tracks.length]!, 4));
    const mix = play([channel(track, MIXER_CEILING_DB + overDb, FADER_DOWN_DB), blend]);
    return pileAt(check(analogue(master(mix), { channels: 2, seed: k })), RED_DBFS + FADER_DOWN_DB);
  }),
);
row('In a set', (overDb) =>
  CLIPPED_SEEDS.map((seed) => {
    const red = { at: Math.floor(tracks.length / 2), overDb };
    const file = analogue(master(set(tracks, seed, red)), { channels: 2, seed });
    return pileAt(check(file), RED_DBFS + FADER_DOWN_DB);
  }),
);
const howler = OVERDRIVES.map((overDb) =>
  CLIPPED_SEEDS.map((seed) => {
    const x = master(set(tracks, seed));
    const gain = db(overDb) / peakOf(x);
    const file = analogue(
      x.map((v) => v * gain),
      { channels: 2, seed },
    );
    const copy = db(-2) / peakOf(file);
    const normalised = file.map((v) => Math.round(v * copy * 8388608) / 8388608);
    return [check(file).verdict === 'runs', check(normalised).verdict === 'runs'] as const;
  }),
);
row('Howler', (overDb) => howler[OVERDRIVES.indexOf(overDb)]!.map(([file]) => file));
row('Howler, normalised', (overDb) => howler[OVERDRIVES.indexOf(overDb)]!.map(([, normalised]) => normalised));
console.log(`\n${((performance.now() - started) / 60000).toFixed(1)} min`);
