<script lang="ts">
  /**
   * One step of the practice checklist, set like a line of a quick reference handbook: its number
   * (a tick once done), the challenge and, after a dotted leader, the response. Before the step is
   * done the response is the target state, in the action cyan on the step you're on; after, it's
   * what was actually done.
   *
   * The step being worked on also carries its read-then-do line (worked example only). The step
   * just finished carries what its key said, so the result stays with its step.
   */
  interface Props {
    n: number;
    of: number;
    label: string;
    response: string;
    state: 'done' | 'current' | 'todo';
    /** The read-then-do line, for the current step. */
    instruction?: string | null;
    /** What the key said, for the step just finished. */
    message?: string | null;
  }

  let { n, of, label, response, state, instruction = null, message = null }: Props = $props();

  const STATE_WORDS = { done: 'Done', current: 'Now', todo: 'To do' } as const;
</script>

<div class="row" data-state={state}>
  <span class="num" aria-hidden="true">
    {#if state === 'done'}
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6.5 5 9.2 10 3" /></svg>
    {:else}
      {n}
    {/if}
  </span>
  <!-- The dotted leader separates challenge and response by eye; the hidden comma does it by ear. -->
  <p class="line">
    <span class="label"
      ><span class="visually-hidden">{STATE_WORDS[state]}, step {n} of {of}: </span>{label}<span class="visually-hidden"
        >,</span
      ></span
    >
    <span class="leader" aria-hidden="true"></span>
    <span class="response">{response}</span>
  </p>
  {#if instruction}
    <p class="instruction">{instruction}</p>
  {/if}
  {#if message}
    <p class="message">
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" /></svg>
      <span>{message}</span>
    </p>
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 1.1rem minmax(0, 1fr);
    column-gap: 0.6rem;
    align-items: start;
    padding: 0.4rem 0.6rem;
  }

  /* The step's number in plain bold, as a printed checklist numbers its lines. */
  .num {
    display: grid;
    place-items: center start;
    min-height: 1.6rem;
    padding-top: 0.2rem;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label-2);
  }

  [data-state='current'] .num {
    color: var(--hw-bright);
  }

  [data-state='done'] .num {
    color: var(--hw-label);
  }

  .num svg {
    width: 0.8rem;
    height: 0.8rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Challenge ........ response, as on a printed checklist. */
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.4rem;
    min-height: 1.6rem;
    margin: 0;
    padding-top: 0.2rem;
    font-size: var(--text-sm);
    line-height: 1.3;
  }

  .label {
    font-weight: 700;
    color: var(--hw-label);
  }

  [data-state='current'] .label {
    color: var(--hw-bright);
  }

  [data-state='todo'] .label {
    color: var(--hw-label-2);
  }

  .leader {
    flex: 1 1 1.5rem;
    min-width: 1.5rem;
    border-bottom: 1.5px dotted color-mix(in oklab, var(--hw-label-2) 60%, transparent);
    translate: 0 -0.25em;
  }

  .response {
    margin-left: auto;
    text-align: right;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--hw-label-2);
  }

  [data-state='done'] .response {
    color: var(--hw-label);
  }

  /* The step you're on: its target is what to do, so it reads at full size in the action cyan. */
  [data-state='current'] .response {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-action);
  }

  /* The step's words take the row's full width: fewer lines, so more of the step fits on one
     screen, and a message's tick sits under the step's own. */
  .instruction,
  .message {
    grid-column: 1 / -1;
    margin: 0.4rem 0 0.1rem;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  .message {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin-top: 0.3rem;
  }

  .icon {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    margin-top: 0.12rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (forced-colors: active) {
    [data-state='current'] .response {
      color: CanvasText;
    }
  }
</style>
