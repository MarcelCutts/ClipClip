<script lang="ts">
  /**
   * Step 1: place your bet before you touch anything. Two native radio groups of rubber pads
   * (ui/RadioPad), so they work with a keyboard, a screen reader and a thumb. The "How sure are
   * you?" question appears once there's an answer to be sure about, laid out like every other one
   * on the site (quiz/Sure.svelte): three equal pads under a smaller label. It stays a radio group
   * here, because answering it commits nothing.
   */
  import type { Confidence, Prediction } from '../../lib/lab/ceilings';
  import { PREDICT } from '../../lib/lab/copy';
  import RadioPad from '../ui/RadioPad.svelte';

  interface Props {
    id: string;
    prediction: Prediction | null;
    confidence: Confidence | null;
    /** Shown when the reader tried to move on without answering. */
    nudge: boolean;
    onpredict: (value: Prediction) => void;
    onconfidence: (value: Confidence) => void;
  }

  let { id, prediction, confidence, nudge, onpredict, onconfidence }: Props = $props();

  const answers = Object.entries(PREDICT.options) as Array<[Prediction, string]>;
  const levels = Object.entries(PREDICT.confidence) as Array<[Confidence, string]>;
</script>

<fieldset class="group" id="{id}-question" aria-describedby={nudge ? `${id}-nudge` : undefined}>
  <legend>{PREDICT.question}</legend>
  <div class="options answers">
    {#each answers as [value, text] (value)}
      <RadioPad name="{id}-prediction" {value} label={text} checked={prediction === value} onchange={() => onpredict(value)} />
    {/each}
  </div>
  {#if nudge}
    <p class="nudge" id="{id}-nudge">{PREDICT.waiting}</p>
  {/if}
</fieldset>

{#if prediction && prediction !== 'not-sure'}
  <fieldset class="group sure">
    <legend>{PREDICT.sure}</legend>
    <div class="options levels">
      {#each levels as [value, text] (value)}
        <RadioPad
          name="{id}-confidence"
          {value}
          label={text}
          checked={confidence === value}
          onchange={() => onconfidence(value)}
        />
      {/each}
    </div>
  </fieldset>
{/if}

<style>
  .group {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.55rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--hw-bright);
  }

  /* The second, smaller question, labelled the way the quiz labels it. */
  .sure legend {
    margin-bottom: 0.45rem;
    font-size: var(--text-sm);
    color: var(--hw-label);
  }

  /*
   * Both groups share one width, so their edges line up. How sure: three equal pads in a row,
   * always. The answers are longer: on a phone they stack full width, as on the home page, so
   * "Gets quieter, stays" never has to squeeze into a third of the row.
   */
  .options {
    display: grid;
    gap: 0.4rem;
    max-width: 24rem;
  }

  .levels {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /* A pad in a row of three centres its words. */
  .levels :global(.radio-pad) {
    padding-inline: 0.5rem;
    text-align: center;
  }

  .levels :global(.radio-pad .main) {
    justify-content: center;
  }

  /* What to do before moving on, so in the action colour. */
  .nudge {
    margin: 0.55rem 0 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-action);
  }

  /* Room for the answers side by side, each on one line. The lab's live column is the container. */
  @container lab-live (min-width: 32rem) {
    .options {
      max-width: 36rem;
    }

    .answers {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .answers :global(.radio-pad) {
      padding-inline: 0.5rem;
      text-align: center;
    }

    .answers :global(.radio-pad .main) {
      justify-content: center;
    }
  }

  /* The smallest phones: the three pads keep their row, with less padding round the words. */
  @container lab-live (max-width: 19rem) {
    .levels :global(.radio-pad) {
      padding: 0.45rem 0.3rem;
    }
  }
</style>
