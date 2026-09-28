<script lang="ts">
  /**
   * The Howler's LEVEL light with its state in words, in the Howler's stage. Howler's manual: it
   * blinks green while the level is fine and red when it's too hot. The real light blinks all the
   * time; this one blinks for under 5 seconds after each change and then stays lit (WCAG 2.2.2),
   * and with reduced motion it doesn't blink at all. The words say "blinking". Colour is never the
   * only cue.
   *
   * What it means is the level at the Howler's input, as a distance from its ceiling: all the light
   * goes by. It is never "OK": a green light over a crunchy file is the lab's lesson, and "OK" would
   * read as a verdict on the file.
   */
  interface Props {
    light: 'green' | 'red';
    /** "Blinking green", "Blinking red". */
    state: string;
    /** "Input 3 dB under its ceiling", "Input at its ceiling", "Input 2 dB over its ceiling". */
    meaning: string;
  }

  let { light, state, meaning }: Props = $props();
</script>

<span class="howler">
  <!-- Keyed, so a change of colour starts a fresh blink. -->
  {#key light}
    <span class="led" data-light={light} aria-hidden="true"></span>
  {/key}
  <span class="words">
    <span class="state">{state}</span>
    <span class="meaning">{meaning}</span>
  </span>
</span>

<style>
  .howler {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }

  /* Round, like the light on the recorder itself. */
  .led {
    flex: none;
    width: 0.8rem;
    height: 0.8rem;
    margin-top: 0.25em;
    border-radius: 50%;
    background: var(--led-off);
  }

  .led[data-light='green'] {
    --lit: var(--led-g);
  }

  .led[data-light='red'] {
    --lit: var(--led-r);
  }

  .led[data-light] {
    background: var(--lit);
    box-shadow: 0 0 0.6rem var(--lit);
  }

  /* Four blinks, 4.4 s in all, then it stays lit: inside the 5 seconds WCAG 2.2.2 allows. */
  @media (prefers-reduced-motion: no-preference) {
    .led[data-light] {
      animation: blink 1.1s steps(1, end) 4;
    }
  }

  @keyframes blink {
    50% {
      background: color-mix(in oklab, var(--lit) 30%, var(--led-off));
      box-shadow: none;
    }
  }

  .words {
    display: grid;
    min-width: 0;
    line-height: 1.2;
  }

  /* The size of the readout it sits in. */
  .state {
    font-size: inherit;
    font-weight: 700;
    color: var(--hw-bright);
  }

  .meaning {
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    color: var(--hw-label);
  }

  @media (forced-colors: active) {
    .led {
      forced-color-adjust: none;
      background: Canvas;
      outline: 1px solid CanvasText;
    }

    .led[data-light] {
      background: CanvasText;
      box-shadow: none;
      animation: none;
    }
  }
</style>
