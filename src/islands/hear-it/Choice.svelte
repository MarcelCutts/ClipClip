<script lang="ts" generics="T extends string">
  /**
   * A choice made with native radio buttons (arrow keys, taps and screen readers work as usual),
   * drawn as hardware in one of two ways:
   *
   * - By default, a slide switch, for a setting: one slot with one cap, which sits at the chosen
   *   position, and each position's name printed under the slot as it would be on a panel. Each
   *   radio covers its stretch of slot and its name, so the whole column takes the tap. A long
   *   name wraps under its own position rather than squeezing the others.
   * - With `pads`, rubber pads (ui/RadioPad) in one row of equal widths, for an answer, laid out
   *   like every "How sure are you?" on the site (quiz/Sure). `letters` prints the pads' words as
   *   big letters (the A/B pick).
   */
  import RadioPad from '../ui/RadioPad.svelte';

  interface Option {
    value: T;
    label: string;
  }

  interface Props {
    name: string;
    legend: string;
    options: readonly Option[];
    value: T | null;
    disabled?: boolean;
    /** Rubber pads in a row instead of a switch: for answers. */
    pads?: boolean;
    /** With `pads`, print their words as big letters (the A/B pick). */
    letters?: boolean;
    onchange: (value: T) => void;
  }

  let { name, legend, options, value, disabled = false, pads = false, letters = false, onchange }: Props = $props();
</script>

<fieldset class={['choice', { letters }]} {disabled}>
  <legend>{legend}</legend>
  {#if pads}
    <div class="pads">
      {#each options as option (option.value)}
        <RadioPad
          {name}
          value={option.value}
          label={option.label}
          checked={value === option.value}
          {disabled}
          onchange={() => onchange(option.value)}
          data-dim={disabled && value !== option.value}
        />
      {/each}
    </div>
  {:else}
    <div class="switch" style:--positions={options.length}>
      {#each options as option (option.value)}
        <label class="position">
          <input
            type="radio"
            {name}
            value={option.value}
            checked={value === option.value}
            onchange={() => onchange(option.value)}
          />
          <span class="slot" aria-hidden="true"><span class="cap"></span></span>
          <span class="name">{option.label}</span>
        </label>
      {/each}
    </div>
  {/if}
</fieldset>

<style>
  .choice {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.5rem;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.3;
    color: var(--hw-label);
  }

  /* The switch ---------------------------------------------------------------------------------- */

  /* Positions of equal width, so the cap moves by one step at a time. No longer than a real
     switch would be. */
  .switch {
    display: grid;
    grid-template-columns: repeat(var(--positions), minmax(0, 1fr));
    width: 100%;
    max-width: calc(var(--positions) * 8rem);
  }

  .position {
    position: relative;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.45rem;
    min-width: 0;
    padding-bottom: 0.2rem;
    cursor: pointer;
  }

  /* The real radio covers its column: it takes the tap, the focus and the announcement. */
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  /* The slot, sunk into the panel: one stretch per position, joined end to end. */
  .slot {
    display: grid;
    place-items: center;
    width: 100%;
    height: 2rem;
    border-block: 1px solid var(--hw-edge);
    background: var(--hw-sunk);
  }

  .position:first-child .slot {
    border-left: 1px solid var(--hw-edge);
    border-radius: var(--radius-control) 0 0 var(--radius-control);
  }

  .position:last-child .slot {
    border-right: 1px solid var(--hw-edge);
    border-radius: 0 var(--radius-control) var(--radius-control) 0;
  }

  /* The cap fills most of its position, flat, with three ridges for a thumb, unlike a fader's
     cap with its white line: it clicks between positions rather than sliding. */
  .cap {
    display: none;
    width: min(4.5rem, calc(100% - 8px));
    height: calc(100% - 6px);
    border: 1px solid var(--cap-edge);
    border-radius: var(--radius-control);
    background:
      linear-gradient(
          to right,
          var(--cap-edge) 0 1px,
          transparent 1px 4px,
          var(--cap-edge) 4px 5px,
          transparent 5px 8px,
          var(--cap-edge) 8px 9px
        )
        center / 9px 50% no-repeat,
      var(--cap-top);
  }

  .position:has(input:checked) .cap {
    display: block;
  }

  /* Under a pointer, a faint cap shows where a press would move it. */
  @media (hover: hover) {
    .position:hover:not(:has(input:checked)) .cap {
      display: block;
      opacity: 0.35;
    }
  }

  /* The position's name, printed under the slot. */
  .name {
    display: grid;
    justify-items: center;
    font-size: var(--text-sm);
    line-height: 1.25;
    text-align: center;
    color: var(--hw-label);
  }

  .position:has(input:checked) .name {
    font-weight: 700;
    color: var(--hw-bright);
  }

  .position:has(input:focus-visible) {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  .choice:disabled .position {
    cursor: default;
  }

  /* Pads -------------------------------------------------------------------------------------- */

  /* Equal widths, even on a phone. Each centres its words and gives up some side padding, as in
     the quiz. */
  .pads {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 0.4rem;
  }

  .pads :global(.radio-pad) {
    justify-content: center;
    padding-inline: 0.35rem;
    text-align: center;
  }

  .pads :global(.radio-pad .main) {
    flex-grow: 0;
  }

  /* The A/B pick: two square-ish keys, each printed with its letter. */
  .letters .pads {
    grid-auto-columns: minmax(0, 5.5rem);
  }

  .letters :global(.radio-pad) {
    min-height: 3.25rem;
  }

  .letters :global(.radio-pad .label) {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1;
  }

  /* The smallest phones: the three pads keep their row, with less padding round the words. */
  @container (max-width: 19rem) {
    .pads :global(.radio-pad) {
      padding: 0.45rem 0.3rem;
    }
  }

  /* Answered: the chosen pad stays lit, the others sink into the panel. */
  .pads :global(.radio-pad[data-dim='true']),
  .pads :global(.radio-pad[data-dim='true']:hover) {
    background: var(--hw-2);
    color: var(--hw-label-2);
  }

  /*
   * Forced colours drop the slot's fill, so it keeps its edge, and the cap is drawn in Highlight.
   * The chosen name is underlined too, so the choice never rests on the cap's position alone.
   */
  @media (forced-colors: active) {
    .slot,
    .position:first-child .slot,
    .position:last-child .slot {
      border-color: CanvasText;
    }

    .cap {
      forced-color-adjust: none;
      border-color: Highlight;
      background: Highlight;
    }

    .position:has(input:checked) .name {
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }

    .position:has(input:focus-visible) {
      outline-color: CanvasText;
    }

    /* The sunk pads lose their colours here, so they step back in the system's disabled grey. */
    .pads :global(.radio-pad[data-dim='true']) {
      color: GrayText;
    }
  }
</style>
