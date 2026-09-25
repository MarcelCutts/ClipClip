<script lang="ts">
  /**
   * W7b · The home page's prediction hook. One question with a bet ("How sure are you?"), then
   * the reveal: a before/after pair of scopes and one line. Predicting first is what makes the
   * reveal stick (Crouch et al. 2004; Brod 2021), and a sure bet on "Goes away" gets one more
   * line naming the surprise. "Not sure" skips the bet, since the reader has already said.
   *
   * Server-rendered in its question state. Nothing moves or sounds until the reader answers.
   * Not a landmark of its own: the home page wraps it in a labelled section, and the fieldset
   * already names the question for screen readers.
   */
  import { tick } from 'svelte';
  import type { Confidence } from '../lib/quiz/cards';
  import { PREDICT, surpriseLine } from '../lib/quiz/predict';
  import { showBelow } from '../lib/quiz/scroll';
  import { href } from '../lib/url';
  import Choices from './quiz/Choices.svelte';
  import ScopePair from './quiz/ScopePair.svelte';
  import Sure from './quiz/Sure.svelte';
  import HwButton from './ui/HwButton.svelte';

  const uid = $props.id();

  let choice = $state<string | undefined>();
  let confidence = $state<Confidence | undefined>();
  let revealed = $state(false);
  /** The one polite live region: the reveal sentence. */
  let announcement = $state('');
  let revealEl = $state<HTMLElement>();

  const verdict = $derived(
    !revealed || choice === PREDICT.unsure ? null : choice === PREDICT.correct ? 'Right.' : 'Not quite.',
  );
  /** A confident bet on "Goes away" gets its surprise named, as in the lab. */
  const surprise = $derived(revealed ? surpriseLine(choice, confidence) : null);

  async function reveal(sure?: Confidence) {
    if (revealed || choice === undefined) return;
    confidence = sure;
    revealed = true;
    announcement = [verdict, PREDICT.reveal, surprise].filter(Boolean).join(' ');
    await tick();
    showBelow(revealEl);
  }
</script>

<div class="panel predict">
  <fieldset class="ask">
    <legend class="question">
      <span class="lead">{PREDICT.lead}</span>
      {PREDICT.question}
    </legend>

    <Choices
      name="{uid}-guess"
      choices={PREDICT.choices}
      bind:value={choice}
      locked={revealed}
      correct={revealed ? PREDICT.correct : undefined}
      neutral={[PREDICT.unsure]}
      yoursText="Your guess"
    />

    {#if choice === PREDICT.unsure}
      <div class="commit">
        <HwButton primary locked={revealed} onclick={() => reveal()}>Show me what happens</HwButton>
      </div>
    {:else if choice !== undefined}
      <div class="commit">
        <Sure picked={confidence} locked={revealed} onpick={reveal} />
      </div>
    {/if}
  </fieldset>

  {#if revealed}
    <div class="reveal" bind:this={revealEl}>
      <div class="answer">
        {#if verdict}
          <p class="verdict">
            {#if verdict === 'Right.'}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.8" /></svg>
            {:else}
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
            {/if}
            {verdict}
          </p>
        {/if}
        <p class="line">{PREDICT.reveal}</p>
        {#if surprise}
          <p class="surprise">{surprise}</p>
        {/if}
      </div>
      <ScopePair />
      <p class="learn"><a href={href(PREDICT.learn.path)}>{PREDICT.learn.text}</a></p>
    </div>
  {/if}

  <p class="visually-hidden" role="status">{announcement}</p>
</div>

<style>
  .predict {
    /* Dropped straight into a .flow page (islands render inside a display: contents wrapper),
       sit in the reading column; inside any other wrapper this does nothing. */
    grid-column: content;
    container-type: inline-size;
    display: grid;
    gap: 1.1rem;
  }

  /* Links are white like the lettering, told apart by the underline (the page's rule), in the
     panel's own white so they hold up wherever the panel is shown. */
  .predict :global(a) {
    color: var(--hw-bright);
  }

  .ask {
    display: grid;
    gap: 1rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .question {
    float: left;
    width: 100%;
    padding: 0;
    font-size: clamp(1.0625rem, 1rem + 0.35vw, 1.25rem);
    font-weight: 400;
    line-height: 1.4;
    color: var(--hw-bright);
    text-wrap: pretty;
  }

  .lead {
    display: block;
    margin-bottom: 0.25rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label-2);
  }

  /* The three answers sit in a row when there is room for them. */
  @container (min-width: 34rem) {
    .ask :global(.choices) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .answer {
    display: grid;
    gap: 0.2rem;
  }

  .reveal {
    display: grid;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--hw-edge);
    /* When the answer scrolls it into view, stop short of the screen's edge. */
    scroll-margin-bottom: 1.25rem;
  }

  .verdict {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    color: var(--hw-label);
  }

  .verdict svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .line {
    max-width: 36rem;
    font-weight: 700;
    color: var(--hw-bright);
  }

  .surprise {
    max-width: 36rem;
    margin-top: 0.3rem;
    color: var(--hw-label);
  }

  .learn {
    font-size: var(--text-sm);
    font-weight: 700;
  }

  /* A link on its own line: a taller hit area than the text, without moving the layout. */
  .learn a {
    display: inline-block;
    padding-block: 0.3rem;
    margin-block: -0.3rem;
  }
</style>
