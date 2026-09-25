<script lang="ts">
  /**
   * The quick check after step 4: a 2×2 of which control can fix crunch made in the mixer, and
   * crunch made at the recorder. Each row is a group of two toggle pads (pick every one that can),
   * so it works with a keyboard, a screen reader and a thumb. Check locks the pads and gives each
   * row its answer in words, right or not, with the reason; focus goes to the answers, so they're
   * read out once. The answers come from canFix (ceilings.ts), so they follow the chain.
   *
   * The lab owns the picks, so going back a step and returning keeps them.
   */
  import { tick } from 'svelte';
  import { type Ceiling, canFix, type Fixer } from '../../lib/lab/ceilings';
  import { CHECK } from '../../lib/lab/copy';
  import HwButton from '../ui/HwButton.svelte';
  import Pad from '../ui/Pad.svelte';

  interface Props {
    id: string;
    /** What the reader has picked for each place. */
    picks: Record<Ceiling, readonly Fixer[]>;
    checked: boolean;
    onpick: (ceiling: Ceiling, fixer: Fixer) => void;
    oncheck: () => void;
  }

  let { id, picks, checked, onpick, oncheck }: Props = $props();

  const ceilings: Ceiling[] = ['mixer', 'recorder'];
  const fixers: Fixer[] = ['channels', 'knob'];
  const rightFor = (ceiling: Ceiling) => fixers.every((f) => canFix(f, ceiling) === picks[ceiling].includes(f));

  let answers: HTMLElement | undefined = $state();

  async function check() {
    oncheck();
    await tick();
    answers?.focus();
  }
</script>

<div class="check">
  <fieldset class="group" aria-describedby="{id}-check-question">
    <legend class="title">{CHECK.title}</legend>
    <p class="question" id="{id}-check-question">{CHECK.question}</p>
    {#each ceilings as ceiling (ceiling)}
      <fieldset class="row">
        <legend class="row-label">{CHECK.rows[ceiling]}</legend>
        <div class="pads">
          {#each fixers as fixer (fixer)}
            <Pad pressed={picks[ceiling].includes(fixer)} disabled={checked} onclick={() => onpick(ceiling, fixer)}>
              {CHECK.controls[fixer]}
            </Pad>
          {/each}
        </div>
      </fieldset>
    {/each}
  </fieldset>
  {#if checked}
    <div class="answers" tabindex="-1" bind:this={answers}>
      {#each ceilings as ceiling (ceiling)}
        {@const right = rightFor(ceiling)}
        <p class="answer" data-right={right}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {#if right}<path d="M3 8.6l3.1 3.1L13 4.8" />{:else}<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />{/if}
          </svg>
          <span>
            <strong>{CHECK.short[ceiling]}: {right ? CHECK.right : CHECK.wrong}</strong>
            {CHECK.why[ceiling]}
          </span>
        </p>
      {/each}
    </div>
  {:else}
    <span class="go"><HwButton primary onclick={check}>{CHECK.check}</HwButton></span>
  {/if}
</div>

<style>
  /* Its own section of the panel, under a printed line: no box of its own. */
  .check {
    display: grid;
    gap: 0.6rem;
    justify-self: stretch;
    margin-top: 0.5rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--hw-edge);
  }

  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* A legend sits outside its fieldset's grid, so it keeps its own space below. */
  .group {
    display: grid;
    gap: 0.6rem;
  }

  .row {
    display: grid;
  }

  .title,
  .row-label {
    padding: 0;
  }

  .title {
    margin-bottom: 0.35rem;
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    line-height: 1.2;
    color: var(--hw-bright);
  }

  .question,
  .row-label {
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--hw-label);
  }

  .row-label {
    margin-bottom: 0.35rem;
    font-weight: 700;
    color: var(--hw-bright);
  }

  .question,
  .answer {
    margin: 0;
  }

  .pads {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }

  /* Locked after Check: the pads keep their lights, but read as done. */
  .pads :global(.pad:disabled) {
    cursor: default;
    opacity: 0.8;
  }

  .go {
    margin-top: 0.2rem;
  }

  .answers {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.2rem;
  }

  .answers:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 3px;
    border-radius: var(--radius-control);
  }

  /* Right or not in words and a shape, never colour alone. */
  .answer {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-label);
  }

  /* Right or not on a line of its own, then the reason. */
  .answer strong {
    display: block;
    color: var(--hw-bright);
  }

  .answer svg {
    width: 1rem;
    height: 1rem;
    margin-top: 0.15rem;
    fill: none;
    stroke: var(--hw-bright);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (forced-colors: active) {
    .answer svg {
      stroke: CanvasText;
    }
  }
</style>
