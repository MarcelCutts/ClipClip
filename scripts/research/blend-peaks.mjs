// How EQ and blends move a track's peak, measured on real tracks. Behind the guide's 2.4, the blend
// lab's LOW, and the note on a LOW cut in src/lib/blend/model.ts.
//
//   node scripts/research/blend-peaks.mjs <folder of tracks> [--start 60] [--seconds 90]
//
// Every file ffmpeg can read in the folder is decoded to 48 kHz stereo float, a stretch from --start
// for --seconds, into a temp folder, never the repo. Each excerpt is scaled to a sample peak of 1, as
// if its channel meter read the same light. Then:
//   A. each band on its own (under 150 Hz, 150 Hz to 2.5 kHz, over 2.5 kHz): its peak and energy share;
//   B. +6 dB on one band, across plausible EQ shapes (Pioneer publishes only the range: LOW at 20 Hz,
//      MID at 1 kHz, HI at 20 kHz), and how far each lifts the track's peak;
//   C. every ordered pair blended for 60 s, beatmatched: the second track resampled to the first's
//      tempo, its beat grid on the first's, both faders up. The loudest sample of the sum against the
//      louder track, and what one move on the second track does to it;
//   D. the same blends with the second track a half and a quarter beat late;
//   E. each track with its lows taken out, with a normal EQ and with the same cut run both ways
//      (zero phase), to see whether the peak moves because of phase or because of the lows.
// Peaks are sample peaks. EQs are RBJ biquads; crossovers are 4th-order Linkwitz-Riley.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 48_000;
const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith('--'));
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
if (!folder) {
  console.error('Usage: node scripts/research/blend-peaks.mjs <folder of tracks> [--start 60] [--seconds 90]');
  process.exit(1);
}
const START = option('start', 60);
const SECONDS = option('seconds', 90);

// ---- Decoding ---------------------------------------------------------------------------------

function decode(file, dir, n) {
  const out = join(dir, `${n}.f32`);
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-ss',
    String(START),
    '-t',
    String(SECONDS),
    '-i',
    file,
    '-ac',
    '2',
    '-ar',
    String(SR),
    '-f',
    'f32le',
    out,
  ]);
  const b = readFileSync(out);
  const x = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const len = x.length / 2;
  const L = new Float64Array(len);
  const R = new Float64Array(len);
  let p = 0;
  for (let i = 0; i < len; i++) {
    L[i] = x[2 * i];
    R[i] = x[2 * i + 1];
    p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  }
  for (let i = 0; i < len; i++) {
    L[i] /= p;
    R[i] /= p;
  }
  return [L, R];
}

// ---- Filters ----------------------------------------------------------------------------------

// RBJ cookbook biquads; shelves at a slope of 1 (Q 0.707).
function biquad(type, f0, gainDb = 0, q = Math.SQRT1_2) {
  const A = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * f0) / SR;
  const cs = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const s = 2 * Math.sqrt(A) * alpha;
  const c = {
    lp: [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + alpha, -2 * cs, 1 - alpha],
    hp: [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + alpha, -2 * cs, 1 - alpha],
    peak: [1 + alpha * A, -2 * cs, 1 - alpha * A, 1 + alpha / A, -2 * cs, 1 - alpha / A],
    lowshelf: [
      A * (A + 1 - (A - 1) * cs + s),
      2 * A * (A - 1 - (A + 1) * cs),
      A * (A + 1 - (A - 1) * cs - s),
      A + 1 + (A - 1) * cs + s,
      -2 * (A - 1 + (A + 1) * cs),
      A + 1 + (A - 1) * cs - s,
    ],
    highshelf: [
      A * (A + 1 + (A - 1) * cs + s),
      -2 * A * (A - 1 + (A + 1) * cs),
      A * (A + 1 + (A - 1) * cs - s),
      A + 1 - (A - 1) * cs + s,
      2 * (A - 1 - (A + 1) * cs),
      A + 1 - (A - 1) * cs - s,
    ],
  }[type];
  const [b0, b1, b2, a0, a1, a2] = c;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function run(c, x) {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = c[0] * v + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = o;
    y[i] = o;
  }
  return y;
}
const chain = (x, cs) => cs.reduce((s, c) => run(c, s), x);
const stereo = (x, cs) => x.map((ch) => chain(ch, cs));
const lr4 = (type, f) => [biquad(type, f), biquad(type, f)];
/** The same filters forwards then backwards: the magnitude twice over, and no phase shift. */
const zeroPhase = (x, cs) => chain(chain(x, cs).reverse(), cs).reverse();

