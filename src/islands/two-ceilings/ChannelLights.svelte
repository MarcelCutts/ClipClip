<script lang="ts">
  import { formatDb } from '../../lib/dsp/db';
  /**
   * CH1's meter, in the mixer's stage: the XDJ-RX2's twelve lights laid on their side, with the
   * zone in words beside them, so colour is never the only cue. It watches the mixer's ceiling, and
   * sits with the mixer's control and screen.
   *
   * The lights sit in a small well, like the meter's window.
   */
  import { levelWords, READOUTS } from '../../lib/lab/copy';
  import { describeLevel, litCount, METER_SEGMENTS } from '../../lib/xdj';

  interface Props {
    /** The channel's loudest peak, on the meter's own dB scale. */
    channels: number;
  }

  let { channels }: Props = $props();

  const lit = $derived(litCount(channels));
  // The same reading LedMeter gives, so the lab and the rest of the site speak alike.
  const valueNow = $derived(Math.max(-30, Math.min(15, channels)));
  const valueText = $derived(`${READOUTS.ch1}: peaks at ${formatDb(channels)}, ${describeLevel(channels)}`);
</script>

<p class="ch1">
  <span class="hw-label">{READOUTS.ch1}</span>
  <!-- biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot draw the LED row; role="meter" carries the same semantics -->
  <span
    class="lights"
    role="meter"
    aria-label="{READOUTS.ch1} level"
    aria-valuemin={-30}
    aria-valuemax={15}
    aria-valuenow={valueNow}
    aria-valuetext={valueText}
  >
    {#each METER_SEGMENTS as seg, i (seg.db)}
      {@const before = METER_SEGMENTS[i - 1]}
      <!-- A printed break where the colour changes, as on the lab's upright meters. -->
      <span class="led" class:zone-start={before !== undefined && before.zone !== seg.zone} data-zone={seg.zone} data-on={i < lit}></span>
    {/each}
  </span>
  <span class="zone" aria-hidden="true">{levelWords(channels)}</span>
</p>

<style>
  .ch1 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.75rem;
    min-width: 0;
    margin: 0;
  }

  /* The meter's printed name, big enough to read as one (14px). */
  .hw-label {
    font-size: 0.875rem;
    line-height: 1.1;
  }

  /* The channel meter on its side, in its own small well: green, orange, then the red light at
     the right-hand end. */
  .lights {
    display: flex;
    gap: 2px;
    width: fit-content;
    padding: 3px;
    border: 1px solid var(--hw-edge);
    border-radius: var(--radius-control);
    background: var(--hw-sunk);
  }

  /* Square-cornered, like the unit's own segments. */
  .led {
    width: 0.45rem;
    height: 0.85rem;
    background: var(--led-off);
  }

  /* The printed break between colour zones, so they read apart without their colours. */
  .led.zone-start {
    margin-left: var(--zone-break, 3px);
  }

  .led[data-on='true'][data-zone='green'] {
    background: var(--led-g);
    box-shadow: 0 0 0.35rem color-mix(in oklab, var(--led-g) 60%, transparent);
  }

  .led[data-on='true'][data-zone='orange'] {
    background: var(--led-a);
    box-shadow: 0 0 0.35rem color-mix(in oklab, var(--led-a) 60%, transparent);
  }

  .led[data-on='true'][data-zone='red'] {
    background: var(--led-r);
    box-shadow: 0 0 0.5rem var(--led-r);
  }

  /* Unlit, each keeps a hint of its colour through the lens, like the real panel. */
  .led[data-on='false'][data-zone='green'] {
    background: var(--led-g-off);
  }

  .led[data-on='false'][data-zone='orange'] {
    background: var(--led-a-off);
  }

  .led[data-on='false'][data-zone='red'] {
    background: var(--led-r-off);
    outline: 1px solid var(--led-r-rim);
    outline-offset: -1px;
  }

  .zone {
    font-weight: 700;
    line-height: 1.25;
    color: var(--hw-bright);
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
  }
</style>
