<script lang="ts">
  /**
   * W7 · Meter check: five retrieval cards, one at a time.
   *
   * Each card is a fieldset: the scenario as its legend, a picture of the booth where it helps,
   * two or three answers (the wrong ones are real misconceptions), then "How sure are you?".
   * Saying how sure commits the answer; the feedback says right or wrong in words, gives the
   * one-line why and links to where the site teaches it. At the end: the count, and a nudge
   * when a confident answer was wrong (those are the ones people remember). No points, badges
   * or timers. The root carries id="check" so the group chat can link straight here.
   */
  import { tick } from 'svelte';
  import {
    type Answer,
    CARDS,
    type Confidence,
    correctChoice,
    feedbackFor,
    isCorrect,
    reviewLinks,
    scoreLine,
    summarise,
    sureLine,
  } from '../lib/quiz/cards';
  import { showBelow } from '../lib/quiz/scroll';
  import { href } from '../lib/url';
  import BoothKnob from './quiz/BoothKnob.svelte';
  import Choices from './quiz/Choices.svelte';
  import HowlerLight from './quiz/HowlerLight.svelte';
  import MeterBridge from './quiz/MeterBridge.svelte';
  import Sure from './quiz/Sure.svelte';
  import HwButton from './ui/HwButton.svelte';

  const uid = $props.id();

  let index = $state(0);
  let picks = $state<Array<string | undefined>>(CARDS.map(() => undefined));
  let answers = $state<Array<Answer | undefined>>(CARDS.map(() => undefined));
  /** The one polite live region: the feedback sentence, once an answer is in. */
  let announcement = $state('');
  let rootEl = $state<HTMLElement>();
  let cardEl = $state<HTMLFieldSetElement>();
  let scoreEl = $state<HTMLParagraphElement>();
  let navEl = $state<HTMLElement>();

  const done = $derived(index >= CARDS.length);
  const summary = $derived(summarise(CARDS, answers));
  const sure = $derived(sureLine(summary));
  const review = $derived(reviewLinks(CARDS, summary));

  async function commit(confidence: Confidence) {
    const card = CARDS[index];
    const choice = picks[index];
    if (!card || choice === undefined) return;
    answers[index] = { choice, confidence };
    announcement = feedbackFor(card, choice);
    // The feedback appears under the button just pressed, often below the fold on a phone.
    // Show it, and the way on, without moving focus.
    await tick();
    showBelow(navEl);
  }

  async function go(to: number) {
    index = Math.max(0, Math.min(CARDS.length, to));
    announcement = '';
    await tick();
    // Next sits at the foot of a tall card, so on a phone the new question can start above the
    // screen. Bring the top of the panel back into view, then hand focus to the new card.
    if (rootEl && rootEl.getBoundingClientRect().top < 0) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      rootEl.scrollIntoView({ block: 'start', behavior: still ? 'instant' : 'smooth' });
    }
    (index >= CARDS.length ? scoreEl : cardEl)?.focus({ preventScroll: true });
  }

  function restart() {
    picks = CARDS.map(() => undefined);
    answers = CARDS.map(() => undefined);
    void go(0);
  }
</script>

