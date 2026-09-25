<script lang="ts">
  /**
   * "How sure are you?" Three pads (ui/Pad); pressing one commits the answer with that confidence.
   * They are toggle buttons, not radios, so arrowing through them can never submit by accident.
   * Once the answer is in they stay put (focus doesn't jump) but stop responding and leave the
   * tab order, so the next Tab reaches the feedback. The pressed one stays lit as a record of what
   * the reader said.
   */
  import { CONFIDENCE, type Confidence } from '../../lib/quiz/cards';
  import Pad from '../ui/Pad.svelte';

  interface Props {
    picked?: Confidence | undefined;
    locked?: boolean;
    onpick: (confidence: Confidence) => void;
  }

  let { picked, locked = false, onpick }: Props = $props();
</script>

<fieldset class="sure">
  <legend>How sure are you?</legend>
  <div class="row" data-locked={locked}>
    {#each CONFIDENCE as option (option.id)}
      <Pad
        pressed={picked === option.id}
        aria-disabled={locked}
        tabindex={locked ? -1 : undefined}
        onclick={() => {
          if (!locked) onpick(option.id);
        }}
      >
        {option.label}
      </Pad>
    {/each}
  </div>
</fieldset>

<style>
  .sure {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.45rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label);
  }

  /* Three across, even on a phone: each pad centres its words and gives up some side padding. */
  .row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .row :global(.pad) {
    justify-content: center;
    padding-inline: 0.35rem;
    text-align: center;
  }

  /* Locked: a record of the answer. The pressed pad stays lit; the others sink into the panel. */
  .row[data-locked='true'] :global(.pad) {
    cursor: default;
  }

  .row[data-locked='true'] :global(.pad:active) {
    translate: none;
  }

  .row[data-locked='true'] :global(.pad[aria-pressed='false']),
  .row[data-locked='true'] :global(.pad[aria-pressed='false']:hover) {
    background: var(--hw-2);
    color: var(--hw-label-2);
  }
</style>
