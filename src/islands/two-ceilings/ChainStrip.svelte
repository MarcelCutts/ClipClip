<script lang="ts">
  /**
   * The pre-training strip: the four parts of the chain, named before the lab asks anything,
   * left to right in the order the sound travels, joined by arrows that stretch to fill the
   * panel. Each ceiling also says, live, whether it is cutting peaks, with a tiny wave that goes
   * flat-topped when it is. It is an ordered list of four items; each arrow is decoration inside
   * the item it leaves, hidden from screen readers, and stretches to take up the slack.
   *
   * A ceiling whose state would give away the answer (before the reader has guessed) waits in
   * words instead, with a flat, empty mark: `null` and the `waiting` text.
   *
   * A phone can't fit four parts and real arrows on one row, so a narrow panel reads it in two
   * rows, like lines of text: Mixer → Recorder knob, then Howler → File. That puts the two
   * ceilings one above the other.
   */
  import type { Stage } from '../../lib/lab/ceilings';
  import { CHAIN, STAGE_WORDS } from '../../lib/lab/copy';

  interface Props {
    /** Each ceiling's state, or null while it waits for the reader's guess. */
    mixer: Stage | null;
    recorder: Stage | null;
    /** What a waiting ceiling says. */
    waiting?: string;
  }

  let { mixer, recorder, waiting = '' }: Props = $props();

  const WAVES: Record<Stage, string> = {
    clear: 'M0 11C1.5 11 3 6.5 4.5 6.5S7.5 11 9 11S12 6.5 13.5 6.5S16.5 11 18 11',
    at: 'M0 11C1.5 11 3 3 4.5 3S7.5 11 9 11S12 3 13.5 3S16.5 11 18 11',
    over: 'M0 11L2.4 3H6.6L9 11L11.4 3H15.6L18 11',
  };
</script>

{#snippet ceiling(state: Stage | null)}
  <span class="status" data-state={state ?? 'waiting'}>
    <svg class="mark" viewBox="0 0 18 12" width="18" height="12" aria-hidden="true">
      <line class="lid" x1="0" x2="18" y1="3" y2="3" />
      {#if state}
        <path class="wave" d={WAVES[state]} />
        {#if state === 'over'}<path class="flat" d="M2.4 3H6.6M11.4 3H15.6" />{/if}
      {:else}
        <line class="idle" x1="0" x2="18" y1="11" y2="11" />
      {/if}
    </svg>
    {state ? STAGE_WORDS[state] : waiting}
  </span>
{/snippet}

{#snippet arrow()}
  <span class="arrow" aria-hidden="true"></span>
{/snippet}

<ol class="chain" aria-label={CHAIN.label}>
  <li class="link">
    <div class="stage">
      <span class="name">{CHAIN.mixer.name}</span>
      <span class="sub">{CHAIN.mixer.sub}</span>
      {@render ceiling(mixer)}
    </div>
    {@render arrow()}
  </li>
  <li class="link">
    <div class="stage">
      <span class="name">{CHAIN.knob.name}</span>
      <span class="sub hw-label">{CHAIN.knob.sub}</span>
    </div>
    {@render arrow()}
  </li>
  <li class="link">
    <div class="stage">
      <span class="name">{CHAIN.howler.name}</span>
      <span class="sub">{CHAIN.howler.sub}</span>
      {@render ceiling(recorder)}
    </div>
    {@render arrow()}
  </li>
  <li class="link">
    <div class="stage">
      <span class="name">{CHAIN.file.name}</span>
      <span class="sub">{CHAIN.file.sub}</span>
    </div>
  </li>
</ol>

<style>
  .chain,
  .link {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
  }

  .chain {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Each part and the arrow leaving it. The last part has no arrow, so it doesn't stretch. */
  .link {
    flex: 1 1 auto;
    min-width: min-content;
  }

  .link:last-child {
    flex: 0 1 auto;
  }

  .stage {
    display: grid;
    align-content: start;
    gap: 0.15rem;
    flex: 0 1 auto;
    min-width: min-content;
    line-height: 1.2;
  }

  /* A line printed on the panel between the parts, the way the sound goes. It takes up the slack. */
  .arrow {
    position: relative;
    flex: 1 1 1rem;
    min-width: 0.9rem;
    margin-top: 0.62em;
    border-top: 1.5px solid var(--hw-label-2);
  }

  .arrow::after {
    content: '';
    position: absolute;
    right: 0;
    top: calc(-0.2rem - 0.75px);
    width: 0.4rem;
    height: 0.4rem;
    border-top: 1.5px solid var(--hw-label-2);
    border-right: 1.5px solid var(--hw-label-2);
    rotate: 45deg;
    translate: -0.05rem 0;
  }

  .name {
    font-weight: 700;
    color: var(--hw-bright);
  }

  .sub {
    font-size: var(--text-xs);
    color: var(--hw-label-2);
  }

  /* MASTER LEVEL as printed on the mixer: it names a control, so 14px like the fader names. */
  .sub.hw-label {
    font-size: 0.875rem;
    line-height: 1.2;
    color: var(--hw-label);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.2rem;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.25;
    color: var(--hw-label);
  }

  .status[data-state='over'] {
    color: var(--hw-bright);
  }

  /* Waiting for a guess: the words someone acts on stay readable, at the size of the others. */
  .status[data-state='waiting'] {
    font-weight: 400;
  }

  .mark {
    flex: none;
    display: inline;
    overflow: visible;
  }

  .lid {
    stroke: var(--screen-text);
    stroke-width: 1;
    stroke-dasharray: 2 1.5;
  }

  .wave {
    fill: none;
    stroke: var(--sig);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .flat {
    fill: none;
    stroke: var(--dmg);
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .idle {
    stroke: var(--hw-label-2);
    stroke-width: 1.25;
    stroke-dasharray: 1.5 2;
  }

  /* Two rows of two. Each row's arrow runs the full width of its column to the next part; the
     arrow leaving the end of the first row would point off the panel, so it goes. */
  @container two-ceilings (max-width: 26rem) {
    .chain {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem 0.4rem;
    }

    .link:nth-child(2) .arrow {
      display: none;
    }

    .name {
      font-size: var(--text-sm);
    }
  }

  @media (forced-colors: active) {
    .wave,
    .idle {
      stroke: CanvasText;
    }

    .flat {
      stroke: Highlight;
    }

    .arrow,
    .arrow::after {
      border-color: CanvasText;
    }
  }
</style>
