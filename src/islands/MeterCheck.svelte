<script lang="ts">
  /**
   * W7 · Meter check: four questions on the DJ's lines to know by heart, one at a time, printed
   * as a card like the checklists: a title strip saying which question it is, the question, ruled
   * answers, and "How sure are you?".
   *
   * Each question is a fieldset: the question as its legend, a picture of the booth where it
   * helps, two or three answers (the wrong ones are real habits), then the confidence scale.
   * Saying how sure commits the answer; the feedback says right or wrong in words, gives the
   * one-line why and links to the guide section that covers it. At the end: the count, how many
   * wrong answers were certain, and the sections to read again. No points, badges or timers. The
   * group chat links to the guide's heading above this card, which carries the anchor.
   *
   * A card, not a panel: black is kept for the gear. The pictures of the booth (the meters, the
   * BOOTH MONITOR knob) are gear, so each sits on a scrap of black faceplate.
   */
  import { tick } from 'svelte';
  import {
    type Answer,
    CARDS,
    type Confidence,
    correctChoice,
    feedbackFor,
    isCorrect,
    REVIEW_LEAD,
    reviewLinks,
    scoreLine,
    summarise,
    sureLine,
  } from '../lib/quiz/cards';
  import { showBelow } from '../lib/quiz/scroll';
  import { href } from '../lib/url';
  import BoothKnob from './quiz/BoothKnob.svelte';
  import Choices from './quiz/Choices.svelte';
  import Key from './quiz/Key.svelte';
  import MeterBridge from './quiz/MeterBridge.svelte';
  import Sure from './quiz/Sure.svelte';

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
    // screen, or under the sticky tabs. Bring the top of the card back into view (the page's
    // scroll-padding keeps it clear of the tabs), then hand focus to the new question.
    const clear = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (rootEl && rootEl.getBoundingClientRect().top < clear) {
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

<!-- Named for screen readers; the guide's heading above it shows the name, so the strip shows
     how far through you are instead of saying it twice. -->
<section class="check" aria-label="Meter check" bind:this={rootEl}>
  <header class="strip">
    <p class="title">{#if done}Done{:else}Question {index + 1} of {CARDS.length}{/if}</p>
  </header>

  <div class="body">
    {#if !done}
      {@const card = CARDS[index]!}
      {@const answer = answers[index]}
      {#key card.id}
        <fieldset class="card" tabindex="-1" bind:this={cardEl}>
          <legend class="question">{card.question}</legend>

          <div class="qa" data-scene={card.scene?.kind ?? 'none'}>
            {#if card.scene}
              <figure class="scene" data-kind={card.scene.kind}>
                <div class="plate">
                  {#if card.scene.kind === 'meters'}
                    <MeterBridge ch1={card.scene.ch1} master={card.scene.master} ch2={card.scene.ch2} />
                  {:else if card.scene.tag}
                    <BoothKnob tape={card.scene.tag.name} owner={card.scene.tag.owner} />
                  {:else}
                    <BoothKnob />
                  {/if}
                </div>
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
            <Key onclick={() => go(index - 1)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
              Back
            </Key>
          {/if}
          {#if answer}
            <span class="next">
              <Key primary onclick={() => go(index + 1)}>
                {index === CARDS.length - 1 ? 'See your score' : 'Next question'}
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
              </Key>
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
          <p class="review-lead" id="{uid}-review">{REVIEW_LEAD}</p>
          <ul class="review" aria-labelledby="{uid}-review">
            {#each review as link (link.path)}
              <li><a href={href(link.path)}>{link.text}</a></li>
            {/each}
          </ul>
        {/if}
        <span class="again"><Key onclick={restart}>Start again</Key></span>
      </div>
    {/if}
  </div>

  <p class="visually-hidden" role="status">{announcement}</p>
</section>

<style>
  /*
   * A printed card, like the checklists: a 2px ink frame whose top edge is the strip's (by night
   * it lifts the strip off the display), the page's paper and ink, hairlines between the answers.
   * Dropped straight into a .flow page (islands render inside a display: contents wrapper), it
   * sits in the reading column; inside any other wrapper that does nothing.
   */
  .check {
    grid-column: content;
    display: grid;
    border: 2px solid var(--ink);
    border-top-color: var(--strip-edge);
    background: var(--paper);
    color: var(--ink);
  }

  /* The title strip: which question this is, in words. */
  .strip {
    padding: 0.55rem 0.8rem;
    background: var(--strip);
    color: var(--on-strip);
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
  }

  .body {
    container-type: inline-size;
    display: grid;
    gap: 1rem;
    padding: 0.8rem 0.8rem 1rem;
  }

  .card {
    display: grid;
    gap: 1rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .card:focus {
    outline: none;
  }

  .card:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 4px;
  }

  /* Floating the legend turns it into an ordinary grid item in every engine, so it lays out
     like the rest of the card instead of sitting on the fieldset's border. */
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

  .qa {
    display: grid;
    gap: 1.1rem;
  }

  .scene {
    display: grid;
    align-self: start;
    gap: 0.45rem;
    margin: 0;
  }

  /* A scrap of faceplate: the gear is drawn for the black panel it sits on, as on the drills. */
  .plate {
    display: grid;
    justify-items: center;
    align-items: center;
    padding: 0.8rem 0.6rem;
    border: 1px solid var(--panel-edge);
    border-radius: var(--radius-panel);
    background: var(--hw);
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
    .qa:not([data-scene='none']) {
      grid-template-columns: 13rem minmax(0, 1fr);
      gap: 1.5rem;
    }
  }

  .feedback {
    display: grid;
    gap: 0.3rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--rule);
  }

  /* Right or not, in words and a shape. */
  .verdict {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-base);
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

  .why {
    max-width: 38rem;
    color: var(--ink-2);
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

  /* The result: the display face, the biggest words on the card. */
  .score {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 1.3rem + 0.9vw, 2rem);
    font-weight: 700;
    line-height: 1.15;
    color: var(--ink);
    border-radius: var(--radius-control);
  }

  .score:focus {
    outline: none;
  }

  .score:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 4px;
  }

  .sure-line {
    max-width: 36rem;
    color: var(--ink-2);
  }

  .review-lead {
    margin-top: 0.4rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--ink);
  }

  .review {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding-left: 1.1rem;
  }

  .again {
    margin-top: 0.6rem;
  }

  @media (forced-colors: active) {
    .strip {
      forced-color-adjust: none;
      background: CanvasText;
      color: Canvas;
    }
  }
</style>
