<script lang="ts">
  /**
   * The Howler MK1 seen from above (ui/HowlerTop): a small black box with a RECORD button and a
   * single LEVEL light. That light is all the crew can see of the record level on the night, so
   * the words beside it say what it is doing too.
   *
   * On a wide panel the drawing sits over its readout. In the phone strip the drawing goes and the
   * readout gets a small LED of its own, so the light still shows as a light.
   */
  import { LIGHT_WORDS, type Light } from '../../lib/record/model';
  import HowlerTop from '../ui/HowlerTop.svelte';

  interface Props {
    light: Light;
  }

  let { light }: Props = $props();
</script>

<div class="howler" data-state={light}>
  <div class="drawing"><HowlerTop {light} blink /></div>
  <p class="readout">
    {#key light}<span class="dot" data-state={light} aria-hidden="true"></span>{/key}
    <span class="name">Howler <span class="hw-label">Level</span></span>
    <span class="state" data-state={light}>{LIGHT_WORDS[light]}</span>
  </p>
</div>

<style>
  .howler {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
    min-width: 0;
  }

  .drawing {
    display: none;
    width: 100%;
  }

  .readout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem 0.5rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.3;
    color: var(--hw-label);
  }

  .name {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    font-weight: 700;
  }

  .state {
    color: var(--hw-bright);
  }

  .state[data-state='red'] {
    font-weight: 700;
  }

  /* The strip's own LED, in its bezel: lit solid, dark hollow. */
  .dot {
    flex: none;
    width: 0.8rem;
    height: 0.8rem;
    border: 1px solid var(--hw-edge);
    border-radius: 50%;
    background: var(--led-off);
  }

  .dot[data-state='green'] {
    border-color: var(--led-g);
    background: var(--led-g);
    box-shadow: 0 0 0.6rem color-mix(in oklab, var(--led-g) 60%, transparent);
  }

  .dot[data-state='red'] {
    border-color: var(--led-r);
    background: var(--led-r);
    box-shadow: 0 0 0.6rem color-mix(in oklab, var(--led-r) 60%, transparent);
  }

  /* As the drawing's light: a few blinks after each change, then steady (WCAG 2.2.2). */
  @media (prefers-reduced-motion: no-preference) {
    .dot[data-state='green'],
    .dot[data-state='red'] {
      animation: blink 0.8s steps(1, end) 6;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0.18;
    }
  }

  /* A wide panel: the drawing, with the words under it and no second LED. */
  @container record (min-width: 54rem) {
    .drawing {
      display: block;
    }

    .dot {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .dot {
      forced-color-adjust: none;
      background: Canvas;
      box-shadow: none;
      border: 2px solid CanvasText;
    }

    .dot[data-state='green'],
    .dot[data-state='red'] {
      background: CanvasText;
      box-shadow: none;
    }
  }
</style>
