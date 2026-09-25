<script lang="ts" generics="T extends string | number">
  /**
   * A native radio group of the XDJ's rubber pads (ui/RadioPad), the chosen one lit, under a legend
   * and an optional note. The pads stack, or share one row.
   */
  import RadioPad from '../ui/RadioPad.svelte';

  interface Option {
    value: T;
    label: string;
    detail?: string;
  }

  interface Props {
    name: string;
    legend: string;
    /** Style the legend as a label printed on the hardware (only for names on the real unit). */
    hardware?: boolean;
    /** One line under the legend. */
    note?: string;
    options: readonly Option[];
    value: T | null;
    onchange: (value: T) => void;
    /** Stack the pads, or share one row between them. */
    layout?: 'stack' | 'row';
    /** In a row, let long labels take two lines instead of one. */
    wrap?: boolean;
  }

  let { name, legend, hardware = false, note, options, value, onchange, layout = 'stack', wrap = false }: Props =
    $props();

  const noteId = $derived(note ? `${name}-note` : undefined);
</script>

<fieldset class="group" data-layout={layout} data-wrap={wrap || undefined} aria-describedby={noteId}>
  <legend class:hw-label={hardware}>{legend}</legend>
  {#if note}
    <p class="note" id={noteId}>{note}</p>
  {/if}
  <div class="pads">
    {#each options as o (o.value)}
      <RadioPad
        {name}
        value={String(o.value)}
        label={o.label}
        detail={o.detail}
        checked={value === o.value}
        onchange={() => onchange(o.value)}
      />
    {/each}
  </div>
</fieldset>

<style>
  .group {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.45rem;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    color: var(--hw-label);
  }

  legend.hw-label {
    font-size: 0.8125rem;
    font-weight: 760;
  }

  .note {
    margin: -0.2rem 0 0.5rem;
    font-size: var(--text-xs);
    line-height: 1.35;
    color: var(--hw-label-2);
  }

  .pads {
    display: grid;
    gap: 0.4rem;
  }

  [data-layout='row'] .pads {
    grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
  }

  /* A pad in a row centres its words, and gives up some side padding. */
  [data-layout='row'] :global(.radio-pad) {
    padding-inline: 0.5rem;
  }

  [data-layout='row'] :global(.radio-pad .main) {
    justify-content: center;
  }

  [data-layout='row'] :global(.radio-pad .label) {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Two short lines beat one squeezed one: "Loudest / blend". */
  [data-wrap] :global(.radio-pad .label) {
    white-space: normal;
    text-wrap: balance;
  }

  [data-wrap] :global(.radio-pad) {
    align-content: center;
  }
</style>
