<script lang="ts">
  /**
   * Where each thing the night can play lands in the Howler's file, in dBFS, at the current
   * setting: what a test recording opened in an editor would show. One knob moves all three
   * together, 6 dB apart, so the job is to fit the whole night into the target band. The caption
   * says what the chart shows: whether they fit, and if not, which one doesn't.
   *
   * Two drawings of the same scale, and CSS shows one: a tall ladder beside the rig on a wide
   * panel, and a strip on phones, under the controls, with what's playing spelled out above it.
   * The strip names each peak and gives its value above its dot; on the client the labels are
   * measured and spread so they never overlap or run off the screen.
   */
  import { formatDb } from '../../lib/dsp/db';
  import { fileFinding, spreadLabels } from '../../lib/record/ladder';
  import { type MaterialId, material, TARGET } from '../../lib/record/model';

  interface Props {
    peaks: { id: MaterialId; dbfs: number }[];
    playing: MaterialId | null;
  }

  let { peaks, playing }: Props = $props();

  /** The scale runs from 6 dB over the top down to −42 dBFS: every setting the rig allows. */
  const TOP = 6;
  const BOTTOM = -42;
  const TICKS = [0, -6, -12, -18, -24, -30, -36, -42];
  /** The strip is short on room, so it marks every other line. */
  const STRIP_TICKS = [0, -12, -24, -36];
  /** Its numbers stop short of the zones, which are named instead: every dot carries its own value. */
  const STRIP_NUMS = [-24, -36];
  /** How far down the scale a level sits, 0 at the top and 1 at the bottom. */
  const at = (db: number) => ((TOP - Math.max(BOTTOM, Math.min(TOP, db))) / (TOP - BOTTOM)).toFixed(4);
  /** How far along the strip a level sits, 0 at the quiet end and 1 at the loud end. */
  const along = (db: number) => 1 - Number(at(db));
  const middle = (a: number, b: number) => at((a + b) / 2);

  const tick = (db: number) => formatDb(db, { unit: '', signed: false });
  const value = (db: number) => formatDb(db, { unit: '', signed: true });
  const silent = $derived(peaks.every((p) => !Number.isFinite(p.dbfs)));
  const shown = $derived(peaks.filter((p) => Number.isFinite(p.dbfs)));
  /** The strip's labels, quiet end first, as they sit along it. */
  const ordered = $derived([...shown].sort((a, b) => a.dbfs - b.dbfs));
  const now = $derived(peaks.find((p) => p.id === playing) ?? null);
  const finding = $derived(fileFinding(peaks));

  // The strip's labels, measured once they're on screen. Until then, and on the server, each sits
  // at its dot and leans inwards at the ends (its anchor slides along it), so none leaves the strip.
  let stripWidth = $state(0);
  let barWidth = $state(0);
  let labelWidths = $state<number[]>([]);
  const centres = $derived.by(() => {
    const widths = labelWidths.slice(0, ordered.length);
    if (barWidth === 0 || widths.length < ordered.length || widths.some((w) => !w)) return null;
    // The labels may use the strip's inset at either end, but not the last few pixels of it.
    const inset = Math.max(0, (stripWidth - barWidth) / 2 - 3);
    return spreadLabels(
      ordered.map((p) => along(p.dbfs) * barWidth),
      widths,
      -inset,
      barWidth + inset,
      6,
    );
  });

  const where = (dbfs: number) =>
    dbfs > 0
      ? `${formatDb(dbfs, { signed: false })} over the top, clipped`
      : dbfs === 0
        ? 'right at the top, clipped'
        : formatDb(dbfs, { unit: 'dBFS' });

  const summary = $derived.by(() => {
    if (silent) return 'Peaks in the file: none. MASTER LEVEL is off, so nothing reaches the file.';
    const parts = peaks.map(({ id, dbfs }) => `${material(id).name}: ${where(dbfs)}`);
    return `Peaks in the file. ${parts.join('. ')}. The target band runs from ${formatDb(TARGET.band.bottom, { unit: 'dBFS' })} to ${formatDb(TARGET.band.top, { unit: 'dBFS' })}, with loud tracks around ${formatDb(TARGET.normal, { unit: 'dBFS' })}.`;
  });

  /** The strip's headline: what's playing, and where it lands. */
  const headline = $derived.by(() => {
    if (silent) return 'nothing reaches it';
    if (!now || !Number.isFinite(now.dbfs)) return null;
    const m = material(now.id).short;
    if (now.dbfs > 0) return `${m} ${formatDb(now.dbfs, { signed: false })} over the top`;
    if (now.dbfs === 0) return `${m} right at the top`;
    return `${m} at ${formatDb(now.dbfs, { unit: 'dBFS' })}`;
  });
