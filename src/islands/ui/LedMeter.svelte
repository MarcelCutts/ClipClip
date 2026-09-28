<script lang="ts">
  import { formatDb } from '../../lib/dsp/db';
  /**
   * An XDJ-RX2 level indicator: twelve LEDs, green to −3 dB, orange 0 to +9, red at +12.
   * `level` is the peak on the meter's own dB scale. The master variant has two columns and a
   * CLIP light. Colour is never the only cue: the scale is printed beside the LEDs as on the
   * panel (−24 … 0, 3 … 12, with 0 in bold), a printed break sets each colour zone apart, and
   * the meter exposes its reading to screen readers.
   *
   * The break is `--zone-break` (3px by default) added under the red light and under the 0 light.
   * A parent that lays something over the LEDs row by row has to leave room for it too.
   */
  import { describeLevel, litCount, METER_SEGMENTS, scaleLabel } from '../../lib/xdj';

  interface Props {
    /** Name printed above the meter, like CH1 or MASTER. */
    label: string;
    level: number;
    /** Second column for the master's right channel. Defaults to `level`. */
    levelRight?: number;
    stereo?: boolean;
    /** CLIP light state, master only. */
    clip?: 'off' | 'slow' | 'fast';
    /** Which side the dB scale is printed on. */
    scale?: 'left' | 'right' | 'none';
  }

  let { label, level, levelRight, stereo = false, clip, scale = 'right' }: Props = $props();

  const top = [...METER_SEGMENTS].reverse();
  const lit = $derived(litCount(level));
  const litRight = $derived(litCount(levelRight ?? level));
  const valueNow = $derived(Number.isFinite(level) ? Math.max(-30, Math.min(15, level)) : -30);
  const valueText = $derived(
    Number.isFinite(level) ? `${label}: peaks at ${formatDb(level)}, ${describeLevel(level)}` : `${label}: no signal`,
  );
</script>

<!-- biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot draw the LED ladder; role="meter" carries the same semantics -->
<div
  class="meter"
  class:stereo
  data-scale={scale}
  role="meter"
  aria-label="{label} level"
  aria-valuemin={-30}
  aria-valuemax={15}
  aria-valuenow={valueNow}
  aria-valuetext={valueText}
>
  <span class="name hw-label" aria-hidden="true">{label}</span>
  {#if clip !== undefined}
    <span class="clip hw-label" data-state={clip} aria-hidden="true">Clip</span>
  {/if}
  <div class="body" aria-hidden="true">
    <ol class="leds">
      {#each top as seg, i (seg.db)}
        {@const index = METER_SEGMENTS.length - 1 - i}
        {@const below = top[i + 1]}
        <!-- A break under the last light of a colour: red over orange, orange over green. -->
        <li class="row" class:zone-end={below !== undefined && below.zone !== seg.zone} class:zero={seg.db === 0}>
          <span class="led" data-zone={seg.zone} data-on={index < lit}></span>
          {#if stereo}
            <span class="led" data-zone={seg.zone} data-on={index < litRight}></span>
          {/if}
          {#if scale !== 'none'}
            <span class="tick">{scaleLabel(seg.db)}</span>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</div>

<style>
  /* The meter's well: a flat black window in the panel, the one box a meter keeps. */
  .meter {
    display: inline-grid;
    justify-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.45rem 0.55rem;
    border-radius: var(--radius-control);
    background: var(--hw-sunk);
  }

  /* The meter's name and the CLIP legend name what they sit on, so they're big enough to read as
     names (14px), like the fader names. */
  .name {
    font-size: 0.875rem;
  }

  /* The CLIP legend stays readable when unlit, like the red print on the real panel. */
  .clip {
    font-size: 0.875rem;
    padding: 0.12rem 0.3rem;
    color: color-mix(in oklab, var(--led-r) 45%, var(--hw-label));
    background: var(--led-r-off);
  }

  /* Lit: dark print on the red lamp keeps the word readable (about 5:1). */
  .clip[data-state='slow'],
  .clip[data-state='fast'] {
    color: var(--hw-sunk);
    background: var(--led-r);
    box-shadow: 0 0 0.6rem var(--led-r);
  }

  @media (prefers-reduced-motion: no-preference) {
    /* Blink the glow, not the word, and stop within five seconds (WCAG 2.2.2): the lamp then
       stays lit, like the real CLIP light holding on a sustained overload. */
    .clip[data-state='slow'] {
      animation: blink 1s steps(1, end) 5;
    }

    .clip[data-state='fast'] {
      animation: blink 0.25s steps(1, end) 20;
    }
  }

  @keyframes blink {
    50% {
      box-shadow: none;
    }
  }

  .leds {
    display: grid;
    gap: var(--led-gap, 3px);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 3px;
    /* Keeps rows the same height whether or not the scale is printed. */
    min-height: 0.66rem;
  }

  [data-scale='left'] .row {
    flex-direction: row-reverse;
  }

  /* The printed break between colour zones, so the zones read apart without their colours. */
  .row.zone-end {
    margin-bottom: var(--zone-break, 3px);
  }

  /* Square-cornered, like the XDJ-RX2's own segments. */
  .led {
    width: var(--led-w, 1.25rem);
    height: var(--led-h, 0.5rem);
    background: var(--led-off);
    opacity: 0.9;
  }

  .stereo .led {
    width: var(--led-w, 0.7rem);
  }

  .led[data-on='true'][data-zone='green'] {
    background: var(--led-g);
    box-shadow: 0 0 0.4rem color-mix(in oklab, var(--led-g) 65%, transparent);
  }

  .led[data-on='true'][data-zone='orange'] {
    background: var(--led-a);
    box-shadow: 0 0 0.4rem color-mix(in oklab, var(--led-a) 65%, transparent);
  }

  .led[data-on='true'][data-zone='red'] {
    background: var(--led-r);
    box-shadow: 0 0 0.55rem var(--led-r);
  }

  /* Unlit LEDs keep a hint of their colour, like the real panel. */
  .led[data-on='false'][data-zone='green'] {
    background: var(--led-g-off);
  }

  .led[data-on='false'][data-zone='orange'] {
    background: var(--led-a-off);
  }

  .led[data-on='false'][data-zone='red'] {
    background: var(--led-r-off);
  }

  /* The dB scale is printed on the panel, so it's lettered like the other silk-screen legends. */
  .tick {
    min-width: 1.8em;
    font-family: var(--font-label);
    font-size: 0.75rem;
    line-height: 1;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label-2);
    text-align: left;
  }

  /* 0 is the mark everything is set against, so it's printed bold. */
  .zero .tick {
    font-weight: 800;
    color: var(--hw-label);
  }

  [data-scale='left'] .tick {
    text-align: right;
  }

  @media (forced-colors: active) {
    .led[data-on][data-zone] {
      forced-color-adjust: none;
      box-shadow: none;
    }

    .led[data-on='true'][data-zone] {
      background: CanvasText;
    }

    .led[data-on='false'][data-zone] {
      background: Canvas;
      outline: 1px solid CanvasText;
    }

    .clip[data-state='slow'],
    .clip[data-state='fast'] {
      forced-color-adjust: none;
      background: CanvasText;
      color: Canvas;
      box-shadow: none;
    }
  }
</style>
