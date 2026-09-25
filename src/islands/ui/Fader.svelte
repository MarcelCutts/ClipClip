<script lang="ts">
  /**
   * A labelled range input styled as a hardware fader. Native <input type="range"> underneath,
   * so keyboard, touch and screen readers work without extra code. A horizontal fader can also
   * carry a marked scale: tinted zones along the slot, tick labels under it, and an inset that
   * lines the cap up with a chart axis.
   */
  interface Zone {
    from: number;
    to: number;
    tone: 'sig' | 'dmg';
  }

  interface Tick {
    at: number;
    label: string;
  }

  interface Props {
    id: string;
    /** The name printed on the hardware (TRIM, LOW, FADER...). */
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    /** Shown in the output next to the label. */
    format?: (value: number) => string;
    /** Read out by screen readers. Defaults to the formatted value. */
    speak?: (value: number) => string;
    /** One line under the fader explaining what it stands for. */
    hint?: string;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
    /** Show − and + buttons for one-step changes (handy on touch screens). */
    steppers?: boolean;
    /** Id of another element that describes this control, added to aria-describedby. */
    describedby?: string;
    /** Set the label in sentence case, for names that aren't printed on the hardware. */
    plain?: boolean;
    /**
     * Words added to the accessible name but not shown, like "Deck 1", so two decks' TRIM
     * controls have different names for voice control and screen readers.
     */
    context?: string;
    /**
     * Tinted stretches of the slot, in slider units, painted in place of the lit travelled part.
     * An empty list leaves the slot plain. Horizontal only.
     */
    zones?: Zone[];
    /** Small labels under the slot, in slider units. Horizontal only. */
    ticks?: Tick[];
    /**
     * Line the cap up with a chart axis: where `min` and `max` sit, measured in from the fader's
     * left and right edges (CSS lengths). The label and hint keep the full width. Horizontal
     * only, without steppers.
     */
    inset?: [start: string, end: string];
    oninput?: (value: number) => void;
  }

  let {
    id,
    label,
    value = $bindable(),
    min,
    max,
    step = 1,
    format = (v: number) => String(v),
    speak,
    hint,
    orientation = 'horizontal',
    disabled = false,
    steppers = false,
    describedby,
    plain = false,
    context,
    zones,
    ticks = [],
    inset,
    oninput,
  }: Props = $props();

  const fullName = $derived(context ? `${context} ${label}` : label);

  // Focus stays on a −/+ button after a press, so nothing else would read the new value out.
  // Announce it once the presses stop; drags and arrow keys are already spoken by the slider.
  let announced = $state('');
  let announceTimer: ReturnType<typeof setTimeout> | undefined;

  function nudge(direction: 1 | -1) {
    const next = Math.min(max, Math.max(min, value + direction * step));
    if (next === value) return;
    value = next;
    oninput?.(value);
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      announced = `${fullName} ${speak ? speak(value) : format(value)}`;
    }, 400);
  }

  $effect(() => () => clearTimeout(announceTimer));

  const hintId = $derived(hint ? `${id}-hint` : undefined);
  const describedBy = $derived([hintId, describedby].filter(Boolean).join(' ') || undefined);
  const fill = $derived(((value - min) / (max - min)) * 100);

  const frac = (v: number) => (Math.max(min, Math.min(max, v)) - min) / (max - min);
  // Where a value sits along the slot: the cap's centre travels from half a cap in from each end.
  const along = (v: number) => `calc(var(--half) + (100% - 2 * var(--half)) * ${frac(v).toFixed(4)})`;
  const zoned = $derived.by(() => {
    if (!zones) return undefined;
    const stops = zones.flatMap(({ from, to, tone }) => {
      const colour = `color-mix(in oklab, var(--${tone}) 38%, var(--hw-sunk))`;
      return [`transparent ${along(from)}`, `${colour} ${along(from)}`, `${colour} ${along(to)}`, `transparent ${along(to)}`];
    });
    return stops.length > 0 ? `linear-gradient(to right, ${stops.join(', ')}), var(--hw-sunk)` : 'var(--hw-sunk)';
  });
</script>

