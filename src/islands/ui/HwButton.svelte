<script lang="ts">
  /**
   * A plain hardware key that does what its label says. Rubber pads are for choices and toggles
   * (ui/Pad, ui/RadioPad), and they light up when they're on; this is for moving through a widget.
   *
   * - `primary` is the way forward (Next, Show the result): the one key on the panel meant to
   *   be pressed next, framed and lettered in the display's action cyan. One per step at most.
   * - Without it, a dark rubber key for everything else (Back, Start again, Reset).
   *
   * `locked` keeps it on screen, pressed-looking and quiet once it has done its job, without
   * pulling focus away (aria-disabled, out of the tab order).
   */
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    onclick: () => void;
    /** The way forward: framed and lettered in the action colour. */
    primary?: boolean;
    locked?: boolean;
    /** The button itself, for a widget that moves focus to it (bind:element). */
    element?: HTMLButtonElement | undefined;
    children: Snippet;
  }

  let { onclick, primary = false, locked = false, element = $bindable(), children }: Props = $props();
  let ready = $state(false);
  onMount(() => { ready = true; });
</script>

<button
  bind:this={element}
  type="button"
  class="key"
  class:primary={primary}
  disabled={!ready}
  aria-disabled={locked ? 'true' : undefined}
  tabindex={locked ? -1 : undefined}
  onclick={() => {
    if (!locked) onclick();
  }}
>
  {@render children()}
</button>

<style>
  /* The same square key as the pads: one flat face, one printed edge. */
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--pad-edge);
    border-radius: var(--radius-control);
    background: var(--pad-top);
    color: var(--hw-bright);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
  }

  .key:hover {
    background: var(--pad-hover-top);
  }

  .key:active {
    translate: 0 1px;
  }

  .key:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  /* The way forward: a heavier frame, and the words in the action cyan, as the display letters
     what to do. Lit keys mean "on", so this one stays unlit. */
  .primary {
    border: 2px solid var(--hw-label);
    padding: calc(0.5rem - 1px) calc(1rem - 1px);
    color: var(--hw-action);
  }

  /* Locked, either kind: done its job, so it sinks into the panel and goes quiet. */
  .key[aria-disabled='true'],
  .key[aria-disabled='true']:hover {
    cursor: default;
    translate: none;
    border-color: var(--pad-edge);
    background: var(--hw-2);
    color: var(--hw-label-2);
  }

  .key :global(svg) {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (prefers-reduced-motion: reduce) {
    .key:active {
      translate: none;
    }
  }

  /* System colours flatten both kinds to one button look, so the way forward keeps a heavier edge. */
  @media (forced-colors: active) {
    .primary {
      border: 2px solid ButtonText;
    }
  }
</style>
