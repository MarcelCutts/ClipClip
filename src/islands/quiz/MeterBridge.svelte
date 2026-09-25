<script lang="ts">
  /**
   * The XDJ-RX2's meter section as it sits on the panel: CH1, the stereo MASTER meter with its
   * CLIP light, CH2, and the dB scale printed between them. Built from the shared LedMeter, so
   * every reading also reaches screen readers as text.
   *
   * With `hideMaster`, the middle meters stay dark behind a question mark until the reader has
   * answered; when it is revealed it climbs to its level one LED at a time (instantly with
   * reduced motion), so the reader sees where the blend goes.
   */
  import { untrack } from 'svelte';
  import { clipState } from '../../lib/blend/model';
  import { METER_SEGMENTS } from '../../lib/xdj';
  import LedMeter from '../ui/LedMeter.svelte';

  interface Props {
    ch1: number;
    master: number;
    ch2: number;
    hideMaster?: boolean;
  }

  let { ch1, master, ch2, hideMaster = false }: Props = $props();

  const SILENT = Number.NEGATIVE_INFINITY;
  const STEP_MS = 45;

  let shown = $state(untrack(() => (hideMaster ? SILENT : master)));
  let wasHidden = untrack(() => hideMaster);

  $effect(() => {
    const target = master;
    if (hideMaster) {
      shown = SILENT;
      wasHidden = true;
      return;
    }
    const climb = wasHidden;
    wasHidden = false;
    if (!climb || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown = target;
      return;
    }
    const steps = METER_SEGMENTS.map((s) => s.db).filter((db) => db <= target);
    let i = 0;
    const timer = window.setInterval(() => {
      shown = i < steps.length ? steps[i]! : target;
      i += 1;
      if (i > steps.length) window.clearInterval(timer);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  });

  /** The CLIP light follows the blend lab's rule, so the two never disagree about the same level. */
  const clip = $derived(hideMaster ? 'off' : clipState(shown));
</script>

<div class="bridge">
  <span class="name hw-label" aria-hidden="true">CH1</span>
  <span class="name hw-label" aria-hidden="true">Master</span>
  <span class="name hw-label" aria-hidden="true">CH2</span>

  <div class="ch">
    <LedMeter label="CH1" level={ch1} scale="right" />
  </div>

  <div class="mid">
    {#if hideMaster}
      <div class="dark" aria-hidden="true">
        <LedMeter label="MASTER" level={SILENT} stereo clip="off" scale="right" />
        <span class="unknown">?</span>
      </div>
      <span class="visually-hidden">MASTER meter: hidden until you answer.</span>
    {:else}
      <LedMeter label="MASTER" level={shown} stereo {clip} scale="right" />
    {/if}
  </div>

  <div class="ch">
    <LedMeter label="CH2" level={ch2} scale="none" />
  </div>

  <span class="unit" aria-hidden="true">dB</span>
  <span class="unit" aria-hidden="true">dB</span>
</div>

<style>
  /*
   * One black well holding all three meters, like the real panel. The shared meters bring their
   * own names and wells; here the names move to one row above and the wells merge into ours.
   */
  .bridge {
    display: grid;
    grid-template-columns: auto auto auto;
    grid-template-rows: auto auto auto;
    justify-content: center;
    column-gap: 0.55rem;
    row-gap: 0.25rem;
    align-items: end;
    justify-items: center;
    padding: 0.75rem 0.65rem 0.5rem;
    border: 1px solid var(--hw-edge);
    border-radius: var(--radius-control);
    background: var(--hw-sunk);
  }

  .name {
    font-size: 0.72rem;
  }

  .bridge :global(.meter) {
    padding: 0;
    background: none;
    --led-h: 0.45rem;
  }

  .bridge :global(.meter > .name) {
    display: none;
  }

  /* Grids, so each meter is a grid item and no line box adds space above it. */
  .ch,
  .mid {
    display: grid;
    justify-items: center;
  }

  .ch :global(.meter) {
    --led-w: 0.95rem;
  }

  .mid :global(.meter) {
    --led-w: 0.8rem;
  }

  /* A grid, not a block, so the hidden meter sits exactly where the revealed one will. */
  .dark {
    position: relative;
    display: grid;
  }

  /* Over the two LED columns: below the CLIP legend, clear of the printed scale on their right. */
  .unknown {
    position: absolute;
    inset: 1.3rem 1.45rem 0 0;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 2.4rem;
    line-height: 1;
    color: var(--hw-label);
  }

  /* Printed on the panel, like the scale it belongs to. */
  .unit {
    grid-row: 3;
    font-family: var(--font-label);
    font-size: 0.66rem;
    font-weight: 650;
    color: var(--hw-label-2);
  }

  /* Each "dB" sits under the scale column to the right of its meter. */
  .unit:nth-last-of-type(2) {
    grid-column: 1;
    justify-self: end;
  }

  .unit:last-of-type {
    grid-column: 2;
    justify-self: end;
  }

</style>
