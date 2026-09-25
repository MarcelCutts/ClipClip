<script lang="ts">
  /**
   * W6 "Turn it up afterwards": recording low is free on a 24-bit recorder; recording over costs
   * the peaks for good. Visual only: the noise floors here are far below anything a page could
   * play, and clean-against-clipped listening is the lab's job.
   *
   * The model, every number and the title's finding live in lib/headroom/model.ts.
   */
  import { formatDb } from '../lib/dsp/db';
  import { GLOSSARY } from '../lib/glossary';
  import {
    DEFAULT_PEAK_DBFS,
    FLOOR_24_BIT_DBFS,
    finding,
    headroom,
    musicWindow,
    NORMALISE_TO_DBTP,
    peakLabel,
    RECORD_RANGE,
    recordedLevels,
    roomToNoise,
    speakPeak,
    TARGET_BAND,
    takeaway,
    verdictFor,
    waveCaption,
    XDJ_HISS_BELOW_MUSIC_DB,
    XDJ_SN_DB,
    XDJ_STANDARD_BELOW_RATED_DB,
  } from '../lib/headroom/model';
  import Fader from './ui/Fader.svelte';
  import Pad from './ui/Pad.svelte';
  import Ladder from './why/Ladder.svelte';
  import Wave from './why/Wave.svelte';

  const uid = $props.id();
  const music = musicWindow();

  let peak = $state<number>(DEFAULT_PEAK_DBFS);
  let normalised = $state(false);

  const target = $derived(headroom(peak, normalised));

  // The gain on show glides to its new value when Normalise is pressed, so everything in the file
  // visibly moves together. It follows the slider instantly.
  let shownGain = $state(0);
  let frame = 0;
  const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toggleNormalise() {
    normalised = !normalised;
    cancelAnimationFrame(frame);
    frame = 0;
    if (reduceMotion()) {
      shownGain = target.gain;
      return;
    }
    const from = shownGain;
    const start = performance.now();
    // Chase the live target, so moving the slider mid-glide still lands in the right place.
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      shownGain = from + (target.gain - from) * (1 - (1 - k) ** 3);
      frame = k < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }

  $effect(() => {
    const to = target.gain;
    if (!frame) shownGain = to;
  });

  $effect(() => () => cancelAnimationFrame(frame));

  const shown = $derived(recordedLevels(peak, shownGain));
  const asRecorded = $derived(recordedLevels(peak));

  // The slider speaks each step's level and the room it leaves (speakPeak). The live region adds
  // the takeaway only when the verdict changes, or Normalise is pressed, once the reader pauses
  // for 400 ms. It starts with the sentence the server rendered, so hydrating announces nothing.
  const sentence = $derived(takeaway(target));
  const verdict = $derived(verdictFor(target));
  let announced = $state(takeaway(headroom(DEFAULT_PEAK_DBFS, false)));
  let lastVerdict = verdictFor(headroom(DEFAULT_PEAK_DBFS, false));
  $effect(() => {
    const next = { verdict, sentence };
    const timer = setTimeout(() => {
      if (next.verdict !== lastVerdict) announced = next.sentence;
      lastVerdict = next.verdict;
    }, 400);
    return () => clearTimeout(timer);
  });

  const dbfs = (v: number, decimals = 0) => formatDb(v, { decimals, unit: 'dBFS' });
  const dbtp = formatDb(NORMALISE_TO_DBTP, { unit: 'dBTP' });

  // The slider's scale: its two ends, the target for a loud track, and the top of the file.
  const ticks = [RECORD_RANGE.min, TARGET_BAND.ideal, 0, RECORD_RANGE.max].map((at) => ({
    at,
    label: formatDb(at, { unit: '' }),
  }));

  const room = $derived(roomToNoise(target.levels));
  const rows = $derived([
    { what: 'Top of the file', level: dbfs(0) },
    { what: 'Target for a loud track', level: dbfs(TARGET_BAND.ideal) },
    { what: 'Loudest blend, at most', level: dbfs(TARGET_BAND.top) },
    {
      what: target.zone === 'over' ? 'Your peaks, cut flat' : 'Your peaks',
      level:
        target.zone === 'over'
          ? dbfs(target.levels.peaks, target.normalised ? 1 : 0)
          : target.normalised
            ? dbtp
            : dbfs(target.levels.peaks),
    },
    { what: 'XDJ-RX2 hiss', level: `about ${dbfs(target.levels.xdjHiss)}` },
    { what: 'Howler’s own noise (a guess)', level: `${formatDb(target.levels.howlerTop, { unit: '' })} to ${dbfs(target.levels.howlerBottom)}` },
    { what: '24-bit floor', level: dbfs(FLOOR_24_BIT_DBFS) },
  ]);
</script>

