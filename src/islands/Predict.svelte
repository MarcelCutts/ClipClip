<script lang="ts">
  /**
   * W7b · The guide's prediction hook, printed as a card: a title strip naming the situation, one
   * question with ruled answers, a bet ("How sure are you?"), then the reveal: a before/after pair
   * of scopes and one line. Predicting first is what makes the reveal stick (Crouch et al. 2004;
   * Brod 2021), and a sure bet on "Goes away" gets one more line naming the surprise. "Not sure"
   * skips the bet, since the reader has already said.
   *
   * A card, not a panel: questions are printed things, and black panels are kept for the gear.
   * The scopes in the reveal are gear, so they stay dark screens on the card.
   *
   * Server-rendered in its question state. Nothing moves or sounds until the reader answers.
   * Not a landmark of its own: the guide wraps it in its part, and the fieldset names the
   * question for screen readers.
   */
  import { tick } from 'svelte';
  import type { Confidence } from '../lib/quiz/cards';
  import { PREDICT, surpriseLine } from '../lib/quiz/predict';
  import { showBelow } from '../lib/quiz/scroll';
  import { href } from '../lib/url';
  import Choices from './quiz/Choices.svelte';
  import Key from './quiz/Key.svelte';
  import ScopePair from './quiz/ScopePair.svelte';
  import Sure from './quiz/Sure.svelte';

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

<div class="predict">
  <p class="strip">{PREDICT.title}</p>

  <div class="body">
    <fieldset class="ask">
      <legend class="question">{PREDICT.question}</legend>

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
          <Key primary locked={revealed} onclick={() => reveal()}>Show me what happens</Key>
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
  </div>

  <p class="visually-hidden" role="status">{announcement}</p>
</div>

<style>
  /*
   * A printed card, like the checklists: a 2px ink frame whose top edge is the strip's (by night
   * it lifts the strip off the display), the page's paper and ink, hairlines between the answers.
   * Dropped straight into a .flow page (islands render inside a display: contents wrapper), it
   * sits in the reading column; inside any other wrapper that does nothing.
   */
  .predict {
    grid-column: content;
    container-type: inline-size;
    display: grid;
    border: 2px solid var(--ink);
    border-top-color: var(--strip-edge);
    background: var(--paper);
    color: var(--ink);
  }

  .strip {
    margin: 0;
    padding: 0.55rem 0.8rem;
    background: var(--strip);
    color: var(--on-strip);
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    line-height: 1.3;
  }

  .body {
    display: grid;
    gap: 1.1rem;
    padding: 0.8rem 0.8rem 1rem;
  }

  .ask {
    display: grid;
    gap: 1rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Floating the legend turns it into an ordinary grid item in every engine. */
  .question {
    float: left;
    width: 100%;
    padding: 0;
    font-size: var(--text-rule);
    font-weight: 400;
    line-height: 1.45;
    color: var(--ink);
    text-wrap: pretty;
  }

  .answer {
    display: grid;
    gap: 0.25rem;
  }

  .reveal {
    display: grid;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
    /* When the answer scrolls it into view, stop short of the screen's edge. */
    scroll-margin-bottom: 1.25rem;
  }

  /* Right or not, in words and a shape. */
  .verdict {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    color: var(--ink);
  }

  .verdict svg {
    flex: none;
    width: 1.15rem;
    height: 1.15rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .line {
    max-width: 38rem;
    font-weight: 700;
    color: var(--ink);
  }

  .surprise {
    max-width: 38rem;
    margin-top: 0.3rem;
    color: var(--ink-2);
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

  @media (forced-colors: active) {
    .strip {
      forced-color-adjust: none;
      background: CanvasText;
      color: Canvas;
    }
  }
</style>
