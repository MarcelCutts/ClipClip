<script lang="ts">
  /**
   * W10 "Why it sounds worse at home": how loud a bass and its clipping crunch SOUND as you turn
   * the same file down. Pure-tone model from ISO 226:2023; the model, the words and the chart
   * geometry live in lib/headroom/homeVsClub.ts.
   *
   * The chart draws marks in SVG and text in HTML, so type stays one size at any width. A crosshair
   * readout beside the cursor lists both values, placed clear of the lines, the axis title and the
   * "Equal at" label (lib/headroom/readout.ts).
   */
  import {
    BASS_HZ,
    bassPhon,
    CHART,
    CROSSING_DB,
    CRUNCH_BELOW_DB,
    CRUNCH_HZ,
    crunchPhon,
    DEFAULT_SIZES,
    finding,
    LEVEL_RANGE,
    readoutFor,
    START_DB,
    STOPS,
    sentenceFor,
    shownPhon,
    speakLevel,
    worthAnnouncing,
    X_TITLE,
    xFrac,
    yPx,
  } from '../lib/headroom/homeVsClub';
  import { READOUT_GAP } from '../lib/headroom/readout';
  import Fader from './ui/Fader.svelte';
  import Pad from './ui/Pad.svelte';

  const { min: MIN_DB, max: MAX_DB } = LEVEL_RANGE;
  const PLOT_H = CHART.plot.height;

  const uid = $props.id();
  let level = $state<number>(START_DB);

  /** CSS left for a point on the x axis, relative to the chart box. */
  const left = (db: number) =>
    `calc(${CHART.inset.left}px + (100% - ${CHART.inset.left + CHART.inset.right}px) * ${(xFrac(db) / 100).toFixed(4)})`;

  const line = (fn: (db: number) => number) => {
    const pts: string[] = [];
    for (let db = MIN_DB; db <= MAX_DB + 1e-9; db += 0.5) pts.push(`${xFrac(db).toFixed(2)},${yPx(fn(db)).toFixed(2)}`);
    return pts.join(' ');
  };
  const bassLine = line(bassPhon);
  const crunchLine = line(crunchPhon);

  const bass = $derived(bassPhon(level));
  const crunch = $derived(crunchPhon(level));
  const sentence = $derived(sentenceFor(level));

  // The slider speaks each step's level and both loudnesses (speakLevel). The live region adds the
  // takeaway only on arriving at a named stop, or when the louder sound changes over, once the
  // reader pauses for 400 ms. It starts with the sentence the server rendered, so hydrating
  // announces nothing.
  let announced = $state(sentenceFor(START_DB));
  let settled = START_DB;
  $effect(() => {
    const to = level;
    const timer = setTimeout(() => {
      if (worthAnnouncing(settled, to)) announced = sentenceFor(to);
      settled = to;
    }, 400);
    return () => clearTimeout(timer);
  });

  // The crosshair readout: louder first, so the rows sit in the same order as the dots. Its spot
  // comes from measured sizes once the chart is on screen (the server lays out for a phone).
  let chartW = $state(DEFAULT_SIZES.width);
  let readoutW = $state(DEFAULT_SIZES.readout.w);
  let readoutH = $state(DEFAULT_SIZES.readout.h);
  let titleW = $state(DEFAULT_SIZES.title.w);
  let titleH = $state(DEFAULT_SIZES.title.h);
  let equalW = $state(DEFAULT_SIZES.equal.w);
  let equalH = $state(DEFAULT_SIZES.equal.h);
  const place = $derived(
    readoutFor(level, {
      width: chartW,
      readout: { w: readoutW, h: readoutH },
      title: { w: titleW, h: titleH },
      equal: { w: equalW, h: equalH },
    }),
  );
  // Beside the cursor, the box's x follows the cursor in CSS like every other label, so the server
  // render is right at any width. Only the centred spot (narrow charts, far right) needs px.
  const readoutLeft = $derived(
    place.side === 'centre' ? `${place.x}px` : `calc(${left(level)} ${place.side === 'before' ? '-' : '+'} ${READOUT_GAP}px)`,
  );
  const rows = $derived.by(() => {
    const shown = shownPhon(level);
    const all = [
      { id: 'bass', name: 'Bass', value: shown.bass },
      { id: 'crunch', name: 'Crunch', value: shown.crunch },
    ];
    return shown.crunch > shown.bass ? [all[1]!, all[0]!] : all;
  });

  // Scrub along the chart with a pointer, as well as with the slider. A mouse sets the level at
  // once. A finger has to tap or drag sideways first, so scrolling past the chart changes nothing.
  let plot = $state<HTMLDivElement | null>(null);
  let press: { id: number; x: number; y: number; scrubbing: boolean } | null = null;
  const onDown = (e: PointerEvent) => {
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, scrubbing: e.pointerType === 'mouse' };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (press.scrubbing) scrubTo(e.clientX);
  };
  const onMove = (e: PointerEvent) => {
    if (!press || press.id !== e.pointerId) return;
    if (!press.scrubbing) {
      const dx = Math.abs(e.clientX - press.x);
      const dy = Math.abs(e.clientY - press.y);
      if (dx < 6 || dx < dy) return;
      press.scrubbing = true;
    }
    scrubTo(e.clientX);
  };
  const onUp = (e: PointerEvent) => {
    if (!press || press.id !== e.pointerId) return;
    const tap = Math.abs(e.clientX - press.x) < 6 && Math.abs(e.clientY - press.y) < 6;
    if (!press.scrubbing && tap) scrubTo(e.clientX);
    press = null;
  };
  const scrubTo = (clientX: number) => {
    if (!plot) return;
    const box = plot.getBoundingClientRect();
    const f = (clientX - box.left) / box.width;
    level = Math.round(Math.max(MIN_DB, Math.min(MAX_DB, MIN_DB + f * (MAX_DB - MIN_DB))));
  };

  const round = Math.round;
  const chartLabel = `Line chart. As the bass level drops from ${MAX_DB} to ${MIN_DB} dB, the bass falls from ${round(
    bassPhon(MAX_DB),
  )} to ${round(bassPhon(MIN_DB))} phon, but the crunch only from ${round(crunchPhon(MAX_DB))} to ${round(
    crunchPhon(MIN_DB),
  )}. They sound equally loud at about ${round(CROSSING_DB)} dB. Below that, the crunch sounds louder.`;
