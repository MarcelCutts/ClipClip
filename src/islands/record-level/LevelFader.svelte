<script lang="ts">
  /**
   * MASTER LEVEL, drawn as the site's fader from off to fully up, with a dot for each 3 dB notch
   * under the slot and − / + buttons, so "one notch" is one tap on a phone. Once taped, a strip of
   * tape marked REC sits at the taped notch with a pen line up to the cap, so any movement shows:
   * the cap and the line part company.
   */
  import { formatDb } from '../../lib/dsp/db';
  import { LEVEL_NOTCHES, NOTCH_DB } from '../../lib/record/model';
  import Fader from '../ui/Fader.svelte';

  interface Props {
    id: string;
    /** MASTER LEVEL, dB. −∞ is off. */
    value: number;
    /** The taped notch, once there is one. */
    tape: number | null;
    /** The spoken value at a setting: where it is, and where what's playing lands. */
    speak: (value: number) => string;
    oninput: (value: number) => void;
  }

  let { id, value, tape, speak, oninput }: Props = $props();

  // The slider moves through the notches by position, off first, so every step is one notch.
  const last = LEVEL_NOTCHES.length - 1;
  const notch = (i: number) => LEVEL_NOTCHES[i] ?? LEVEL_NOTCHES[last]!;
  const indexOf = (db: number) => Math.max(0, LEVEL_NOTCHES.indexOf(db));
  const at = (i: number) => (i / last).toFixed(4);
</script>

<div class="level" class:taped={tape !== null}>
  <Fader
    {id}
    label="MASTER LEVEL"
    value={indexOf(value)}
    min={0}
    max={last}
    step={1}
    format={(i) => formatDb(notch(i))}
    speak={(i) => speak(notch(i))}
    steppers
    oninput={(i) => oninput(notch(i))}
  />
  <div class="notches" aria-hidden="true">
    {#each LEVEL_NOTCHES as n, i (n)}
      <span class="dot" class:off-dot={i === 0} style:--at={at(i)}></span>
    {/each}
    {#if tape !== null}
      <span class="pen" style:--at={at(indexOf(tape))}></span>
      <span class="tape" style:--at={at(indexOf(tape))}>REC</span>
    {/if}
  </div>
  <p class="hint">0&nbsp;dB is fully up. Each notch here is {formatDb(NOTCH_DB, { signed: false })}, down to off.</p>
</div>

<style>
  .level {
    /* These match ui/Fader.svelte: the cap's width, so dots sit under the cap's centre line, and
       a stepper button plus its gap, so the dots span the slot and not the − and + buttons. */
    --cap: 1.15rem;
    --stepper: calc(2.75rem + 0.4rem);
    display: grid;
    min-width: 0;
  }

  .notches {
    position: relative;
    height: 1.9rem;
    margin: -0.35rem var(--stepper) 0;
    pointer-events: none;
  }

  .dot,
  .tape,
  .pen {
    position: absolute;
    left: calc(var(--cap) / 2 + var(--at) * (100% - var(--cap)));
    translate: -50% 0;
  }

  .dot {
    top: 0.1rem;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--hw-label-2);
    opacity: 0.7;
  }

  /* Off: a ring, not a dot. */
  .off-dot {
    width: 6px;
    height: 6px;
    top: 0;
    border: 1.25px solid var(--hw-label-2);
    background: none;
  }

  /* A strip of gaffer tape stuck to the panel under the cap, pen line and all. */
  .tape {
    top: 0.35rem;
    padding: 0.2rem 0.45rem 0.15rem;
    background: var(--tape);
    color: var(--tape-ink);
    font-family: var(--font-stencil);
    font-weight: 800;
    font-size: 0.875rem;
    line-height: 1;
    letter-spacing: 0.04em;
    clip-path: polygon(0 8%, 6% 0, 100% 0, 96% 30%, 100% 62%, 95% 100%, 4% 100%, 0 70%, 3% 40%);
    rotate: -1.5deg;
  }

  /* The pen line runs from the tape up across the slot and the cap, like a line drawn across
     knob and panel. On the mark it lines up with the cap's own index line; off it, they part. */
  .pen {
    top: -1.75rem;
    width: 2px;
    height: 2.2rem;
    background: var(--tape);
    opacity: 0.9;
  }

  .hint {
    margin: 0.1rem 0 0;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--hw-label-2);
  }

  @media (forced-colors: active) {
    .dot {
      background: CanvasText;
      forced-color-adjust: none;
    }

    .off-dot {
      background: none;
      border-color: CanvasText;
    }

    .tape,
    .pen {
      background: CanvasText;
      color: Canvas;
      forced-color-adjust: none;
    }
  }
</style>
