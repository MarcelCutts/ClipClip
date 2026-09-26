<script lang="ts">
  /**
   * One deck's channel fader, standing beside the meters so the two are always on screen
   * together: the deck's name and colour key, the fader with − and + keys (one printed mark a
   * press), and the printed scale behind it.
   *
   * The fader's length comes from --fader-length, set by the lab to match the meters beside it.
   * On a touch screen it moves only by its cap (ui/Fader), so a scroll that starts on the fader,
   * which on a phone sits right where a thumb scrolls, never pushes deck 2 in by accident.
   */
  import { speakFader } from '../../lib/blend/copy';
  import { FADER, faderDb } from '../../lib/blend/model';
  import { formatDb } from '../../lib/dsp/db';
  import Fader from '../ui/Fader.svelte';

  interface Props {
    /** Which deck: 1 or 2. */
    n: 1 | 2;
    /** Fader position, 0 (closed) to 10. */
    value: number;
    /** Unique prefix for ids. */
    uid: string;
  }

  let { n, value = $bindable(), uid }: Props = $props();

  const id = $derived(`${uid}-deck${n}`);
  const formatFader = (p: number) => (p <= FADER.min ? 'Off' : formatDb(faderDb(p)));
  /** One mark per step, top to bottom. */
  const ticks = Array.from(
    { length: Math.round((FADER.max - FADER.min) / FADER.step) + 1 },
    (_, k) => FADER.max - k * FADER.step,
  );
</script>

<!-- biome-ignore lint/a11y/useSemanticElements: the strip's name is a drawn hardware label beside a colour key, which a <legend> can't be; role="group" with aria-labelledby names it -->
<div class="strip" data-deck={n} role="group" aria-labelledby="{id}-strip">
  <p class="title">
    <span class="key" aria-hidden="true"></span>
    <span class="hw-label" id="{id}-strip">Deck {n}</span>
  </p>

  <div class="channel">
    <div class="scale" aria-hidden="true">
      {#each ticks as t (t)}
        <span class="tick" class:major={t % 5 === 0}></span>
      {/each}
    </div>
    <Fader
      id="{id}-fader"
      label="Fader"
      plain
      context="Deck {n}"
      orientation="vertical"
      steppers
      bind:value
      min={FADER.min}
      max={FADER.max}
      step={FADER.step}
      format={formatFader}
      speak={speakFader}
    />
  </div>
</div>

<style>
  .strip {
    container: strip / inline-size;
    display: grid;
    align-content: start;
    gap: 0.6rem;
    min-width: 0;
  }

  .title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin: 0;
    min-height: 1.1rem;
  }

  /* Colour key: the same line this deck has on the waveform. */
  .key {
    flex: none;
    width: 1rem;
    height: 3px;
    background: var(--sig);
  }

  /* Dashed, like deck 2's line on the waveform, so the keys never differ by hue alone. */
  [data-deck='2'] .key {
    height: 0;
    border-top: 3px dashed var(--sig-b);
    background: none;
  }

  [data-deck='2'] .title {
    flex-direction: row-reverse;
  }

  /* The strip's name, at 14px: it names the fader under it. */
  .title .hw-label {
    font-size: 0.875rem;
    white-space: nowrap;
  }

  /* Narrow strips (phones): the key sits above the name, so "DECK 1" stays whole, and the
     lettering closes up a little to fit the strip. */
  @container strip (max-width: 5rem) {
    .title,
    [data-deck='2'] .title {
      flex-direction: column;
      gap: 0.35rem;
    }

    .title .hw-label {
      letter-spacing: 0.06em;
    }
  }

  .channel {
    position: relative;
    z-index: 0;
  }

  /* The shared fader grows its slot to fill a column; here the slot is --fader-length long, so the
     printed scale behind it lines up. */
  .channel :global(.track input) {
    flex: none;
  }

  /*
   * Printed scale behind the fader: one mark per step of 0–10, lined up with the centre of the
   * cap at each position. It sits between the two stepper buttons, like the real panel's
   * markings sit either side of the slot.
   */
  .scale {
    position: absolute;
    z-index: -1;
    left: 50%;
    bottom: calc(2.75rem + 0.4rem + 0.575rem);
    height: calc(var(--fader-length, 9rem) - 1.15rem);
    width: 3.1rem;
    translate: -50% 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .tick {
    height: 1px;
    background: linear-gradient(
      to right,
      var(--hw-label-2) 0 18%,
      transparent 18% 82%,
      var(--hw-label-2) 82% 100%
    );
    opacity: 0.6;
  }

  .tick.major {
    opacity: 1;
    background: linear-gradient(
      to right,
      var(--hw-label) 0 22%,
      transparent 22% 78%,
      var(--hw-label) 78% 100%
    );
  }

  @media (forced-colors: active) {
    .tick,
    .tick.major {
      background: CanvasText;
    }

    .key {
      background: CanvasText;
    }

    [data-deck='2'] .key {
      border-top-color: CanvasText;
      background: none;
    }
  }
</style>
