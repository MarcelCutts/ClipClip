<script lang="ts">
  /**
   * The verdict by the MASTER meters, the biggest words in the lab: where the mix peaks and its
   * colour, like "Mix +12 dB" over "in the red". Its square lamp is lit in the zone's colour, the
   * same signal state the meters show. "Mix" is our word, not a legend on the unit, so it's set
   * in sentence case, not in the panel lettering.
   *
   * Hidden from screen readers: the MASTER meter says the same thing, and the lab's live region
   * says the verdict when it changes. It reserves the same height for every reading, and one width,
   * set for its longest words ("6 dB over the red"), with the words starting at the same place
   * whatever they say, so nothing in it shifts as the level changes.
   */
  import type { Zone } from '../../lib/xdj';

  interface Props {
    /** Printed before the number, like a name on the panel. */
    label: string;
    /** The level, formatted: "+12 dB". */
    value: string;
    zone: Zone | null;
    /** The colour in words: "in the red", "3 dB over the red", "dark". */
    words: string;
  }

  let { label, value, zone, words }: Props = $props();
</script>

<div class="readout" data-zone={zone ?? 'dark'} aria-hidden="true">
  <p class="level"><span class="label">{label}</span> <span class="value">{value}</span></p>
  <p class="zone"><span class="lamp"></span>{words}</p>
</div>

<style>
  .readout {
    display: grid;
    justify-items: start;
    gap: 0.2rem;
    inline-size: min(100%, 10.5rem);
  }

  p {
    margin: 0;
  }

  .level {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    white-space: nowrap;
  }

  .label {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label);
  }

  /* The biggest text in the lab. */
  .value {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(1.9rem, 1.2rem + 3cqi, 2.6rem);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--hw-bright);
  }

  .zone {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--text-base);
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    color: var(--hw-bright);
  }

  /* Below a 360px phone, the meter column is too narrow for the full-size number and a single
     line of colour words. Reserve two lines for the latter before anything changes. */
  @container mixer (max-width: 17.99rem) {
    .value {
      font-size: 1.375rem;
    }

    .zone {
      align-items: baseline;
      min-height: 2.5em;
      font-size: var(--text-sm);
      white-space: normal;
    }
  }

  /* Square, like a segment of the meter it repeats. */
  .lamp {
    flex: none;
    width: 0.7rem;
    height: 0.7rem;
    border: 1px solid var(--hw-edge);
    background: var(--led-off);
  }

  [data-zone='green'] .lamp {
    border-color: var(--led-g);
    background: var(--led-g);
    box-shadow: 0 0 0.45rem var(--led-g);
  }

  [data-zone='orange'] .lamp {
    border-color: var(--led-a);
    background: var(--led-a);
    box-shadow: 0 0 0.45rem var(--led-a);
  }

  [data-zone='red'] .lamp {
    border-color: var(--led-r);
    background: var(--led-r);
    box-shadow: 0 0 0.6rem var(--led-r);
  }

  @media (forced-colors: active) {
    .lamp {
      forced-color-adjust: none;
      border-color: CanvasText;
      background: Canvas;
      box-shadow: none;
    }

    [data-zone='green'] .lamp,
    [data-zone='orange'] .lamp,
    [data-zone='red'] .lamp {
      border-color: CanvasText;
      background: CanvasText;
      box-shadow: none;
    }
  }
</style>
