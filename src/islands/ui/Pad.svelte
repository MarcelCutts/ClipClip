<script lang="ts">
  /**
   * A rubber pad for presets and toggles. `pressed` sets aria-pressed and lights it.
   *
   * - White (the default): the whole pad lights, the way the XDJ-RX2's own pads and SOUND COLOR
   *   FX keys light when they're on. No LED dot: the pad is the light.
   * - Green or red, only for a preset that stands for a clean or a clipped level: the pad keeps its
   *   dark face and a small LED in it lights in that colour, since a whole pad lit red reads as an
   *   alarm. The LED is the only one on any key, because here its colour says something.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'onclick'> {
    pressed?: boolean;
    /** How it lights: the whole pad white, or a green or red LED for a level preset. */
    tone?: 'white' | 'green' | 'red';
    onclick?: () => void;
    children: Snippet;
  }

  let { pressed = false, tone = 'white', onclick, children, ...rest }: Props = $props();
</script>

<button type="button" {...rest} class="pad" data-tone={tone} aria-pressed={pressed} {onclick}>
  {#if tone !== 'white'}<span class="led" aria-hidden="true"></span>{/if}
  <span class="text">{@render children()}</span>
</button>

<style>
  /* A square key cut into the panel: one flat face, one printed edge. */
  .pad {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.9rem;
    border: 1px solid var(--pad-edge);
    border-radius: var(--radius-control);
    background: var(--pad-top);
    color: var(--hw-bright);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
  }

  .pad:hover {
    background: var(--pad-hover-top);
  }

  .pad:active {
    translate: 0 1px;
  }

  .pad:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  .pad:disabled {
    cursor: default;
  }

  /* White and lit: the pad glows and the print on it reads dark, about 11:1. */
  [data-tone='white'][aria-pressed='true'],
  [data-tone='white'][aria-pressed='true']:hover {
    border-color: var(--hw-label);
    background: var(--hw-label);
    color: var(--hw-sunk);
  }

  /* A level preset: a bar-shaped LED, dark until lit in its colour (a round or square one reads as
     a radio button or a checkbox). The pad's edge brightens too, so "on" never rests on colour. */
  .led {
    flex: none;
    width: 0.9rem;
    height: 0.3rem;
    background: var(--hw-sunk);
  }

  [aria-pressed='true'] .led {
    background: var(--lit);
    box-shadow: 0 0 0.5rem var(--lit);
  }

  [data-tone='green'] .led {
    --lit: var(--led-g);
  }

  [data-tone='red'] .led {
    --lit: var(--led-r);
  }

  [data-tone='green'][aria-pressed='true'],
  [data-tone='red'][aria-pressed='true'] {
    border-color: var(--hw-label);
  }

  @media (prefers-reduced-motion: reduce) {
    .pad:active {
      translate: none;
    }
  }

  /* System colours drop the light, so a lit pad, or a lit LED, takes the highlight instead. */
  @media (forced-colors: active) {
    [data-tone='white'][aria-pressed='true'],
    [data-tone='white'][aria-pressed='true']:hover {
      forced-color-adjust: none;
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }

    [data-tone='green'][aria-pressed='true'],
    [data-tone='red'][aria-pressed='true'] {
      outline: 2px solid Highlight;
    }

    .led {
      forced-color-adjust: none;
      background: Canvas;
      outline: 1px solid CanvasText;
    }

    [aria-pressed='true'] .led {
      background: Highlight;
      outline-color: Highlight;
      box-shadow: none;
    }
  }
</style>