</script>

<figure class="ladder">
  <figcaption class="title">
    In the file<span class="unit">{' '}(dBFS)</span>{#if headline}<span class="headline">: {headline}</span>{/if}
    <span class="finding">{finding}</span>
  </figcaption>

  <!-- Wide panel: the tall ladder. -->
  <div class="screen plot tall" role="img" aria-label={summary}>
    <div class="scale">
      <!-- "Over", as in over the top: the band is only 6 dB tall, too short for a longer word
           on a phone. The text alternative says "clipped" in full. -->
      <div class="zone clip" style:--from={at(TOP)} style:--to={at(0)}><span class="zone-label">Over</span></div>
      <div class="zone band" style:--from={at(TARGET.band.top)} style:--to={at(TARGET.band.bottom)}>
        <span class="zone-label">Target</span>
      </div>
      {#each TICKS as t (t)}
        <div class="tick" class:ceiling={t === 0} class:aim={t === TARGET.normal} style:--at={at(t)}>
          <span class="num">{tick(t)}</span>
        </div>
      {/each}
      {#each shown as p (p.id)}
        <div class="peak" class:on={p.id === playing} style:--at={at(p.dbfs)}>
          <span class="dot" data-on={p.id === playing || undefined} data-hot={p.dbfs >= 0 || undefined}></span>
          <span class="label"><b>{value(p.dbfs)}</b> {material(p.id).short}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Phones: the same scale on its side, louder to the right. Each dot's name and value sit above
       it; the zones are named below. -->
  <div class="screen plot strip" role="img" aria-label={summary} bind:clientWidth={stripWidth}>
    <div class="labels" aria-hidden="true">
      {#each ordered as p, i (p.id)}
        <span
          class="mark"
          class:on={p.id === playing}
          bind:clientWidth={labelWidths[i]}
          style:left={centres ? `${centres[i]}px` : `${along(p.dbfs) * 100}%`}
          style:translate={centres ? '-50% 0' : `${-along(p.dbfs) * 100}% 0`}
        >
          <span class="name">{material(p.id).short}</span>
          <span class="value">{value(p.dbfs)}</span>
        </span>
      {/each}
    </div>
    <div class="bar" bind:clientWidth={barWidth}>
      <div class="zone clip" style:--from={at(TOP)} style:--to={at(0)}></div>
      <div class="zone band" style:--from={at(TARGET.band.top)} style:--to={at(TARGET.band.bottom)}></div>
      {#each STRIP_TICKS as t (t)}
        <div class="tick" class:ceiling={t === 0} style:--at={at(t)}></div>
      {/each}
      {#each shown as p (p.id)}
        <span
          class="dot"
          data-on={p.id === playing || undefined}
          data-hot={p.dbfs >= 0 || undefined}
          style:--at={at(p.dbfs)}
        ></span>
      {/each}
    </div>
    <div class="nums" aria-hidden="true">
      {#each STRIP_NUMS as t (t)}
        <span class="num" style:--at={at(t)}>{tick(t)}</span>
      {/each}
      <span class="num zone-name" style:--at={middle(TARGET.band.top, TARGET.band.bottom)}>Target</span>
      <span class="num zone-name" style:--at={middle(TOP, 0)}>Over</span>
    </div>
  </div>
  <p class="note">What a test recording shows</p>
</figure>

<style>
  .ladder {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
    margin: 0;
  }

  .title,
  .note {
    font-size: var(--text-xs);
    line-height: 1.25;
    color: var(--hw-label-2);
  }

  .title {
    font-weight: 700;
    color: var(--hw-label);
  }

  .unit {
    font-weight: 400;
    color: var(--hw-label-2);
  }

  .headline {
    color: var(--hw-bright);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* What the chart shows, in a sentence: under the title, in the panel's own words colour. */
  .finding {
    display: block;
    margin-top: 0.2rem;
    font-weight: 400;
    color: var(--hw-label);
  }

  /* The headline carries its own unit. */
  .title:has(.headline) .unit {
    display: none;
  }

  .note {
    display: none;
    margin: 0;
  }

  .plot {
    position: relative;
    font-size: 0.75rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .clip {
    background: color-mix(in oklab, var(--dmg) 16%, transparent);
  }

  .band {
    background: color-mix(in oklab, var(--screen-text) 14%, transparent);
  }

  /* A ring in the screen's own black keeps the gridlines off each mark. */
  .dot {
    flex: none;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 2px solid var(--sig);
    background: var(--screen);
    outline: 2px solid var(--screen);
  }

  /* ---------------------------------------------------------------------------------------------
   * The strip (phones)
   * ------------------------------------------------------------------------------------------- */

  .strip {
    --inset: 1rem;
    display: grid;
    gap: 0.3rem;
    padding: 0.45rem var(--inset) 0.4rem;
  }

  .labels,
  .nums,
  .bar {
    position: relative;
  }

  /* Two lines: the name, and its value over the dot. */
  .labels {
    height: 1.7rem;
  }

  .nums {
    height: 0.8rem;
  }

  /* Louder to the right, like a meter lying down. */
  .nums .num,
  .strip .dot,
  .strip .tick {
    position: absolute;
    left: calc((1 - var(--at)) * 100%);
    translate: -50% 0;
  }

  /* Placed from the script: at its dot, or spread from its neighbours. */
  .mark {
    position: absolute;
    top: 0;
    display: grid;
    justify-items: center;
    row-gap: 0.1rem;
    color: var(--screen-text);
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  .mark .value {
    font-weight: 700;
  }

  .mark.on {
    color: var(--hw-bright);
  }

  .mark.on .name {
    font-weight: 700;
  }

  .nums .num {
    top: 0;
    color: var(--screen-text);
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  /* The zones' names: what the tinted stretches of the bar are. */
  .nums .zone-name {
    color: var(--hw-label);
  }

  .bar {
    height: 0.85rem;
    background: var(--screen-grid);
  }

  /* --from is the zone's loud end and --to its quiet end, both measured down from the top. */
  .strip .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc((1 - var(--to)) * 100%);
    right: calc(var(--from) * 100%);
  }

  .strip .clip {
    background: color-mix(in oklab, var(--dmg) 30%, transparent);
  }

  .strip .band {
    background: color-mix(in oklab, var(--screen-text) 24%, transparent);
  }

  .strip .tick {
    top: -2px;
    bottom: -2px;
    width: 1px;
    translate: -0.5px 0;
    background: var(--screen-axis);
  }

  .strip .tick.ceiling {
    width: 0;
    background: none;
    border-left: 1.25px dashed var(--screen-text);
  }

  .strip .dot {
    top: 50%;
    translate: -50% -50%;
  }

  /* ---------------------------------------------------------------------------------------------
   * The tall ladder (wide panels)
   * ------------------------------------------------------------------------------------------- */

  .tall {
    --num-w: 2.1rem;
    --dot-x: calc(var(--num-w) + 0.85rem);
    /* A column on the right for the zone names. (Not --strip: that's the title strips' colour.) */
    --names-w: 1.1rem;
    display: none;
    flex: 1;
    min-height: 12rem;
  }

  /* The scale sits inset from the screen's edges, so labels on the top and bottom lines fit. */
  .scale {
    position: absolute;
    inset: 0.6rem 0;
  }

  .tall .zone {
    position: absolute;
    left: var(--num-w);
    right: 0;
    top: calc(var(--from) * 100%);
    bottom: calc((1 - var(--to)) * 100%);
  }

  /* Zone names run up the right-hand edge, clear of the markers' labels wherever they land. */
  .zone-label {
    position: absolute;
    right: 0.15rem;
    top: 50%;
    writing-mode: vertical-rl;
    transform: translateY(-50%) rotate(180deg);
    color: var(--screen-text);
    font-size: 0.6875rem;
    line-height: 1;
    white-space: nowrap;
  }

  .tall .tick {
    position: absolute;
    top: calc(var(--at) * 100%);
    left: 0;
    right: var(--names-w);
    height: 0;
    border-top: 1px solid var(--screen-grid);
    margin-left: var(--num-w);
  }

  .tall .tick .num {
    position: absolute;
    right: calc(100% + 0.4rem);
    top: 0;
    translate: 0 -50%;
    color: var(--screen-text);
  }

  .tall .tick.aim {
    border-top-color: color-mix(in oklab, var(--screen-text) 60%, transparent);
  }

  .tall .tick.aim .num {
    color: var(--hw-label);
    font-weight: 700;
  }

  /* The top of the file: the Howler's limit in this model. Dashed, like every ceiling on the site,
     in the screen's ink as on the lab's scopes. Red is for damage: the Over zone above it. */
  .tall .tick.ceiling {
    border-top: 1.25px dashed var(--screen-text);
  }

  .tall .tick.ceiling .num {
    color: var(--hw-label);
  }

  .peak {
    position: absolute;
    top: calc(var(--at) * 100%);
    left: var(--dot-x);
    right: var(--names-w);
    height: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .peak .dot {
    margin-left: -0.375rem;
  }

  /* A chip in the screen colour keeps gridlines and the ceiling from striking through labels. */
  .label {
    min-width: 0;
    padding: 0.15rem 0.3rem;
    margin-left: -0.15rem;
    background: color-mix(in oklab, var(--screen) 88%, transparent);
    color: var(--screen-text);
    white-space: nowrap;
  }

  .label b {
    font-weight: 700;
  }

  .peak.on .label {
    color: var(--hw-label);
  }

  /* What's playing is filled in; anything at or over the top is drawn in damage red. */
  .dot[data-on] {
    background: var(--sig);
  }

  .dot[data-hot] {
    border-color: var(--dmg);
  }

  .dot[data-hot][data-on] {
    background: var(--dmg);
  }

  /* A wide panel: the tall ladder beside the rig, and the note under it. The strip's headline
     goes: the ladder labels every peak itself. */
  @container record (min-width: 54rem) {
    .ladder {
      height: 100%;
    }

    .tall {
      display: block;
    }

    .strip,
    .headline {
      display: none;
    }

    .title:has(.headline) .unit,
    .note {
      display: inline;
    }
  }

  @media (forced-colors: active) {
    /* The tinted zones lose their backgrounds, so a bar along one edge shows their extent. */
    .tall .band {
      border-left: 3px solid CanvasText;
    }

    .tall .clip {
      border-left: 3px dashed CanvasText;
    }

    .strip .band {
      border-bottom: 3px solid CanvasText;
    }

    .strip .clip {
      border-bottom: 3px dashed CanvasText;
    }

    .bar {
      border: 1px solid CanvasText;
    }

    .dot[data-on],
    .dot[data-hot][data-on] {
      background: CanvasText;
    }

    .dot,
    .dot[data-hot] {
      border-color: CanvasText;
    }

    .tall .tick.ceiling,
    .strip .tick.ceiling {
      border-color: CanvasText;
    }
  }
</style>
