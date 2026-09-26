<script lang="ts">
  /**
   * "How sure are you?" A three-step scale printed on the card, least sure first; pressing a step
   * commits the answer with that confidence. The steps are toggle buttons, not radios, so arrowing
   * through them can never submit by accident. Once the answer is in they stay put (focus doesn't
   * jump) but stop responding and leave the tab order, so the next Tab reaches the feedback. The
   * pressed step stays filled as a record of what the reader said.
   *
   * It's a scale, not a list of answers, so it's drawn as one printed strip cut in three rather
   * than as rows: it never looks like a fourth answer.
   */
  import { CONFIDENCE, type Confidence } from '../../lib/quiz/cards';

  interface Props {
    picked?: Confidence | undefined;
    locked?: boolean;
    onpick: (confidence: Confidence) => void;
  }

  let { picked, locked = false, onpick }: Props = $props();
</script>

<fieldset class="sure">
  <legend>How sure are you?</legend>
  <div class="scale" data-locked={locked}>
    {#each CONFIDENCE as option (option.id)}
      <button
        type="button"
        class="step"
        aria-pressed={picked === option.id}
        aria-disabled={locked ? 'true' : undefined}
        tabindex={locked ? -1 : undefined}
        onclick={() => {
          if (!locked) onpick(option.id);
        }}
      >
        {option.label}
      </button>
    {/each}
  </div>
</fieldset>

<style>
  .sure {
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
    color: var(--ink);
  }

  /* One printed strip in three equal steps, even on a phone. */
  .scale {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 30rem;
    border: 2px solid var(--ink);
    border-radius: var(--radius-control);
  }

  .step {
    position: relative;
    min-width: 0;
    min-height: 2.75rem;
    padding: 0.45rem 0.35rem;
    border: 0;
    border-inline-start: 1px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    cursor: pointer;
  }

  .step:first-child {
    border-inline-start: 0;
    border-radius: 2px 0 0 2px;
  }

  .step:last-child {
    border-radius: 0 2px 2px 0;
  }

  .scale[data-locked='false'] .step:hover {
    background: var(--paper-2);
  }

  /* The step the reader pressed: filled in the action colour, as the chosen answer is lettered. */
  .step[aria-pressed='true'],
  .scale[data-locked='false'] .step[aria-pressed='true']:hover {
    background: var(--action);
    color: var(--paper);
  }

  /* Inside the step, so the ring never merges with the strip's own printed edge. */
  .step:focus-visible {
    z-index: 1;
    outline: 3px solid var(--focus);
    outline-offset: -6px;
  }

  /* Locked: a record of the answer. The pressed step stays filled; the others step back. */
  .scale[data-locked='true'] .step {
    cursor: default;
  }

  .scale[data-locked='true'] .step[aria-pressed='false'] {
    color: var(--ink-3);
  }

  @media (forced-colors: active) {
    .step[aria-pressed='true'],
    .scale[data-locked='false'] .step[aria-pressed='true']:hover {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }
  }
</style>