<figure class="panel headroom" aria-labelledby="{uid}-title">
  <figcaption class="title" id="{uid}-title">{finding()}</figcaption>

  <div class="layout">
    <div class="controls">
      <Fader
        id="{uid}-peak"
        label="How hot we recorded"
        plain
        bind:value={peak}
        min={RECORD_RANGE.min}
        max={RECORD_RANGE.max}
        step={RECORD_RANGE.step}
        format={peakLabel}
        speak={speakPeak}
        hint="dBFS counts down from the top of the file. 0 is the top, and everything else is minus."
        zones={[
          { from: TARGET_BAND.bottom, to: TARGET_BAND.ideal, tone: 'sig' },
          { from: 0, to: RECORD_RANGE.max, tone: 'dmg' },
        ]}
        {ticks}
      />
      <div class="normalise">
        <Pad pressed={normalised} onclick={toggleNormalise} aria-describedby="{uid}-normalise-hint">Normalise to {dbtp}</Pad>
        <p class="pad-hint" id="{uid}-normalise-hint">{GLOSSARY.normalise.gloss}</p>
      </div>
      <p class="takeaway" aria-hidden="true">{sentence}</p>
      <p class="visually-hidden" aria-live="polite">{announced}</p>
    </div>

    <div class="wave-area">
      <Wave {music} {peak} gain={shownGain} zone={target.zone} caption={waveCaption(target)} />
    </div>

    <div class="ladder-area">
      <Ladder levels={shown} {asRecorded} gain={shownGain} {normalised} zone={target.zone} lost={target.lost} />
      <p class="caption">Each notch is 6&nbsp;dB, one bit of the 24.</p>
    </div>

    <div class="facts">
      <details class="numbers">
        <summary>Show the numbers</summary>
        <table>
          <caption class="visually-hidden">Levels in the file, dBFS</caption>
          <tbody>
            {#each rows as r (r.what)}
              <tr><th scope="row">{r.what}</th><td>{r.level}</td></tr>
            {/each}
            <tr>
              <th scope="row">Room down to the nearest noise</th>
              <td>
                {Math.round(room.min) === Math.round(room.max)
                  ? `about ${formatDb(room.max, { signed: false })}`
                  : `${Math.round(room.min)} to ${formatDb(room.max, { signed: false })}`}
              </td>
            </tr>
          </tbody>
        </table>
      </details>
      <ul class="notes">
        <li>
          Pioneer quotes {XDJ_SN_DB}&nbsp;dB signal-to-noise at “rated output”, A-weighted. We read that as its maximum. On
          the master outputs the standard level sits {XDJ_STANDARD_BELOW_RATED_DB}&nbsp;dB under that, so the hiss rides
          about {XDJ_HISS_BELOW_MUSIC_DB}&nbsp;dB under the music. Trimming the recording with MASTER ATT may bring it
          closer, and it stays far below anything you’d hear.
        </li>
        <li>Howler doesn’t publish its noise floor. The shaded range is our guess, deliberately wide.</li>
        <li>dBTP counts the peaks between samples too. Those can clip when the file becomes an MP3.</li>
      </ul>
    </div>
  </div>
</figure>

<style>
  .headroom {
    container-type: inline-size;
    display: grid;
    gap: 1rem;
    margin: 0;
  }

  .title {
    font-size: var(--text-base);
    font-weight: 700;
    line-height: 1.3;
    text-wrap: balance;
    color: var(--hw-bright);
  }

  .layout {
    display: grid;
    gap: 1rem;
    grid-template-areas:
      'controls'
      'wave'
      'ladder'
      'facts';
  }

  .controls {
    grid-area: controls;
    display: grid;
    gap: 0.75rem;
    align-content: start;
  }

  .normalise {
    display: grid;
    justify-items: start;
    gap: 0.3rem;
  }

  .pad-hint,
  .caption {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--hw-label-2);
  }

  .takeaway {
    margin: 0;
    font-size: var(--text-lede);
    font-weight: 700;
    line-height: 1.3;
    text-wrap: balance;
    color: var(--hw-bright);
  }

  .wave-area {
    grid-area: wave;
  }

  .ladder-area {
    grid-area: ladder;
    display: grid;
    align-content: start;
    gap: 0.35rem;
  }

  .facts {
    grid-area: facts;
    display: grid;
    gap: 0.6rem;
    align-content: start;
  }

  .numbers {
    font-size: var(--text-sm);
  }

  /* A chevron that turns when open, as in the two-ceilings lab, so the summary reads as a control. */
  .numbers summary {
    cursor: pointer;
    min-height: 2.75rem;
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    color: var(--hw-label);
    list-style: none;
  }

  .numbers summary::-webkit-details-marker {
    display: none;
  }

  .numbers summary::before {
    content: '';
    width: 0.45rem;
    height: 0.45rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    rotate: -45deg;
    translate: 0 -0.05rem;
  }

  .numbers[open] summary::before {
    rotate: 45deg;
    translate: 0 -0.2rem;
  }

  .numbers summary:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
    border-radius: var(--radius-control);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--hw-edge);
    text-align: left;
    font-weight: 400;
  }

  td {
    text-align: right;
    white-space: nowrap;
    padding-left: 1rem;
    font-weight: 700;
    color: var(--hw-bright);
  }

  .notes {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--hw-label-2);
  }

  @container (min-width: 44rem) {
    .layout {
      grid-template-columns: minmax(19rem, 0.95fr) minmax(0, 1fr);
      grid-template-areas:
        'ladder controls'
        'ladder wave'
        'ladder facts';
      grid-template-rows: auto auto 1fr;
      column-gap: 1.5rem;
    }
  }
</style>
