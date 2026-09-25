<script lang="ts">
  /**
   * One rubber pad in a radio group: the look of ui/Pad, with a native radio underneath
   * (transparent, over the whole pad) so arrow keys, taps and screen readers behave as they do on
   * a plain radio group. The checked pad lights up, as ui/Pad does when it's pressed. Group the
   * pads in a fieldset with a legend.
   *
   * States that belong to a group (a right-or-wrong mark, a dimmed leftover) stay with the group:
   * pass data-* attributes, which land on the pad, and style `.radio-pad[data-…]` from there.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLLabelAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLLabelAttributes, 'children' | 'onchange'> {
    /** The radio group's name, unique on the page. */
    name: string;
    value: string;
    checked: boolean;
    disabled?: boolean;
    onchange: () => void;
    /** The pad's words. */
    label: string;
    /** A smaller second line under the words. */
    detail?: string | undefined;
    /** Anything after the words, like a mark. It drops to its own line when the pad runs out of room. */
    after?: Snippet;
  }

  let { name, value, checked, disabled = false, onchange, label, detail, after, ...rest }: Props = $props();
</script>

<label {...rest} class="radio-pad">
  <input type="radio" {name} {value} {checked} {disabled} {onchange} />
  <span class="main">
    <span class="text">
      <span class="label">{label}</span>
      {#if detail}<span class="detail">{detail}</span>{/if}
    </span>
  </span>
  {@render after?.()}
</label>

<style>
  /* The same square key as ui/Pad: one flat face, one printed edge. */
  .radio-pad {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    column-gap: 0.7rem;
    row-gap: 0.15rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.9rem;
    border: 1px solid var(--pad-edge);
    border-radius: var(--radius-control);
    background: var(--pad-top);
    color: var(--hw-bright);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
  }

  .radio-pad:hover {
    background: var(--pad-hover-top);
  }

  .radio-pad:active {
    translate: 0 1px;
  }

  /* The real radio covers the pad: invisible, but it takes the taps and the focus. */
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .radio-pad:has(input:focus-visible) {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  .main {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .text {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  /* Lighter than --hw-label-2: the pad is lighter than the panel, and small print needs 4.5:1 on
     it, hover included. */
  .detail {
    font-size: var(--text-xs);
    font-weight: 400;
    line-height: 1.3;
    color: color-mix(in oklab, var(--hw-label) 50%, var(--hw-label-2));
  }

  /* Checked: the pad lights, with dark print on it. */
  .radio-pad:has(input:checked),
  .radio-pad:has(input:checked):hover {
    border-color: var(--hw-label);
    background: var(--hw-label);
    color: var(--hw-sunk);
  }

  .radio-pad:has(input:checked) .detail {
    color: var(--hw-2);
  }

  /* Disabled: the pads stop moving and read as a record of the choice. */
  .radio-pad:has(input:disabled) {
    cursor: default;
    translate: none;
  }

  .radio-pad:has(input:disabled:not(:checked)):hover {
    background: var(--pad-top);
  }

  @media (prefers-reduced-motion: reduce) {
    .radio-pad:active {
      translate: none;
    }
  }

  @media (forced-colors: active) {
    .radio-pad:has(input:checked),
    .radio-pad:has(input:checked):hover {
      forced-color-adjust: none;
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }

    .radio-pad:has(input:checked) .detail {
      color: HighlightText;
    }
  }
</style>