</script>

<figure class="panel home-vs-club" aria-labelledby="{uid}-title">
  <figcaption class="title" id="{uid}-title">{finding()}</figcaption>

  <ul class="key" aria-label="Key">
    <li><span class="swatch sig" aria-hidden="true"></span><span><strong>Bass</strong> at {BASS_HZ}&nbsp;Hz, the kick and bassline</span></li>
    <li>
      <span class="swatch dmg" aria-hidden="true"></span><span
        ><strong>Crunch</strong> from clipping, one tone at {CRUNCH_HZ / 1000}&nbsp;kHz, {CRUNCH_BELOW_DB}&nbsp;dB quieter in the
        file</span
      >
    </li>
  </ul>

  <div class="layout">
    <div class="main">
      <div
        class="chart screen"
        style:--plot-top="{CHART.plot.top}px"
        style:--plot-height="{PLOT_H}px"
        style:--inset-left="{CHART.inset.left}px"
        style:--inset-right="{CHART.inset.right}px"
        style:height="{CHART.plot.top + PLOT_H + CHART.axisHeight}px"
        bind:offsetWidth={chartW}
        role="img"
        aria-label={chartLabel}
      >
        <span
          class="axis-title"
          style:left="{CHART.title.x}px"
          style:top="{CHART.title.y}px"
          bind:offsetWidth={titleW}
          bind:offsetHeight={titleH}
          aria-hidden="true">How loud it sounds (phon)</span
        >
        {#each CHART.grid as phon (phon)}
          <span class="ytick" style:top="{CHART.plot.top + yPx(phon)}px" aria-hidden="true">{phon}</span>
        {/each}

        <div
          class="plot"
          bind:this={plot}
          onpointerdown={onDown}
          onpointermove={onMove}
          onpointerup={onUp}
          onpointercancel={() => (press = null)}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 {PLOT_H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {#each CHART.grid as phon (phon)}
              <line class="grid" x1="0" x2="100" y1={yPx(phon)} y2={yPx(phon)} />
            {/each}
            <line class="divider" x1={xFrac(CROSSING_DB)} x2={xFrac(CROSSING_DB)} y1="0" y2={PLOT_H} />
            <polyline class="series crunch" points={crunchLine} />
            <polyline class="series bass" points={bassLine} />
            <line class="cursor" x1={xFrac(level)} x2={xFrac(level)} y1="0" y2={PLOT_H} />
            <path class="dot-ring" d="M{xFrac(level)} {yPx(crunch)}h0" />
            <path class="dot crunch" d="M{xFrac(level)} {yPx(crunch)}h0" />
            <path class="dot-ring" d="M{xFrac(level)} {yPx(bass)}h0" />
            <path class="dot bass" d="M{xFrac(level)} {yPx(bass)}h0" />
          </svg>
        </div>

        <span
          class="equal"
          style:left={left(CROSSING_DB)}
          style:top="{CHART.plot.top + PLOT_H - CHART.equal.up}px"
          style:--dx="{CHART.equal.dx}px"
          bind:offsetWidth={equalW}
          bind:offsetHeight={equalH}
          aria-hidden="true"><span>Equal at</span><span>{round(CROSSING_DB)}&nbsp;dB</span></span
        >

        <div
          class="readout"
          style:left={readoutLeft}
          style:translate={place.side === 'before' ? '-100% 0' : undefined}
          style:top="{place.y}px"
          bind:offsetWidth={readoutW}
          bind:offsetHeight={readoutH}
          aria-hidden="true"
        >
          {#each rows as r (r.id)}
            <span class="line-key {r.id}"></span><span class="name">{r.name}</span><span class="value">{r.value}</span>
          {/each}
        </div>

        {#each STOPS as s (s.id)}
          <span class="xtick" style:left={left(s.db)} aria-hidden="true"
            ><span class="num">{s.db}&nbsp;dB</span><span class="name">{s.name}</span></span
          >
        {/each}
        <span class="x-title" aria-hidden="true">{X_TITLE}</span>
      </div>

      <div class="controls">
        <!-- A plain slot, no lit travel: the chart's cursor already marks the level. -->
        <Fader
          id="{uid}-level"
          label="How loud you’re listening"
          plain
          bind:value={level}
          min={MIN_DB}
          max={MAX_DB}
          format={(v) => `bass at ${v} dB`}
          speak={speakLevel}
          zones={[]}
          inset={[`${CHART.inset.left}px`, `${CHART.inset.right}px`]}
        />
        <fieldset class="stops">
          <legend class="visually-hidden">Listening levels</legend>
          {#each STOPS as s (s.id)}
            <Pad pressed={level === s.db} onclick={() => (level = s.db)}>{s.name}</Pad>
          {/each}
        </fieldset>
      </div>
    </div>

    <div class="side">
      <p class="takeaway" aria-hidden="true">{sentence}</p>
      <p class="visually-hidden" aria-live="polite">{announced}</p>

      <details class="numbers">
        <summary>Show the numbers</summary>
        <table>
          <caption class="visually-hidden">How loud the bass and the crunch sound, in phon, at three listening levels</caption>
          <thead>
            <tr><th scope="col">Listening level</th><th scope="col">Bass (phon)</th><th scope="col">Crunch (phon)</th></tr>
          </thead>
          <tbody>
            {#each STOPS as s (s.id)}
              <tr>
                <th scope="row">{s.name}, bass at {s.db}&nbsp;dB</th>
                <td>{bassPhon(s.db).toFixed(1)}</td>
                <td>{crunchPhon(s.db).toFixed(1)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </details>

      <ul class="notes">
        <li>Pure-tone model from ISO 226:2023 (equal-loudness contours). Real music is more complex, but the direction holds.</li>
        <li>
          Most phone and laptop speakers play little or nothing at {BASS_HZ}&nbsp;Hz, so on them the bass drops further
          still.
        </li>
        <li>
          <strong>Phon</strong> measures how loud a tone seems, as the level of a 1&nbsp;kHz tone that sounds just as loud.
        </li>
      </ul>
    </div>
  </div>
</figure>

<style>
  .home-vs-club {
    container-type: inline-size;
    display: grid;
    gap: 0.9rem;
    margin: 0;
  }

  .title {
    font-size: var(--text-base);
    font-weight: 700;
    line-height: 1.3;
    color: var(--hw-bright);
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-xs);
    line-height: 1.35;
    color: var(--hw-label-2);
  }

  .key li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .key strong {
    color: var(--hw-label);
    font-weight: 700;
  }

  .swatch {
    flex: none;
    width: 1.1rem;
    height: 0;
    border-top: 3px solid;
    translate: 0 -0.2em;
  }

  .swatch.sig {
    border-color: var(--sig);
  }

  .swatch.dmg {
    border-color: var(--dmg);
    border-top-style: dashed;
  }

  .layout {
    display: grid;
    gap: 1rem;
  }

  .main {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }

  /* ---- Chart ---- */

  .chart {
    position: relative;
    font-size: 0.75rem;
    line-height: 1.15;
    color: var(--screen-text);
  }

  /* Labels laid over the plot let the pointer through to it, so scrubbing works everywhere. */
  .axis-title,
  .ytick,
  .equal,
  .readout,
  .xtick,
  .x-title {
    pointer-events: none;
  }

  /* Under the tick names, centred on the plot, like the y axis's title over its ticks. */
  .x-title {
    position: absolute;
    left: var(--inset-left);
    right: var(--inset-right);
    bottom: 0.3rem;
    font-weight: 700;
    text-align: center;
    text-wrap: balance;
  }

  .axis-title {
    position: absolute;
    font-weight: 700;
    white-space: nowrap;
  }

  .ytick {
    position: absolute;
    left: 0;
    width: calc(var(--inset-left) - 8px);
    text-align: right;
    translate: 0 -50%;
    font-variant-numeric: tabular-nums;
  }

  .plot {
    position: absolute;
    top: var(--plot-top);
    left: var(--inset-left);
    right: var(--inset-right);
    height: var(--plot-height);
    cursor: ew-resize;
    touch-action: pan-y;
  }

  .plot svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .grid {
    stroke: var(--screen-grid);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .divider {
    stroke: var(--screen-axis);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .series {
    fill: none;
    stroke-width: 2.25;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .series.bass,
  .dot.bass {
    stroke: var(--sig);
  }

  .series.crunch,
  .dot.crunch {
    stroke: var(--dmg);
  }

  /* Dashed as well as red, so the crunch is told apart without colour. The dots stay solid. */
  .series.crunch {
    stroke-dasharray: 4 3;
  }

  .cursor {
    stroke: color-mix(in oklab, var(--screen-text) 70%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .dot,
  .dot-ring {
    fill: none;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .dot {
    stroke-width: 10;
  }

  .dot-ring {
    stroke: var(--screen);
    stroke-width: 14;
  }

  /* At the foot of the divider, inside the bass-louder zone: both lines are far above it there. */
  .equal {
    position: absolute;
    translate: var(--dx) -100%;
    display: grid;
    padding: 0.1rem 0.25rem;
    background: color-mix(in oklab, var(--screen) 82%, transparent);
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
    color: var(--screen-text);
  }

  /* The crosshair readout: both values at the cursor, louder first. */
  .readout {
    position: absolute;
    width: max-content;
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: center;
    column-gap: 0.35rem;
    row-gap: 0.1rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--screen-axis);
    border-radius: var(--radius-control);
    background: color-mix(in oklab, var(--screen) 90%, transparent);
    font-weight: 700;
    white-space: nowrap;
    color: var(--hw-label);
  }

  .readout .value {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--hw-bright);
  }

  .line-key {
    width: 0.75rem;
    height: 0;
    border-top: 3px solid;
  }

  .line-key.bass {
    border-color: var(--sig);
  }

  .line-key.crunch {
    border-color: var(--dmg);
    border-top-style: dashed;
  }

  .xtick {
    position: absolute;
    top: calc(var(--plot-top) + var(--plot-height) + 0.45rem);
    translate: -50% 0;
    width: max-content;
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    text-align: center;
  }

  .xtick::before {
    content: '';
    position: absolute;
    top: -0.45rem;
    left: 50%;
    width: 1px;
    height: 0.3rem;
    background: var(--screen-axis);
  }

  .xtick .num {
    white-space: nowrap;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label);
  }

  .xtick .name {
    max-width: 5.5rem;
    text-wrap: balance;
  }

  /* ---- Controls ---- */

  .controls {
    display: grid;
    gap: 0.5rem;
  }

  /* Three listening levels, three keys in a row, even on a phone. */
  .stops {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .stops :global(.pad) {
    justify-content: center;
    padding-inline: 0.4rem;
    text-align: center;
  }

  /* ---- Words ---- */

  .side {
    display: grid;
    align-content: start;
    gap: 0.85rem;
  }

  .takeaway {
    margin: 0;
    font-size: var(--text-lede);
    font-weight: 700;
    line-height: 1.3;
    text-wrap: balance;
    color: var(--hw-bright);
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
    padding: 0.35rem 0.5rem 0.35rem 0;
    border-bottom: 1px solid var(--hw-edge);
    text-align: left;
    font-weight: 400;
  }

  td {
    white-space: nowrap;
    text-align: right;
    font-weight: 700;
    color: var(--hw-bright);
  }

  thead th:not(:first-child) {
    text-align: right;
  }

  thead th {
    font-weight: 700;
    color: var(--hw-label);
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

  .notes strong {
    color: var(--hw-label);
  }

  @container (min-width: 44rem) {
    .layout {
      grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
      align-items: start;
      gap: 1.5rem;
    }

    .side {
      padding-top: 0.25rem;
    }
  }

  /* Forced colours: marks take the user's text colour, and the dashes tell the crunch apart. The
     selectors match the colour rules' own specificity, so they win. */
  @media (forced-colors: active) {
    .series.bass,
    .series.crunch,
    .dot.bass,
    .dot.crunch {
      stroke: CanvasText;
    }

    .dot-ring {
      stroke: Canvas;
    }

    .swatch.sig,
    .swatch.dmg,
    .line-key.bass,
    .line-key.crunch {
      border-color: CanvasText;
    }
  }
</style>
