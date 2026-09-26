<script lang="ts">
  /**
   * The meter check's picture of the XDJ-RX2's meter section: the blend lab's well
   * (blend/MeterBridge), drawn small. Every reading also reaches screen readers as text.
   */
  import { clipState } from '../../lib/blend/model';
  import Well from '../blend/MeterBridge.svelte';

  interface Props {
    ch1: number;
    master: number;
    ch2: number;
  }

  let { ch1, master, ch2 }: Props = $props();

  /** The CLIP light follows the blend lab's rule, so the two never disagree about the same level. */
  const clip = $derived(clipState(master));
</script>

<Well size="card" {ch1} {master} {ch2} {clip} />