<section id="check" class="panel check" aria-labelledby="{uid}-title" bind:this={rootEl}>
  <!-- The step header for every step-by-step widget: the count in words over the title. -->
  <header class="top">
    <p class="count">
      {#if done}Done{:else}Question {index + 1} of {CARDS.length}{/if}
    </p>
    <p class="title" id="{uid}-title">Meter check</p>
  </header>

  {#if !done}
    {@const card = CARDS[index]!}
    {@const answer = answers[index]}
    {#key card.id}
      <fieldset class="card" tabindex="-1" bind:this={cardEl}>
        <legend class="question">{card.question}</legend>

        <div class="body" data-scene={card.scene?.kind ?? 'none'}>
          {#if card.scene}
            <figure class="scene" data-kind={card.scene.kind}>
              {#if card.scene.kind === 'meters'}
                <MeterBridge
                  ch1={card.scene.ch1}
                  master={card.scene.master}
                  ch2={card.scene.ch2}
                  hideMaster={card.scene.hideMaster === true && !answer}
                />
                {#if card.scene.caption}
                  <figcaption>{card.scene.caption}</figcaption>
                {/if}
              {:else if card.scene.kind === 'howler'}
                <HowlerLight light={card.scene.light} />
              {:else if card.scene.tag}
                <BoothKnob tape={card.scene.tag.name} owner={card.scene.tag.owner} />
              {:else}
                <BoothKnob />
              {/if}
            </figure>
          {/if}

          <div class="respond">
            <Choices
              name="{uid}-{card.id}"
              choices={card.choices}
              bind:value={picks[index]}
              locked={answer !== undefined}
              correct={answer ? correctChoice(card).id : undefined}
            />
            {#if picks[index] !== undefined || answer}
              <Sure picked={answer?.confidence} locked={answer !== undefined} onpick={commit} />
            {/if}
          </div>
        </div>

        {#if answer}
          {@const right = isCorrect(card, answer.choice)}
          {@const chosen = card.choices.find((c) => c.id === answer.choice)}
          <div class="feedback">
            <p class="verdict">
              {#if right}
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.8" /></svg>
                Right.
              {:else}
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
                Not quite.
              {/if}
            </p>
            <p class="why">{chosen?.feedback}</p>
            <p class="learn"><a href={href(card.learn.path)}>{card.learn.text}</a></p>
          </div>
        {/if}
      </fieldset>
    {/key}

    {#if index > 0 || answer}
    <div class="nav" bind:this={navEl}>
      {#if index > 0}
        <HwButton onclick={() => go(index - 1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
          Back
        </HwButton>
      {/if}
      {#if answer}
        <span class="next">
          <HwButton primary onclick={() => go(index + 1)}>
            {index === CARDS.length - 1 ? 'See how you did' : 'Next question'}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
          </HwButton>
        </span>
      {/if}
    </div>
    {/if}
  {:else}
    <div class="summary">
      <p class="score" tabindex="-1" bind:this={scoreEl}>{scoreLine(summary)}</p>
      {#if sure}
        <p class="sure-line">{sure}</p>
      {/if}
      {#if review.length > 0}
        <p class="review-lead" id="{uid}-review">Go over these again</p>
        <ul class="review" aria-labelledby="{uid}-review">
          {#each review as link (link.path)}
            <li><a href={href(link.path)}>{link.text}</a></li>
          {/each}
        </ul>
      {/if}
      <span class="again"><HwButton onclick={restart}>Start again</HwButton></span>
    </div>
  {/if}

  <p class="visually-hidden" role="status">{announcement}</p>
</section>

<style>
  .check {
    /* Dropped straight into a .flow page (islands render inside a display: contents wrapper),
       sit in the reading column; inside any other wrapper this does nothing. */
    grid-column: content;
    container-type: inline-size;
    display: grid;
    gap: 1rem;
  }

  /* Links are white like the lettering, told apart by the underline (the page's rule), in the
     panel's own white so they hold up wherever the panel is shown. */
  .check :global(a) {
    color: var(--hw-bright);
  }

  .top {
    display: grid;
    gap: 0.3rem;
  }

  .count {
    font-size: var(--text-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label-2);
  }

  .title {
    font-family: var(--font-display);
    font-size: clamp(1.4rem, 1.25rem + 0.6vw, 1.625rem);
    font-weight: 700;
    line-height: 1.1;
    color: var(--hw-bright);
  }

  .card {
    display: grid;
    gap: 1rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: var(--radius-panel);
  }

  .card:focus {
    outline: none;
  }

  .card:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 6px;
  }

  /* Floating the legend turns it into an ordinary grid item in every engine, so it lays out
     like the rest of the card instead of sitting on the fieldset's border. */
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

  .body {
    display: grid;
    gap: 1.1rem;
  }

  /* The booth as drawn in a manual: straight on the panel, no plate. The meters bring their own
     well, as on the mixer. */
  .scene {
    display: grid;
    align-self: start;
    justify-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .scene[data-kind='howler'] {
    padding-top: 0.25rem;
  }

  .scene figcaption {
    max-width: 16rem;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--hw-label-2);
  }

  .respond {
    display: grid;
    align-content: start;
    gap: 1.1rem;
    min-width: 0;
    max-width: 34rem;
  }

  /* Wide enough: the booth picture on the left, answers beside it. */
  @container (min-width: 32rem) {
    .body:not([data-scene='none']) {
      grid-template-columns: 12.5rem minmax(0, 1fr);
      gap: 1.5rem;
    }
  }

  .feedback {
    display: grid;
    gap: 0.3rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--hw-edge);
  }

  .verdict {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    font-size: var(--text-base);
    color: var(--hw-label);
  }

  .verdict svg {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .why {
    max-width: 36rem;
    color: var(--hw-label);
  }

  .learn {
    margin-top: 0.45rem;
    font-size: var(--text-sm);
    font-weight: 700;
  }

  /* A link on its own line: a taller hit area than the text, without moving the layout. */
  .learn a,
  .review a {
    display: inline-block;
    padding-block: 0.3rem;
    margin-block: -0.3rem;
  }

  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    /* When an answer scrolls the way on into view, stop short of the screen's edge. */
    scroll-margin-bottom: 1.25rem;
  }

  .next {
    margin-inline-start: auto;
  }

  .summary {
    display: grid;
    justify-items: start;
    gap: 0.6rem;
  }

  /* The result reads like the listening test's: the display face, lit. */
  .score {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 1.3rem + 0.9vw, 2rem);
    font-weight: 700;
    line-height: 1.15;
    color: var(--hw-bright);
    border-radius: var(--radius-control);
  }

  .score:focus {
    outline: none;
  }

  .score:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 4px;
  }

  .sure-line {
    max-width: 34rem;
    color: var(--hw-label);
  }

  .review-lead {
    margin-top: 0.4rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label-2);
  }

  .review {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding-left: 1.1rem;
  }

  .review li::marker {
    color: var(--hw-label-2);
  }

  .again {
    margin-top: 0.6rem;
  }
</style>
