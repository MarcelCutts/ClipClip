<script lang="ts">
  /**
   * The key that starts and stops a demo's sound: a play triangle and its words. While its sound
   * plays the whole key lights, like a lit pad, the triangle turns into a stop square and the words
   * say Stop, so one key does both. There's no aria-pressed: the name itself changes ("Listen",
   * then "Stop"), and pressing the key always does what the name says.
   *
   * A minimum width keeps the key from jumping as the words change. Say what the sound is (it
   * starts quietly, it's matched for loudness) with aria-describedby, which lands on the button.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'onclick' | 'type'> {
    /** This key's sound is the one playing. */
    playing: boolean;
    onclick: () => void;
    /** The words while it's quiet. */
    label?: string;
    /** The words while it plays. */
    stopLabel?: string;
    /** Anything after the words, the same in both states, like the listening test's big A or B. */
    children?: Snippet;
    /** The button itself, for a widget that moves focus to it (bind:element). */
    element?: HTMLButtonElement | undefined;
  }

  let {
    playing,
    onclick,
    label = 'Listen',
    stopLabel = 'Stop',
    children,
    element = $bindable(),
    ...rest
  }: Props = $props();
</script>

<button bind:this={element} type="button" {...rest} class="listen-key" class:on={playing} {onclick}>
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    {#if playing}
      <rect x="1.5" y="1.5" width="9" height="9" />
    {:else}
      <path d="M2.5 1.2 11 6l-8.5 4.8z" />
    {/if}
  </svg>
  <!-- One run of text, so the name reads "Play A", not "PlayA". -->
  <span class="text">{playing ? stopLabel : label}{#if children}{' '}{@render children()}{/if}</span>
</button>

<style>
  /* Padded like ui/Pad, so the two share a row on a 390 px phone. */
  .listen-key {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 7rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.9rem 0.55rem 0.8rem;
    border: 1px solid var(--pad-edge);
    border-radius: var(--radius-control);
    background: var(--pad-top);
    color: var(--hw-bright);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
  }

  .listen-key:hover {
    background: var(--pad-hover-top);
  }

  .listen-key:active {
    translate: 0 1px;
  }

  .listen-key:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  /* In currentColor, so the triangle and square follow the words into forced colours. */
  svg {
    flex: none;
    fill: currentColor;
  }

  /* Lit white while playing, like a backlit key: green, orange and red are kept for levels. */
  .on,
  .on:hover {
    border-color: var(--hw-label);
    background: var(--hw-label);
    color: var(--hw-sunk);
  }

  @media (prefers-reduced-motion: reduce) {
    .listen-key:active {
      translate: none;
    }
  }

  @media (forced-colors: active) {
    .on,
    .on:hover {
      forced-color-adjust: none;
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }
  }
</style>