{#snippet stepper(direction: 1 | -1)}
  <button
    type="button"
    class="step"
    aria-label="{fullName} {direction === 1 ? 'up' : 'down'}"
    {disabled}
    onclick={() => nudge(direction)}>{direction === 1 ? '+' : '−'}</button
  >
{/snippet}

<div
  class="fader"
  data-orientation={orientation}
  style:--inset-start={inset ? `calc(${inset[0]} - var(--half))` : undefined}
  style:--inset-end={inset ? `calc(${inset[1]} - var(--half))` : undefined}
>
  <div class="fader-head">
    <label class={plain ? 'plain-label' : 'hw-label'} for={id}
      >{#if context}<span class="visually-hidden">{`${context} `}</span>{/if}{label}</label
    >
    <!-- Not an <output>: that is a live region, and the slider already announces its value. -->
    <span class="value" aria-hidden="true">{format(value)}</span>
  </div>
  <!-- Vertical faders put + first, so the tab order runs top to bottom like the column. -->
  <div class="track" class:steppers>
    {#if steppers}
      {@render stepper(orientation === 'vertical' ? 1 : -1)}
    {/if}
    <input
      type="range"
      {id}
      {min}
      {max}
      {step}
      {disabled}
      bind:value
      class:zoned={zones !== undefined}
      style:--fill="{fill}%"
      style:--zones={zoned}
      aria-valuetext={speak ? speak(value) : format(value)}
      aria-describedby={describedBy}
      oninput={() => oninput?.(value)}
    />
    {#if steppers}
      {@render stepper(orientation === 'vertical' ? -1 : 1)}
    {/if}
  </div>
  {#if ticks.length > 0}
    <div class="ticks" aria-hidden="true">
      {#each ticks as t (t.at)}
        <span style:left={along(t.at)}>{t.label}</span>
      {/each}
    </div>
  {/if}
  {#if hint}
    <p class="hint" id={hintId}>{hint}</p>
  {/if}
  {#if steppers}
    <span class="visually-hidden" role="status">{announced}</span>
  {/if}
</div>

<style>
  .fader {
    /* The slot's printed rim: four 1px lines, drawn as backgrounds over the slot's fill. */
    --rim:
      linear-gradient(var(--hw-label-2) 0 0) top / 100% 1px no-repeat,
      linear-gradient(var(--hw-label-2) 0 0) bottom / 100% 1px no-repeat,
      linear-gradient(var(--hw-label-2) 0 0) left / 1px 100% no-repeat,
      linear-gradient(var(--hw-label-2) 0 0) right / 1px 100% no-repeat;
    --cap-long: 2.25rem;
    --cap-short: 1.15rem;
    /* How far in from each end of the slot the cap's centre stops. */
    --half: calc(var(--cap-short) / 2);
    --inset-start: 0px;
    --inset-end: 0px;
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }

  .fader-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .plain-label {
    font-weight: 700;
    font-size: var(--text-sm);
    line-height: 1.25;
    color: var(--hw-bright);
  }

  .value {
    font-weight: 700;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--hw-bright);
  }

  /* Set --stepper-size and --stepper-gap on a parent to size the −/+ buttons and to line other
     marks up with the slot (e.g. notch dots under a knob). */
  .track {
    display: flex;
    align-items: center;
    gap: var(--stepper-gap, 0.4rem);
    min-width: 0;
  }

  /* Inset (or pulled wider than the label row) to line the cap up with a chart axis. */
  .track,
  .ticks {
    margin-inline: var(--inset-start) var(--inset-end);
  }

  /* The same square key as ui/Pad. */
  .step {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--stepper-size, 2.75rem);
    height: var(--stepper-size, 2.75rem);
    border: 1px solid var(--pad-edge);
    border-radius: var(--radius-control);
    background: var(--pad-top);
    color: var(--hw-bright);
    font: 700 1.25rem/1 var(--font-body);
    cursor: pointer;
  }

  .step:hover:not(:disabled) {
    background: var(--pad-hover-top);
  }

  .step:active:not(:disabled) {
    translate: 0 1px;
  }

  .step:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .step:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  [data-orientation='vertical'] .track {
    flex-direction: column;
  }

  /* A hint says how to use the control: an instruction, so 15px in the panel's main lettering. */
  .hint {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--hw-label);
  }

  input {
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
    width: 100%;
    height: 2.75rem;
    background: transparent;
    cursor: pointer;
    touch-action: pan-y;
  }

  .track input {
    flex: 1;
    min-width: 0;
  }

  input:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  input:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
    border-radius: var(--radius-control);
  }

  /* Track: a straight slot cut in the panel, with the travelled part lit faintly, or with tinted
     zones in its place. The slot is barely darker than the panel, so a printed rim (5:1 on the
     panel) shows where it runs; tracks need 3:1. The rim is drawn as four 1px lines over the fill,
     so it takes no room and moves nothing. */
  input::-webkit-slider-runnable-track {
    height: 0.4rem;
    border-radius: 0;
    background:
      var(--rim),
      var(--zones, linear-gradient(to right, var(--cap-travel) 0 var(--fill), var(--hw-sunk) var(--fill) 100%));
  }

  input::-moz-range-track {
    height: 0.4rem;
    border-radius: 0;
    background: var(--rim), var(--zones, var(--hw-sunk));
  }

  input::-moz-range-progress {
    height: 0.4rem;
    border-radius: 0;
    background: var(--rim), var(--cap-travel);
  }

  input.zoned::-moz-range-progress {
    background: none;
  }

  /* Thumb: a flat fader cap with its white index line printed across it. */
  input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--cap-short);
    height: var(--cap-long);
    margin-top: calc((0.4rem - var(--cap-long)) / 2);
    border-radius: var(--radius-control);
    border: 1px solid var(--cap-edge);
    background: linear-gradient(to right, transparent 42%, var(--cap-line) 42% 58%, transparent 58%), var(--cap-top);
  }

  input::-moz-range-thumb {
    width: var(--cap-short);
    height: var(--cap-long);
    border-radius: var(--radius-control);
    border: 1px solid var(--cap-edge);
    background: linear-gradient(to right, transparent 42%, var(--cap-line) 42% 58%, transparent 58%), var(--cap-top);
  }

  /* Tick labels, each under the cap's centre at its value. With the grid's gap they sit 0.4rem
     under the input, clear of the focus ring (3px wide, 2px out), which would otherwise strike
     through the numbers. */
  .ticks {
    position: relative;
    height: 1.1rem;
    margin-top: 0.05rem;
  }

  /* Between the − and + buttons, like the slot. */
  .steppers + .ticks {
    --beside: calc(var(--stepper-size, 2.75rem) + var(--stepper-gap, 0.4rem));
    margin-inline: calc(var(--inset-start) + var(--beside)) calc(var(--inset-end) + var(--beside));
  }

  .ticks span {
    position: absolute;
    top: 0;
    translate: -50% 0;
    font-size: 0.75rem;
    line-height: 1;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--hw-label-2);
  }

  /* Vertical channel fader: up is louder. */
  [data-orientation='vertical'] {
    justify-items: center;
  }

  [data-orientation='vertical'] .fader-head {
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  [data-orientation='vertical'] input {
    writing-mode: vertical-lr;
    direction: rtl;
    width: 2.75rem;
    height: var(--fader-length, 9rem);
    touch-action: pan-x;
  }

  /* A vertical slot is --fader-length long, so a printed scale beside it can line up. */
  [data-orientation='vertical'] .track input {
    flex: none;
  }

  [data-orientation='vertical'] input::-webkit-slider-runnable-track {
    width: 0.4rem;
    height: 100%;
    background:
      var(--rim),
      linear-gradient(to top, var(--cap-travel) 0 var(--fill), var(--hw-sunk) var(--fill) 100%);
  }

  [data-orientation='vertical'] input::-moz-range-track {
    width: 0.4rem;
    height: 100%;
  }

  [data-orientation='vertical'] input::-moz-range-progress {
    width: 0.4rem;
  }

  [data-orientation='vertical'] input::-webkit-slider-thumb {
    width: var(--cap-long);
    height: var(--cap-short);
    margin-top: 0;
    margin-left: calc((0.4rem - var(--cap-long)) / 2);
    background: linear-gradient(to bottom, transparent 42%, var(--cap-line) 42% 58%, transparent 58%), var(--cap-top);
  }

  [data-orientation='vertical'] input::-moz-range-thumb {
    width: var(--cap-long);
    height: var(--cap-short);
    background: linear-gradient(to bottom, transparent 42%, var(--cap-line) 42% 58%, transparent 58%), var(--cap-top);
  }

  @media (prefers-reduced-motion: reduce) {
    .step:active:not(:disabled) {
      translate: none;
    }
  }

  @media (forced-colors: active) {
    input {
      forced-color-adjust: none;
    }

    /* forced-color-adjust: none keeps the author's colours, focus ring included. */
    input:focus-visible {
      outline-color: Highlight;
    }

    /* The vertical rules above are more specific, so they're named here too. */
    input::-webkit-slider-runnable-track,
    [data-orientation='vertical'] input::-webkit-slider-runnable-track {
      background: GrayText;
    }

    input::-moz-range-track {
      background: GrayText;
    }

    input::-moz-range-progress {
      background: GrayText;
    }

    input::-webkit-slider-thumb,
    [data-orientation='vertical'] input::-webkit-slider-thumb {
      background: ButtonText;
    }

    input::-moz-range-thumb,
    [data-orientation='vertical'] input::-moz-range-thumb {
      background: ButtonText;
    }
  }
</style>
