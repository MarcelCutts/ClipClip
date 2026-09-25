<script lang="ts">
  /**
   * A radio group drawn as rubber pads (ui/RadioPad): native radios underneath, so arrow keys,
   * forms and screen readers work as usual; the chosen pad lights up. Once `locked`, the group
   * shows the answer in words and shapes, never colour alone: a tick on the right choice, a cross
   * on a wrong pick.
   */
  import RadioPad from '../ui/RadioPad.svelte';

  interface Props {
    /** Radio group name, unique on the page. */
    name: string;
    choices: ReadonlyArray<{ id: string; label: string }>;
    /** The chosen id (bindable). */
    value?: string | undefined;
    /** After the answer is in: no more changes, and the marks show. */
    locked?: boolean;
    /** Id of the right choice, marked once locked. Leave out for questions with no right answer. */
    correct?: string | undefined;
    /** Picks that are neither right nor wrong (like "Not sure"): no mark, just the lit LED. */
    neutral?: readonly string[];
    /** What to call the reader's wrong pick and the right choice once locked. */
    yoursText?: string;
    rightText?: string;
  }

  let {
    name,
    choices,
    value = $bindable(),
    locked = false,
    correct,
    neutral = [],
    yoursText = 'Your answer',
    rightText = 'Right answer',
  }: Props = $props();

  type Mark = 'right' | 'wrong' | null;

  function markFor(id: string): Mark {
    if (!locked) return null;
    if (id === correct) return 'right';
    if (id === value && correct !== undefined && !neutral.includes(id)) return 'wrong';
    return null;
  }
</script>

<div class="choices">
  {#each choices as choice (choice.id)}
    {@const mark = markFor(choice.id)}
    <RadioPad
      {name}
      value={choice.id}
      label={choice.label}
      checked={value === choice.id}
      disabled={locked}
      onchange={() => (value = choice.id)}
      data-mark={mark}
      data-dim={locked && mark === null && choice.id !== value}
    >
      {#snippet after()}
        {#if mark}
          <span class="mark">
            {#if mark === 'right'}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.8" /></svg>
              <span>{rightText}</span>
            {:else}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
              <span>{yoursText}</span>
            {/if}
          </span>
        {/if}
      {/snippet}
    </RadioPad>
  {/each}
</div>

<style>
  .choices {
    display: grid;
    gap: 0.5rem;
  }

  /* Answers get a little more room than a preset pad: a taller target, and space for two lines. */
  .choices :global(.radio-pad) {
    min-height: 3rem;
    line-height: 1.3;
  }

  /* Locked: the choices nobody picked sink into the panel. */
  .choices :global(.radio-pad[data-dim='true']),
  .choices :global(.radio-pad[data-dim='true']:hover) {
    background: var(--hw-2);
    color: var(--hw-label-2);
  }

  .choices :global(.radio-pad[data-mark='right']) {
    border-color: var(--hw-label);
  }

  .mark {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-inline-start: auto;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--hw-label);
    white-space: nowrap;
  }

  /* On a lit pad the mark prints dark, like the pad's own words. */
  .choices :global(.radio-pad:has(input:checked) .mark) {
    color: inherit;
  }

  /* Both marks keep full-strength print: the tick or cross and the words tell them apart. */
  .mark svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
