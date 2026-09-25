<script lang="ts">
  /**
   * Kicks lined up (a beatmatched blend) or apart (deck 2 a 16th note late): a two-position slide
   * switch with the positions printed under it, the same switch the listening test uses for what
   * you're listening on (hear-it/Choice). Native radio buttons underneath.
   */
  import { KICKS } from '../../lib/blend/copy';
  import Choice from '../hear-it/Choice.svelte';

  interface Props {
    aligned: boolean;
    /** Name for the radio group, unique on the page. */
    name: string;
  }

  let { aligned = $bindable(), name }: Props = $props();

  type Kicks = 'lined' | 'apart';
  const options: ReadonlyArray<{ value: Kicks; label: string; detail?: string }> = [
    { value: 'lined', label: KICKS.lined },
    { value: 'apart', label: KICKS.apart, detail: KICKS.apartDetail },
  ];
</script>

<Choice
  {name}
  legend={KICKS.legend}
  {options}
  value={aligned ? 'lined' : 'apart'}
  onchange={(kicks) => (aligned = kicks === 'lined')}
/>
