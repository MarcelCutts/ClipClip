<script lang="ts">
  /**
   * The answers on a quiz card, printed as ruled rows the way a card lists its lines: a ring to
   * mark, then the answer. Native radios underneath (the ring is the radio), so arrow keys, taps
   * and screen readers work as usual, and the whole row takes the tap. The chosen answer prints in
   * the action colour with its ring filled, as a checklist prints its responses.
   *
   * Once `locked`, the rows say right and wrong in words and shapes, never colour alone: a tick
   * and "Right answer" on the right one, a cross and "Your answer" on a wrong pick. Answers nobody
   * picked step back, like a ticked line on a checklist.
   */

  interface Props {
    /** Radio group name, unique on the page. */
    name: string;
    choices: ReadonlyArray<{ id: string; label: string }>;
    /** The chosen id (bindable). */
    value?: string | undefined;
    /** After the answer is in: no more changes, and the marks show. */
    locked?: boolean;
    /** Id of the right choice, marked once locked. */
    correct?: string | undefined;
  }

  let { name, choices, value = $bindable(), locked = false, correct }: Props = $props();

  type Mark = 'right' | 'wrong' | null;

  function markFor(id: string): Mark {
    if (!locked) return null;
    if (id === correct) return 'right';
    if (id === value && correct !== undefined) return 'wrong';
    return null;
  }
</script>

<div class="choices" data-locked={locked}>
  {#each choices as choice (choice.id)}
    {@const mark = markFor(choice.id)}
    <label class="row" data-mark={mark} data-dim={locked && mark === null && choice.id !== value}>
      <input
        type="radio"
        {name}
        value={choice.id}
        checked={value === choice.id}
        disabled={locked}
        onchange={() => (value = choice.id)}
      />
      <span class="text">{choice.label}</span>
      {#if mark}
        <span class="mark">
          {#if mark === 'right'}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.8" /></svg>
            <span>Right answer</span>
          {:else}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
            <span>Your answer</span>
          {/if}
        </span>
      {/if}
    </label>
  {/each}
</div>

<style>
  /* Rows ruled like a checklist card's lines: a hairline above the first and under each. */
  .choices {
    display: grid;
    border-top: 1px solid var(--rule);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.15rem;
    min-height: 3rem;
    padding: 0.55rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    line-height: 1.35;
    cursor: pointer;
  }

  .choices[data-locked='false'] .row:hover {
    background: var(--paper-2);
  }

  /* The ring is the radio itself, drawn in ink. Chosen, it fills in the action colour. */
  input {
    appearance: none;
    flex: none;
    display: grid;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--paper);
    cursor: inherit;
  }

  input:checked {
    border-color: var(--action);
    background: radial-gradient(circle, var(--action) 0 42%, var(--paper) 47%);
  }

  /* The whole row shows the focus, since the whole row is the target. */
  input:focus-visible {
    outline: none;
  }

  .row:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }

  input:disabled {
    cursor: default;
  }

  .choices[data-locked='true'] .row {
    cursor: default;
  }

  .text {
    flex: 1 1 12rem;
    min-width: 0;
    font-weight: 700;
    color: var(--ink);
    text-wrap: pretty;
  }

  /* Locked: the answers nobody picked step back, unless they're the right one. */
  .row[data-dim='true'] .text {
    color: var(--ink-3);
  }

  /* The reader's pick: what they did, so it takes the action colour, like a checklist's response. */
  .row:has(input:checked) .text {
    color: var(--action);
  }

  .row[data-dim='true'] input {
    border-color: var(--rule);
  }

  /* Right or wrong, in words and a shape, at the row's end; under the answer when it's long. */
  .mark {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-inline-start: auto;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
  }

  .mark svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Gradients drop out in forced colours, so the filled ring takes the system highlight. */
  @media (forced-colors: active) {
    input {
      forced-color-adjust: none;
      border-color: CanvasText;
      background: Canvas;
    }

    input:checked {
      border-color: Highlight;
      background: radial-gradient(circle, Highlight 0 42%, Canvas 47%);
    }

    .row:has(input:focus-visible) {
      outline-color: Highlight;
    }
  }
</style>
