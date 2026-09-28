<script lang="ts">
  /**
   * The head of one stage of the chain: its place in the order the sound travels, and its name.
   * The number is real: the sound reaches the stages in this order, and what one stage cuts, the
   * next receives. Where the wave stands against the stage's ceiling is said once, by the stage's
   * own light and screen, not again here.
   */
  interface Props {
    no: number;
    name: string;
    /** The level of the stage's heading: one under the step's. */
    level: 4 | 5 | 6;
  }

  let { no, name, level }: Props = $props();
</script>

<div class="stage-head">
  <svelte:element this={`h${level}`} class="name">
    <span class="no" aria-hidden="true">{no}</span><span class="visually-hidden">{no}. </span>{name}
  </svelte:element>
</div>

<style>
  .stage-head {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    line-height: 1.2;
    color: var(--hw-bright);
  }

  /* The stage's place in the chain, printed in a square like a card's code. */
  .no {
    flex: none;
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: 1.5px solid var(--hw-label);
    font-size: var(--text-sm);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  @media (forced-colors: active) {
    .no {
      border-color: CanvasText;
    }
  }
</style>
