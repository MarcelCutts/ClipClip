<script lang="ts">
  /**
   * The meter check's picture of the XDJ-RX2's meter section: the blend lab's well
   * (blend/MeterBridge), drawn small. Every reading also reaches screen readers as text.
   *
   * With `hideMaster`, the middle meters stay dark behind a question mark until the reader has
   * answered; when they're revealed they climb to their level one LED at a time (instantly with
   * reduced motion), so the reader sees where the blend goes.
   */
  import { untrack } from 'svelte';
  import { clipState } from '../../lib/blend/model';
  import { METER_SEGMENTS } from '../../lib/xdj';
  import Well from '../blend/MeterBridge.svelte';

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

<Well size="card" {ch1} master={shown} {ch2} {clip} {hideMaster} />