// ---- Measures ---------------------------------------------------------------------------------

const peakOf = (chs, from = 0, to = Infinity) => {
  let p = 0;
  for (const c of chs) for (let i = from; i < Math.min(to, c.length); i++) p = Math.max(p, Math.abs(c[i]));
  return p;
};
const energy = (chs) => chs.reduce((e, c) => e + c.reduce((s, v) => s + v * v, 0), 0);
const db = (r) => 20 * Math.log10(r);
/** A percentile by linear interpolation: the 0.5 of an even count is the mean of the middle two. */
const pct = (a, f) => {
  const s = [...a].sort((x, y) => x - y);
  const i = f * (s.length - 1);
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
};
const f1 = (v) => v.toFixed(1).padStart(5);
const summary = (a) =>
  `median ${f1(pct(a, 0.5))}, 10–90% ${f1(pct(a, 0.1))} to ${f1(pct(a, 0.9))}, worst ${f1(Math.max(...a))}`;

// ---- Beat grids ---------------------------------------------------------------------------------

// Onsets of the low band, a coarse beat period by autocorrelation (80 to 180 BPM), then a line fitted
// through the strongest onset near each predicted beat.
function beatGrid([L, R]) {
  const low = chain(
    Float64Array.from(L, (v, i) => (v + R[i]) / 2),
    lr4('lp', 150),
  );
  const win = Math.round(0.005 * SR);
  const env = new Float64Array(low.length);
  let acc = 0;
  for (let i = 0; i < low.length; i++) {
    acc += Math.abs(low[i]);
    if (i >= win) acc -= Math.abs(low[i - win]);
    env[i] = acc / win;
  }
  const on = new Float64Array(low.length);
  for (let i = win; i < low.length; i++) on[i] = Math.max(0, env[i] - env[i - win]);
  const D = 48;
  const o = Float64Array.from({ length: Math.floor(on.length / D) }, (_, k) => {
    let s = 0;
    for (let j = 0; j < D; j++) s += on[k * D + j];
    return s;
  });
  let best = 0;
  let P = 0;
  for (let lag = 333; lag <= 750; lag++) {
    let s = 0;
    for (let i = 0; i + lag < o.length; i++) s += o[i] * o[i + lag];
    if (s > best) [best, P] = [s, lag];
  }
  let phase = 0;
  let bestPhase = -1;
  for (let ph = 0; ph < P; ph++) {
    let s = 0;
    for (let t = ph; t < o.length; t += P) s += o[t];
    if (s > bestPhase) [bestPhase, phase] = [s, ph];
  }
  const points = [];
  for (let n = 0; phase + n * P < o.length - P; n++) {
    const c = (phase + n * P) * D;
    const r = Math.round((P * D) / 8);
    let at = -1;
    let v = 0;
    for (let i = Math.max(win, c - r); i < Math.min(on.length, c + r); i++) if (on[i] > v) [v, at] = [on[i], i];
    if (at >= 0) points.push([n, at, v]);
  }
  const cut = [...points].map((p) => p[2]).sort((a, b) => a - b)[points.length >> 1];
  const strong = points.filter((p) => p[2] >= cut);
  const mn = strong.reduce((s, p) => s + p[0], 0) / strong.length;
  const mt = strong.reduce((s, p) => s + p[1], 0) / strong.length;
  let sxy = 0;
  let sxx = 0;
  for (const [n, t] of strong) {
    sxy += (n - mn) * (t - mt);
    sxx += (n - mn) ** 2;
  }
  const period = sxy / sxx;
  return { period, t0: mt - period * mn, bpm: (60 * SR) / period };
}

