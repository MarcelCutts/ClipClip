<script lang="ts">
  /**
   * A key printed on a quiz card, the way the checklist cards print theirs: an outlined key for
   * Back and Start again, and a filled one for the way on (`primary`: Next question, See your
   * score). The cards are printed things, not gear, so their keys wear the page's ink, not the
   * panels' rubber.
   */
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    onclick: () => void;
    /** The way forward: filled with ink. One per step at most. */
    primary?: boolean;
    children: Snippet;
  }

  let { onclick, primary = false, children }: Props = $props();
  let ready = $state(false);
  onMount(() => { ready = true; });
</script>

<button type="button" class="key" class:primary={primary} disabled={!ready} {onclick}>
  {@render children()}
</button>

<style>
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    border: 2px solid var(--ink);
    border-radius: var(--radius-control);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
  }

  .key:hover {
    background: var(--paper-2);
  }

  /* The way on: ink all over with the paper's colour for its words, by day and by night. */
  .primary,
  .primary:hover {
    background: var(--ink);
    color: var(--paper);
  }

  .primary:hover {
    background: color-mix(in srgb, var(--ink) 84%, var(--paper));
  }

  .key:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
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

  /* System colours flatten both kinds to one look, so the way on keeps a heavier edge. */
  @media (forced-colors: active) {
    .primary {
      border-width: 3px;
    }
  }
</style>