/** Catmull-Rom read of x at a fractional index. */
function at(x, f) {
  const i = Math.floor(f);
  const u = f - i;
  const [p0, p1, p2, p3] = [x[i - 1] ?? 0, x[i] ?? 0, x[i + 1] ?? 0, x[i + 2] ?? 0];
  return p1 + 0.5 * u * (p2 - p0 + u * (2 * p0 - 5 * p1 + 4 * p2 - p3 + u * (3 * (p1 - p2) + p3 - p0)));
}

// ---- Run ----------------------------------------------------------------------------------------

const files = readdirSync(folder)
  .filter((f) => !f.startsWith('.'))
  .map((f) => join(folder, f));
const dir = mkdtempSync(join(tmpdir(), 'blend-peaks-'));
let tracks;
try {
  tracks = files.map((f, n) => decode(f, dir, n));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${tracks.length} tracks, ${SECONDS} s each from ${START} s, each scaled to a sample peak of 1.\n`);

console.log('A. Each band alone: its peak against the whole track, and its share of the energy');
const bands = {
  'under 150 Hz': lr4('lp', 150),
  '150 Hz to 2.5 kHz': [...lr4('hp', 150), ...lr4('lp', 2500)],
  'over 2.5 kHz': lr4('hp', 2500),
};
const split = tracks.map((x) => Object.fromEntries(Object.entries(bands).map(([k, cs]) => [k, stereo(x, cs)])));
for (const k of Object.keys(bands)) {
  const peaks = split.map((b) => db(peakOf(b[k])));
  const shares = split.map((b) => (100 * energy(b[k])) / Object.values(b).reduce((s, v) => s + energy(v), 0));
  console.log(`  ${k.padEnd(18)} peak ${summary(peaks)} dB | energy median ${pct(shares, 0.5).toFixed(0)} %`);
}

console.log('\nB. +6 dB on one band: how far the track’s peak rises (dB)');
for (const [name, c] of [
  ['LOW shelf from 50 Hz', biquad('lowshelf', 50, 6)],
  ['LOW shelf from 70 Hz', biquad('lowshelf', 70, 6)],
  ['LOW shelf from 100 Hz', biquad('lowshelf', 100, 6)],
  ['LOW shelf from 150 Hz', biquad('lowshelf', 150, 6)],
  ['LOW shelf from 250 Hz', biquad('lowshelf', 250, 6)],
  ['MID bell at 1 kHz, Q 0.5', biquad('peak', 1000, 6, 0.5)],
  ['MID bell at 1 kHz, Q 0.7', biquad('peak', 1000, 6, Math.SQRT1_2)],
  ['MID bell at 1 kHz, Q 1.4', biquad('peak', 1000, 6, 1.4)],
  ['HI shelf from 5 kHz', biquad('highshelf', 5000, 6)],
  ['HI shelf from 8 kHz', biquad('highshelf', 8000, 6)],
  ['HI shelf from 13 kHz', biquad('highshelf', 13000, 6)],
]) {
  console.log(`  ${name.padEnd(26)} ${summary(tracks.map((x) => db(peakOf(stereo(x, [c])))))}`);
}

const grids = tracks.map(beatGrid);
const PRE = SR;
const LEN = 60 * SR;
const moves = {
  'none (both flat)': [],
  'fader 3 dB down': [{ gain: 10 ** (-3 / 20) }],
  'fader 6 dB down': [{ gain: 10 ** (-6 / 20) }],
  'LOW fully down, shelf from 70 Hz': [biquad('lowshelf', 70, -26)],
  'LOW fully down, shelf from 150 Hz': [biquad('lowshelf', 150, -26)],
  'LOW isolated out under 150 Hz': lr4('hp', 150),
  'MID fully down': [biquad('peak', 1000, -26)],
  'HI fully down': [biquad('highshelf', 13000, -26)],
};

function blends(offsetBeats, only) {
  const out = Object.fromEntries(Object.keys(moves).map((k) => [k, { peak: [], energy: [], to4: [] }]));
  for (let a = 0; a < tracks.length; a++)
    for (let b = 0; b < tracks.length; b++) {
      if (a === b) continue;
      const [A, B, ga, gb] = [tracks[a], tracks[b], grids[a], grids[b]];
      const r = gb.period / ga.period;
      const na = Math.ceil((3 * SR - ga.t0) / ga.period);
      const nb = Math.ceil((3 * SR - gb.t0) / gb.period);
      const sa = Math.round(ga.t0 + na * ga.period) - PRE;
      const sb = gb.t0 + (nb + offsetBeats) * gb.period - PRE * r;
      if (sa + PRE + LEN > A[0].length || sb + (PRE + LEN) * r + 2 > B[0].length) continue;
      const Bw = B.map((ch) => Float64Array.from({ length: PRE + LEN }, (_, i) => at(ch, sb + i * r)));
      const Aw = A.map((ch) => ch.subarray(sa, sa + PRE + LEN));
      const ref = Math.max(peakOf(Aw, PRE), peakOf(Bw, PRE));
      const eA = energy(Aw.map((c) => c.subarray(PRE)));
      for (const [name, fx] of Object.entries(moves)) {
        if (only && !only.includes(name)) continue;
        const Bm = Bw.map((ch) => fx.reduce((s, f) => (f.gain ? s.map((v) => v * f.gain) : run(f, s)), ch));
        const sum = Aw.map((ch, c) => ch.map((v, i) => v + Bm[c][i]).subarray(PRE));
        out[name].peak.push(db(peakOf(sum) / ref));
        out[name].energy.push(10 * Math.log10(energy(sum) / eA));
        // How soon the blend first passes 4 dB over the louder track, in seconds.
        const over = ref * 10 ** (4 / 20);
        let first = Infinity;
        for (const ch of sum) {
          const k = ch.findIndex((v) => Math.abs(v) > over);
          if (k >= 0) first = Math.min(first, k / SR);
        }
        out[name].to4.push(first);
      }
    }
  return out;
}

console.log(`\nC. Beatmatched 60 s blends of every ordered pair: the sum’s peak above the louder track (dB)`);
const aligned = blends(0);
console.log(
  `   ${aligned['none (both flat)'].peak.length} pairs. Move on the second track, then the energy against the first alone:`,
);
for (const [name, v] of Object.entries(aligned))
  console.log(`  ${name.padEnd(34)} ${summary(v.peak)} | energy ${f1(pct(v.energy, 0.5))} dB`);
const to4 = aligned['none (both flat)'].to4;
const within = (t) => to4.filter((v) => v <= t).length;
console.log(
  `  Both flat, passing +4 dB: within 2 s in ${within(2)} of ${to4.length}, within 10 s in ${within(10)}, never in ${to4.filter((v) => v === Infinity).length}`,
);

console.log('\nD. The same, with the second track late (both flat)');
for (const [label, beats] of [
  ['a half beat late', 0.5],
  ['a quarter beat late', 0.25],
]) {
  console.log(`  ${label.padEnd(34)} ${summary(blends(beats, ['none (both flat)'])['none (both flat)'].peak)}`);
}

console.log('\nE. Each track with its lows out: its own peak against the flat track (dB)');
const shelf = [biquad('lowshelf', 70, -26)];
const half = [biquad('lowshelf', 70, -13)];
const normal = tracks.map((x) => db(peakOf(stereo(x, shelf))));
const zero = tracks.map((x) => db(peakOf(x.map((c) => zeroPhase(c, half)))));
console.log(
  `  LOW −26 dB, shelf from 70 Hz        ${summary(normal)} | higher on ${normal.filter((v) => v > 0.05).length} of ${normal.length}`,
);
console.log(
  `  the same, zero phase                ${summary(zero)} | higher on ${zero.filter((v) => v > 0.05).length} of ${zero.length}`,
);
